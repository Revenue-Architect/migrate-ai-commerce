import { supabase } from "@/integrations/supabase/client";

interface SchemaDetectionResult {
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'date' | 'email' | 'phone' | 'currency' | 'boolean';
    confidence: number;
    sampleValues: string[];
  }>;
  detectedSource: 'square' | 'lightspeed' | 'revel' | 'heartland' | 'magento' | 'woocommerce' | 'teamworks' | 'unknown';
  confidence: number;
}

interface MappingResult {
  sourceField: string;
  suggestedMapping: string;
  confidence: number;
  reasoning: string;
}

interface ValidationResult {
  isValid: boolean;
  errors: Array<{
    field: string;
    type: 'required' | 'format' | 'duplicate' | 'invalid';
    message: string;
    suggestions?: string[];
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}

class CloudAIService {
  private async callEdgeFunction(action: string, data: any, timeoutMs: number = 30000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const { data: result, error } = await supabase.functions.invoke('analyze-data-migration', {
        body: { action, data },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (error) {
        console.error(`Edge function error for ${action}:`, error);
        throw error;
      }

      if (!result?.success) {
        throw new Error(result?.error || 'Edge function returned unsuccessful response');
      }

      return result.result;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again with less data.');
      }
      throw error;
    }
  }

  async detectSchema(data: any[]): Promise<SchemaDetectionResult> {
    try {
      const sampleData = data.slice(0, Math.min(3, data.length));
      const fields = Object.keys(sampleData[0] || {});

      const result = await this.callEdgeFunction('detectSchema', {
        sampleData,
        fields
      });

      return result;
    } catch (error) {
      console.error('Schema detection failed:', error);
      return this.fallbackSchemaDetection(data);
    }
  }

  async suggestMappings(
    sourceFields: string[],
    sampleData: any[],
    detectedSource: string
  ): Promise<MappingResult[]> {
    try {
      const result = await this.callEdgeFunction('suggestMappings', {
        sourceFields: sourceFields.slice(0, 20),
        sampleData: sampleData.slice(0, 2),
        detectedSource
      });

      return result;
    } catch (error) {
      console.error('Mapping suggestion failed:', error);
      return this.fallbackMappingDetection(sourceFields);
    }
  }

  async validateData(
    data: any[],
    mappings: Array<{sourceField: string, targetField: string}>
  ): Promise<ValidationResult> {
    try {
      const mappedSample = data.slice(0, 10).map(row => {
        const mapped: any = {};
        mappings.forEach(mapping => {
          if (mapping.targetField) {
            mapped[mapping.targetField] = row[mapping.sourceField];
          }
        });
        return mapped;
      });

      const result = await this.callEdgeFunction('validateData', {
        mappedSample,
        mappings
      });

      return result;
    } catch (error) {
      console.error('Data validation failed:', error);
      return this.fallbackValidation(data, mappings);
    }
  }

  private fallbackSchemaDetection(data: any[]): SchemaDetectionResult {
    if (!data.length) {
      return { fields: [], detectedSource: 'unknown', confidence: 0 };
    }

    const fields = Object.keys(data[0]).map(field => {
      const sampleValues = data.slice(0, 5).map(row => String(row[field] || '')).filter(Boolean);
      
      let type: any = 'string';
      if (sampleValues.some(val => val.includes('@'))) type = 'email';
      else if (sampleValues.some(val => /^\d+\.?\d*$/.test(val))) type = 'number';
      else if (sampleValues.some(val => !isNaN(Date.parse(val)))) type = 'date';

      return {
        name: field,
        type,
        confidence: 70,
        sampleValues: sampleValues.slice(0, 3)
      };
    });

    return {
      fields,
      detectedSource: 'unknown',
      confidence: 50
    };
  }

  private fallbackMappingDetection(sourceFields: string[]): MappingResult[] {
    const patterns: Record<string, string[]> = {
      'title': ['name', 'title', 'product_name'],
      'sku': ['sku', 'code', 'item_code'],
      'price': ['price', 'cost', 'amount'],
      'email': ['email', 'mail', 'email_address'],
      'first_name': ['first_name', 'fname'],
      'last_name': ['last_name', 'lname']
    };

    return sourceFields.map(field => {
      const lowerField = field.toLowerCase();
      
      for (const [target, keywords] of Object.entries(patterns)) {
        if (keywords.some(keyword => lowerField.includes(keyword))) {
          return {
            sourceField: field,
            suggestedMapping: target,
            confidence: 80,
            reasoning: `Pattern match: ${field} contains "${keywords.find(k => lowerField.includes(k))}"`
          };
        }
      }

      return {
        sourceField: field,
        suggestedMapping: '',
        confidence: 0,
        reasoning: 'No clear pattern match found'
      };
    });
  }

  private fallbackValidation(
    data: any[],
    mappings: Array<{sourceField: string, targetField: string}>
  ): ValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    const requiredFields = ['title', 'sku'];
    const mappedFields = mappings.map(m => m.targetField).filter(Boolean);
    
    requiredFields.forEach(required => {
      if (!mappedFields.includes(required)) {
        errors.push({
          field: required,
          type: 'required',
          message: `Required field '${required}' is not mapped`,
          suggestions: [`Map a source field to ${required}`]
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

export const cloudAIService = new CloudAIService();
export type { SchemaDetectionResult, MappingResult, ValidationResult };
