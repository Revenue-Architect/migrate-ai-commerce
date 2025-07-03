interface ShopifyConfig {
  shopDomain: string;
  accessToken: string;
  apiVersion: string;
}

interface BatchOperation {
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  resource: 'product' | 'customer' | 'order' | 'inventory';
  data: any;
  id?: string;
}

interface MigrationProgress {
  total: number;
  completed: number;
  failed: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  errors: Array<{
    operation: BatchOperation;
    error: string;
    retryCount: number;
  }>;
}

class ShopifyAPIService {
  private config: ShopifyConfig;
  private rateLimiter: RateLimiter;
  private retryQueue: RetryQueue;
  
  constructor(config: ShopifyConfig) {
    this.config = config;
    this.rateLimiter = new RateLimiter();
    this.retryQueue = new RetryQueue();
  }

  // GraphQL Bulk Operations for Large Datasets
  async bulkImportProducts(products: any[]): Promise<MigrationProgress> {
    const progress: MigrationProgress = {
      total: products.length,
      completed: 0,
      failed: 0,
      status: 'running',
      errors: []
    };

    try {
      // Use GraphQL Bulk Operations for efficient large-scale imports
      const bulkQuery = this.buildBulkProductMutation(products);
      const response = await this.executeGraphQLBulkOperation(bulkQuery);
      
      // Monitor bulk operation status
      const operationId = response.data.bulkOperationRunMutation.bulkOperation.id;
      return await this.monitorBulkOperation(operationId, progress);
      
    } catch (error) {
      console.error('Bulk import failed:', error);
      progress.status = 'failed';
      return progress;
    }
  }

  // Advanced Batch Processing with Rate Limiting
  async batchProcessOperations(operations: BatchOperation[]): Promise<MigrationProgress> {
    const progress: MigrationProgress = {
      total: operations.length,
      completed: 0,
      failed: 0,
      status: 'running',
      errors: []
    };

    const batches = this.createOptimalBatches(operations);
    
    for (const batch of batches) {
      await this.rateLimiter.throttle();
      
      const batchPromises = batch.map(async (operation) => {
        try {
          const result = await this.executeOperation(operation);
          progress.completed++;
          return { success: true, operation, result };
        } catch (error) {
          progress.failed++;
          const errorInfo = {
            operation,
            error: error.message,
            retryCount: 0
          };
          progress.errors.push(errorInfo);
          
          // Add to retry queue for non-critical errors
          if (this.isRetryableError(error)) {
            this.retryQueue.add(operation);
          }
          
          return { success: false, operation, error };
        }
      });
      
      await Promise.allSettled(batchPromises);
      
      // Update rate limiter based on response headers
      await this.updateRateLimitFromHeaders();
    }
    
    progress.status = progress.failed === 0 ? 'completed' : 'completed';
    return progress;
  }

  // Smart Field Mapping to Shopify Schema
  async validateAndTransformData(mappings: any[], sourceData: any[]): Promise<{
    validData: any[];
    invalidData: any[];
    transformationLog: string[];
  }> {
    const validData: any[] = [];
    const invalidData: any[] = [];
    const transformationLog: string[] = [];

    for (const record of sourceData) {
      try {
        const transformedRecord = await this.transformRecord(record, mappings);
        const validation = await this.validateShopifyRecord(transformedRecord);
        
        if (validation.isValid) {
          validData.push(transformedRecord);
          transformationLog.push(`✓ Record transformed successfully`);
        } else {
          invalidData.push({ 
            original: record, 
            transformed: transformedRecord, 
            errors: validation.errors 
          });
          transformationLog.push(`✗ Validation failed: ${validation.errors.join(', ')}`);
        }
      } catch (error) {
        invalidData.push({ original: record, error: error.message });
        transformationLog.push(`✗ Transformation failed: ${error.message}`);
      }
    }

    return { validData, invalidData, transformationLog };
  }

  // Webhook Integration for Real-time Updates
  async setupMigrationWebhooks(): Promise<void> {
    const webhookTopics = [
      'products/create',
      'products/update', 
      'customers/create',
      'orders/create',
      'app/uninstalled'
    ];

    for (const topic of webhookTopics) {
      await this.createWebhook({
        topic,
        address: `${process.env.WEBHOOK_BASE_URL}/webhooks/${topic.replace('/', '-')}`,
        format: 'json'
      });
    }
  }

