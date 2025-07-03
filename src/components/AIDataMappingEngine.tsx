import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataUpload } from "./DataUpload";
import { MappingInterface } from "./MappingInterface";
import { DataPreview } from "./DataPreview";
import { Brain, Database, Eye, Zap } from "lucide-react";

type Step = 'upload' | 'mapping' | 'preview' | 'complete';

interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  status: 'mapped' | 'unmapped' | 'conflict';
}

export const AIDataMappingEngine = () => {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [filename, setFilename] = useState('');
  const [mappings, setMappings] = useState<FieldMapping[]>([]);

  const handleDataUploaded = (data: any[], name: string) => {
    setSourceData(data);
    setFilename(name);
    setCurrentStep('mapping');
  };

  const handleMappingComplete = (completedMappings: FieldMapping[]) => {
    setMappings(completedMappings);
    setCurrentStep('preview');
  };

  const steps = [
    { id: 'upload', label: 'Upload Data', icon: Database, description: 'Upload your POS data file' },
    { id: 'mapping', label: 'AI Mapping', icon: Brain, description: 'AI analyzes and maps your fields' },
    { id: 'preview', label: 'Preview', icon: Eye, description: 'Review mapped data before import' },
    { id: 'complete', label: 'Import', icon: Zap, description: 'Import to Shopify' }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="min-h-screen bg-gradient-subtle p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center space-x-2 bg-gradient-ai text-primary-foreground px-4 py-2 rounded-full shadow-elegant">
            <Brain className="h-5 w-5" />
            <span className="font-semibold">AI Data Mapping Engine</span>
          </div>
          <h1 className="text-4xl font-bold text-foreground">
            Intelligent POS to Shopify Migration
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Let AI analyze your data, suggest optimal field mappings, and ensure seamless migration to Shopify POS
          </p>
        </div>

        {/* Progress Steps */}
        <Card className="shadow-mapping">
          <CardHeader>
            <CardTitle>Migration Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              {steps.map((step, index) => {
                const Icon = step.icon;
                const isActive = index === currentStepIndex;
                const isCompleted = index < currentStepIndex;
                
                return (
                  <div key={step.id} className="flex items-center">
                    <div className={`flex flex-col items-center space-y-2 ${isActive ? 'text-primary' : isCompleted ? 'text-ai-high' : 'text-muted-foreground'}`}>
                      <div className={`p-3 rounded-full border-2 transition-all duration-300 ${
                        isActive 
                          ? 'border-primary bg-primary text-primary-foreground shadow-mapping' 
                          : isCompleted 
                          ? 'border-ai-high bg-ai-high-bg text-ai-high' 
                          : 'border-border bg-background'
                      }`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">{step.label}</p>
                        <p className="text-xs text-muted-foreground">{step.description}</p>
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <div className={`h-px w-24 mx-4 transition-colors duration-300 ${
                        index < currentStepIndex ? 'bg-ai-high' : 'bg-border'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <div className="transition-all duration-500 ease-in-out">
          {currentStep === 'upload' && (
            <div className="space-y-6">
              <Card className="shadow-mapping">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Database className="h-5 w-5 text-primary" />
                    <span>Upload Your POS Data</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <DataUpload onDataUploaded={handleDataUploaded} />
                </CardContent>
              </Card>
              
              <Card>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center space-y-2">
                      <Brain className="h-8 w-8 text-primary mx-auto" />
                      <h3 className="font-semibold">AI-Powered Analysis</h3>
                      <p className="text-sm text-muted-foreground">
                        Our AI automatically detects field types and suggests optimal mappings
                      </p>
                    </div>
                    <div className="text-center space-y-2">
                      <Eye className="h-8 w-8 text-primary mx-auto" />
                      <h3 className="font-semibold">Real-time Preview</h3>
                      <p className="text-sm text-muted-foreground">
                        See exactly how your data will look in Shopify before importing
                      </p>
                    </div>
                    <div className="text-center space-y-2">
                      <Zap className="h-8 w-8 text-primary mx-auto" />
                      <h3 className="font-semibold">Instant Validation</h3>
                      <p className="text-sm text-muted-foreground">
                        Catch errors early with our intelligent validation system
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 'mapping' && (
            <div className="space-y-6">
              <Card className="shadow-mapping">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Brain className="h-5 w-5 text-primary" />
                      <span>Smart Field Mapping</span>
                    </div>
                    <Badge variant="outline" className="bg-accent">
                      {filename} • {sourceData.length} records
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <MappingInterface 
                    sourceData={sourceData} 
                    onMappingComplete={handleMappingComplete}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {currentStep === 'preview' && (
            <div className="space-y-6">
              <DataPreview sourceData={sourceData} mappings={mappings} />
              
              <div className="flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep('mapping')}
                >
                  Back to Mapping
                </Button>
                <Button 
                  className="bg-gradient-ai hover:opacity-90"
                  onClick={() => setCurrentStep('complete')}
                >
                  Start Migration to Shopify
                </Button>
              </div>
            </div>
          )}

          {currentStep === 'complete' && (
            <Card className="shadow-mapping">
              <CardContent className="p-8">
                <div className="text-center space-y-4">
                  <div className="animate-pulse-ai">
                    <Zap className="h-16 w-16 text-primary mx-auto" />
                  </div>
                  <h2 className="text-2xl font-bold">Migration Complete!</h2>
                  <p className="text-muted-foreground">
                    Your data has been successfully imported to Shopify POS.
                  </p>
                  <Button className="bg-gradient-ai hover:opacity-90">
                    View in Shopify Admin
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};