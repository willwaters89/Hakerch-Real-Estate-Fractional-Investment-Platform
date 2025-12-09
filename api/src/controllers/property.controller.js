const { StatusCodes } = require('http-status-codes');
const { validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const { logger } = require('../app');

/**
 * Get all properties with pagination and filtering
 */
const getAllProperties = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      propertyType,
      minYield,
      maxYield,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      order = 'desc',
    } = req.query;

    // Calculate pagination
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('properties')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }

    if (propertyType) {
      query = query.eq('property_type', propertyType);
    }

    if (minYield) {
      query = query.gte('annual_yield', minYield);
    }

    if (maxYield) {
      query = query.lte('annual_yield', maxYield);
    }

    if (minPrice) {
      query = query.gte('price_per_share', minPrice);
    }

    if (maxPrice) {
      query = query.lte('price_per_share', maxPrice);
    }

    // Apply sorting
    if (sortBy) {
      query = query.order(sortBy, { ascending: order === 'asc' });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    // Execute query
    const { data: properties, count, error } = await query;

    if (error) {
      logger.error(`Error fetching properties: ${error.message}`);
      throw new Error('Failed to fetch properties');
    }

    // Get property images and other related data if needed
    const propertiesWithImages = await Promise.all(
      properties.map(async (property) => {
        const { data: images } = await supabase
          .from('property_images')
          .select('id, url, is_primary')
          .eq('property_id', property.id)
          .order('is_primary', { ascending: false });

        return {
          ...property,
          images: images || [],
        };
      })
    );

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: propertiesWithImages,
      pagination: {
        total: count || 0,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    logger.error(`Get all properties error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to fetch properties',
    });
  }
};

/**
 * Get property by ID
 */
const getPropertyById = async (req, res) => {
  try {
    const { id } = req.params;

    // Get property
    const { data: property, error: propertyError } = await supabase
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (propertyError || !property) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Property not found',
      });
    }

    // Get property images
    const { data: images } = await supabase
      .from('property_images')
      .select('*')
      .eq('property_id', id)
      .order('is_primary', { ascending: false });

    // Get property documents
    const { data: documents } = await supabase
      .from('property_documents')
      .select('*')
      .eq('property_id', id);

    // Get property financials
    const { data: financials } = await supabase
      .from('property_financials')
      .select('*')
      .eq('property_id', id)
      .single();

    // Get property updates
    const { data: updates } = await supabase
      .from('property_updates')
      .select('*')
      .eq('property_id', id)
      .order('created_at', { ascending: false });

    // Get property statistics (investors, total invested, etc.)
    const { count: investorCount } = await supabase
      .from('investments')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', id);

    const { data: totalInvested } = await supabase
      .from('investments')
      .select('shares')
      .eq('property_id', id);

    const totalSharesInvested = totalInvested?.reduce((sum, inv) => sum + inv.shares, 0) || 0;

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: {
        ...property,
        images: images || [],
        documents: documents || [],
        financials: financials || {},
        updates: updates || [],
        stats: {
          investorCount: investorCount || 0,
          totalSharesInvested,
          availableShares: property.total_shares - totalSharesInvested,
          percentFunded: (totalSharesInvested / property.total_shares) * 100,
        },
      },
    });
  } catch (error) {
    logger.error(`Get property by ID error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to fetch property',
    });
  }
};

/**
 * Create a new property (Admin only)
 */
