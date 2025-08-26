import puppeteer, { Browser, Page } from 'puppeteer';
import axios from 'axios';
import * as cheerio from 'cheerio';
import NodeCache from 'node-cache';
import { WarrantyInfo, LenovoApiResponse } from '../types';

class LenovoWarrantyService {
  private cache: NodeCache;
  private browser: Browser | null = null;
  private readonly LENOVO_WARRANTY_URL = 'https://pcsupport.lenovo.com/us/en/warrantylookup';
  private readonly BATCH_QUERY_URL = 'https://pcsupport.lenovo.com/us/en/warrantylookup/batchquery';
  private readonly CACHE_TTL = 3600; // 1 hour cache

  constructor() {
    this.cache = new NodeCache({ stdTTL: this.CACHE_TTL });
  }

  async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-extensions'
        ]
      });
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async checkWarrantyBatch(serialNumbers: string[]): Promise<WarrantyInfo[]> {
    const results: WarrantyInfo[] = [];
    
    // Process in chunks of 10 to avoid overwhelming the server
    const chunks = this.chunkArray(serialNumbers, 10);
    
    for (const chunk of chunks) {
      const chunkResults = await Promise.all(
        chunk.map(serial => this.checkSingleWarranty(serial))
      );
      results.push(...chunkResults);
      
      // Add delay between chunks
      await this.delay(2000);
    }
    
    return results;
  }

  async checkSingleWarranty(serialNumber: string): Promise<WarrantyInfo> {
    // Check cache first
    const cacheKey = `warranty_${serialNumber}`;
    const cached = this.cache.get<WarrantyInfo>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      // Try API method first (if available)
      const apiResult = await this.tryApiMethod(serialNumber);
      if (apiResult) {
        this.cache.set(cacheKey, apiResult);
        return apiResult;
      }

      // Fallback to web scraping
      const scrapingResult = await this.scrapeWarrantyInfo(serialNumber);
      this.cache.set(cacheKey, scrapingResult);
      return scrapingResult;

    } catch (error) {
      console.error(`Error checking warranty for ${serialNumber}:`, error);
      return {
        serialNumber,
        warrantyStatus: 'Error',
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async tryApiMethod(serialNumber: string): Promise<WarrantyInfo | null> {
    try {
      // This is a placeholder - Lenovo doesn't provide a public API
      // You would need to implement actual API calls if available
      const response = await axios.post('https://api.lenovo.com/warranty/check', {
        serialNumber
      }, {
        timeout: 10000,
        headers: {
          'User-Agent': 'LenovoWarrantyChecker/1.0',
          'Content-Type': 'application/json'
        }
      });

      const data: LenovoApiResponse = response.data;
      
      if (data.status === 'success' && data.data) {
        return this.parseApiResponse(serialNumber, data);
      }
      
      return null;
    } catch (error) {
      // API not available or failed, will fallback to scraping
      return null;
    }
  }

  private async scrapeWarrantyInfo(serialNumber: string): Promise<WarrantyInfo> {
    await this.initBrowser();
    
    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }

    const page = await this.browser.newPage();
    
    try {
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1366, height: 768 });

      // Navigate to warranty lookup page
      await page.goto(this.LENOVO_WARRANTY_URL, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait for the serial number input field
      await page.waitForSelector('#serialNumber, input[name="serialNumber"], [data-testid="serial-input"]', { timeout: 10000 });

      // Enter serial number
      const serialInput = await page.$('#serialNumber') || 
                         await page.$('input[name="serialNumber"]') || 
                         await page.$('[data-testid="serial-input"]');
      
      if (!serialInput) {
        throw new Error('Serial number input field not found');
      }

      await serialInput.click();
      await serialInput.type(serialNumber);

      // Submit the form
      const submitButton = await page.$('button[type="submit"], .submit-btn, [data-testid="submit-button"]') ||
                          await page.$('input[type="submit"]');
      
      if (!submitButton) {
        throw new Error('Submit button not found');
      }

      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }),
        submitButton.click()
      ]);

      // Wait for results to load
      await page.waitForTimeout(3000);

      // Extract warranty information
      const warrantyData = await page.evaluate(() => {
        const extractText = (selector: string): string => {
          const element = document.querySelector(selector);
          return element ? element.textContent?.trim() || '' : '';
        };

        const extractDate = (selector: string): string => {
          const text = extractText(selector);
          const dateMatch = text.match(/\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}/);
          return dateMatch ? dateMatch[0] : '';
        };

        return {
          productName: extractText('.product-name, .model-name, [data-testid="product-name"]'),
          productType: extractText('.product-type, .category, [data-testid="product-type"]'),
          warrantyStartDate: extractDate('.warranty-start, .start-date, [data-testid="warranty-start"]'),
          warrantyEndDate: extractDate('.warranty-end, .end-date, [data-testid="warranty-end"]'),
          warrantyType: extractText('.warranty-type, .coverage-type, [data-testid="warranty-type"]'),
          warrantyStatus: extractText('.warranty-status, .status, [data-testid="warranty-status"]'),
          errorMessage: extractText('.error-message, .alert-danger, [data-testid="error"]')
        };
      });

      // Calculate days remaining
      let daysRemaining: number | undefined;
      let status: WarrantyInfo['warrantyStatus'] = 'Not Found';

      if (warrantyData.warrantyEndDate) {
        const endDate = new Date(warrantyData.warrantyEndDate);
        const today = new Date();
        daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining < 0) {
          status = 'Expired';
        } else if (daysRemaining <= 30) {
          status = 'Expiring Soon';
        } else {
          status = 'Active';
        }
      } else if (warrantyData.errorMessage) {
        status = 'Error';
      }

      return {
        serialNumber,
        productName: warrantyData.productName || undefined,
        productType: warrantyData.productType || undefined,
        warrantyStartDate: warrantyData.warrantyStartDate || undefined,
        warrantyEndDate: warrantyData.warrantyEndDate || undefined,
        daysRemaining,
        warrantyStatus: status,
        warrantyType: warrantyData.warrantyType || undefined,
        errorMessage: warrantyData.errorMessage || undefined
      };

    } finally {
      await page.close();
    }
  }

  private parseApiResponse(serialNumber: string, data: LenovoApiResponse): WarrantyInfo {
    if (!data.data || !data.data.warranty) {
      return {
        serialNumber,
        warrantyStatus: 'Not Found'
      };
    }

    const warranty = data.data.warranty;
    const endDate = new Date(warranty.endDate);
    const today = new Date();
    const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    let status: WarrantyInfo['warrantyStatus'];
    if (daysRemaining < 0) {
      status = 'Expired';
    } else if (daysRemaining <= 30) {
      status = 'Expiring Soon';
    } else {
      status = 'Active';
    }

    return {
      serialNumber,
      productName: data.data.product,
      warrantyStartDate: warranty.startDate,
      warrantyEndDate: warranty.endDate,
      daysRemaining,
      warrantyStatus: status,
      warrantyType: warranty.type
    };
  }

  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cleanup method to be called on server shutdown
  async cleanup(): Promise<void> {
    await this.closeBrowser();
    this.cache.flushAll();
  }
}

export const lenovoWarrantyService = new LenovoWarrantyService();

// Graceful shutdown
process.on('SIGTERM', async () => {
  await lenovoWarrantyService.cleanup();
});

process.on('SIGINT', async () => {
  await lenovoWarrantyService.cleanup();
});