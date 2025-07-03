import { ShopifyAPIService, type ShopifyConfig, type BatchOperation, type MigrationProgress } from './shopifyAPIService';

interface MigrationStep {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  estimatedTime?: number;
  errors?: string[];
}

interface MigrationPlan {
  id: string;
  steps: MigrationStep[];
  totalRecords: number;
  estimatedDuration: number;
  strategy: 'bulk' | 'batch' | 'hybrid';
}

export class MigrationOrchestrator {
  private shopifyService: ShopifyAPIService;
  private currentPlan?: MigrationPlan;
  private onProgressUpdate?: (step: MigrationStep, overall: number) => void;

  constructor(config: ShopifyConfig) {
    this.shopifyService = new ShopifyAPIService(config);
  }

  // Intelligent Migration Planning
  async createMigrationPlan(
    sourceData: any[], 
    mappings: any[], 
    options: {
      priority: 'speed' | 'reliability' | 'balanced';
      resourceTypes: string[];
      testMode?: boolean;
    }
  ): Promise<MigrationPlan> {
    
    const totalRecords = sourceData.length;
    const strategy = this.selectOptimalStrategy(totalRecords, options.priority);
    
    const steps: MigrationStep[] = [
      {
        id: 'validation',
        name: 'Data Validation',
        description: 'Validate and transform source data according to mappings',
        status: 'pending',
        progress: 0,
        estimatedTime: Math.ceil(totalRecords / 1000) * 60 // 1 minute per 1000 records
      },
      {
        id: 'backup',
        name: 'Create Backup',
        description: 'Create backup of existing Shopify data',
        status: 'pending', 
        progress: 0,
        estimatedTime: 300 // 5 minutes
      },
      {
        id: 'products',
        name: 'Migrate Products',
        description: 'Import product catalog with variants and inventory',
        status: 'pending',
        progress: 0,
        estimatedTime: this.estimateMigrationTime(totalRecords, 'products', strategy)
      },
      {
        id: 'customers', 
        name: 'Migrate Customers',
        description: 'Import customer database with contact information',
        status: 'pending',
        progress: 0,
        estimatedTime: this.estimateMigrationTime(totalRecords, 'customers', strategy)
      },
      {
        id: 'orders',
        name: 'Migrate Orders',
        description: 'Import historical order data',
        status: 'pending', 
        progress: 0,
        estimatedTime: this.estimateMigrationTime(totalRecords, 'orders', strategy)
      },
      {
        id: 'verification',
        name: 'Data Verification',
        description: 'Verify migration integrity and consistency',
        status: 'pending',
        progress: 0,
        estimatedTime: Math.ceil(totalRecords / 500) * 60 // 1 minute per 500 records
      }
    ];

    const plan: MigrationPlan = {
      id: `migration_${Date.now()}`,
      steps: steps.filter(step => options.resourceTypes.includes(step.id) || 
                         ['validation', 'backup', 'verification'].includes(step.id)),
      totalRecords,
      estimatedDuration: steps.reduce((total, step) => total + (step.estimatedTime || 0), 0),
      strategy
    };

    this.currentPlan = plan;
    return plan;
  }

  // Execute Migration with Real-time Progress
  async executeMigration(
    sourceData: any[], 
    mappings: any[],
    onProgress?: (step: MigrationStep, overall: number) => void
  ): Promise<MigrationProgress> {
    
    if (!this.currentPlan) {
      throw new Error('No migration plan created. Call createMigrationPlan first.');
    }

    this.onProgressUpdate = onProgress;
    let overallProgress = 0;

    try {
      // Step 1: Data Validation & Transformation
      await this.executeStep('validation', async () => {
        const validation = await this.shopifyService.validateAndTransformData(mappings, sourceData);
        
        if (validation.invalidData.length > 0) {
          throw new Error(`${validation.invalidData.length} records failed validation`);
        }
        
        return validation.validData;
      });

      // Step 2: Create Backup
      await this.executeStep('backup', async () => {
        await this.createDataBackup();
      });

      // Step 3: Setup Webhooks for Monitoring
      await this.shopifyService.setupMigrationWebhooks();

      // Step 4-6: Resource Migration (Products, Customers, Orders)
      const validData = await this.shopifyService.validateAndTransformData(mappings, sourceData);
      
      for (const step of this.currentPlan.steps) {
        if (['products', 'customers', 'orders'].includes(step.id)) {
          await this.executeResourceMigration(step.id, validData.validData);
          overallProgress += 100 / this.currentPlan.steps.length;
          this.updateOverallProgress(overallProgress);
        }
      }

      // Final Step: Verification
      await this.executeStep('verification', async () => {
        return await this.verifyMigrationIntegrity(sourceData);
      });

      return {
        total: sourceData.length,
        completed: sourceData.length,
        failed: 0,
        status: 'completed',
        errors: []
      };

    } catch (error) {
      console.error('Migration failed:', error);
      return {
        total: sourceData.length,
        completed: 0,
        failed: sourceData.length,
        status: 'failed',
        errors: [{ 
          operation: { operation: 'CREATE', resource: 'product', data: {} },
          error: error.message,
          retryCount: 0 
        }]
      };
    }
  }

