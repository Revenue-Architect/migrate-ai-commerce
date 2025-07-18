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
  const [validating, setValidating] = useState(true);
  const { toast } = useToast();

  const mappedData = useMemo(() => {
    return data.map(row => {
      const mapped: any = {};
      mappings.forEach(mapping => {
        if (mapping.targetField) {
          mapped[mapping.targetField] = row[mapping.sourceField];
        }
      });
      return mapped;
    });
  }, [data, mappings]);

  const stats = useMemo(() => {
    const totalRecords = data.length;
    const mappedFields = mappings.filter(m => m.targetField).length;
    const highConfidenceMappings = mappings.filter(m => m.confidence >= 80).length;
    
    return {
      totalRecords,
      mappedFields,
      highConfidenceMappings,
      unmappedFields: mappings.length - mappedFields
    };
  }, [data, mappings]);

  useEffect(() => {
    const validateData = async () => {
      try {
        setValidating(true);
        
        // Check if geminiService is initialized
        const storedApiKey = localStorage.getItem('gemini_api_key');
        if (storedApiKey) {
          try {
            await geminiService.initialize(storedApiKey);
            const validationResult = await geminiService.validateData(data, mappings);
            setValidation(validationResult);
            
            if (validationResult.errors.length > 0) {
              toast({
                title: "Validation Issues Found",
                description: `${validationResult.errors.length} errors detected. Please review before proceeding.`,
                variant: "destructive"
              });
            } else {
              toast({
                title: "Validation Passed",
                description: "Your data is ready for migration to Shopify"
              });
            }
          } catch (aiError) {
            console.error('AI validation failed:', aiError);
            // Fall back to basic validation
            const basicValidation = performBasicValidation();
            setValidation(basicValidation);
            
            toast({
              title: "Basic Validation Complete",
              description: "AI validation unavailable, using basic checks"
            });
          }
        } else {
          // No API key available, use basic validation
          const basicValidation = performBasicValidation();
          setValidation(basicValidation);
          
          toast({
            title: "Basic Validation Complete",
            description: "AI validation requires API key, using basic checks"
          });
        }
      } catch (error) {
        console.error('Validation failed:', error);
        // Fallback to basic validation
        const basicValidation = performBasicValidation();
        setValidation(basicValidation);
        
        toast({
          title: "Validation Complete",
          description: "Using basic validation checks",
          variant: "default"
        });
      } finally {
        setValidating(false);
      }
    };

    const performBasicValidation = (): ValidationResult => {
      const errors: any[] = [];
      const warnings: any[] = [];
      
      // Check for required fields
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
      
      // Check for duplicate mappings
      const fieldCounts = mappedFields.reduce((acc: any, field) => {
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
    };

    validateData();
  }, [data, mappings, toast]);

  const canProceed = validation?.isValid && !validating;

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
                <div className={`text-2xl font-bold ${validation?.errors.length ? 'text-red-600' : 'text-green-600'}`}>
                  {validation?.errors.length || 0}
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

      {/* Field Mapping Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Mapping Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mappings.filter(m => m.targetField).map((mapping, index) => (
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
          ) : (
            "Fix Validation Errors First"
          )}
        </Button>
      </div>
    </div>
  );
};