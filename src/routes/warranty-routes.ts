import express from 'express';
import { lenovoWarrantyService } from '../services/warranty-service';
import { WarrantyRequest, WarrantyResponse } from '../types';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Check warranty for multiple serial numbers
router.post('/check', async (req: express.Request, res: express.Response) => {
  try {
    const { serialNumbers, batchId }: WarrantyRequest = req.body;
    const startTime = Date.now();

    if (!serialNumbers || !Array.isArray(serialNumbers) || serialNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        message: 'Serial numbers array is required and must not be empty'
      });
    }

    if (serialNumbers.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Too many serial numbers',
        message: 'Maximum 50 serial numbers allowed per request'
      });
    }

    // Validate serial numbers format
    const validSerialNumbers = serialNumbers.filter(serial => 
      typeof serial === 'string' && 
      serial.trim().length > 0 && 
      /^[A-Z0-9]{6,15}$/i.test(serial.trim())
    );

    if (validSerialNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid serial numbers',
        message: 'Serial numbers must be 6-15 alphanumeric characters'
      });
    }

    console.log(`Processing warranty check for ${validSerialNumbers.length} serial numbers`);

    const results = await lenovoWarrantyService.checkWarrantyBatch(validSerialNumbers);
    const processingTime = Date.now() - startTime;
    const errors = results.filter(r => r.warrantyStatus === 'Error').length;

    const response: WarrantyResponse = {
      success: true,
      results,
      totalProcessed: validSerialNumbers.length,
      errors,
      batchId: batchId || uuidv4(),
      processingTime
    };

    res.json(response);

  } catch (error) {
    console.error('Error in warranty check:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Check warranty for a single serial number
router.get('/check/:serialNumber', async (req: express.Request, res: express.Response) => {
  try {
    const { serialNumber } = req.params;
    
    if (!serialNumber || !/^[A-Z0-9]{6,15}$/i.test(serialNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid serial number',
        message: 'Serial number must be 6-15 alphanumeric characters'
      });
    }

    console.log(`Processing single warranty check for: ${serialNumber}`);

    const result = await lenovoWarrantyService.checkSingleWarranty(serialNumber);
    
    res.json({
      success: true,
      result
    });

  } catch (error) {
    console.error('Error in single warranty check:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get warranty status statistics
router.get('/stats', async (req: express.Request, res: express.Response) => {
  try {
    // This would typically come from a database
    // For now, return mock statistics
    const stats = {
      totalChecks: 1250,
      todayChecks: 45,
      activeWarranties: 892,
      expiredWarranties: 234,
      expiringWarranties: 124,
      averageResponseTime: '2.3s',
      lastUpdated: new Date().toISOString()
    };

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

export { router as warrantyRouter };