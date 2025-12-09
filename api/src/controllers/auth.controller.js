const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { logger } = require('../app');

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'your_refresh_token_secret';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

/**
 * Register a new user
 */
const register = async (req, res) => {
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

    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(StatusCodes.CONFLICT).json({
        status: 'error',
        message: 'Email already registered',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();

    // Create user in database
    const { data: user, error } = await supabase
      .from('users')
      .insert([
        {
          id: userId,
          email,
          password: hashedPassword,
          first_name: firstName,
          last_name: lastName,
          role: 'investor', // Default role
          status: 'active',
          email_verified: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      logger.error(`Error creating user: ${error.message}`);
      throw new Error('Failed to create user');
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user.id },
      REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    // Save refresh token to database
    await supabase
      .from('refresh_tokens')
      .insert([
        {
          user_id: user.id,
          token: refreshToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        },
      ]);

    // Remove sensitive data before sending response
    const { password: _, ...userWithoutPassword } = user;

    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: {
        user: userWithoutPassword,
        token,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error(`Registration error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Internal server error during registration',
    });
  }
};

/**
 * Login user
 */
const login = async (req, res) => {
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

    const { email, password } = req.body;

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (userError || !user) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: 'error',
        message: 'Invalid email or password',
      });
    }

    // Check if account is active
    if (user.status !== 'active') {
      return res.status(StatusCodes.FORBIDDEN).json({
        status: 'error',
        message: 'Account is not active. Please contact support.',
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(StatusCodes.UNAUTHORIZED).json({
        status: 'error',
        message: 'Invalid email or password',
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Generate refresh token
    const refreshToken = jwt.sign(
      { userId: user.id },
      REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    // Save refresh token to database
    await supabase
      .from('refresh_tokens')
      .insert([
        {
          user_id: user.id,
          token: refreshToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
        },
      ]);

    // Remove sensitive data before sending response
    const { password: _, ...userWithoutPassword } = user;

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        user: userWithoutPassword,
        token,
        refreshToken,
      },
    });
  } catch (error) {
    logger.error(`Login error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Internal server error during login',
    });
  }
};

/**
 * Get current user profile
 */
const getCurrentUser = async (req, res) => {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error || !user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Remove sensitive data before sending response
    const { password, ...userWithoutPassword } = user;

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: userWithoutPassword,
    });
  } catch (error) {
    logger.error(`Get current user error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to fetch user profile',
    });
  }
};

/**
 * Update user profile
 */
const updateProfile = async (req, res) => {
  try {
    const { firstName, lastName, phone, address } = req.body;
    const userId = req.user.id;

    // Prepare update data
    const updateData = {
      first_name: firstName,
      last_name: lastName,
      phone,
      address,
      updated_at: new Date().toISOString(),
    };

    // Update user in database
    const { data: updatedUser, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      logger.error(`Update profile error: ${error.message}`);
      throw new Error('Failed to update profile');
    }

    // Remove sensitive data before sending response
    const { password, ...userWithoutPassword } = updatedUser;

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: userWithoutPassword,
    });
  } catch (error) {
    logger.error(`Update profile error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to update profile',
    });
  }
};

/**
 * Refresh access token
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Refresh token is required',
      });
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET);
    
    // Check if refresh token exists in database
    const { data: tokenData, error: tokenError } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('token', refreshToken)
      .single();

    if (tokenError || !tokenData) {
      return res.status(StatusCodes.FORBIDDEN).json({
        status: 'error',
        message: 'Invalid refresh token',
      });
    }

    // Check if refresh token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      // Delete expired token
      await supabase
        .from('refresh_tokens')
        .delete()
        .eq('token', refreshToken);
      
      return res.status(StatusCodes.FORBIDDEN).json({
        status: 'error',
        message: 'Refresh token expired',
      });
    }

    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.userId)
      .single();

    if (userError || !user) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'User not found',
      });
    }

    // Generate new access token
    const newToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        token: newToken,
      },
    });
  } catch (error) {
    logger.error(`Refresh token error: ${error.message}`, { stack: error.stack });
    
    if (error.name === 'TokenExpiredError') {
      return res.status(StatusCodes.FORBIDDEN).json({
        status: 'error',
        message: 'Refresh token expired',
      });
    }
    
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to refresh token',
    });
  }
};

/**
 * Logout user
 */
const logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Refresh token is required',
      });
    }

    // Delete refresh token from database
    const { error } = await supabase
      .from('refresh_tokens')
      .delete()
      .eq('token', refreshToken);

    if (error) {
      logger.error(`Logout error: ${error.message}`);
      throw new Error('Failed to logout');
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Successfully logged out',
    });
  } catch (error) {
    logger.error(`Logout error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to logout',
    });
  }
};

/**
 * Forgot password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Find user by email
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, first_name')
      .eq('email', email)
      .single();

    if (userError || !user) {
      // Don't reveal if the email exists or not for security reasons
      return res.status(StatusCodes.OK).json({
        status: 'success',
        message: 'If your email is registered, you will receive a password reset link',
      });
    }

    // Generate password reset token
    const resetToken = jwt.sign(
      { userId: user.id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    // Save reset token to database
    await supabase
      .from('password_reset_tokens')
      .upsert(
        {
          user_id: user.id,
          token: resetToken,
          expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour
          created_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    // TODO: Send password reset email with the resetToken
    // This would typically be done using a service like SendGrid, Mailchimp, etc.
    console.log(`Password reset token for ${user.email}: ${resetToken}`);

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'If your email is registered, you will receive a password reset link',
    });
  } catch (error) {
    logger.error(`Forgot password error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to process password reset request',
    });
  }
};

/**
 * Reset password
 */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Token and new password are required',
      });
    }

    // Verify token
    let userId;
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.userId;
    } catch (error) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Invalid or expired token',
      });
    }

    // Check if token exists and is not expired
    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_tokens')
      .select('*')
      .eq('token', token)
      .single();

    if (tokenError || !resetToken) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Invalid or expired token',
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update user password
    const { error: updateError } = await supabase
      .from('users')
      .update({ password: hashedPassword })
      .eq('id', userId);

    if (updateError) {
      logger.error(`Reset password error: ${updateError.message}`);
      throw new Error('Failed to update password');
    }

    // Delete used reset token
    await supabase
      .from('password_reset_tokens')
      .delete()
      .eq('token', token);

    res.status(StatusCodes.OK).json({
      status: 'success',
      message: 'Password has been reset successfully',
    });
  } catch (error) {
    logger.error(`Reset password error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to reset password',
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  updateProfile,
  refreshToken,
  logout,
  forgotPassword,
  resetPassword,
};
