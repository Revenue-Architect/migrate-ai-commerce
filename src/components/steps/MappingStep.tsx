import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Brain, ArrowRight, AlertTriangle, CheckCircle, Settings } from 'lucide-react';
import { geminiService, type MappingResult, type SchemaDetectionResult } from '@/services/geminiService';
import { useToast } from '@/hooks/use-toast';

interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  reasoning: string;
}

interface MappingStepProps {
  data: any[];
  sourcePlatform?: string;
  onMappingComplete: (mappings: FieldMapping[]) => void;
  onNext: () => void;
  onBack: () => void;
}

const SHOPIFY_FIELDS = [
  { id: 'title', label: 'Product Title', required: true, category: 'product' },
  { id: 'description', label: 'Product Description', required: false, category: 'product' },
  { id: 'vendor', label: 'Vendor', required: false, category: 'product' },
  { id: 'product_type', label: 'Product Type', required: false, category: 'product' },
  { id: 'sku', label: 'SKU', required: true, category: 'product' },
  { id: 'price', label: 'Price', required: true, category: 'product' },
  { id: 'compare_at_price', label: 'Compare at Price', required: false, category: 'product' },
  { id: 'inventory_quantity', label: 'Inventory Quantity', required: false, category: 'product' },
  { id: 'weight', label: 'Weight', required: false, category: 'product' },
  { id: 'tags', label: 'Tags', required: false, category: 'product' },
  { id: 'first_name', label: 'First Name', required: true, category: 'customer' },
  { id: 'last_name', label: 'Last Name', required: true, category: 'customer' },
  { id: 'email', label: 'Email', required: true, category: 'customer' },
  { id: 'phone', label: 'Phone', required: false, category: 'customer' },
];

