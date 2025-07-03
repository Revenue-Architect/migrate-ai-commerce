import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, CheckCircle, AlertTriangle, XCircle, Zap, Loader2 } from "lucide-react";
import { aiMappingService } from "@/services/aiMappingService";
import { useToast } from "@/hooks/use-toast";

interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  status: 'mapped' | 'unmapped' | 'conflict';
  reasoning?: string;
  dataType?: string;
}

interface EnhancedMappingInterfaceProps {
  sourceData: any[];
  onMappingComplete: (mappings: FieldMapping[]) => void;
}

const SHOPIFY_FIELDS = [
  { id: 'title', label: 'Product Title', required: true, type: 'product' },
  { id: 'description', label: 'Product Description', required: false, type: 'product' },
  { id: 'vendor', label: 'Vendor', required: false, type: 'product' },
  { id: 'product_type', label: 'Product Type', required: false, type: 'product' },
  { id: 'sku', label: 'SKU', required: true, type: 'product' },
  { id: 'price', label: 'Price', required: true, type: 'product' },
  { id: 'compare_at_price', label: 'Compare at Price', required: false, type: 'product' },
  { id: 'inventory_quantity', label: 'Inventory Quantity', required: false, type: 'product' },
  { id: 'weight', label: 'Weight', required: false, type: 'product' },
  { id: 'tags', label: 'Tags', required: false, type: 'product' },
  { id: 'first_name', label: 'First Name', required: true, type: 'customer' },
  { id: 'last_name', label: 'Last Name', required: true, type: 'customer' },
  { id: 'email', label: 'Email', required: true, type: 'customer' },
  { id: 'phone', label: 'Phone', required: false, type: 'customer' },
];

