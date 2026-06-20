import { Router } from 'express';
import * as exportController from '../controllers/export.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { query } from 'express-validator';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();
router.use(verifyJWT);

const exportValidation = [
  query('accountId').optional().isMongoId().withMessage('Invalid account ID'),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601(),
];

router.get('/csv', exportValidation, validate, exportController.exportCSV);
router.get('/pdf', exportValidation, validate, exportController.exportPDF);

export default router;