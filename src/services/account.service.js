import { Account } from '../models/Account.model.js';
import { Transaction } from '../models/Transaction.model.js';
import { ApiError } from '../utils/ApiError.js';

// ─────────────────────────────────────────────
// HELPER: Ownership verification
// Extracted as a reusable function because every
// operation needs it. DRY principle in action.
// ─────────────────────────────────────────────
const verifyAccountOwnership = async (accountId, userId) => {
  const account = await Account.findById(accountId);

  if (!account) {
    throw new ApiError(404, 'Account not found.');
  }

  // toString() because Mongoose ObjectId !== plain string
  if (account.userId.toString() !== userId.toString()) {
    // Return 404, not 403 — don't confirm the resource exists to unauthorized users
    // This is called "security through obscurity" at the resource level
    // A 403 tells an attacker "this exists but you can't access it"
    // A 404 tells them nothing useful
    throw new ApiError(404, 'Account not found.');
  }

  return account;
};

// ─────────────────────────────────────────────
// CREATE ACCOUNT
// ─────────────────────────────────────────────
export const createAccount = async (userId, accountData) => {
  const { bankName, accountHolderName, accountType, accountNumberLast4, initialBalance = 0 } = accountData;

  // Business rule: max 5 accounts per user
  // WHY? Prevents abuse, mirrors real banking limits.
  // Shows interviewers you think about business constraints, not just code.
  const accountCount = await Account.countDocuments({ userId, isActive: true });
  if (accountCount >= 5) {
    throw new ApiError(400, 'Maximum of 5 bank accounts allowed per user.');
  }

  const account = await Account.create({
    userId,
    bankName,
    accountHolderName,
    accountType,
    accountNumberLast4,
    balance: initialBalance,
  });

  // If initial balance > 0, create an opening credit transaction
  // WHY? Every rupee must be accounted for in the transaction history.
  // Balance should never change without a corresponding transaction record.
  // This is called double-entry bookkeeping awareness — big interview point.
  if (initialBalance > 0) {
    await Transaction.create({
      userId,
      accountId: account._id,
      type: 'credit',
      amount: initialBalance,
      category: 'other',
      description: 'Opening balance',
      status: 'success',
      channel: 'branch',
    });
  }

  return account;
};

// ─────────────────────────────────────────────
// GET ALL ACCOUNTS + PORTFOLIO SUMMARY
// ─────────────────────────────────────────────
export const getAllAccounts = async (userId) => {
  // Use aggregation pipeline to compute summary stats in one DB round-trip
  // WHY aggregation over find + JS reduce?
  // For 5 accounts it barely matters. For 50,000 users with 3 accounts each,
  // doing math in the DB vs. in Node.js is the difference between O(1) and O(n).
  // This kind of answer makes interviewers very happy.

  const summaryPipeline = [
    {
      $match: {
        userId: new (await import('mongoose')).default.Types.ObjectId(userId),
        isActive: true,
      },
    },
    {
      $group: {
        _id: null,
        totalBalance: { $sum: '$balance' },
        totalAccounts: { $sum: 1 },
        avgBalance: { $avg: '$balance' },
      },
    },
  ];

  const [accounts, summaryResult] = await Promise.all([
    Account.find({ userId, isActive: true }).sort({ createdAt: -1 }),
    Account.aggregate(summaryPipeline),
  ]);

  // WHY Promise.all? Run both queries concurrently, not sequentially.
  // Sequential: 200ms + 150ms = 350ms
  // Concurrent: max(200ms, 150ms) = 200ms
  // Always parallelize independent async operations.

  const summary = summaryResult[0] || {
    totalBalance: 0,
    totalAccounts: 0,
    avgBalance: 0,
  };

  return {
    accounts,
    summary: {
      totalBalance: summary.totalBalance,
      totalAccounts: summary.totalAccounts,
      avgBalance: Math.round(summary.avgBalance || 0),
    },
  };
};

// ─────────────────────────────────────────────
// GET SINGLE ACCOUNT WITH RECENT TRANSACTIONS
// ─────────────────────────────────────────────
export const getAccountById = async (accountId, userId) => {
  const account = await verifyAccountOwnership(accountId, userId);

  // Fetch last 10 transactions for this account
  const recentTransactions = await Transaction.find({ accountId })
    .sort({ createdAt: -1 })
    .limit(10)
    .select('type amount category description status createdAt');

  return { account, recentTransactions };
};

// ─────────────────────────────────────────────
// UPDATE ACCOUNT
// ─────────────────────────────────────────────
export const updateAccount = async (accountId, userId, updateData) => {
  // verifyOwnership first — always check before modifying
  await verifyAccountOwnership(accountId, userId);

  // findByIdAndUpdate with { new: true } returns the updated document
  // runValidators: true ensures schema validators run on update too
  // WHY mention this? By default Mongoose skips validators on update — a common gotcha
  const updatedAccount = await Account.findByIdAndUpdate(
    accountId,
    { $set: updateData },
    { new: true, runValidators: true }
  );

  return updatedAccount;
};

// ─────────────────────────────────────────────
// DELETE ACCOUNT (Soft Delete)
// ─────────────────────────────────────────────
export const deleteAccount = async (accountId, userId) => {
  const account = await verifyAccountOwnership(accountId, userId);

  // Business rule: cannot delete account with remaining balance
  // WHY? Money would disappear. User must transfer or withdraw first.
  // This enforces data integrity at the service layer, not just the DB.
  if (account.balance > 0) {
    throw new ApiError(
      400,
      `Cannot delete account with a remaining balance of ₹${account.balance}. Please transfer or withdraw funds first.`
    );
  }

  // SOFT DELETE — set isActive: false instead of removing the document
  // WHY soft delete?
  // 1. Transaction history references this accountId — hard delete breaks history
  // 2. Regulatory compliance — financial records must be retained
  // 3. Accidental deletion recovery
  // This is a critical concept: in financial systems, data is almost never hard-deleted.
  await Account.findByIdAndUpdate(accountId, { isActive: false });

  return { message: 'Account successfully deactivated.' };
};