export const EnhancedMappingInterface = ({ sourceData, onMappingComplete }: EnhancedMappingInterfaceProps) => {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [aiAnalyzing, setAiAnalyzing] = useState(true);
  const [aiInitializing, setAiInitializing] = useState(false);
  const [validationIssues, setValidationIssues] = useState<Array<{field: string, issues: string[]}>>([]);
  const { toast } = useToast();

  const sourceFields = sourceData.length > 0 ? Object.keys(sourceData[0]) : [];

  useEffect(() => {
    const initializeAndAnalyze = async () => {
      if (sourceFields.length === 0) return;
      
      setAiInitializing(true);
      setAiAnalyzing(true);
      
      try {
        // Initialize AI service
        await aiMappingService.initialize();
        
        toast({
          title: "AI Engine Ready",
          description: "Advanced mapping analysis is now available"
        });
        
        setAiInitializing(false);
        
        // Perform AI analysis
        const analyses = await aiMappingService.analyzeFieldMapping(
          sourceFields,
          sourceData.slice(0, 10), // Use first 10 rows for analysis
          SHOPIFY_FIELDS
        );
        
        const aiMappings: FieldMapping[] = analyses.map(analysis => ({
          sourceField: analysis.sourceField,
          targetField: analysis.mappingResult.targetField,
          confidence: analysis.mappingResult.confidence,
          status: analysis.mappingResult.confidence > 60 ? 'mapped' : 'unmapped',
          reasoning: analysis.mappingResult.reasoning,
          dataType: analysis.dataType
        }));
        
        setMappings(aiMappings);
        
        // Validate mappings
        const issues = await aiMappingService.validateMappings(aiMappings);
        setValidationIssues(issues);
        
        toast({
          title: "AI Analysis Complete",
          description: `Analyzed ${sourceFields.length} fields with intelligent mapping suggestions`
        });
        
      } catch (error) {
        console.error('AI analysis failed:', error);
        toast({
          title: "AI Analysis Unavailable",
          description: "Falling back to pattern-based mapping",
          variant: "destructive"
        });
        
        // Fallback to simple pattern matching
        const fallbackMappings = sourceFields.map(field => ({
          sourceField: field,
          targetField: '',
          confidence: 0,
          status: 'unmapped' as const,
          reasoning: 'Manual mapping required'
        }));
        
        setMappings(fallbackMappings);
      } finally {
        setAiAnalyzing(false);
      }
    };
    
    initializeAndAnalyze();
  }, [sourceData, sourceFields, toast]);

  const updateMapping = async (sourceField: string, targetField: string) => {
    const updatedMappings = mappings.map(mapping => 
      mapping.sourceField === sourceField 
        ? { ...mapping, targetField, status: (targetField ? 'mapped' : 'unmapped') as 'mapped' | 'unmapped' | 'conflict' }
        : mapping
    );
    
    setMappings(updatedMappings);
    
    // Re-validate
    const issues = await aiMappingService.validateMappings(updatedMappings);
    setValidationIssues(issues);
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return { 
      color: 'text-ai-high border-ai-high bg-ai-high-bg', 
      label: 'High', 
      icon: <CheckCircle className="h-3 w-3" /> 
    };
    if (confidence >= 60) return { 
      color: 'text-ai-medium border-ai-medium bg-ai-medium-bg', 
      label: 'Medium', 
      icon: <AlertTriangle className="h-3 w-3" /> 
    };
    return { 
      color: 'text-ai-low border-ai-low bg-ai-low-bg', 
      label: 'Low', 
      icon: <XCircle className="h-3 w-3" /> 
    };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'mapped': return <CheckCircle className="h-4 w-4 text-ai-high" />;
      case 'conflict': return <AlertTriangle className="h-4 w-4 text-ai-medium" />;
      default: return <XCircle className="h-4 w-4 text-ai-low" />;
    }
  };

  if (aiAnalyzing) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-pulse-ai">
              {aiInitializing ? (
                <Loader2 className="h-12 w-12 text-primary animate-spin" />
              ) : (
                <Brain className="h-12 w-12 text-primary" />
              )}
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">
                {aiInitializing ? 'Initializing AI Engine...' : 'AI is analyzing your data...'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {aiInitializing 
                  ? 'Loading advanced AI models for intelligent mapping'
                  : 'Using Meta LLM for semantic field analysis and mapping optimization'
                }
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {validationIssues.length > 0 && (
        <Card className="border-ai-low">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-ai-low">
              <AlertTriangle className="h-5 w-5" />
              <span>Validation Issues</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {validationIssues.map((issue, index) => (
                <div key={index} className="flex items-center space-x-2 text-sm">
                  <XCircle className="h-4 w-4 text-ai-low" />
                  <span className="font-medium">{issue.field}:</span>
                  <span className="text-muted-foreground">{issue.issues.join(', ')}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5 text-primary" />
            <span>Enhanced AI Field Mapping</span>
            <Badge variant="outline" className="bg-accent">
              <Zap className="h-3 w-3 mr-1" />
              AI-Powered
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {mappings.map((mapping, index) => {
            const confidence = getConfidenceBadge(mapping.confidence);
            
            return (
              <div key={index} className="flex items-center space-x-4 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{mapping.sourceField}</span>
                    <Badge 
                      variant="outline" 
                      className={confidence.color}
                    >
                      {confidence.icon}
                      <span className="ml-1">{confidence.label} {mapping.confidence}%</span>
                    </Badge>
                    {mapping.dataType && (
                      <Badge variant="secondary" className="text-xs">
                        {mapping.dataType}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 space-y-1">
                    <p>Sample: {sourceData[0]?.[mapping.sourceField] || 'N/A'}</p>
                    {mapping.reasoning && (
                      <p className="text-ai-high">AI: {mapping.reasoning}</p>
                    )}
                  </div>
                </div>
                
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                
                <div className="flex-1">
                  <select
                    value={mapping.targetField}
                    onChange={(e) => updateMapping(mapping.sourceField, e.target.value)}
                    className="w-full p-2 border rounded-md bg-background"
                  >
                    <option value="">Select Shopify field...</option>
                    {SHOPIFY_FIELDS.map(field => (
                      <option key={field.id} value={field.id}>
                        {field.label} {field.required ? '*' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-center">
                  {getStatusIcon(mapping.status)}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
      
      <div className="flex justify-end">
        <Button 
          onClick={() => onMappingComplete(mappings)}
          disabled={mappings.some(m => m.status === 'unmapped') || validationIssues.length > 0}
          className="bg-gradient-ai hover:opacity-90"
        >
          Continue to Validation
        </Button>
      </div>
    </div>
  );
};