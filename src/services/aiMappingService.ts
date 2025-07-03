import { pipeline, env } from '@huggingface/transformers';

// Configure to use local models and disable remote model loading warnings
env.allowRemoteModels = false;
env.allowLocalModels = true;

interface FieldMappingResult {
  targetField: string;
  confidence: number;
  reasoning: string;
}

interface FieldAnalysis {
  sourceField: string;
  dataType: string;
  sampleValues: string[];
  mappingResult: FieldMappingResult;
}

class AIMappingService {
  private textGenerationPipeline: any = null;
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      // Use a smaller, efficient model for text generation
      // Note: Llama 3 8B is too large for browser inference
      // Using a smaller model that can run in the browser
      this.textGenerationPipeline = await pipeline(
        'text-generation',
        'Xenova/LaMini-Flan-T5-783M',
        { device: 'webgpu' }
      );
      this.isInitialized = true;
      console.log('AI Mapping Service initialized successfully');
    } catch (error) {
      console.warn('WebGPU not available, falling back to CPU:', error);
      try {
        this.textGenerationPipeline = await pipeline(
          'text-generation',
          'Xenova/LaMini-Flan-T5-783M'
        );
        this.isInitialized = true;
      } catch (fallbackError) {
        console.error('Failed to initialize AI pipeline:', fallbackError);
        this.isInitialized = false;
      }
    }
  }

  async analyzeFieldMapping(
    sourceFields: string[],
    sampleData: Record<string, any>[],
    targetSchema: Array<{id: string, label: string, type: string, required: boolean}>
  ): Promise<FieldAnalysis[]> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const analyses: FieldAnalysis[] = [];

    for (const sourceField of sourceFields) {
      const sampleValues = sampleData
        .slice(0, 5)
        .map(row => String(row[sourceField] || ''))
        .filter(val => val.trim() !== '');

      const dataType = this.inferDataType(sampleValues);
      const mappingResult = await this.findBestMapping(sourceField, sampleValues, dataType, targetSchema);

      analyses.push({
        sourceField,
        dataType,
        sampleValues,
        mappingResult
      });
    }

    return analyses;
  }

  private inferDataType(sampleValues: string[]): string {
    if (sampleValues.length === 0) return 'string';
    
    const firstValue = sampleValues[0];
    
    // Check for email
    if (/@/.test(firstValue)) return 'email';
    
    // Check for phone
    if (/^\+?[\d\s\-\(\)]+$/.test(firstValue)) return 'phone';
    
    // Check for number/price
    if (/^\d+\.?\d*$/.test(firstValue)) return 'number';
    
    // Check for date
    if (!isNaN(Date.parse(firstValue))) return 'date';
    
    return 'string';
  }

  private async findBestMapping(
    sourceField: string,
    sampleValues: string[],
    dataType: string,
    targetSchema: Array<{id: string, label: string, type: string}>
  ): Promise<FieldMappingResult> {
    // Create context for the AI
    const prompt = this.buildMappingPrompt(sourceField, sampleValues, dataType, targetSchema);
    
    try {
      if (this.textGenerationPipeline) {
        const result = await this.textGenerationPipeline(prompt, {
          max_length: 200,
          temperature: 0.1,
          do_sample: true
        });
        
        return this.parseMappingResponse(result[0].generated_text, targetSchema);
      }
    } catch (error) {
      console.error('AI mapping failed, falling back to rule-based:', error);
    }
    
    // Fallback to rule-based mapping
    return this.ruleBasedMapping(sourceField, sampleValues, dataType, targetSchema);
  }

  private buildMappingPrompt(
    sourceField: string,
    sampleValues: string[],
    dataType: string,
    targetSchema: Array<{id: string, label: string, type: string}>
  ): string {
    const schemaOptions = targetSchema.map(s => `${s.id}: ${s.label}`).join(', ');
    const samples = sampleValues.slice(0, 3).join(', ');
    
    return `Map the source field "${sourceField}" with data type "${dataType}" and sample values [${samples}] to the most appropriate Shopify field from these options: ${schemaOptions}. 

Respond with only the field ID and confidence (0-100). Format: fieldId|confidence|reasoning

Example: sku|95|Field name and sample values clearly indicate product SKU`;
  }

  private parseMappingResponse(response: string, targetSchema: Array<{id: string}>): FieldMappingResult {
    try {
      const lines = response.split('\n');
      const mappingLine = lines.find(line => line.includes('|'));
      
      if (mappingLine) {
        const [fieldId, confidenceStr, reasoning] = mappingLine.split('|');
        const targetField = targetSchema.find(s => s.id === fieldId.trim())?.id || '';
        const confidence = Math.min(100, Math.max(0, parseInt(confidenceStr) || 0));
        
        return {
          targetField,
          confidence,
          reasoning: reasoning || 'AI-based mapping'
        };
      }
    } catch (error) {
      console.error('Failed to parse AI response:', error);
    }
    
    return { targetField: '', confidence: 0, reasoning: 'Parsing failed' };
  }

  private ruleBasedMapping(
    sourceField: string,
    sampleValues: string[],
    dataType: string,
    targetSchema: Array<{id: string, label: string}>
  ): FieldMappingResult {
    const lowerField = sourceField.toLowerCase();
    
    // Enhanced pattern matching with confidence scoring
    const patterns = {
      'title': { patterns: ['name', 'title', 'product_name', 'item_name'], confidence: 90 },
      'description': { patterns: ['description', 'desc', 'details'], confidence: 95 },
      'sku': { patterns: ['sku', 'code', 'item_code', 'product_code'], confidence: 95 },
      'price': { patterns: ['price', 'cost', 'amount'], confidence: 90 },
      'vendor': { patterns: ['vendor', 'brand', 'manufacturer'], confidence: 85 },
      'inventory_quantity': { patterns: ['quantity', 'qty', 'stock', 'inventory'], confidence: 85 },
      'first_name': { patterns: ['first_name', 'fname', 'first'], confidence: 95 },
      'last_name': { patterns: ['last_name', 'lname', 'last', 'surname'], confidence: 95 },
      'email': { patterns: ['email', 'mail', 'email_address'], confidence: 95 },
      'phone': { patterns: ['phone', 'telephone', 'mobile', 'cell'], confidence: 90 }
    };

    let bestMatch = '';
    let bestConfidence = 0;
    let reasoning = 'Rule-based pattern matching';

    for (const [targetId, config] of Object.entries(patterns)) {
      for (const pattern of config.patterns) {
        if (lowerField.includes(pattern) || pattern.includes(lowerField)) {
          if (config.confidence > bestConfidence) {
            bestMatch = targetId;
            bestConfidence = config.confidence;
            reasoning = `Matched pattern "${pattern}" with high confidence`;
          }
        }
      }
    }

    // Data type validation boost
    if (dataType === 'email' && bestMatch === 'email') bestConfidence = Math.min(100, bestConfidence + 5);
    if (dataType === 'phone' && bestMatch === 'phone') bestConfidence = Math.min(100, bestConfidence + 5);
    if (dataType === 'number' && ['price', 'inventory_quantity'].includes(bestMatch)) {
      bestConfidence = Math.min(100, bestConfidence + 5);
    }

    return {
      targetField: bestMatch,
      confidence: bestConfidence,
      reasoning
    };
  }

  async validateMappings(mappings: Array<{sourceField: string, targetField: string, confidence: number}>): Promise<Array<{field: string, issues: string[]}>> {
    const issues: Array<{field: string, issues: string[]}> = [];
    
    // Check for duplicate mappings
    const targetFields = mappings.map(m => m.targetField).filter(Boolean);
    const duplicates = targetFields.filter((field, index) => targetFields.indexOf(field) !== index);
    
    duplicates.forEach(field => {
      issues.push({
        field,
        issues: ['Multiple source fields mapped to the same target field']
      });
    });

    // Check for low confidence mappings
    mappings.forEach(mapping => {
      if (mapping.confidence < 70 && mapping.targetField) {
        issues.push({
          field: mapping.sourceField,
          issues: [`Low confidence mapping (${mapping.confidence}%)`]
        });
      }
    });

    return issues;
  }
}

export const aiMappingService = new AIMappingService();