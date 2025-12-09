const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { logger } = require('../app');

/**
 * Create a new investment
 */
const createInvestment = async (req, res) => {
  const transactionId = uuidv4();
  
  try {
    // Validate request body
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Validation failed',
        errors: errors.array(),
      });
    }

    const { propertyId, shares, paymentMethodId, notes } = req.body;
    const userId = req.user.id;

    // Start a database transaction
    const { data: property, error: propertyError } = await supabase.rpc('begin_transaction');
    
    try {
      // 1. Check if property exists and is active
      const { data: property, error: propertyFetchError } = await supabase
        .from('properties')
        .select('id, status, available_shares, price_per_share')
        .eq('id', propertyId)
        .single();

      if (propertyFetchError || !property) {
        throw new Error('Property not found');
      }

      if (property.status !== 'active') {
        return res.status(StatusCodes.BAD_REQUEST).json({
          status: 'error',
          message: 'Property is not available for investment',
        });
      }

      // 2. Check if there are enough available shares
      if (shares > property.available_shares) {
        return res.status(StatusCodes.BAD_REQUEST).json({
          status: 'error',
          message: 'Not enough shares available',
          availableShares: property.available_shares,
        });
      }

      // 3. Calculate total amount
      const amount = shares * property.price_per_share;

      // 4. Create investment record
      const investmentId = uuidv4();
      const { data: investment, error: investmentError } = await supabase
        .from('investments')
        .insert([
          {
            id: investmentId,
            user_id: userId,
            property_id: propertyId,
            shares,
            amount,
            status: 'pending',
            payment_method_id: paymentMethodId,
            transaction_id: transactionId,
            notes: notes || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (investmentError) {
        logger.error(`Create investment error: ${investmentError.message}`);
        throw new Error('Failed to create investment');
      }

      // 5. Process payment (simplified - in production, integrate with payment gateway)
      // This is where you would integrate with Stripe, PayPal, etc.
      const paymentSuccess = await processPayment({
        userId,
        amount,
        paymentMethodId,
        description: `Investment in property ${propertyId} for ${shares} shares`,
        metadata: {
          investmentId,
          propertyId,
          shares,
        },
      });

      if (!paymentSuccess) {
        throw new Error('Payment processing failed');
      }

      // 6. Update investment status to completed
      const { data: updatedInvestment, error: updateError } = await supabase
        .from('investments')
        .update({
          status: 'completed',
          payment_status: 'succeeded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', investmentId)
        .select()
        .single();

      if (updateError) {
        logger.error(`Update investment status error: ${updateError.message}`);
        throw new Error('Failed to update investment status');
      }

      // 7. Update property available shares
      const { error: updatePropertyError } = await supabase
        .from('properties')
        .update({
          available_shares: property.available_shares - shares,
          updated_at: new Date().toISOString(),
        })
        .eq('id', propertyId);

      if (updatePropertyError) {
        logger.error(`Update property shares error: ${updatePropertyError.message}`);
        throw new Error('Failed to update property shares');
      }

      // 8. Create transaction record
      await createTransaction({
        userId,
        type: 'investment',
        amount: -amount, // Negative because it's money going out
        status: 'completed',
        referenceId: investmentId,
        description: `Purchased ${shares} shares in property ${propertyId}`,
        metadata: {
          propertyId,
          shares,
          pricePerShare: property.price_per_share,
        },
      });

      // 9. Commit transaction
      await supabase.rpc('commit_transaction');

      // 10. Send confirmation email (in production)
      // await sendInvestmentConfirmationEmail(userId, investmentId);

      res.status(StatusCodes.CREATED).json({
        status: 'success',
        data: updatedInvestment,
      });
    } catch (error) {
      // Rollback transaction on error
      await supabase.rpc('rollback_transaction');
      throw error;
    }
  } catch (error) {
    logger.error(`Create investment error: ${error.message}`, { 
      stack: error.stack,
      transactionId,
      userId: req.user?.id,
      propertyId: req.body?.propertyId,
    });

    // Create failed investment record
    try {
      await supabase
        .from('failed_investments')
        .insert([
          {
            user_id: req.user?.id,
            property_id: req.body?.propertyId,
            shares: req.body?.shares,
            error: error.message,
            transaction_id: transactionId,
            created_at: new Date().toISOString(),
          },
        ]);
    } catch (logError) {
      logger.error(`Failed to log failed investment: ${logError.message}`);
    }

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to process investment',
      transactionId,
    });
  }
};

