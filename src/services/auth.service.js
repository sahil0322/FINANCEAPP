import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';
import { generateToken } from '../utils/generateToken.js';

// WHY a service layer?
// Controllers handle HTTP. Services handle business logic.
// If you later add a CLI tool or a cron job that needs to register a user,
// it calls the service directly — no HTTP layer involved.
// This is the single most important architecture decision to explain in interviews.

export const registerUser = async ({ name, email, password }) => {
  // Step 1: Check if user already exists
  // WHY check here instead of relying on unique index error?
  // Mongoose unique index throws a generic error (code 11000).
  // We want a clean, readable error message for the client.
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, 'An account with this email already exists.');
  }

  // Step 2: Create user — password hashing happens in the pre-save hook
  // We deliberately don't hash here so the model stays the single source of truth
  const user = await User.create({ name, email, password });

  // Step 3: Generate token
  const token = generateToken({ userId: user._id, role: user.role });

  // Step 4: Return safe user object (no password)
  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  return { user: userResponse, token };
};

export const loginUser = async ({ email, password }) => {
  // Step 1: Find user and explicitly select password (it's select:false in schema)
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    // SECURITY: Don't say "email not found" — that leaks whether an email is registered
    // Always use a generic message for auth failures
    throw new ApiError(401, 'Invalid email or password.');
  }

  // Step 2: Check account status before password comparison
  // Fail fast — no point checking password if account is disabled
  if (!user.isActive) {
    throw new ApiError(403, 'Your account has been disabled. Please contact support.');
  }

  // Step 3: Compare password using bcrypt instance method we defined on schema
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  // Step 4: Generate token and return
  const token = generateToken({ userId: user._id, role: user.role });

  const userResponse = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  return { user: userResponse, token };
};

export const getMe = async (userId) => {
  // req.user is already attached by middleware but we re-fetch
  // to always return fresh data (e.g., name update)
  const user = await User.findById(userId);
  if (!user) {
    throw new ApiError(404, 'User not found.');
  }
  return user;
};