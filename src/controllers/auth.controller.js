import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import * as authService from '../services/auth.service.js';

// Controllers are intentionally thin — they:
// 1. Extract data from req
// 2. Call service
// 3. Send response
// Business logic? Zero. That's the service's job.

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const { user, token } = await authService.registerUser({
    name,
    email,
    password,
  });

  return res
    .status(201)
    .json(new ApiResponse(201, { user, token }, 'Account created successfully.'));
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { user, token } = await authService.loginUser({ email, password });

  return res
    .status(200)
    .json(new ApiResponse(200, { user, token }, 'Login successful.'));
});

export const logout = asyncHandler(async (req, res) => {
  // With JWT, logout is client-side — delete the token from storage
  // WHY? JWTs are stateless. Server has no session to destroy.
  // For true server-side invalidation you'd maintain a token blacklist in Redis.
  // Mention this as a "future improvement" — it shows senior-level awareness.
  return res
    .status(200)
    .json(new ApiResponse(200, {}, 'Logged out successfully.'));
});

export const getMe = asyncHandler(async (req, res) => {
  // req.user already attached by verifyJWT middleware
  const user = await authService.getMe(req.user._id);

  return res
    .status(200)
    .json(new ApiResponse(200, { user }, 'User profile fetched.'));
});