/**
 * Get user's investments
 */
const getInvestments = async (req, res) => {
  try {
    const { status, propertyId } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('investments')
      .select('*, property:properties(*, images:property_images(*))', { count: 'exact' })
      .eq('user_id', req.user.id);

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    // Apply pagination
    const { data: investments, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Get investments error: ${error.message}`);
      throw new Error('Failed to fetch investments');
    }

    // Process property images to include primary image
    const processedInvestments = investments.map(investment => ({
      ...investment,
      property: {
        ...investment.property,
        primaryImage: investment.property?.images?.find(img => img.is_primary) || null,
      },
    }));

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: processedInvestments,
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    logger.error(`Get investments error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to fetch investments',
    });
  }
};

/**
 * Get investment by ID
 */
const getInvestmentById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get investment
    const { data: investment, error } = await supabase
      .from('investments')
      .select('*, property:properties(*, images:property_images(*))')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (error || !investment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Investment not found',
      });
    }

    // Get investment transactions
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('reference_id', id)
      .order('created_at', { ascending: false });

    // Get property updates
    const { data: updates } = await supabase
      .from('property_updates')
      .select('*')
      .eq('property_id', investment.property_id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate investment performance
    const performance = await calculateInvestmentPerformance(investment.id);

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        ...investment,
        property: {
          ...investment.property,
          primaryImage: investment.property.images?.find(img => img.is_primary) || null,
        },
        transactions: transactions || [],
        updates: updates || [],
        performance,
      },
    });
  } catch (error) {
    logger.error(`Get investment by ID error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to fetch investment details',
    });
  }
};

/**
 * Cancel investment (if pending)
 */
const cancelInvestment = async (req, res) => {
  try {
    const { id } = req.params;

    // Start transaction
    await supabase.rpc('begin_transaction');

    try {
      // Get investment
      const { data: investment, error: investmentError } = await supabase
        .from('investments')
        .select('*')
        .eq('id', id)
        .eq('user_id', req.user.id)
        .single();

      if (investmentError || !investment) {
        throw new Error('Investment not found');
      }

      // Check if investment can be cancelled
      if (investment.status !== 'pending') {
        return res.status(StatusCodes.BAD_REQUEST).json({
          status: 'error',
          message: 'Only pending investments can be cancelled',
        });
      }

      // Update investment status
      const { data: updatedInvestment, error: updateError } = await supabase
        .from('investments')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error('Failed to cancel investment');
      }

      // Process refund if payment was made
      if (investment.payment_status === 'succeeded') {
        // In production, integrate with payment provider to process refund
        const refundSuccess = await processRefund({
          paymentIntentId: investment.payment_intent_id,
          amount: investment.amount,
          reason: 'Investment cancelled by user',
        });

        if (!refundSuccess) {
          throw new Error('Failed to process refund');
        }

        // Update payment status
        await supabase
          .from('investments')
          .update({
            payment_status: 'refunded',
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
      }

      // Create transaction record
      await createTransaction({
        userId: req.user.id,
        type: 'refund',
        amount: investment.amount,
        status: 'completed',
        referenceId: id,
        description: `Refund for cancelled investment ${id}`,
        metadata: {
          originalInvestmentId: id,
          propertyId: investment.property_id,
          shares: investment.shares,
        },
      });

      // Update property available shares
      if (investment.status === 'completed') {
        const { data: property } = await supabase
          .from('properties')
          .select('available_shares')
          .eq('id', investment.property_id)
          .single();

        if (property) {
          await supabase
            .from('properties')
            .update({
              available_shares: property.available_shares + investment.shares,
              updated_at: new Date().toISOString(),
            })
            .eq('id', investment.property_id);
        }
      }

      // Commit transaction
      await supabase.rpc('commit_transaction');

      // Send cancellation confirmation (in production)
      // await sendInvestmentCancellationEmail(req.user.id, id);

      res.status(StatusCodes.OK).json({
        status: 'success',
        data: updatedInvestment,
      });
    } catch (error) {
      // Rollback transaction on error
      await supabase.rpc('rollback_transaction');
      throw error;
    }
  } catch (error) {
    logger.error(`Cancel investment error: ${error.message}`, { 
      stack: error.stack,
      investmentId: req.params.id,
      userId: req.user?.id,
    });

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to cancel investment',
    });
  }
};

/**
 * Admin: Get all investments (with filters)
 */
const adminGetAllInvestments = async (req, res) => {
  try {
    const { status, userId, propertyId } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('investments')
      .select('*, user:users(email, first_name, last_name), property:properties(title)', { 
        count: 'exact' 
      });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (userId) {
      query = query.eq('user_id', userId);
    }

    if (propertyId) {
      query = query.eq('property_id', propertyId);
    }

    // Apply pagination and sorting
    const { data: investments, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error(`Admin get all investments error: ${error.message}`);
      throw new Error('Failed to fetch investments');
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: investments || [],
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    logger.error(`Admin get all investments error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to fetch investments',
    });
  }
};

