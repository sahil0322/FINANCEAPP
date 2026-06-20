import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js';
import { authorizeRoles } from '../middleware/role.middleware.js';
import { body, param } from 'express-validator';
import { validate } from '../middleware/validate.middleware.js';

const router = Router();

// CRITICAL: Apply BOTH middlewares to every route in this router
// verifyJWT confirms identity, authorizeRoles confirms permission
// Order matters — verifyJWT MUST run first since authorizeRoles reads req.user
router.use(verifyJWT, authorizeRoles('admin'));

router.get('/stats', adminController.getPlatformStats);

router.get('/users', adminController.getAllUsers);
router.get('/users/:id', adminController.getUserDetail);

router.patch(
  '/users/:id/status',
  [
    param('id').isMongoId().withMessage('Invalid user ID'),
    body('isActive').isBoolean().withMessage('isActive must be true or false'),
  ],
  validate,
  adminController.setUserStatus
);

router.get('/transactions', adminController.getAllTransactions);

router.get('/fraud-alerts', adminController.getAllFraudAlerts);
router.patch(
  '/fraud-alerts/:id',
  [
    param('id').isMongoId().withMessage('Invalid alert ID'),
    body('alertStatus').isIn(['reviewed', 'dismissed', 'escalated']),
  ],
  validate,
  adminController.reviewFraudAlert
);

export default router;