import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.model.js';
import { Account } from '../models/Account.model.js';
import { Transfer } from '../models/Transfer.model.js';
import { ApiError } from '../utils/ApiError.js';
import { runFraudCheck } from './fraud.service.js';

// ─────────────────────────────────────────────
// HELPER: verify account belongs to user and is active
// ─────────────────────────────────────────────
const getOwnedAccount = async (accountId, userId, session = null) => {
  const options = session ? { session } : {};
  // findOne inside session ensures we read the latest committed data
  const account = await Account.findOne(
    { _id: accountId, userId, isActive: true },
    null,
    options
  );

  if (!account) {
    throw new ApiError(404, 'Account not found or access denied.');
  }
  return account;
};

// ─────────────────────────────────────────────
// CREATE MANUAL TRANSACTION
// (credit or debit — no transfer)
// ─────────────────────────────────────────────
export const createTransaction = async (userId, data) => {
  const { accountId, type, amount, category, description, channel = 'online' } = data;

  // Verify ownership
  const account = await getOwnedAccount(accountId, userId);

  // Business rule: prevent overdraft on debit
  if (type === 'debit' && account.balance < amount) {
    throw new ApiError(400, `Insufficient balance. Available: ₹${account.balance}`);
  }

  // Update balance using atomic $inc
  // WHY $inc instead of account.balance += amount then save()?
  // $inc is a single atomic DB operation — no race condition possible.
  // If two requests hit simultaneously, $inc handles both correctly.
  // account.balance += amount is a read-modify-write — vulnerable to race conditions.
  const balanceDelta = type === 'credit' ? amount : -amount;

  await Account.findByIdAndUpdate(
    accountId,
    { $inc: { balance: balanceDelta } }
  );

  // Create the transaction record
  const transaction = await Transaction.create({
    userId,
    accountId,
    type,
    amount,
    category,
    description,
    status: 'success',
    channel,
  });

  // Run fraud check asynchronously after creation
  // Only check debits — credits are incoming money (lower risk)
  if (type === 'debit') {
    const fraudResult = await runFraudCheck(transaction);
    return { transaction, fraudResult };
  }

  return { transaction, fraudResult: null };
};

// ─────────────────────────────────────────────
// FUND TRANSFER — THE STAR OF THE SHOW
// Uses MongoDB sessions for atomic operations
// ─────────────────────────────────────────────
export const transferFunds = async (userId, data) => {
  const { fromAccountId, toAccountId, amount, description } = data;

  // Start a MongoDB session
  // WHY? A session groups multiple operations under one transaction context.
  // Without it, if the credit succeeds and the debit fails, money appears from nowhere.
  const session = await mongoose.startSession();

  // We'll store the result to return after session ends
  let result;

  try {
    // withTransaction handles:
    // - Starting the transaction
    // - Committing on success
    // - Aborting on any error
    // - Retrying on transient errors (network blips, write conflicts)
    await session.withTransaction(async () => {

      // ── Step 1: Verify sender owns the fromAccount ──────────────
      const fromAccount = await getOwnedAccount(fromAccountId, userId, session);

      // ── Step 2: Verify toAccount exists and is active ────────────
      // Note: toAccount doesn't need to belong to this user
      // (future feature: transfer to another user's account)
      const toAccount = await Account.findOne(
        { _id: toAccountId, isActive: true },
        null,
        { session }
      );

      if (!toAccount) {
        throw new ApiError(404, 'Destination account not found or inactive.');
      }

      // ── Step 3: Sufficient balance check ─────────────────────────
      if (fromAccount.balance < amount) {
        throw new ApiError(
          400,
          `Insufficient balance. Available: ₹${fromAccount.balance}, Required: ₹${amount}`
        );
      }

      // ── Step 4: Create Transfer document (pending) ────────────────
      // Create it first so we have an ID to reference in transactions
      const [transfer] = await Transfer.create(
        [{
          fromAccountId,
          toAccountId,
          initiatedBy: userId,
          amount,
          status: 'pending',
        }],
        { session }
      );

      // ── Step 5: Create DEBIT transaction for sender ───────────────
      const [debitTxn] = await Transaction.create(
        [{
          userId,
          accountId: fromAccountId,
          type: 'debit',
          amount,
          category: 'transfer',
          description: description || `Transfer to account ending in ${toAccount.accountNumberLast4}`,
          status: 'success',
          channel: 'online',
          transferId: transfer._id,
        }],
        { session }
      );

      // ── Step 6: Create CREDIT transaction for receiver ────────────
      const [creditTxn] = await Transaction.create(
        [{
          userId: toAccount.userId,
          accountId: toAccountId,
          type: 'credit',
          amount,
          category: 'transfer',
          description: description || `Transfer from account ending in ${fromAccount.accountNumberLast4}`,
          status: 'success',
          channel: 'online',
          transferId: transfer._id,
        }],
        { session }
      );

      // ── Step 7: Deduct from sender using atomic $inc ──────────────
      await Account.findByIdAndUpdate(
        fromAccountId,
        { $inc: { balance: -amount } },
        { session }
      );

      // ── Step 8: Credit to receiver using atomic $inc ──────────────
      await Account.findByIdAndUpdate(
        toAccountId,
        { $inc: { balance: amount } },
        { session }
      );

      // ── Step 9: Update Transfer document with txn references ──────
      await Transfer.findByIdAndUpdate(
        transfer._id,
        {
          status: 'success',
          debitTransactionId: debitTxn._id,
          creditTransactionId: creditTxn._id,
        },
        { session }
      );

      // ── Step 10: Run fraud check on debit transaction ─────────────
      // Fraud check runs INSIDE the session so the alert is part of the same transaction
      const fraudResult = await runFraudCheck(debitTxn, session);

      result = {
        transfer: { ...transfer.toObject(), status: 'success' },
        debitTransaction: debitTxn,
        creditTransaction: creditTxn,
        fraudResult,
      };

    }); // withTransaction auto-commits here if no errors were thrown

    return result;

  } catch (error) {
    // If error is our ApiError, re-throw it cleanly
    // withTransaction already aborted — all changes rolled back
    if (error.statusCode) throw error;
    throw new ApiError(500, `Transfer failed: ${error.message}`);

  } finally {
    // Always end the session — prevents connection pool exhaustion
    session.endSession();
  }
};

