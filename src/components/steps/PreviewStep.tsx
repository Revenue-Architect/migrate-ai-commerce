
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DataGridPreview } from './DataGridPreview';
import { Eye, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { geminiService, type ValidationResult } from '@/services/geminiService';
import { useToast } from '@/hooks/use-toast';

interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  reasoning: string;
  status?: 'mapped' | 'unmapped' | 'conflict';
}

interface PreviewStepProps {
  data: any[];
  mappings: FieldMapping[];
  filename: string;
  onNext: () => void;
  onBack: () => void;
}

export const PreviewStep = ({ data, mappings, filename, onNext, onBack }: PreviewStepProps) => {
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Defensive data validation
  const isDataValid = useMemo(() => {
    return (
      Array.isArray(data) && 
      data.length > 0 && 
      Array.isArray(mappings) && 
      mappings.length > 0 &&
      mappings.every(m => m && typeof m === 'object' && m.sourceField && typeof m.sourceField === 'string')
    );
  }, [data, mappings]);

  // Safe mapped data generation
  const mappedData = useMemo(() => {
    if (!isDataValid) {
      console.log('Invalid data for mapping:', { dataLength: data?.length, mappingsLength: mappings?.length });
      return [];
    }
    
    try {
      return data.slice(0, 10).map((row, index) => {
        const mapped: any = {};
        mappings.forEach(mapping => {
          try {
            if (mapping?.targetField && mapping?.sourceField && row) {
              mapped[mapping.targetField] = row[mapping.sourceField] || '';
            }
          } catch (err) {
            console.error('Error mapping field:', mapping, err);
          }
        });
        return mapped;
      });
    } catch (err) {
      console.error('Error creating mapped data:', err);
      return [];
    }
  }, [data, mappings, isDataValid]);

  // Safe statistics calculation
  const stats = useMemo(() => {
    if (!isDataValid) {
      return {
        totalRecords: 0,
        mappedFields: 0,
        highConfidenceMappings: 0,
        unmappedFields: 0
      };
    }
    
    try {
      const totalRecords = data.length;
      const validMappings = mappings.filter(m => m && m.targetField && m.targetField.trim() !== '');
      const mappedFields = validMappings.length;
      const highConfidenceMappings = mappings.filter(m => m && typeof m.confidence === 'number' && m.confidence >= 80).length;
      
      return {
        totalRecords,
        mappedFields,
        highConfidenceMappings,
        unmappedFields: mappings.length - mappedFields
      };
    } catch (err) {
      console.error('Error calculating stats:', err);
      return {
        totalRecords: 0,
        mappedFields: 0,
        highConfidenceMappings: 0,
        unmappedFields: 0
      };
    }
  }, [data, mappings, isDataValid]);

  // Basic validation function
  const performBasicValidation = (): ValidationResult => {
    const errors: any[] = [];
    const warnings: any[] = [];
    
    try {
      // Check for required fields
      const requiredFields = ['title', 'sku'];
      const mappedTargetFields = mappings
        .filter(m => m && m.targetField && m.targetField.trim() !== '')
        .map(m => m.targetField);
      
      requiredFields.forEach(required => {
        if (!mappedTargetFields.includes(required)) {
          errors.push({
            field: required,
            type: 'required',
            message: `Required field '${required}' is not mapped`,
            suggestions: [`Map a source field to ${required}`]
          });
        }
      });
      
      // Check for duplicate mappings
      const fieldCounts = mappedTargetFields.reduce((acc: any, field) => {
        acc[field] = (acc[field] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(fieldCounts).forEach(([field, count]) => {
        if ((count as number) > 1) {
          warnings.push({
            field,
            message: `Field '${field}' is mapped multiple times (${count} times)`
          });
        }
      });
      
      return {
        isValid: errors.length === 0,
        errors,
        warnings
      };
    } catch (err) {
      console.error('Error in basic validation:', err);
      return {
        isValid: false,
        errors: [{ field: 'system', message: 'Validation error occurred', type: 'invalid' }],
        warnings: []
      };
    }
  };

  // Initialize validation
  useEffect(() => {
    if (!isDataValid) {
      setError('Invalid data or mappings provided');
      setValidating(false);
      return;
    }

    const runValidation = async () => {
      try {
        setValidating(true);
        setError(null);
        
        // Try AI validation first
        const storedApiKey = localStorage.getItem('gemini_api_key');
        if (storedApiKey) {
          try {
            await geminiService.initialize(storedApiKey);
            const aiValidation = await Promise.race([
              geminiService.validateData(data, mappings),
              new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Validation timeout')), 10000)
              )
            ]) as ValidationResult;
            
            setValidation(aiValidation);
            
            toast({
              title: aiValidation.isValid ? "Validation Passed" : "Validation Issues Found",
              description: aiValidation.isValid 
                ? "Your data is ready for migration" 
                : `${aiValidation.errors.length} errors detected`,
              variant: aiValidation.isValid ? "default" : "destructive"
            });
            
          } catch (aiError) {
            console.error('AI validation failed:', aiError);
            // Fallback to basic validation
            const basicValidation = performBasicValidation();
            setValidation(basicValidation);
            
            toast({
              title: "Basic Validation Complete",
              description: "AI validation unavailable, using basic checks"
            });
          }
        } else {
          // No API key, use basic validation
          const basicValidation = performBasicValidation();
          setValidation(basicValidation);
          
          toast({
            title: "Basic Validation Complete",
            description: "Using basic validation checks"
          });
        }
      } catch (error) {
        console.error('Validation failed completely:', error);
        setError('Validation failed. Please try again.');
        
        // Emergency fallback
        setValidation({
          isValid: mappings.some(m => m?.targetField),
          errors: [],
          warnings: [{ field: 'system', message: 'Using minimal validation due to errors' }]
        });
      } finally {
        setValidating(false);
      }
    };

    runValidation();
  }, [data, mappings, isDataValid, toast]);

  // Early return for invalid data
  if (!isDataValid) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {error || 'Invalid data or mappings provided. Please go back and try again.'}
            </AlertDescription>
          </Alert>
          <div className="mt-4 space-x-2">
            <Button onClick={onBack}>Back to Mapping</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const canProceed = validation?.isValid && !validating && !error;

  return (
    <div className="space-y-6">
      {/* Validation Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-primary" />
            Data Validation Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {validating ? (
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Validating data...</span>
            </div>
          ) : error ? (
            <Alert className="border-red-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{stats.totalRecords}</div>
                <div className="text-sm text-muted-foreground">Total Records</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.mappedFields}</div>
                <div className="text-sm text-muted-foreground">Mapped Fields</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.highConfidenceMappings}</div>
                <div className="text-sm text-muted-foreground">High Confidence</div>
              </div>
              <div className="text-center">
                <div className={`text-2xl font-bold ${validation?.errors?.length ? 'text-red-600' : 'text-green-600'}`}>
                  {validation?.errors?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Validation Errors</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Errors */}
      {validation?.errors && validation.errors.length > 0 && (
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Validation Errors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {validation.errors.map((error, index) => (
              <Alert key={index} className="border-red-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">{error.field}:</span> {error.message}
                  {error.suggestions && error.suggestions.length > 0 && (
                    <div className="mt-1 text-sm">
                      Suggestions: {error.suggestions.join(', ')}
                    </div>
                  )}
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Validation Warnings */}
      {validation?.warnings && validation.warnings.length > 0 && (
        <Card className="border-yellow-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-5 w-5" />
              Warnings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {validation.warnings.map((warning, index) => (
              <Alert key={index} className="border-yellow-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <span className="font-medium">{warning.field}:</span> {warning.message}
                </AlertDescription>
              </Alert>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Mapped Data Preview */}
      {mappedData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Shopify-Ready Data Preview</span>
              <Badge variant="outline">{filename}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataGridPreview data={mappedData} filename={`${filename} (Shopify format)`} />
          </CardContent>
        </Card>
      )}

      {/* Field Mapping Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Mapping Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mappings.filter(m => m && m.targetField).map((mapping, index) => (
              <div key={index} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm font-medium">{mapping.sourceField}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">→</span>
                  <span className="text-sm">{mapping.targetField}</span>
                  <Badge variant={mapping.confidence >= 80 ? "default" : "secondary"} className="text-xs">
                    {mapping.confidence}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back to Mapping
        </Button>
        <Button 
          onClick={onNext} 
          disabled={!canProceed}
          className={canProceed ? "bg-green-600 hover:bg-green-700" : ""}
        >
          {canProceed ? (
            <>
              <CheckCircle className="h-4 w-4 mr-2" />
              Start Migration
            </>
          ) : validating ? (
            "Validating..."
          ) : error ? (
            "Fix Errors First"
          ) : (
            "Fix Validation Errors First"
          )}
        </Button>
      </div>
    </div>
  );
};
