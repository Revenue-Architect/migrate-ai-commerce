import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Brain, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  status: 'mapped' | 'unmapped' | 'conflict';
}

interface MappingInterfaceProps {
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

export const MappingInterface = ({ sourceData, onMappingComplete }: MappingInterfaceProps) => {
  const [mappings, setMappings] = useState<FieldMapping[]>([]);
  const [aiAnalyzing, setAiAnalyzing] = useState(true);

  const sourceFields = sourceData.length > 0 ? Object.keys(sourceData[0]) : [];

  // Simulate AI analysis and auto-mapping
  useEffect(() => {
    const analyzeFields = async () => {
      setAiAnalyzing(true);
      
      // Simulate AI processing delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const autoMappings: FieldMapping[] = sourceFields.map(sourceField => {
        const lowerField = sourceField.toLowerCase();
        let bestMatch = '';
        let confidence = 0;
        
        // AI-like pattern matching logic
        for (const shopifyField of SHOPIFY_FIELDS) {
          const similarity = calculateSimilarity(lowerField, shopifyField.id);
          if (similarity > confidence) {
            confidence = similarity;
            bestMatch = shopifyField.id;
          }
        }
        
        return {
          sourceField,
          targetField: confidence > 0.6 ? bestMatch : '',
          confidence: Math.round(confidence * 100),
          status: confidence > 0.6 ? 'mapped' : 'unmapped'
        } as FieldMapping;
      });
      
      setMappings(autoMappings);
      setAiAnalyzing(false);
    };
    
    if (sourceFields.length > 0) {
      analyzeFields();
    }
  }, [sourceData]);

  const calculateSimilarity = (str1: string, str2: string): number => {
    // Simple similarity calculation based on common patterns
    const patterns = {
      'title': ['name', 'title', 'product_name', 'item_name'],
      'description': ['description', 'desc', 'details'],
      'sku': ['sku', 'code', 'item_code', 'product_code'],
      'price': ['price', 'cost', 'amount'],
      'vendor': ['vendor', 'brand', 'manufacturer'],
      'inventory_quantity': ['quantity', 'qty', 'stock', 'inventory'],
      'first_name': ['first_name', 'fname', 'first'],
      'last_name': ['last_name', 'lname', 'last', 'surname'],
      'email': ['email', 'mail', 'email_address'],
      'phone': ['phone', 'telephone', 'mobile', 'cell']
    };
    
    const targetPatterns = patterns[str2 as keyof typeof patterns] || [str2];
    return Math.max(...targetPatterns.map(pattern => {
      if (str1.includes(pattern) || pattern.includes(str1)) return 0.9;
      if (str1.startsWith(pattern) || pattern.startsWith(str1)) return 0.8;
      return 0;
    }));
  };

  const updateMapping = (sourceField: string, targetField: string) => {
    setMappings(prev => prev.map(mapping => 
      mapping.sourceField === sourceField 
        ? { ...mapping, targetField, status: targetField ? 'mapped' : 'unmapped' }
        : mapping
    ));
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return { color: 'ai-high', bg: 'ai-high-bg', label: 'High' };
    if (confidence >= 60) return { color: 'ai-medium', bg: 'ai-medium-bg', label: 'Medium' };
    return { color: 'ai-low', bg: 'ai-low-bg', label: 'Low' };
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
              <Brain className="h-12 w-12 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold">AI is analyzing your data...</h3>
              <p className="text-sm text-muted-foreground">
                Detecting field types and suggesting optimal mappings to Shopify
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
            <span>AI Field Mapping</span>
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
                      className={`text-${confidence.color} bg-${confidence.bg} border-${confidence.color}`}
                    >
                      {confidence.label} {mapping.confidence}%
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Sample: {sourceData[0]?.[mapping.sourceField] || 'N/A'}
                  </p>
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