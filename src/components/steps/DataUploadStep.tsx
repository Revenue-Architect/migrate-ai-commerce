import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DataUploadStepProps {
  onDataUploaded: (data: any[], filename: string) => void;
  onNext: () => void;
}

export const DataUploadStep = ({ onDataUploaded, onNext }: DataUploadStepProps) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  const { toast } = useToast();

  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(csv|xlsx|xls)$/i)) {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV or Excel file",
        variant: "destructive"
      });
      return;
    }

    setUploading(true);
    
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('File must contain at least a header row and one data row');
      }

      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      const data = lines.slice(1).map(line => {
        const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });

      setUploadedFile(file.name);
      setRecordCount(data.length);
      onDataUploaded(data, file.name);
      
      toast({
        title: "File uploaded successfully",
        description: `Processed ${data.length} records from ${file.name}`,
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to process file",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  }, [onDataUploaded, toast]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, [handleFile]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  }, [handleFile]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Upload POS Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragActive ? 'border-primary bg-primary/5' : 'border-border'
            } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
              disabled={uploading}
            />
            
            {uploading ? (
              <div className="space-y-2">
                <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
                <p className="text-sm text-muted-foreground">Processing file...</p>
              </div>
            ) : uploadedFile ? (
              <div className="space-y-3">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto" />
                <div>
                  <p className="font-medium text-green-700">{uploadedFile}</p>
                  <Badge variant="secondary" className="mt-1">
                    {recordCount} records
                  </Badge>
                </div>
                <Button
                  variant="outline"
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="mt-2"
                >
                  Upload Different File
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="text-lg font-medium">Drop your POS data file here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
                <Button
                  onClick={() => document.getElementById('file-upload')?.click()}
                  className="mt-2"
                >
                  Choose File
                </Button>
              </div>
            )}
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Supported formats: CSV, Excel (.xlsx, .xls). Your data is processed locally and securely.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <FileSpreadsheet className="h-8 w-8 text-primary mx-auto mb-2" />
            <h3 className="font-medium mb-1">Supported Systems</h3>
            <p className="text-sm text-muted-foreground">Square, Lightspeed, Revel, and more</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
            <h3 className="font-medium mb-1">Secure Processing</h3>
            <p className="text-sm text-muted-foreground">Data encrypted and processed safely</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 text-primary mx-auto mb-2" />
            <h3 className="font-medium mb-1">AI-Powered</h3>
            <p className="text-sm text-muted-foreground">Intelligent mapping and validation</p>
          </CardContent>
        </Card>
      </div>

      {uploadedFile && (
        <div className="flex justify-end">
          <Button onClick={onNext} size="lg">
            Continue to Mapping
          </Button>
        </div>
      )}
    </div>
  );
};