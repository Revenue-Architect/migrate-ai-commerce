import { GoogleGenerativeAI } from '@google/generative-ai';

interface SchemaDetectionResult {
  fields: Array<{
    name: string;
    type: 'string' | 'number' | 'date' | 'email' | 'phone' | 'currency' | 'boolean';
    confidence: number;
    sampleValues: string[];
  }>;
  detectedSource: 'square' | 'lightspeed' | 'revel' | 'unknown';
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

class GeminiService {
  private genAI: GoogleGenerativeAI | null = null;
  private model: any = null;
  private isInitialized = false;

  async initialize(apiKey: string) {
    if (this.isInitialized) return;
    
    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      this.isInitialized = true;
      console.log('Gemini AI service initialized');
    } catch (error) {
      console.error('Failed to initialize Gemini AI:', error);
      throw new Error('Failed to initialize AI service');
    }
  }

  async detectSchema(data: any[]): Promise<SchemaDetectionResult> {
    if (!this.isInitialized || !this.model) {
      throw new Error('Gemini service not initialized');
    }

    const sampleData = data.slice(0, 5);
    const fields = Object.keys(sampleData[0] || {});
    
    const prompt = `
Analyze this POS data structure and detect the schema:

Sample data (first 5 rows):
${JSON.stringify(sampleData, null, 2)}

Fields: ${fields.join(', ')}

Please analyze and respond in JSON format:
{
  "fields": [
    {
      "name": "field_name",
      "type": "string|number|date|email|phone|currency|boolean",
      "confidence": 0-100,
      "sampleValues": ["val1", "val2", "val3"]
    }
  ],
  "detectedSource": "square|lightspeed|revel|unknown",
  "confidence": 0-100
}

Consider common POS field patterns like SKU, product names, prices, customer info, etc.
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback to basic detection
      return this.fallbackSchemaDetection(data);
    } catch (error) {
      console.error('Schema detection failed:', error);
      return this.fallbackSchemaDetection(data);
    }
  }

  async suggestMappings(
    sourceFields: string[],
    sampleData: any[],
    schemaInfo: SchemaDetectionResult
  ): Promise<MappingResult[]> {
    if (!this.isInitialized || !this.model) {
      throw new Error('Gemini service not initialized');
    }

    const shopifyFields = [
      'title', 'description', 'vendor', 'product_type', 'sku', 'price',
      'compare_at_price', 'inventory_quantity', 'weight', 'tags',
      'first_name', 'last_name', 'email', 'phone', 'address1',
      'city', 'province', 'country', 'zip'
    ];

    const prompt = `
Map these POS data fields to Shopify fields:

Source fields with sample data:
${sourceFields.map(field => {
  const samples = sampleData.slice(0, 3).map(row => row[field]).filter(Boolean);
  return `${field}: [${samples.join(', ')}]`;
}).join('\n')}

Available Shopify fields: ${shopifyFields.join(', ')}

Detected POS system: ${schemaInfo.detectedSource}

Please suggest mappings in JSON format:
[
  {
    "sourceField": "source_field_name",
    "suggestedMapping": "shopify_field_name",
    "confidence": 0-100,
    "reasoning": "explanation for this mapping"
  }
]

Consider:
- Field names and their semantic meaning
- Sample data content and format
- Common POS to Shopify mapping patterns
- Data types and validation requirements
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return this.fallbackMappingDetection(sourceFields);
    } catch (error) {
      console.error('Mapping suggestion failed:', error);
      return this.fallbackMappingDetection(sourceFields);
    }
  }

  async validateData(
    data: any[],
    mappings: Array<{sourceField: string, targetField: string}>
  ): Promise<ValidationResult> {
    if (!this.isInitialized || !this.model) {
      throw new Error('Gemini service not initialized');
    }

    const mappedSample = data.slice(0, 10).map(row => {
      const mapped: any = {};
      mappings.forEach(mapping => {
        if (mapping.targetField) {
          mapped[mapping.targetField] = row[mapping.sourceField];
        }
      });
      return mapped;
    });

    const prompt = `
Validate this Shopify-mapped data for common issues:

Sample mapped data:
${JSON.stringify(mappedSample, null, 2)}

Field mappings:
${mappings.map(m => `${m.sourceField} -> ${m.targetField}`).join('\n')}

Check for:
- Required Shopify fields (title, sku for products; email for customers)
- Valid email formats
- Positive prices and quantities
- Duplicate SKUs
- Missing critical data
- Format issues

Respond in JSON:
{
  "isValid": boolean,
  "errors": [
    {
      "field": "field_name",
      "type": "required|format|duplicate|invalid",
      "message": "description",
      "suggestions": ["suggestion1", "suggestion2"]
    }
  ],
  "warnings": [
    {
      "field": "field_name",
      "message": "warning description"
    }
  ]
}
`;

    try {
      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      return this.fallbackValidation(data, mappings);
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

    // Basic validation
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

export const geminiService = new GeminiService();
export type { SchemaDetectionResult, MappingResult, ValidationResult };