/**
 * Admin: Update investment status
 */
const updateInvestmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    // Get current investment
    const { data: investment, error: investmentError } = await supabase
      .from('investments')
      .select('*')
      .eq('id', id)
      .single();

    if (investmentError || !investment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Investment not found',
      });
    }

    // Validate status transition
    if (!isValidStatusTransition(investment.status, status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: `Invalid status transition from ${investment.status} to ${status}`,
      });
    }

    // Update investment status
    const updateData = {
      status,
      updated_at: new Date().toISOString(),
    };

    // Add completed_at timestamp if marking as completed
    if (status === 'completed' && investment.status !== 'completed') {
      updateData.completed_at = new Date().toISOString();
    }

    const { data: updatedInvestment, error: updateError } = await supabase
      .from('investments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      logger.error(`Update investment status error: ${updateError.message}`);
      throw new Error('Failed to update investment status');
    }

    // Add status change to investment history
    await supabase
      .from('investment_history')
      .insert([
        {
          investment_id: id,
          status,
          notes: notes || null,
          changed_by: req.user.id,
          created_at: new Date().toISOString(),
        },
      ]);

    // If marking as completed, update property shares
    if (status === 'completed' && investment.status !== 'completed') {
      const { data: property } = await supabase
        .from('properties')
        .select('available_shares')
        .eq('id', investment.property_id)
        .single();

      if (property) {
        await supabase
          .from('properties')
          .update({
            available_shares: property.available_shares - investment.shares,
            updated_at: new Date().toISOString(),
          })
          .eq('id', investment.property_id);
      }
    }

    // TODO: Notify user about status change

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: updatedInvestment,
    });
  } catch (error) {
    logger.error(`Update investment status error: ${error.message}`, { 
      stack: error.stack,
      investmentId: req.params.id,
    });

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to update investment status',
    });
  }
};

/**
 * Request withdrawal from investment
 */
