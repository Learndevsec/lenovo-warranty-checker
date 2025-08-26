export interface WarrantyInfo {
  serialNumber: string;
  productName?: string;
  productType?: string;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  daysRemaining?: number;
  warrantyStatus: 'Active' | 'Expired' | 'Expiring Soon' | 'Error' | 'Not Found';
  warrantyType?: string;
  errorMessage?: string;
}

export interface WarrantyRequest {
  serialNumbers: string[];
  batchId?: string;
}

export interface WarrantyResponse {
  success: boolean;
  results: WarrantyInfo[];
  totalProcessed: number;
  errors: number;
  batchId?: string;
  processingTime: number;
}

export interface LenovoApiResponse {
  status: string;
  data?: {
    product?: string;
    warranty?: {
      startDate: string;
      endDate: string;
      type: string;
      status: string;
    };
  };
  error?: string;
}

export interface FileUploadResponse {
  success: boolean;
  serialNumbers: string[];
  totalFound: number;
  errors: string[];
}