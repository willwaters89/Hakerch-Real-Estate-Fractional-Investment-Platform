const express = require('express');
const router = express.Router();
const { query } = require('express-validator');
const portfolioController = require('../controllers/portfolio.controller');
const { authenticateJWT } = require('../middleware/auth.middleware');

// Protected routes (require authentication)
// router.use(authenticateJWT); // Temporarily disabled for testing

// Portfolio summary and performance
router.get('/summary', portfolioController.getPortfolioSummary);
router.get('/performance', [
  query('period').optional().isIn(['1m', '3m', '6m', '1y', 'all']),
], portfolioController.getPortfolioPerformance);

// Portfolio investments
router.get('/investments', [
  query('status').optional().isIn(['active', 'completed', 'pending', 'cancelled']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
], portfolioController.getInvestments);

// Portfolio transactions
router.get('/transactions', [
  query('type').optional().isIn(['investment', 'withdrawal', 'dividend', 'all']),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
], portfolioController.getTransactions);

// Portfolio documents
router.get('/documents', portfolioController.getDocuments);

// Watchlist routes
router.get('/watchlist', portfolioController.getWatchlist);
router.post('/watchlist/:propertyId', portfolioController.addToWatchlist);
router.delete('/watchlist/:propertyId', portfolioController.removeFromWatchlist);

module.exports = router;