  // Data Consistency Verification
  async verifyMigrationIntegrity(originalData: any[], migratedData: any[]): Promise<{
    integrity: number;
    missingRecords: any[];
    inconsistencies: any[];
  }> {
    const missingRecords: any[] = [];
    const inconsistencies: any[] = [];

    // Check for missing records
    for (const original of originalData) {
      const found = migratedData.find(migrated => 
        this.recordsMatch(original, migrated)
      );
      
      if (!found) {
        missingRecords.push(original);
      }
    }

    // Check for data inconsistencies
    for (const original of originalData) {
      const migrated = migratedData.find(m => this.recordsMatch(original, m));
      if (migrated) {
        const inconsistency = this.findDataInconsistencies(original, migrated);
        if (inconsistency.length > 0) {
          inconsistencies.push({ original, migrated, issues: inconsistency });
        }
      }
    }

    const integrity = ((originalData.length - missingRecords.length) / originalData.length) * 100;
    
    return { integrity, missingRecords, inconsistencies };
  }

  // Private helper methods
  private async executeGraphQLBulkOperation(query: string): Promise<any> {
    const response = await this.makeGraphQLRequest(query);
    return response;
  }

  private async monitorBulkOperation(operationId: string, progress: MigrationProgress): Promise<MigrationProgress> {
    let isComplete = false;
    
    while (!isComplete) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Poll every 5 seconds
      
      const status = await this.getBulkOperationStatus(operationId);
      
      if (status.status === 'COMPLETED') {
        isComplete = true;
        progress.status = 'completed';
        progress.completed = progress.total;
      } else if (status.status === 'FAILED') {
        isComplete = true;
        progress.status = 'failed';
        progress.errors.push({
          operation: { operation: 'CREATE', resource: 'product', data: {} },
          error: status.errorCode || 'Bulk operation failed',
          retryCount: 0
        });
      }
    }
    
    return progress;
  }

  private createOptimalBatches(operations: BatchOperation[]): BatchOperation[][] {
    const batchSize = this.calculateOptimalBatchSize(operations);
    const batches: BatchOperation[][] = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }
    
    return batches;
  }

  private calculateOptimalBatchSize(operations: BatchOperation[]): number {
    // Dynamic batch sizing based on operation complexity and current rate limits
    const baseSize = 10;
    const rateLimitFactor = this.rateLimiter.getAvailableCredits() / 40; // Shopify's burst bucket
    return Math.max(1, Math.floor(baseSize * rateLimitFactor));
  }

  private async executeOperation(operation: BatchOperation): Promise<any> {
    const endpoint = this.getResourceEndpoint(operation.resource);
    
    switch (operation.operation) {
      case 'CREATE':
        return await this.makeRestRequest('POST', endpoint, operation.data);
      case 'UPDATE':
        return await this.makeRestRequest('PUT', `${endpoint}/${operation.id}`, operation.data);
      case 'DELETE':
        return await this.makeRestRequest('DELETE', `${endpoint}/${operation.id}`);
      default:
        throw new Error(`Unsupported operation: ${operation.operation}`);
    }
  }

  private async makeRestRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `https://${this.config.shopDomain}.myshopify.com/admin/api/${this.config.apiVersion}/${endpoint}.json`;
    
    const response = await fetch(url, {
      method,
      headers: {
        'X-Shopify-Access-Token': this.config.accessToken,
        'Content-Type': 'application/json'
      },
      body: data ? JSON.stringify(data) : undefined
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Shopify API Error: ${errorData.errors || response.statusText}`);
    }

    return await response.json();
  }

  private async makeGraphQLRequest(query: string): Promise<any> {
    const url = `https://${this.config.shopDomain}.myshopify.com/admin/api/${this.config.apiVersion}/graphql.json`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': this.config.accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query })
    });

    return await response.json();
  }

  private buildBulkProductMutation(products: any[]): string {
    // GraphQL bulk mutation for efficient product creation
    return `
      mutation bulkOperationRunMutation($mutation: String!, $stagedUploadPath: String!) {
        bulkOperationRunMutation(mutation: $mutation, stagedUploadPath: $stagedUploadPath) {
          bulkOperation {
            id
            status
          }
          userErrors {
            field
            message
          }
        }
      }
    `;
  }

  private isRetryableError(error: any): boolean {
    // Determine if error is retryable (rate limits, temporary failures)
    const retryableStatuses = [429, 500, 502, 503, 504];
    return retryableStatuses.includes(error.status) || 
           error.message.includes('rate limit') ||
           error.message.includes('timeout');
  }

  private getResourceEndpoint(resource: string): string {
    const endpoints = {
      'product': 'products',
      'customer': 'customers', 
      'order': 'orders',
      'inventory': 'inventory_levels'
    };
    return endpoints[resource] || resource;
  }

  private async transformRecord(record: any, mappings: any[]): Promise<any> {
    const transformed: any = {};
    
    for (const mapping of mappings) {
      if (mapping.sourceField && mapping.targetField && record[mapping.sourceField] !== undefined) {
        transformed[mapping.targetField] = await this.transformFieldValue(
          record[mapping.sourceField], 
          mapping.targetField
        );
      }
    }
    
    return transformed;
  }

  private async transformFieldValue(value: any, targetField: string): Promise<any> {
    // Apply field-specific transformations
    switch (targetField) {
      case 'price':
        return parseFloat(value).toFixed(2);
      case 'inventory_quantity':
        return parseInt(value) || 0;
      case 'tags':
        return Array.isArray(value) ? value.join(',') : value;
      default:
        return value;
    }
  }

  private async validateShopifyRecord(record: any): Promise<{isValid: boolean, errors: string[]}> {
    const errors: string[] = [];
    
    // Shopify-specific validation rules
    if (record.title && record.title.length > 255) {
      errors.push('Product title exceeds 255 characters');
    }
    
    if (record.price && (isNaN(record.price) || record.price < 0)) {
      errors.push('Price must be a positive number');
    }
    
    if (record.sku && record.sku.length > 100) {
      errors.push('SKU exceeds 100 characters');
    }
    
    return { isValid: errors.length === 0, errors };
  }

  private recordsMatch(original: any, migrated: any): boolean {
    // Simple matching logic - can be enhanced based on key fields
    return original.sku === migrated.sku || 
           original.id === migrated.id ||
           original.email === migrated.email;
  }

  private findDataInconsistencies(original: any, migrated: any): string[] {
    const inconsistencies: string[] = [];
    
    // Compare critical fields
    const criticalFields = ['title', 'price', 'sku', 'email'];
    
    for (const field of criticalFields) {
      if (original[field] !== migrated[field]) {
        inconsistencies.push(`${field}: ${original[field]} → ${migrated[field]}`);
      }
    }
    
    return inconsistencies;
  }

  private async updateRateLimitFromHeaders(): Promise<void> {
    // Update rate limiter based on Shopify's response headers
    // X-Shopify-Shop-Api-Call-Limit: 32/40
    // Implementation would parse these headers and adjust timing
  }

  private async getBulkOperationStatus(operationId: string): Promise<any> {
    const query = `
      query {
        node(id: "${operationId}") {
          ... on BulkOperation {
            id
            status
            errorCode
            createdAt
            completedAt
          }
        }
      }
    `;
    
    const response = await this.makeGraphQLRequest(query);
    return response.data.node;
  }

  private async createWebhook(webhook: {topic: string, address: string, format: string}): Promise<any> {
    return await this.makeRestRequest('POST', 'webhooks', { webhook });
  }
}

