import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as analyticsService from '../services/analytics.service.js';

export const getDashboardSummary = asyncHandler(async (req, res) => {
  const data = await analyticsService.getDashboardSummary(req.user._id);
  return res
    .status(200)
    .json(new ApiResponse(200, data, 'Dashboard summary fetched.'));
});

export const getMonthlyAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getMonthlyAnalytics(
    req.user._id,
    req.query.year
  );
  return res
    .status(200)
    .json(new ApiResponse(200, data, 'Monthly analytics fetched.'));
});

export const getCategoryAnalytics = asyncHandler(async (req, res) => {
  const data = await analyticsService.getCategoryAnalytics(
    req.user._id,
    req.query.period
  );
  return res
    .status(200)
    .json(new ApiResponse(200, data, 'Category analytics fetched.'));
});

export const getSpendingTrend = asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const data = await analyticsService.getSpendingTrend(req.user._id, days);
  return res
    .status(200)
    .json(new ApiResponse(200, data, 'Spending trend fetched.'));
});

export const getAccountBalanceSummary = asyncHandler(async (req, res) => {
  const data = await analyticsService.getAccountBalanceSummary(req.user._id);
  return res
    .status(200)
    .json(new ApiResponse(200, data, 'Account balance summary fetched.'));
});

export const getFraudAlertsSummary = asyncHandler(async (req, res) => {
  const data = await analyticsService.getFraudAlertsSummary(req.user._id);
  return res
    .status(200)
    .json(new ApiResponse(200, data, 'Fraud alerts fetched.'));
});