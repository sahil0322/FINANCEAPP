import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  registerValidationRules,
  loginValidationRules,
} from '../validators/auth.validators.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

// Public routes
router.post(
  '/register',
  registerValidationRules, // 1. Run validation rules
  validate,                // 2. Check for errors
  authController.register  // 3. Execute controller
);

router.post(
  '/login',
  loginValidationRules,
  validate,
  authController.login
);

// Protected routes — verifyJWT runs first, blocks if invalid
router.post('/logout', verifyJWT, authController.logout);
router.get('/me', verifyJWT, authController.getMe);

export default router;