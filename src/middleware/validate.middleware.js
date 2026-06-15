import { validationResult } from 'express-validator';
import { ApiError } from '../utils/ApiError.js';

// This middleware runs AFTER express-validator checks
// It collects all validation errors and throws one clean ApiError
// Pattern: define rules in routes, enforce them here, controllers stay clean

export const validate = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => err.msg);
    throw new ApiError(400, 'Validation failed', errorMessages);
  }

  next();
};