export const MappingStep = ({ data, sourcePlatform, onMappingComplete, onNext, onBack }: MappingStepProps) => {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [analyzing, setAnalyzing] = useState(true);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [schemaInfo, setSchemaInfo] = useState<SchemaDetectionResult | null>(null);
  const { toast } = useToast();

  const sourceFields = data.length > 0 ? Object.keys(data[0]) : [];

  useEffect(() => {
    const initializeAI = async () => {
      // Check if we have an API key stored
      const storedApiKey = localStorage.getItem('gemini_api_key');
      if (storedApiKey) {
        setGeminiApiKey(storedApiKey);
        await performAIAnalysis(storedApiKey);
      } else {
        setShowApiKeyInput(true);
        setAnalyzing(false);
      }
    };

    if (sourceFields.length > 0) {
      initializeAI();
    }
  }, [sourceFields.length]); // Fix: Use sourceFields.length instead of data to prevent infinite loops

  const performAIAnalysis = async (apiKey: string) => {
    try {
      setAnalyzing(true);
      
      // Add timeout for AI operations
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('AI analysis timeout')), 30000)
      );
      
      await Promise.race([
        geminiService.initialize(apiKey),
        timeoutPromise
      ]);
      
      // Detect schema with platform context
      const schema = await Promise.race([
        geminiService.detectSchema(data),
        timeoutPromise
      ]) as SchemaDetectionResult;
      setSchemaInfo(schema);
      
      // Get AI mapping suggestions with platform context
      const suggestions = await Promise.race([
        geminiService.suggestMappings(sourceFields, data, schema),
        timeoutPromise
      ]) as MappingResult[];
      
      const aiMappings: FieldMapping[] = suggestions.map(suggestion => ({
        sourceField: suggestion.sourceField,
        targetField: suggestion.suggestedMapping,
        confidence: suggestion.confidence,
        reasoning: suggestion.reasoning
      }));
      
      setMappings(aiMappings);
      
      const platformText = sourcePlatform ? ` from ${sourcePlatform}` : '';
      toast({
        title: "AI Analysis Complete",
        description: `Detected ${schema.detectedSource} POS system${platformText} with ${suggestions.length} field mappings`,
      });
      
    } catch (error) {
      console.error('AI analysis failed:', error);
      toast({
        title: "AI Analysis Failed",
        description: error instanceof Error && error.message.includes('timeout') 
          ? "Analysis timed out - using basic pattern matching instead" 
          : "Using basic pattern matching instead",
        variant: "destructive"
      });
      
      // Fallback to basic mapping
      const basicMappings = sourceFields.map(field => ({
        sourceField: field,
        targetField: '',
        confidence: 0,
        reasoning: 'Manual mapping required'
      }));
      setMappings(basicMappings);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApiKeySubmit = async () => {
    if (!geminiApiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your Google Gemini API key",
        variant: "destructive"
      });
      return;
    }

    localStorage.setItem('gemini_api_key', geminiApiKey);
    setShowApiKeyInput(false);
    await performAIAnalysis(geminiApiKey);
  };

  const updateMapping = (sourceField: string, targetField: string) => {
    const updatedMappings = mappings.map(mapping =>
      mapping.sourceField === sourceField
        ? { ...mapping, targetField: targetField === 'no-mapping' ? '' : targetField, confidence: targetField && targetField !== 'no-mapping' ? 100 : 0 }
        : mapping
    );
    setMappings(updatedMappings);
    onMappingComplete(updatedMappings);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return { variant: "default" as const, label: "High", color: "text-green-600" };
    if (confidence >= 60) return { variant: "secondary" as const, label: "Medium", color: "text-yellow-600" };
    return { variant: "outline" as const, label: "Low", color: "text-red-600" };
  };

  const requiredMappings = SHOPIFY_FIELDS.filter(f => f.required).map(f => f.id);
  const mappedRequiredFields = mappings.filter(m => m.targetField && requiredMappings.includes(m.targetField));
  const canProceed = mappedRequiredFields.length >= Math.min(2, requiredMappings.length); // At least 2 required fields

  if (showApiKeyInput) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            AI Configuration Required
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Brain className="h-4 w-4" />
            <AlertDescription>
              To enable AI-powered mapping, please provide your Google Gemini API key. Your key is stored locally and only used for AI analysis.
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <label className="text-sm font-medium">Google Gemini API Key</label>
            <Input
              type="password"
              placeholder="Enter your Gemini API key..."
              value={geminiApiKey}
              onChange={(e) => setGeminiApiKey(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleApiKeySubmit()}
            />
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleApiKeySubmit} disabled={!geminiApiKey.trim()}>
              Enable AI Mapping
            </Button>
            <Button variant="outline" onClick={onBack}>
              Back
            </Button>
          </div>
          
          <div className="text-xs text-muted-foreground">
            Don't have an API key? Get one at{' '}
            <a href="https://makersuite.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
              Google AI Studio
            </a>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (analyzing) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin h-12 w-12 border-2 border-primary border-t-transparent rounded-full" />
            <div className="text-center">
              <h3 className="text-lg font-semibold">AI Analysis in Progress</h3>
              <p className="text-sm text-muted-foreground">
                Analyzing your data structure and suggesting optimal field mappings...
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {schemaInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                Schema Detection Results
              </div>
              <div className="flex gap-2">
                {sourcePlatform && (
                  <Badge variant="secondary">
                    Source: {sourcePlatform}
                  </Badge>
                )}
                <Badge variant="outline">
                  {schemaInfo.detectedSource} • {schemaInfo.confidence}% confidence
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Detected as {schemaInfo.detectedSource} POS system data with {schemaInfo.fields.length} fields analyzed.
              {sourcePlatform && sourcePlatform !== schemaInfo.detectedSource && (
                <span className="text-amber-600 ml-1">
                  (Note: Detected format differs from selected platform)
                </span>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Field Mapping</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mappings.map((mapping, index) => {
            const confidence = getConfidenceBadge(mapping.confidence);
            const sampleValue = data[0]?.[mapping.sourceField];
            
            return (
              <div key={index} className="flex items-center gap-4 p-4 border rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{mapping.sourceField}</span>
                    <Badge variant={confidence.variant} className={confidence.color}>
                      {confidence.label} {mapping.confidence > 0 && `${mapping.confidence}%`}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Sample: {sampleValue || 'N/A'}</p>
                    {mapping.reasoning && (
                      <p className="text-primary">AI: {mapping.reasoning}</p>
                    )}
                  </div>
                </div>
                
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                
                <div className="flex-1">
                  <Select 
                    value={mapping.targetField} 
                    onValueChange={(value) => updateMapping(mapping.sourceField, value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Shopify field..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-mapping">No mapping</SelectItem>
                      {SHOPIFY_FIELDS.map(field => (
                        <SelectItem key={field.id} value={field.id}>
                          <div className="flex items-center gap-2">
                            {field.label}
                            {field.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-shrink-0">
                  {mapping.targetField ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back to Upload
        </Button>
        <Button onClick={() => { onMappingComplete(mappings); onNext(); }} disabled={!canProceed}>
          Continue to Preview ({mappedRequiredFields.length} required fields mapped)
        </Button>
      </div>
    </div>
  );
};
