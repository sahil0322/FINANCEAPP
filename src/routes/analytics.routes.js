import { Router } from 'express';
import * as analyticsController from '../controllers/analytics.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { query } from 'express-validator';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();
router.use(verifyJWT);

// Query param validation inline for simple rules
const yearValidation = [
  query('year')
    .optional()
    .isInt({ min: 2000, max: 2100 })
    .withMessage('Year must be a valid 4-digit year'),
];

const periodValidation = [
  query('period')
    .optional()
    .isIn(['7', '30', '90', '180', '365'])
    .withMessage('Period must be 7, 30, 90, 180, or 365 days'),
];

const daysValidation = [
  query('days')
    .optional()
    .isInt({ min: 7, max: 365 })
    .withMessage('Days must be between 7 and 365'),
];

router.get('/summary', analyticsController.getDashboardSummary);
router.get('/monthly', yearValidation, validate, analyticsController.getMonthlyAnalytics);
router.get('/category', periodValidation, validate, analyticsController.getCategoryAnalytics);
router.get('/trend', daysValidation, validate, analyticsController.getSpendingTrend);
router.get('/accounts', analyticsController.getAccountBalanceSummary);
router.get('/fraud-alerts', analyticsController.getFraudAlertsSummary);

export default router;