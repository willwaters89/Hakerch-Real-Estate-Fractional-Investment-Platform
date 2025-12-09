const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const { logger } = require('../app');

// Mock data for testing
const mockPortfolio = {
  totalInvested: 25000,
  activeInvestments: 5,
  totalReturns: 1250,
  portfolioValue: 26250
};

const mockInvestments = [
  {
    id: 'inv_001',
    propertyId: 'prop_123',
    propertyName: 'Downtown Apartment Complex',
    amount: 10000,
    shares: 100,
    sharePrice: 100,
    status: 'active',
    purchaseDate: '2023-01-15T00:00:00.000Z'
  },
  {
    id: 'inv_002',
    propertyId: 'prop_456',
    propertyName: 'Suburban Office Building',
    amount: 15000,
    shares: 150,
    sharePrice: 100,
    status: 'active',
    purchaseDate: '2023-02-20T00:00:00.000Z'
  }
];

const mockTransactions = [
  {
    id: 'txn_001',
    type: 'investment',
    amount: 10000,
    status: 'completed',
    date: '2023-01-15T10:30:00.000Z',
    propertyId: 'prop_123',
    propertyName: 'Downtown Apartment Complex'
  },
  {
    id: 'txn_002',
    type: 'investment',
    amount: 15000,
    status: 'completed',
    date: '2023-02-20T14:45:00.000Z',
    propertyId: 'prop_456',
    propertyName: 'Suburban Office Building'
  }
];

const mockDocuments = [
  {
    id: 'doc_001',
    name: 'Investment Agreement - Downtown Apartment Complex.pdf',
    type: 'agreement',
    date: '2023-01-15T00:00:00.000Z',
    size: '2.4 MB'
  },
  {
    id: 'doc_002',
    name: 'Quarterly Report Q1 2023.pdf',
    type: 'report',
    date: '2023-04-01T00:00:00.000Z',
    size: '1.8 MB'
  }
];

const mockWatchlist = [
  {
    id: 'prop_789',
    name: 'Beachfront Condo Development',
    location: 'Miami, FL',
    targetReturn: 8.5,
    minInvestment: 5000
  }
];

const getPortfolioSummary = async (req, res) => {
  try {
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: mockPortfolio
    });
  } catch (error) {
    logger.error('Error getting portfolio summary:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Error fetching portfolio summary'
    });
  }
};

const getPortfolioPerformance = async (req, res) => {
  try {
    const { period = 'all' } = req.query;
    const performanceData = {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
      values: [10000, 15000, 18000, 21000, 23500, 26250]
    };
    res.status(StatusCodes.OK).json(performanceData);
  } catch (error) {
    logger.error('Error getting portfolio performance:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Error fetching portfolio performance'
    });
  }
};

const getInvestments = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    let filteredInvestments = [...mockInvestments];
    if (status) {
      filteredInvestments = filteredInvestments.filter(inv => inv.status === status);
    }

    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    const paginatedInvestments = filteredInvestments.slice(start, end);

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: paginatedInvestments,
      pagination: {
        total: filteredInvestments.length,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(filteredInvestments.length / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting investments:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Error fetching investments'
    });
  }
};

const getTransactions = async (req, res) => {
  try {
    const { type, page = 1, limit = 10 } = req.query;
    
    let filteredTransactions = [...mockTransactions];
    if (type && type !== 'all') {
      filteredTransactions = filteredTransactions.filter(tx => tx.type === type);
    }

    const start = (page - 1) * limit;
    const end = start + parseInt(limit);
    const paginatedTransactions = filteredTransactions.slice(start, end);

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: paginatedTransactions,
      pagination: {
        total: filteredTransactions.length,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(filteredTransactions.length / limit)
      }
    });
  } catch (error) {
    logger.error('Error getting transactions:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Error fetching transactions'
    });
  }
};

const getDocuments = async (req, res) => {
  try {
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: mockDocuments
    });
  } catch (error) {
    logger.error('Error getting documents:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Error fetching documents'
    });
  }
};

const getWatchlist = async (req, res) => {
  try {
    res.status(StatusCodes.OK).json({
      status: 'success',
      data: mockWatchlist
    });
  } catch (error) {
    logger.error('Error getting watchlist:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Error fetching watchlist'
    });
  }
};

const addToWatchlist = async (req, res) => {
  try {
    const { propertyId } = req.params;
    // In a real app, you would add the property to the user's watchlist in the database
    res.status(StatusCodes.CREATED).json({
      status: 'success',
      message: 'Property added to watchlist'
    });
  } catch (error) {
    logger.error('Error adding to watchlist:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Error adding to watchlist'
    });
  }
};

const removeFromWatchlist = async (req, res) => {
  try {
    const { propertyId } = req.params;
    // In a real app, you would remove the property from the user's watchlist in the database
    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Property removed from watchlist'
    });
  } catch (error) {
    logger.error('Error removing from watchlist:', error);
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Error removing from watchlist'
    });
  }
};

module.exports = {
  getPortfolioSummary,
  getPortfolioPerformance,
  getInvestments,
  getTransactions,
  getDocuments,
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist
};