const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const investmentController = require('../controllers/investment.controller');
const { authenticateJWT, isAdmin } = require('../middleware/auth.middleware');

// Input validation
const validateCreateInvestment = [
  body('propertyId').isUUID().withMessage('Valid property ID is required'),
  body('shares').isInt({ min: 1 }).withMessage('Must invest in at least 1 share'),
  body('paymentMethodId').isString().withMessage('Payment method ID is required'),
];

// Protected routes (require authentication)
router.use(authenticateJWT);

// Investment routes
router.post('/', validateCreateInvestment, investmentController.createInvestment);
router.get('/', [
  query('status').optional().isIn(['pending', 'completed', 'failed', 'cancelled']),
  query('propertyId').optional().isUUID(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
], investmentController.getInvestments);

router.get('/:id', investmentController.getInvestmentById);
router.post('/:id/cancel', investmentController.cancelInvestment);

// Admin-only routes
router.get('/admin/all', isAdmin, [
  query('status').optional().isIn(['pending', 'completed', 'failed', 'cancelled']),
  query('userId').optional().isUUID(),
  query('propertyId').optional().isUUID(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
], investmentController.adminGetAllInvestments);

router.put('/:id/status', isAdmin, [
  body('status').isIn(['completed', 'failed', 'cancelled']).withMessage('Invalid status'),
  body('notes').optional().isString(),
], investmentController.updateInvestmentStatus);

// Investment withdrawal
router.post('/:id/withdraw', [
  body('amount').isFloat({ min: 1 }).withMessage('Valid withdrawal amount is required'),
  body('bankAccountId').isString().withMessage('Bank account ID is required'),
], investmentController.requestWithdrawal);

module.exports = router;