// ─────────────────────────────────────────────
// GET TRANSACTIONS WITH FILTERING + PAGINATION
// ─────────────────────────────────────────────
export const getTransactions = async (userId, queryParams) => {
  const {
    accountId,
    type,
    category,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    isFlagged,
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
  } = queryParams;

  // Build filter dynamically — only include fields that were provided
  // WHY dynamic filter? You can't know upfront which filters the client will use.
  const filter = { userId };

  if (accountId) filter.accountId = accountId;
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (isFlagged !== undefined) filter.isFlagged = isFlagged === 'true';

  // Date range filter
  if (startDate || endDate) {
    filter.createdAt = {};
    if (startDate) filter.createdAt.$gte = new Date(startDate);
    if (endDate) {
      // Set to end of day so "endDate=2024-01-31" includes all of Jan 31
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }

  // Amount range filter
  if (minAmount || maxAmount) {
    filter.amount = {};
    if (minAmount) filter.amount.$gte = parseFloat(minAmount);
    if (maxAmount) filter.amount.$lte = parseFloat(maxAmount);
  }

  const sortOptions = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
  const skip = (parseInt(page) - 1) * parseInt(limit);

  // Run count and data fetch concurrently
  // WHY count separately? MongoDB's countDocuments with the same filter
  // gives accurate total for pagination metadata.
  const [transactions, totalCount] = await Promise.all([
    Transaction.find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('accountId', 'bankName accountNumberLast4 accountType'),
    Transaction.countDocuments(filter),
  ]);

  return {
    transactions,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalCount / parseInt(limit)),
      totalTransactions: totalCount,
      hasNextPage: skip + transactions.length < totalCount,
      hasPrevPage: parseInt(page) > 1,
    },
  };
};

// ─────────────────────────────────────────────
// GET SINGLE TRANSACTION
// ─────────────────────────────────────────────
export const getTransactionById = async (transactionId, userId) => {
  const transaction = await Transaction.findOne({
    _id: transactionId,
    userId,
  }).populate('accountId', 'bankName accountNumberLast4');

  if (!transaction) {
    throw new ApiError(404, 'Transaction not found.');
  }

  return transaction;
};

// ─────────────────────────────────────────────
// GET TRANSFER HISTORY
// ─────────────────────────────────────────────
export const getTransferHistory = async (userId) => {
  const transfers = await Transfer.find({ initiatedBy: userId })
    .sort({ createdAt: -1 })
    .populate('fromAccountId', 'bankName accountNumberLast4')
    .populate('toAccountId', 'bankName accountNumberLast4')
    .limit(50);

  return transfers;
};