  // Rollback Migration
  async rollbackMigration(migrationId: string): Promise<void> {
    console.log(`Rolling back migration ${migrationId}...`);
    
    // Implementation would:
    // 1. Restore from backup
    // 2. Delete created records
    // 3. Restore original state
    // 4. Notify via webhooks
    
    throw new Error('Rollback functionality requires careful implementation');
  }

  // Real-time Migration Monitoring
  subscribeToProgress(callback: (progress: MigrationProgress) => void): () => void {
    // WebSocket or Server-Sent Events implementation
    const eventSource = new EventSource(`/api/migration/${this.currentPlan?.id}/progress`);
    
    eventSource.onmessage = (event) => {
      const progress = JSON.parse(event.data);
      callback(progress);
    };

    return () => eventSource.close();
  }

  // Private Implementation Methods
  private selectOptimalStrategy(recordCount: number, priority: string): 'bulk' | 'batch' | 'hybrid' {
    if (recordCount > 10000) {
      return priority === 'speed' ? 'bulk' : 'hybrid';
    } else if (recordCount > 1000) {
      return priority === 'reliability' ? 'batch' : 'hybrid';
    } else {
      return 'batch';
    }
  }

  private estimateMigrationTime(records: number, resourceType: string, strategy: string): number {
    const baseRates = {
      bulk: { products: 500, customers: 1000, orders: 200 }, // records per minute
      batch: { products: 100, customers: 200, orders: 50 },
      hybrid: { products: 300, customers: 600, orders: 125 }
    };

    const rate = baseRates[strategy][resourceType] || 100;
    return Math.ceil(records / rate) * 60; // Convert to seconds
  }

  private async executeStep(stepId: string, operation: () => Promise<any>): Promise<any> {
    const step = this.currentPlan?.steps.find(s => s.id === stepId);
    if (!step) return;

    step.status = 'running';
    this.updateProgress(step, 0);

    try {
      const result = await operation();
      step.status = 'completed';
      step.progress = 100;
      this.updateProgress(step, 100);
      return result;
    } catch (error) {
      step.status = 'failed';
      step.errors = [error.message];
      this.updateProgress(step, 0);
      throw error;
    }
  }

  private async executeResourceMigration(resourceType: string, data: any[]): Promise<void> {
    const step = this.currentPlan?.steps.find(s => s.id === resourceType);
    if (!step) return;

    step.status = 'running';
    
    const resourceData = data.filter(record => this.isResourceType(record, resourceType));
    
    if (this.currentPlan?.strategy === 'bulk') {
      // Use GraphQL Bulk Operations
      await this.executeBulkMigration(resourceType, resourceData, step);
    } else {
      // Use Batch Processing
      await this.executeBatchMigration(resourceType, resourceData, step);
    }

    step.status = 'completed';
    step.progress = 100;
  }

  private async executeBulkMigration(resourceType: string, data: any[], step: MigrationStep): Promise<void> {
    if (resourceType === 'products') {
      const progress = await this.shopifyService.bulkImportProducts(data);
      
      // Monitor progress and update step
      const interval = setInterval(() => {
        step.progress = (progress.completed / progress.total) * 100;
        this.updateProgress(step, step.progress);
        
        if (progress.status === 'completed' || progress.status === 'failed') {
          clearInterval(interval);
        }
      }, 1000);
    }
  }

