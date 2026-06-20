import { body, query, param } from 'express-validator';
import mongoose from 'mongoose';

export const createTransactionRules = [
  body('accountId')
    .notEmpty().withMessage('Account ID is required')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('Invalid account ID'),

  body('type')
    .notEmpty().withMessage('Transaction type is required')
    .isIn(['credit', 'debit'])
    .withMessage('Manual transactions must be credit or debit. Use /transfers for transfers.'),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 0.01 }).withMessage('Amount must be greater than 0'),

  body('category')
    .notEmpty().withMessage('Category is required')
    .isIn([
      'salary', 'food', 'transport', 'shopping',
      'utilities', 'entertainment', 'healthcare',
      'education', 'transfer', 'other'
    ]).withMessage('Invalid category'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 }).withMessage('Description cannot exceed 200 characters'),

  body('channel')
    .optional()
    .isIn(['online', 'atm', 'branch', 'mobile', 'pos'])
    .withMessage('Invalid payment channel'),
];

export const transferValidationRules = [
  body('fromAccountId')
    .notEmpty().withMessage('Source account is required')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('Invalid source account ID'),

  body('toAccountId')
    .notEmpty().withMessage('Destination account is required')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('Invalid destination account ID')
    .custom((value, { req }) => {
      // Prevent transferring to the same account
      if (value === req.body.fromAccountId) {
        throw new Error('Source and destination accounts cannot be the same.');
      }
      return true;
    }),

  body('amount')
    .notEmpty().withMessage('Amount is required')
    .isFloat({ min: 1 }).withMessage('Minimum transfer amount is ₹1'),

  body('description')
    .optional()
    .trim()
    .isLength({ max: 200 }),
];

export const transactionFilterRules = [
  query('accountId')
    .optional()
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('Invalid account ID'),

  query('type')
    .optional()
    .isIn(['credit', 'debit', 'transfer']),

  query('category')
    .optional()
    .isIn([
      'salary', 'food', 'transport', 'shopping',
      'utilities', 'entertainment', 'healthcare',
      'education', 'transfer', 'other'
    ]),

  query('startDate')
    .optional()
    .isISO8601().withMessage('startDate must be a valid ISO date'),

  query('endDate')
    .optional()
    .isISO8601().withMessage('endDate must be a valid ISO date'),

  query('minAmount')
    .optional()
    .isFloat({ min: 0 }),

  query('maxAmount')
    .optional()
    .isFloat({ min: 0 }),

  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
];

export const transactionIdParamRule = [
  param('id')
    .custom((v) => mongoose.Types.ObjectId.isValid(v))
    .withMessage('Invalid transaction ID'),
];