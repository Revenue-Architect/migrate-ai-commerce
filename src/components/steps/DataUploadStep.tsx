
import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DataUploadStepProps {
  onDataUploaded: (data: any[], filename: string, platform?: string) => void;
  onNext: () => void;
}

const SUPPORTED_PLATFORMS = [
  { id: 'lightspeed', label: 'Lightspeed POS', description: 'Lightspeed Retail & Restaurant' },
  { id: 'square', label: 'Square POS', description: 'Square Point of Sale' },
  { id: 'heartland', label: 'Heartland POS', description: 'Heartland Payment Systems' },
  { id: 'teamworks', label: 'Teamwork Commerce', description: 'Teamwork Retail Management' },
  { id: 'magento', label: 'Magento', description: 'Magento eCommerce Platform' },
  { id: 'woocommerce', label: 'WooCommerce', description: 'WordPress WooCommerce' },
  { id: 'shopify_legacy', label: 'Shopify (Legacy)', description: 'Previous Shopify installation' },
  { id: 'custom', label: 'Custom/Other', description: 'Other POS or custom format' }
];

export const DataUploadStep = ({ onDataUploaded, onNext }: DataUploadStepProps) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string>('');
  const [uploadComplete, setUploadComplete] = useState(false);
  const { toast } = useToast();

  const processFile = useCallback(async (file: File) => {
    if (!selectedPlatform) {
      toast({
        title: "Platform Required",
        description: "Please select the source platform before uploading data",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const text = await file.text();
      
      let data: any[] = [];
      
      if (file.name.toLowerCase().endsWith('.csv')) {
        const lines = text.split('\n').filter(line => line.trim());
        if (lines.length < 2) {
          throw new Error('CSV file must have at least a header row and one data row');
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        data = lines.slice(1).map(line => {
          const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          return row;
        }).filter(row => Object.values(row).some(val => val !== ''));
        
      } else if (file.name.toLowerCase().endsWith('.json')) {
        const parsed = JSON.parse(text);
        data = Array.isArray(parsed) ? parsed : [parsed];
      } else {
        throw new Error('Unsupported file format. Please upload CSV or JSON files only.');
      }

      if (data.length === 0) {
        throw new Error('No valid data found in the file');
      }

      console.log('File processed successfully:', { 
        filename: file.name, 
        platform: selectedPlatform,
        recordCount: data.length,
        sampleRecord: data[0] 
      });

      setUploadedFile(file);
      setUploadComplete(true);
      onDataUploaded(data, file.name, selectedPlatform);
      
      toast({
        title: "Upload Successful",
        description: `Processed ${data.length} records from ${file.name}`,
      });

    } catch (error) {
      console.error('File processing error:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to process file",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedPlatform, onDataUploaded, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, [processFile]);

  const selectedPlatformInfo = SUPPORTED_PLATFORMS.find(p => p.id === selectedPlatform);

  return (
    <div className="space-y-6">
      {/* Platform Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Select Source Platform</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger>
              <SelectValue placeholder="Choose your current POS system..." />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_PLATFORMS.map(platform => (
                <SelectItem key={platform.id} value={platform.id}>
                  <div className="flex flex-col">
                    <span className="font-medium">{platform.label}</span>
                    <span className="text-xs text-muted-foreground">{platform.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          {selectedPlatformInfo && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Selected: <strong>{selectedPlatformInfo.label}</strong> - {selectedPlatformInfo.description}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* File Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Your Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
              isDragOver 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            } ${!selectedPlatform ? 'opacity-50 pointer-events-none' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
          >
            {!selectedPlatform ? (
              <div className="space-y-2">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">Please select a platform first</p>
              </div>
            ) : isLoading ? (
              <div className="space-y-2">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-muted-foreground">Processing file...</p>
              </div>
            ) : uploadComplete ? (
              <div className="space-y-2">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                <p className="font-medium text-green-600">Upload Complete!</p>
                <p className="text-sm text-muted-foreground">
                  {uploadedFile?.name} from {selectedPlatformInfo?.label}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-lg font-medium">Drop your data file here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />
                <label
                  htmlFor="file-upload"
                  className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer transition-colors"
                >
                  Choose File
                </label>
                <p className="text-xs text-muted-foreground">
                  Supports CSV and JSON formats
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Continue Button */}
      {uploadComplete && (
        <div className="flex justify-end">
          <Button onClick={onNext} className="px-8">
            Continue to AI Mapping
          </Button>
        </div>
      )}
    </div>
  );
};