const createProperty = async (req, res) => {
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

    const {
      title,
      description,
      address,
      city,
      state,
      zipCode,
      country,
      propertyType,
      totalShares,
      pricePerShare,
      totalValue,
      annualYield,
      holdPeriod,
      status = 'draft',
      features = {},
      coordinates,
    } = req.body;

    const propertyId = uuidv4();

    // Create property in database
    const { data: property, error } = await supabase
      .from('properties')
      .insert([
        {
          id: propertyId,
          title,
          description,
          address,
          city,
          state,
          zip_code: zipCode,
          country,
          property_type: propertyType,
          total_shares: totalShares,
          available_shares: totalShares, // Initially all shares are available
          price_per_share: pricePerShare,
          total_value: totalValue,
          annual_yield: annualYield,
          hold_period_months: holdPeriod,
          status,
          features,
          coordinates: coordinates || null,
          created_by: req.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      logger.error(`Create property error: ${error.message}`);
      throw new Error('Failed to create property');
    }

    // Create initial financial record
    await supabase
      .from('property_financials')
      .insert([
        {
          property_id: propertyId,
          purchase_price: totalValue,
          current_value: totalValue,
          annual_income: (totalValue * annualYield) / 100,
          annual_expenses: 0,
          net_operating_income: (totalValue * annualYield) / 100,
          cap_rate: annualYield,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: property,
    });
  } catch (error) {
    logger.error(`Create property error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to create property',
    });
  }
};

/**
 * Update property (Admin only)
 */
const updateProperty = async (req, res) => {
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

    const { id } = req.params;
    const updateData = { ...req.body, updated_at: new Date().toISOString() };

    // Remove read-only fields
    delete updateData.id;
    delete updateData.created_at;
    delete updateData.created_by;

    // Update property in database
    const { data: property, error } = await supabase
      .from('properties')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      logger.error(`Update property error: ${error.message}`);
      throw new Error('Failed to update property');
    }

    if (!property) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Property not found',
      });
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: property,
    });
  } catch (error) {
    logger.error(`Update property error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to update property',
    });
  }
};

/**
 * Delete property (Admin only)
 */
const deleteProperty = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if property has investments
    const { count: investmentCount } = await supabase
      .from('investments')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', id);

    if (investmentCount > 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Cannot delete property with existing investments',
      });
    }

    // Delete property
    const { error } = await supabase
      .from('properties')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error(`Delete property error: ${error.message}`);
      throw new Error('Failed to delete property');
    }

    // Delete related records (cascade would handle this if foreign keys are set up properly)
    await Promise.all([
      supabase.from('property_images').delete().eq('property_id', id),
      supabase.from('property_documents').delete().eq('property_id', id),
      supabase.from('property_financials').delete().eq('property_id', id),
      supabase.from('property_updates').delete().eq('property_id', id),
    ]);

    res.status(StatusCodes.NO_CONTENT).send();
  } catch (error) {
    logger.error(`Delete property error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to delete property',
    });
  }
};

/**
 * Upload property images (Admin only)
 */
const uploadPropertyImages = async (req, res) => {
  try {
    const { id } = req.params;
    const { images } = req.body; // Array of { url, isPrimary }

    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'At least one image is required',
      });
    }

    // If any image is marked as primary, unset current primary
    const hasNewPrimary = images.some((img) => img.isPrimary);
    if (hasNewPrimary) {
      await supabase
        .from('property_images')
        .update({ is_primary: false })
        .eq('property_id', id)
        .eq('is_primary', true);
    }

    // Prepare image records
    const imageRecords = images.map((img) => ({
      id: uuidv4(),
      property_id: id,
      url: img.url,
      is_primary: img.isPrimary || false,
      created_at: new Date().toISOString(),
    }));

    // Insert images
    const { data: insertedImages, error } = await supabase
      .from('property_images')
      .insert(imageRecords)
      .select();

    if (error) {
      logger.error(`Upload property images error: ${error.message}`);
      throw new Error('Failed to upload images');
    }

    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: insertedImages,
    });
  } catch (error) {
    logger.error(`Upload property images error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to upload property images',
    });
  }
};

/**
 * Delete property image (Admin only)
 */
const deletePropertyImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;

    // Check if image exists and belongs to property
    const { data: image, error: imageError } = await supabase
      .from('property_images')
      .select('*')
      .eq('id', imageId)
      .eq('property_id', id)
      .single();

    if (imageError || !image) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Image not found',
      });
    }

    // Delete image
    const { error } = await supabase
      .from('property_images')
      .delete()
      .eq('id', imageId);

    if (error) {
      logger.error(`Delete property image error: ${error.message}`);
      throw new Error('Failed to delete image');
    }

    // If deleted image was primary, set another image as primary if available
    if (image.is_primary) {
      const { data: otherImages } = await supabase
        .from('property_images')
        .select('id')
        .eq('property_id', id)
        .limit(1);

      if (otherImages && otherImages.length > 0) {
        await supabase
          .from('property_images')
          .update({ is_primary: true })
          .eq('id', otherImages[0].id);
      }
    }

    res.status(StatusCodes.NO_CONTENT).send();
  } catch (error) {
    logger.error(`Delete property image error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to delete property image',
    });
  }
};

/**
 * Upload property document (Admin only)
 */
const uploadPropertyDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url, type = 'other' } = req.body;

    if (!name || !url) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Document name and URL are required',
      });
    }

    // Insert document
    const { data: document, error } = await supabase
      .from('property_documents')
      .insert([
        {
          id: uuidv4(),
          property_id: id,
          name,
          url,
          type,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      logger.error(`Upload property document error: ${error.message}`);
      throw new Error('Failed to upload document');
    }

    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: document,
    });
  } catch (error) {
    logger.error(`Upload property document error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to upload property document',
    });
  }
};

