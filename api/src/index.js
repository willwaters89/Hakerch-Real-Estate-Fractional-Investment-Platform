require('dotenv').config({ path: './envfile.env' });
const { app, logger } = require('./app');
const { StatusCodes } = require('http-status-codes');

const PORT = process.env.PORT || 5000;

// Start the server
const server = app.listen(PORT, () => {
  logger.info(`Server is running on port ${PORT}`);
  console.log(`Server is running on port ${PORT}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error(`Error: ${err.message}`, { stack: err.stack });
  console.error('Unhandled Rejection:', err);
  
  // Close server & exit process
  server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception: ${err.message}`, { stack: err.stack });
  console.error('Uncaught Exception:', err);
  
  // Close server & exit process (with a failure code)
  process.exit(1);
});

// Handle SIGTERM signal for graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully');
  server.close(() => {
    logger.info('Process terminated');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // You might want to restart the server or perform cleanup here
});
