import { Router } from 'express';
import * as txnController from '../controllers/transaction.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';
import {
  createTransactionRules,
  transferValidationRules,
  transactionFilterRules,
  transactionIdParamRule,
} from '../validators/transaction.validators.js';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();
router.use(verifyJWT);

// Transaction routes
router.post('/', createTransactionRules, validate, txnController.createTransaction);
router.get('/', transactionFilterRules, validate, txnController.getTransactions);
router.get('/:id', transactionIdParamRule, validate, txnController.getTransactionById);

// Transfer routes
router.post('/transfer', transferValidationRules, validate, txnController.transferFunds);
router.get('/transfers/history', txnController.getTransferHistory);

export default router;