/**
 * Delete property document (Admin only)
 */
const deletePropertyDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;

    // Check if document exists and belongs to property
    const { data: document, error: docError } = await supabase
      .from('property_documents')
      .select('*')
      .eq('id', docId)
      .eq('property_id', id)
      .single();

    if (docError || !document) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Document not found',
      });
    }

    // Delete document
    const { error } = await supabase
      .from('property_documents')
      .delete()
      .eq('id', docId);

    if (error) {
      logger.error(`Delete property document error: ${error.message}`);
      throw new Error('Failed to delete document');
    }

    // TODO: Delete the actual file from storage if needed

    res.status(StatusCodes.NO_CONTENT).send();
  } catch (error) {
    logger.error(`Delete property document error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to delete property document',
    });
  }
};

/**
 * Get property financials
 */
const getPropertyFinancials = async (req, res) => {
  try {
    const { id } = req.params;

    // Get financials
    const { data: financials, error } = await supabase
      .from('property_financials')
      .select('*')
      .eq('property_id', id)
      .single();

    if (error || !financials) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Financials not found for this property',
      });
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: financials,
    });
  } catch (error) {
    logger.error(`Get property financials error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to fetch property financials',
    });
  }
};

/**
 * Update property financials (Admin only)
 */
const updatePropertyFinancials = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if property exists
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', id)
      .single();

    if (propError || !property) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Property not found',
      });
    }

    // Update or insert financials
    const { data: financials, error } = await supabase
      .from('property_financials')
      .upsert(
        {
          ...updateData,
          property_id: id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'property_id' }
      )
      .select()
      .single();

    if (error) {
      logger.error(`Update property financials error: ${error.message}`);
      throw new Error('Failed to update property financials');
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: financials,
    });
  } catch (error) {
    logger.error(`Update property financials error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to update property financials',
    });
  }
};

/**
 * Get property updates
 */
const getPropertyUpdates = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10 } = req.query;

    // Get updates
    const { data: updates, error } = await supabase
      .from('property_updates')
      .select('*')
      .eq('property_id', id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit, 10));

    if (error) {
      logger.error(`Get property updates error: ${error.message}`);
      throw new Error('Failed to fetch property updates');
    }

    res.status(StatusCodes.OK).json({
      status: 'success',
      data: updates || [],
    });
  } catch (error) {
    logger.error(`Get property updates error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to fetch property updates',
    });
  }
};

/**
 * Add property update (Admin only)
 */
const addPropertyUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        status: 'error',
        message: 'Title and content are required',
      });
    }

    // Check if property exists
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id')
      .eq('id', id)
      .single();

    if (propError || !property) {
      return res.status(StatusCodes.NOT_FOUND).json({
        status: 'error',
        message: 'Property not found',
      });
    }

    // Add update
    const { data: update, error } = await supabase
      .from('property_updates')
      .insert([
        {
          id: uuidv4(),
          property_id: id,
          title,
          content,
          created_by: req.user.id,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      logger.error(`Add property update error: ${error.message}`);
      throw new Error('Failed to add property update');
    }

    // TODO: Notify investors about the update

    res.status(StatusCodes.CREATED).json({
      status: 'success',
      data: update,
    });
  } catch (error) {
    logger.error(`Add property update error: ${error.message}`, { stack: error.stack });
    res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      status: 'error',
      message: 'Failed to add property update',
    });
  }
};

module.exports = {
  getAllProperties,
  getPropertyById,
  createProperty,
  updateProperty,
  deleteProperty,
  uploadPropertyImages,
  deletePropertyImage,
  uploadPropertyDocument,
  deletePropertyDocument,
  getPropertyFinancials,
  updatePropertyFinancials,
  getPropertyUpdates,
  addPropertyUpdate,
};
