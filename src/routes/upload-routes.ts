import express from 'express';
import multer from 'multer';
import csv from 'csv-parser';
import { Readable } from 'stream';
import { FileUploadResponse } from '../types';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'text/plain', 'application/csv'];
    const allowedExtensions = ['.csv', '.txt'];
    
    const hasValidType = allowedTypes.includes(file.mimetype);
    const hasValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (hasValidType || hasValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and TXT files are allowed'));
    }
  }
});

// Upload and parse file containing serial numbers
router.post('/parse', upload.single('file'), async (req: express.Request, res: express.Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded',
        message: 'Please upload a CSV or TXT file containing serial numbers'
      });
    }

    const fileBuffer = req.file.buffer;
    const fileContent = fileBuffer.toString('utf-8');
    
    let serialNumbers: string[] = [];
    const errors: string[] = [];

    // Determine file type and parse accordingly
    if (req.file.originalname.toLowerCase().endsWith('.csv')) {
      serialNumbers = await parseCSVFile(fileContent, errors);
    } else {
      serialNumbers = parseTXTFile(fileContent, errors);
    }

    // Validate and clean serial numbers
    const validSerialNumbers = serialNumbers
      .map(serial => serial.trim().toUpperCase())
      .filter(serial => {
        if (!serial) return false;
        if (!/^[A-Z0-9]{6,15}$/i.test(serial)) {
          errors.push(`Invalid serial number format: ${serial}`);
          return false;
        }
        return true;
      });

    // Remove duplicates
    const uniqueSerialNumbers = [...new Set(validSerialNumbers)];

    if (uniqueSerialNumbers.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid serial numbers found',
        message: 'The file must contain valid serial numbers (6-15 alphanumeric characters)',
        errors
      });
    }

    const response: FileUploadResponse = {
      success: true,
      serialNumbers: uniqueSerialNumbers,
      totalFound: uniqueSerialNumbers.length,
      errors: errors.slice(0, 10) // Limit error messages
    };

    console.log(`Parsed ${uniqueSerialNumbers.length} valid serial numbers from file: ${req.file.originalname}`);

    res.json(response);

  } catch (error) {
    console.error('Error parsing file:', error);
    res.status(500).json({
      success: false,
      error: 'File parsing error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Parse CSV file content
function parseCSVFile(content: string, errors: string[]): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const serialNumbers: string[] = [];
    const stream = Readable.from([content]);

    stream
      .pipe(csv({ headers: false, skipEmptyLines: true }))
      .on('data', (row) => {
        // CSV parser returns an object with numeric keys
        const values = Object.values(row) as string[];
        values.forEach(value => {
          if (value && typeof value === 'string') {
            const trimmed = value.trim();
            if (trimmed) {
              serialNumbers.push(trimmed);
            }
          }
        });
      })
      .on('end', () => {
        resolve(serialNumbers);
      })
      .on('error', (error) => {
        errors.push(`CSV parsing error: ${error.message}`);
        reject(error);
      });
  });
}

// Parse TXT file content
function parseTXTFile(content: string, errors: string[]): string[] {
  const serialNumbers: string[] = [];
  
  // Split by newlines and commas, then filter
  const lines = content.split(/[\n\r]+/);
  
  lines.forEach((line, lineNumber) => {
    const values = line.split(/[,;\t]+/);
    values.forEach(value => {
      const trimmed = value.trim();
      if (trimmed) {
        serialNumbers.push(trimmed);
      }
    });
  });

  return serialNumbers;
}

export { router as uploadRouter };