import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as adminService from '../services/admin.service.js';

export const getPlatformStats = asyncHandler(async (req, res) => {
  const stats = await adminService.getPlatformStats();
  return res.status(200).json(new ApiResponse(200, stats, 'Platform stats fetched.'));
});

export const getAllUsers = asyncHandler(async (req, res) => {
  const data = await adminService.getAllUsers(req.query);
  return res.status(200).json(new ApiResponse(200, data, 'Users fetched.'));
});

export const getUserDetail = asyncHandler(async (req, res) => {
  const data = await adminService.getUserDetail(req.params.id);
  return res.status(200).json(new ApiResponse(200, data, 'User detail fetched.'));
});

export const setUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await adminService.setUserStatus(req.params.id, isActive, req.user._id);

  const message = isActive ? 'User account enabled.' : 'User account disabled.';
  return res.status(200).json(new ApiResponse(200, { user }, message));
});

export const getAllTransactions = asyncHandler(async (req, res) => {
  const data = await adminService.getAllTransactionsAdmin(req.query);
  return res.status(200).json(new ApiResponse(200, data, 'Transactions fetched.'));
});

export const getAllFraudAlerts = asyncHandler(async (req, res) => {
  const data = await adminService.getAllFraudAlerts(req.query);
  return res.status(200).json(new ApiResponse(200, data, 'Fraud alerts fetched.'));
});

export const reviewFraudAlert = asyncHandler(async (req, res) => {
  const alert = await adminService.reviewFraudAlert(
    req.params.id,
    req.user._id,
    req.body
  );
  return res.status(200).json(new ApiResponse(200, { alert }, 'Fraud alert updated.'));
});