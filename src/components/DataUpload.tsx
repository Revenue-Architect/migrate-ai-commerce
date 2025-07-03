import { useState, useCallback } from "react";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface DataUploadProps {
  onDataUploaded: (data: any[], filename: string) => void;
}

export const DataUpload = ({ onDataUploaded }: DataUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const parseCSV = (text: string): any[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim().replace(/"/g, ''));
      return headers.reduce((obj, header, index) => {
        obj[header] = values[index] || '';
        return obj;
      }, {} as any);
    });
  };

  const handleFile = useCallback(async (file: File) => {
    if (!file) return;
    
    setIsProcessing(true);
    
    try {
      const text = await file.text();
      const data = parseCSV(text);
      
      if (data.length === 0) {
        toast({
          title: "Invalid file",
          description: "The file appears to be empty or invalid. Please check your CSV format.",
          variant: "destructive"
        });
        return;
      }
      
      onDataUploaded(data, file.name);
      toast({
        title: "File uploaded successfully",
        description: `Processed ${data.length} records from ${file.name}`
      });
    } catch (error) {
      toast({
        title: "Upload failed",
        description: "There was an error processing your file. Please check the format.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  }, [onDataUploaded, toast]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    const csvFile = files.find(file => file.type === 'text/csv' || file.name.endsWith('.csv'));
    
    if (csvFile) {
      handleFile(csvFile);
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a CSV file.",
        variant: "destructive"
      });
    }
  }, [handleFile, toast]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ${
            isDragging 
              ? 'border-primary bg-accent' 
              : 'border-border hover:border-primary/50'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center space-y-4">
            {isProcessing ? (
              <div className="animate-pulse-ai">
                <FileText className="h-12 w-12 text-primary" />
              </div>
            ) : (
              <Upload className="h-12 w-12 text-muted-foreground" />
            )}
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">
                {isProcessing ? 'Processing your data...' : 'Upload your POS data'}
              </h3>
              <p className="text-sm text-muted-foreground">
                Drag and drop your CSV file here, or click to browse
              </p>
            </div>

            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <AlertCircle className="h-4 w-4" />
              <span>Supported formats: CSV</span>
            </div>

            <input
              type="file"
              accept=".csv"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
              disabled={isProcessing}
            />
            
            <Button 
              variant="outline" 
              asChild 
              disabled={isProcessing}
              className="cursor-pointer"
            >
              <label htmlFor="file-upload">
                {isProcessing ? 'Processing...' : 'Choose File'}
              </label>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};