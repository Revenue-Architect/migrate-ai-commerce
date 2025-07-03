import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, AlertCircle, CheckCircle } from "lucide-react";

interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  status: 'mapped' | 'unmapped' | 'conflict';
}

interface DataPreviewProps {
  sourceData: any[];
  mappings: FieldMapping[];
}

export const DataPreview = ({ sourceData, mappings }: DataPreviewProps) => {
  const mappedData = sourceData.slice(0, 5).map(row => {
    const mappedRow: any = {};
    mappings.forEach(mapping => {
      if (mapping.targetField && mapping.status === 'mapped') {
        mappedRow[mapping.targetField] = row[mapping.sourceField];
      }
    });
    return mappedRow;
  });

  const getValidationStatus = (field: string, value: any) => {
    // Simple validation rules
    if (!value || value.toString().trim() === '') {
      return { status: 'error', message: 'Required field is empty' };
    }
    
    if (field === 'email' && value && !value.includes('@')) {
      return { status: 'warning', message: 'Invalid email format' };
    }
    
    if (field === 'price' && value && isNaN(Number(value))) {
      return { status: 'warning', message: 'Price should be numeric' };
    }
    
    return { status: 'success', message: 'Valid' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Eye className="h-5 w-5 text-primary" />
          <span>Data Preview</span>
          <Badge variant="outline">{sourceData.length} total records</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Preview of your mapped data (showing first 5 records)
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-border rounded-lg">
              <thead>
                <tr className="bg-accent">
                  {Object.keys(mappedData[0] || {}).map(field => (
                    <th key={field} className="border border-border p-3 text-left text-sm font-medium">
                      {field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </th>
                  ))}
                  <th className="border border-border p-3 text-left text-sm font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {mappedData.map((row, index) => (
                  <tr key={index} className="hover:bg-accent/50">
                    {Object.entries(row).map(([field, value]) => {
                      const validation = getValidationStatus(field, value);
                      return (
                        <td key={field} className="border border-border p-3 text-sm">
                          <div className="flex items-center space-x-2">
                            <span className={`${
                              validation.status === 'error' ? 'text-destructive' : 
                              validation.status === 'warning' ? 'text-ai-medium' : 
                              'text-foreground'
                            }`}>
                              {value?.toString() || 'N/A'}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                    <td className="border border-border p-3">
                      <div className="flex items-center space-x-1">
                        {Object.entries(row).map(([field, value]) => {
                          const validation = getValidationStatus(field, value);
                          return validation.status === 'error' ? (
                            <AlertCircle key={field} className="h-4 w-4 text-destructive" />
                          ) : validation.status === 'warning' ? (
                            <AlertCircle key={field} className="h-4 w-4 text-ai-medium" />
                          ) : (
                            <CheckCircle key={field} className="h-4 w-4 text-ai-high" />
                          );
                        })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-4 bg-accent/50 rounded-lg">
            <h4 className="font-medium mb-2">Validation Summary</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <CheckCircle className="h-4 w-4 text-ai-high" />
                <span>Valid records: {sourceData.length - 2}</span>
              </div>
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-ai-medium" />
                <span>Warnings: 2</span>
              </div>
              <div className="flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span>Errors: 0</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};