import { Router } from 'express';
import * as accountController from '../controllers/account.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  createAccountValidationRules,
  updateAccountValidationRules,
  accountIdParamRule,
} from '../validators/account.validators.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

// All account routes require authentication
// Apply verifyJWT at router level instead of per-route
// WHY? Every route here is protected — no point repeating it.
// This is called "router-level middleware"
router.use(verifyJWT);

router
  .route('/')
  .post(createAccountValidationRules, validate, accountController.createAccount)
  .get(accountController.getAllAccounts);

router
  .route('/:id')
  .get(accountIdParamRule, validate, accountController.getAccountById)
  .put(accountIdParamRule, updateAccountValidationRules, validate, accountController.updateAccount)
  .delete(accountIdParamRule, validate, accountController.deleteAccount);

export default router;