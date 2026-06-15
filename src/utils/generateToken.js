import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// WHY a separate utility?
// Token generation logic might change (e.g., adding refresh tokens later).
// Keeping it isolated means you change it in one place.

export const generateToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });
};

// payload shape we'll use: { userId, role }
// WHY not include email/name in payload?
// Minimize data in token. If role changes, token reflects old role until expiry.
// For production you'd use short-lived access tokens + refresh tokens.
// For this project, 7-day token is acceptable — mention the tradeoff in interviews.