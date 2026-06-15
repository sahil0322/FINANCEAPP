import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as accountService from '../services/account.service.js';

// Notice how thin these are.
// No business logic. No DB calls. Just req → service → res.

export const createAccount = asyncHandler(async (req, res) => {
  const account = await accountService.createAccount(req.user._id, req.body);

  return res
    .status(201)
    .json(new ApiResponse(201, { account }, 'Bank account added successfully.'));
});

export const getAllAccounts = asyncHandler(async (req, res) => {
  const data = await accountService.getAllAccounts(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, data, 'Accounts fetched successfully.'));
});

export const getAccountById = asyncHandler(async (req, res) => {
  const data = await accountService.getAccountById(req.params.id, req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, data, 'Account details fetched successfully.'));
});

export const updateAccount = asyncHandler(async (req, res) => {
  const account = await accountService.updateAccount(
    req.params.id,
    req.user._id,
    req.body
  );

  return res
    .status(200)
    .json(new ApiResponse(200, { account }, 'Account updated successfully.'));
});

export const deleteAccount = asyncHandler(async (req, res) => {
  const result = await accountService.deleteAccount(req.params.id, req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, result, result.message));
});