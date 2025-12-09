const express = require('express');
const router = express.Router();
const { body, query } = require('express-validator');
const propertyController = require('../controllers/property.controller');
const { authenticateJWT, isAdmin } = require('../middleware/auth.middleware');

// Input validation
const validateCreateProperty = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('address').trim().notEmpty().withMessage('Address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('state').trim().notEmpty().withMessage('State is required'),
  body('zipCode').trim().notEmpty().withMessage('ZIP code is required'),
  body('country').trim().notEmpty().withMessage('Country is required'),
  body('propertyType').isIn(['residential', 'commercial', 'industrial', 'land']).withMessage('Invalid property type'),
  body('totalShares').isInt({ min: 1 }).withMessage('Total shares must be a positive integer'),
  body('pricePerShare').isFloat({ min: 1 }).withMessage('Price per share must be a positive number'),
  body('totalValue').isFloat({ min: 1 }).withMessage('Total value must be a positive number'),
  body('annualYield').isFloat({ min: 0 }).withMessage('Annual yield must be a non-negative number'),
  body('holdPeriod').isInt({ min: 1 }).withMessage('Hold period must be a positive integer'),
  body('status').isIn(['draft', 'active', 'sold', 'archived']).withMessage('Invalid status'),
];

const validateUpdateProperty = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().trim().notEmpty().withMessage('Description cannot be empty'),
  body('status').optional().isIn(['draft', 'active', 'sold', 'archived']).withMessage('Invalid status'),
  body('pricePerShare').optional().isFloat({ min: 1 }).withMessage('Price per share must be a positive number'),
  body('totalValue').optional().isFloat({ min: 1 }).withMessage('Total value must be a positive number'),
  body('annualYield').optional().isFloat({ min: 0 }).withMessage('Annual yield must be a non-negative number'),
];

// Public routes
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['draft', 'active', 'sold', 'archived']),
  query('propertyType').optional().isIn(['residential', 'commercial', 'industrial', 'land']),
  query('minYield').optional().isFloat({ min: 0 }).toFloat(),
  query('maxYield').optional().isFloat({ min: 0 }).toFloat(),
  query('minPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('maxPrice').optional().isFloat({ min: 0 }).toFloat(),
  query('sortBy').optional().isIn(['pricePerShare', 'annualYield', 'createdAt']),
  query('order').optional().isIn(['asc', 'desc']),
], propertyController.getAllProperties);

router.get('/:id', propertyController.getPropertyById);

// Protected routes (require authentication)
router.use(authenticateJWT);

// Admin-only routes
router.post('/', isAdmin, validateCreateProperty, propertyController.createProperty);
router.put('/:id', isAdmin, validateUpdateProperty, propertyController.updateProperty);
router.delete('/:id', isAdmin, propertyController.deleteProperty);

// Property images management
router.post('/:id/images', isAdmin, propertyController.uploadPropertyImages);
router.delete('/:id/images/:imageId', isAdmin, propertyController.deletePropertyImage);

// Property documents
router.post('/:id/documents', isAdmin, propertyController.uploadPropertyDocument);
router.delete('/:id/documents/:docId', isAdmin, propertyController.deletePropertyDocument);

// Property financials
router.get('/:id/financials', propertyController.getPropertyFinancials);
router.put('/:id/financials', isAdmin, propertyController.updatePropertyFinancials);

// Property timeline/updates
router.get('/:id/updates', propertyController.getPropertyUpdates);
router.post('/:id/updates', isAdmin, propertyController.addPropertyUpdate);

module.exports = router;
