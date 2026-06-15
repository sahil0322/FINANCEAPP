import { body, param } from 'express-validator';
import mongoose from 'mongoose';

export const createAccountValidationRules = [
  body('bankName')
    .trim()
    .notEmpty().withMessage('Bank name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Bank name must be between 2 and 100 characters'),

  body('accountHolderName')
    .trim()
    .notEmpty().withMessage('Account holder name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

  body('accountType')
    .notEmpty().withMessage('Account type is required')
    .isIn(['savings', 'current', 'salary', 'fixed_deposit'])
    .withMessage('Invalid account type'),

  body('accountNumberLast4')
    .notEmpty().withMessage('Last 4 digits of account number are required')
    .matches(/^\d{4}$/).withMessage('Must be exactly 4 numeric digits'),

  body('initialBalance')
    .optional()
    .isFloat({ min: 0 }).withMessage('Initial balance must be a positive number'),
];

export const updateAccountValidationRules = [
  body('bankName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Bank name must be between 2 and 100 characters'),

  body('accountHolderName')
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),

  body('accountType')
    .optional()
    .isIn(['savings', 'current', 'salary', 'fixed_deposit'])
    .withMessage('Invalid account type'),

  // WHY disallow balance updates directly?
  // Balance must ONLY change through transactions and transfers.
  // Direct balance edits would break the audit trail entirely.
  // This is a great point to raise in interviews unprompted.
  body('balance')
    .not().exists()
    .withMessage('Balance cannot be updated directly. Use transactions instead.'),
];

export const accountIdParamRule = [
  param('id')
    .custom((value) => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid account ID format'),
];