const requestWithdrawal = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, bankAccountId } = req.body;

    // Get investment
    const { data: investment, error: investmentError } = await supabase
      .from('investments')
      .select('*, property:properties(*)')
      .eq('id', id)
      .eq('user_id', req.user.id)
      .single();

    if (investmentError || !investment) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Investment not found',
      });
    }

    // Check if investment is eligible for withdrawal
    if (investment.status !== 'completed') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Only completed investments can be withdrawn',
      });
    }

    // Check if property allows withdrawals
    if (investment.property?.withdrawal_policy !== 'allowed') {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Withdrawals are not allowed for this investment',
      });
    }

    // Calculate available balance
    const { availableBalance } = await calculateInvestmentBalance(investment.id);

    if (amount > availableBalance) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Insufficient balance for withdrawal',
        availableBalance,
      });
    }

    // Get bank account
    const { data: bankAccount, error: bankError } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('id', bankAccountId)
      .eq('user_id', req.user.id)
      .single();

    if (bankError || !bankAccount) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Invalid bank account',
      });
    }

    // Create withdrawal request
    const withdrawalId = uuidv4();
    const { data: withdrawal, error: withdrawalError } = await supabase
      .from('withdrawals')
      .insert([
        {
          id: withdrawalId,
          user_id: req.user.id,
          investment_id: id,
          amount,
          bank_account_id: bankAccountId,
          status: 'pending',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (withdrawalError) {
      logger.error(`Create withdrawal error: ${withdrawalError.message}`);
      throw new Error('Failed to create withdrawal request');
    }

    // Create transaction record
    await createTransaction({
      userId: req.user.id,
      type: 'withdrawal',
      amount: -amount, // Negative because it's money going out
      status: 'pending',
      referenceId: withdrawalId,
      description: `Withdrawal request from investment ${id}`,
      metadata: {
        investmentId: id,
        bankAccountId,
      },
    });

    // TODO: Notify admin about withdrawal request
    // await notifyAdminAboutWithdrawal(withdrawalId);

    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: withdrawal,
    });
  } catch (error) {
    logger.error(`Request withdrawal error: ${error.message}`, { 
      stack: error.stack,
      investmentId: req.params.id,
      userId: req.user?.id,
    });

    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to process withdrawal request',
    });
  }
};

// Helper Functions

/**
 * Process payment (mock implementation)
 * In production, integrate with a payment processor like Stripe
 */
async function processPayment({ userId, amount, paymentMethodId, description, metadata }) {
  // In a real implementation, this would call the payment processor's API
  // For example, with Stripe:
  /*
  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100), // Convert to cents
    currency: 'usd',
    payment_method: paymentMethodId,
    confirm: true,
    description,
    metadata,
    return_url: `${process.env.FRONTEND_URL}/payment/return`,
  });
  
  return paymentIntent.status === 'succeeded';
  */

  // For development, simulate a successful payment
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 500);
  });
}

/**
 * Process refund (mock implementation)
 */
async function processRefund({ paymentIntentId, amount, reason }) {
  // In a real implementation, this would call the payment processor's refund API
  // For example, with Stripe:
  /*
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    amount: Math.round(amount * 100), // Convert to cents
    reason: 'requested_by_customer',
    metadata: { reason },
  });
  
  return refund.status === 'succeeded';
  */

  // For development, simulate a successful refund
  return new Promise((resolve) => {
    setTimeout(() => resolve(true), 500);
  });
}

/**
 * Create transaction record
 */
async function createTransaction({ userId, type, amount, status, referenceId, description, metadata }) {
  const { error } = await supabase
    .from('transactions')
    .insert([
      {
        id: uuidv4(),
        user_id: userId,
        type,
        amount,
        status,
        reference_id: referenceId,
        description,
        metadata: metadata || {},
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ]);

  if (error) {
    logger.error(`Create transaction error: ${error.message}`);
    throw new Error('Failed to create transaction record');
  }
}

/**
 * Calculate investment performance
 */
async function calculateInvestmentPerformance(investmentId) {
  // In a real implementation, this would calculate ROI, current value, etc.
  // based on property appreciation, dividends, etc.
  return {
    currentValue: 0,
    totalReturn: 0,
    annualizedReturn: 0,
    dividendsReceived: 0,
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Calculate available balance for withdrawal
 */
async function calculateInvestmentBalance(investmentId) {
  // In a real implementation, this would calculate the available balance
  // considering lock-up periods, previous withdrawals, etc.
  return {
    totalInvested: 0,
    currentValue: 0,
    availableBalance: 0,
    lockedAmount: 0,
    pendingWithdrawals: 0,
  };
}

/**
 * Validate status transition
 */
function isValidStatusTransition(currentStatus, newStatus) {
  const validTransitions = {
    pending: ['completed', 'failed', 'cancelled'],
    completed: ['cancelled'], // In case of reversal
    failed: ['pending'], // If retrying
    cancelled: [], // Terminal state
  };

  return validTransitions[currentStatus]?.includes(newStatus) || false;
}

module.exports = {
  createInvestment,
  getInvestments,
  getInvestmentById,
  cancelInvestment,
  adminGetAllInvestments,
  updateInvestmentStatus,
  requestWithdrawal,
};