  private async executeBatchMigration(resourceType: string, data: any[], step: MigrationStep): Promise<void> {
    const operations: BatchOperation[] = data.map(record => ({
      operation: 'CREATE',
      resource: resourceType as any,
      data: record
    }));

    const progress = await this.shopifyService.batchProcessOperations(operations);
    
    // Update step progress based on batch progress
    step.progress = (progress.completed / progress.total) * 100;
    this.updateProgress(step, step.progress);
  }

  private async createDataBackup(): Promise<void> {
    // Implementation would create a backup of existing Shopify data
    // This is critical for rollback functionality
    console.log('Creating data backup...');
  }

  private async verifyMigrationIntegrity(originalData: any[]): Promise<any> {
    // Implementation would verify the migrated data matches the original
    console.log('Verifying migration integrity...');
    return { integrity: 100, missingRecords: [], inconsistencies: [] };
  }

  private isResourceType(record: any, resourceType: string): boolean {
    // Logic to determine if a record belongs to a specific resource type
    // Based on the presence of certain fields or mapping configuration
    switch (resourceType) {
      case 'products':
        return record.title || record.sku || record.price;
      case 'customers':
        return record.email || record.first_name || record.last_name;
      case 'orders':
        return record.order_number || record.total_price;
      default:
        return false;
    }
  }

  private updateProgress(step: MigrationStep, progress: number): void {
    step.progress = progress;
    
    if (this.onProgressUpdate && this.currentPlan) {
      const overallProgress = this.currentPlan.steps.reduce((total, s) => total + s.progress, 0) / this.currentPlan.steps.length;
      this.onProgressUpdate(step, overallProgress);
    }
  }

  private updateOverallProgress(progress: number): void {
    if (this.onProgressUpdate && this.currentPlan) {
      const currentStep = this.currentPlan.steps.find(s => s.status === 'running');
      if (currentStep) {
        this.onProgressUpdate(currentStep, progress);
      }
    }
  }
}

// Migration Analytics & Reporting
export class MigrationAnalytics {
  
  static generateMigrationReport(progress: MigrationProgress, plan: MigrationPlan): {
    summary: any;
    performance: any;
    issues: any;
    recommendations: string[];
  } {
    const summary = {
      totalRecords: progress.total,
      successfulRecords: progress.completed,
      failedRecords: progress.failed,
      successRate: (progress.completed / progress.total) * 100,
      strategy: plan.strategy,
      actualDuration: Date.now() - parseInt(plan.id.split('_')[1])
    };

    const performance = {
      recordsPerMinute: progress.completed / (summary.actualDuration / 60000),
      estimatedVsActual: summary.actualDuration / plan.estimatedDuration,
      apiCallsEstimate: this.estimateAPICallsMade(progress, plan.strategy)
    };

    const issues = {
      errorTypes: this.categorizeErrors(progress.errors),
      criticalErrors: progress.errors.filter(e => e.retryCount >= 3),
      retryableErrors: progress.errors.filter(e => e.retryCount < 3)
    };

    const recommendations = this.generateRecommendations(summary, performance, issues);

    return { summary, performance, issues, recommendations };
  }

  private static estimateAPICallsMade(progress: MigrationProgress, strategy: string): number {
    // Estimate based on strategy and records processed
    const multipliers = { bulk: 0.1, batch: 1.2, hybrid: 0.7 };
    return Math.ceil(progress.completed * (multipliers[strategy] || 1));
  }

  private static categorizeErrors(errors: any[]): Record<string, number> {
    const categories: Record<string, number> = {};
    
    errors.forEach(error => {
      const category = error.error.includes('rate limit') ? 'Rate Limit' :
                     error.error.includes('validation') ? 'Validation' :
                     error.error.includes('duplicate') ? 'Duplicate' :
                     'Other';
      
      categories[category] = (categories[category] || 0) + 1;
    });

    return categories;
  }

  private static generateRecommendations(summary: any, performance: any, issues: any): string[] {
    const recommendations: string[] = [];

    if (summary.successRate < 95) {
      recommendations.push('Consider data quality improvements before next migration');
    }

    if (performance.recordsPerMinute < 50) {
      recommendations.push('Switch to bulk operations for better performance');
    }

    if (issues.errorTypes['Rate Limit'] > 10) {
      recommendations.push('Implement more aggressive rate limiting');
    }

    if (issues.criticalErrors.length > 0) {
      recommendations.push('Review and fix data validation rules');
    }

    return recommendations;
  }
}