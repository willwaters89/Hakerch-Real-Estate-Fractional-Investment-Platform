const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const { logger } = require('../app');
const supabase = require('../config/supabase');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';

/**
 * Middleware to authenticate JWT token
 */
const authenticateJWT = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: 'error',
        message: 'No token provided or invalid token format',
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify JWT token
    jwt.verify(token, JWT_SECRET, async (err, decoded) => {
      if (err) {
        logger.error(`JWT verification failed: ${err.message}`);
        return res.status(StatusCodes.FORBIDDEN).json({
          status: 'error',
          message: 'Failed to authenticate token',
        });
      }

      // Check if user exists in the database
      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', decoded.userId)
        .single();

      if (error || !user) {
        logger.error(`User not found: ${decoded.userId}`);
        return res.status(StatusCodes.NOT_FOUND).json({
          status: 'error',
          message: 'User not found',
        });
      }

      // Attach user to request object
      req.user = user;
      next();
    });
  } catch (error) {
    logger.error(`Authentication error: ${error.message}`, { stack: error.stack });
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Internal server error during authentication',
    });
  }
};

/**
 * Middleware to check if user has admin role
 */
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  
  logger.warn(`Unauthorized admin access attempt by user: ${req.user?.id}`);
  return res.status(StatusCodes.FORBIDDEN).json({
    status: 'error',
    message: 'Admin access required',
  });
};

/**
 * Middleware to check if user has investor role
 */
const isInvestor = (req, res, next) => {
  if (req.user && req.user.role === 'investor') {
    return next();
  }
  
  logger.warn(`Unauthorized investor access attempt by user: ${req.user?.id}`);
  return res.status(StatusCodes.FORBIDDEN).json({
    status: 'error',
    message: 'Investor access required',
  });
};

module.exports = {
  authenticateJWT,
  isAdmin,
  isInvestor,
};
