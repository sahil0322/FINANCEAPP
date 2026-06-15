import jwt from 'jsonwebtoken';
import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

// verifyJWT: attaches the authenticated user to req.user
// Every protected route uses this middleware first
export const verifyJWT = asyncHandler(async (req, res, next) => {
  // JWT is sent in the Authorization header as: "Bearer <token>"
  // WHY Authorization header vs cookies?
  // Header-based tokens work well for APIs consumed by mobile apps too.
  // For web-only apps, httpOnly cookies are more secure (XSS resistant).
  // Mention this tradeoff confidently in interviews.

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Extract token after "Bearer"

  if (!token) {
    throw new ApiError(401, 'Access denied. No token provided.');
  }

  try {
    // jwt.verify throws if token is expired OR tampered with
    const decoded = jwt.verify(token, env.JWT_SECRET);

    // Re-fetch user from DB to get current role/active status
    // WHY not just trust the token payload?
    // If an admin disables an account, the token still has isActive: true
    // Fetching from DB catches this. Slight performance cost, worth the security.
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      throw new ApiError(401, 'Token is valid but user no longer exists.');
    }

    if (!user.isActive) {
      throw new ApiError(403, 'Account has been disabled. Contact support.');
    }

    req.user = user; // attach to request for downstream controllers
    next();

  } catch (error) {
    // Differentiate between token errors for better client-side handling
    if (error.name === 'TokenExpiredError') {
      throw new ApiError(401, 'Token has expired. Please log in again.');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new ApiError(401, 'Invalid token. Please log in again.');
    }
    throw error; // re-throw ApiErrors from above
  }
});