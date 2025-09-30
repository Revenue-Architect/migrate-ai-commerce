import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, CheckCircle, AlertTriangle, XCircle, Zap, Loader2 } from "lucide-react";
import { cloudAIService } from "@/services/cloudAIService";
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
  const { toast } = useToast();

  const sourceFields = sourceData.length > 0 ? Object.keys(sourceData[0]) : [];

  useEffect(() => {
    const analyzeData = async () => {
      if (sourceFields.length === 0) return;
      
      setAiAnalyzing(true);
      
      try {
        toast({
          title: "AI Analysis Starting",
          description: "Using Lovable Cloud AI for intelligent mapping"
        });
        
        const schema = await cloudAIService.detectSchema(sourceData.slice(0, 10));
        
        const analyses = await cloudAIService.suggestMappings(
          sourceFields,
          sourceData.slice(0, 10),
          schema.detectedSource
        );
        
        const aiMappings: FieldMapping[] = analyses.map(analysis => ({
          sourceField: analysis.sourceField,
          targetField: analysis.suggestedMapping,
          confidence: analysis.confidence,
          status: analysis.confidence > 60 ? 'mapped' : 'unmapped',
          reasoning: analysis.reasoning,
          dataType: 'string'
        }));
        
        setMappings(aiMappings);
        
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
    
    analyzeData();
  }, [sourceData, sourceFields, toast]);

  const updateMapping = (sourceField: string, targetField: string) => {
    const updatedMappings = mappings.map(mapping => 
      mapping.sourceField === sourceField 
        ? { ...mapping, targetField, status: (targetField ? 'mapped' : 'unmapped') as 'mapped' | 'unmapped' | 'conflict' }
        : mapping
    );
    
    setMappings(updatedMappings);
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
              <Brain className="h-12 w-12 text-primary animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">AI is analyzing your data...</h3>
              <p className="text-sm text-muted-foreground">
                Using Lovable Cloud AI for semantic field analysis and mapping optimization
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
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
          disabled={mappings.some(m => m.status === 'unmapped')}
          className="bg-gradient-ai hover:opacity-90"
        >
          Continue to Validation
        </Button>
      </div>
    </div>
  );
};