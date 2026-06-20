import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as txnService from '../services/transaction.service.js';

export const createTransaction = asyncHandler(async (req, res) => {
  const result = await txnService.createTransaction(req.user._id, req.body);

  const message = result.fraudResult?.isFlagged
    ? 'Transaction recorded. This transaction has been flagged for review.'
    : 'Transaction recorded successfully.';

  return res
    .status(201)
    .json(new ApiResponse(201, result, message));
});

export const transferFunds = asyncHandler(async (req, res) => {
  const result = await txnService.transferFunds(req.user._id, req.body);

  const message = result.fraudResult?.isFlagged
    ? 'Transfer successful. This transfer has been flagged for review.'
    : 'Transfer completed successfully.';

  return res
    .status(200)
    .json(new ApiResponse(200, result, message));
});

export const getTransactions = asyncHandler(async (req, res) => {
  const result = await txnService.getTransactions(req.user._id, req.query);

  return res
    .status(200)
    .json(new ApiResponse(200, result, 'Transactions fetched successfully.'));
});

export const getTransactionById = asyncHandler(async (req, res) => {
  const transaction = await txnService.getTransactionById(
    req.params.id,
    req.user._id
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { transaction }, 'Transaction fetched successfully.'));
});

export const getTransferHistory = asyncHandler(async (req, res) => {
  const transfers = await txnService.getTransferHistory(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, { transfers }, 'Transfer history fetched successfully.'));
});