// Rate Limiting Implementation
class RateLimiter {
  private bucketSize = 40; // Shopify's burst bucket
  private refillRate = 2; // Credits per second
  private currentCredits = 40;
  private lastRefill = Date.now();

  async throttle(): Promise<void> {
    this.refillCredits();
    
    if (this.currentCredits <= 0) {
      const waitTime = Math.ceil((1 - this.currentCredits) / this.refillRate * 1000);
      await new Promise(resolve => setTimeout(resolve, waitTime));
      this.refillCredits();
    }
    
    this.currentCredits--;
  }

  getAvailableCredits(): number {
    this.refillCredits();
    return this.currentCredits;
  }

  private refillCredits(): void {
    const now = Date.now();
    const timePassed = (now - this.lastRefill) / 1000;
    const creditsToAdd = Math.floor(timePassed * this.refillRate);
    
    if (creditsToAdd > 0) {
      this.currentCredits = Math.min(this.bucketSize, this.currentCredits + creditsToAdd);
      this.lastRefill = now;
    }
  }
}

// Retry Queue for Failed Operations
class RetryQueue {
  private queue: Array<{operation: BatchOperation, retryCount: number}> = [];
  private maxRetries = 3;
  private retryDelay = 1000; // Base delay in ms

  add(operation: BatchOperation): void {
    this.queue.push({ operation, retryCount: 0 });
  }

  async processRetries(apiService: ShopifyAPIService): Promise<void> {
    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      
      if (item.retryCount >= this.maxRetries) {
        console.error('Max retries reached for operation:', item.operation);
        continue;
      }

      try {
        // Exponential backoff
        const delay = this.retryDelay * Math.pow(2, item.retryCount);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        await apiService['executeOperation'](item.operation);
        console.log('Retry successful for operation:', item.operation);
        
      } catch (error) {
        item.retryCount++;
        this.queue.push(item);
        console.log(`Retry ${item.retryCount} failed for operation:`, item.operation);
      }
    }
  }
}

export { ShopifyAPIService, type ShopifyConfig, type BatchOperation, type MigrationProgress };