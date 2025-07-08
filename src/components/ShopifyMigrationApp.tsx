import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DataUploadStep } from './steps/DataUploadStep';
import { MappingStep } from './steps/MappingStep';
import { PreviewStep } from './steps/PreviewStep';
import { MigrationStep } from './steps/MigrationStep';
import { DataGridPreview } from './steps/DataGridPreview';
import { Database, Brain, Eye, Zap, ArrowRight } from 'lucide-react';

type Step = 'upload' | 'mapping' | 'preview' | 'migration';

interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  reasoning: string;
}

export const ShopifyMigrationApp = () => {
  const [currentStep, setCurrentStep] = useState<Step>('upload');
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [filename, setFilename] = useState('');
  const [mappings, setMappings] = useState<FieldMapping[]>([]);

  const handleDataUploaded = (data: any[], name: string) => {
    console.log('App received data:', { name, recordCount: data.length });
    setSourceData(data);
    setFilename(name);
  };

  const handleMappingComplete = (completedMappings: FieldMapping[]) => {
    setMappings(completedMappings);
  };

  const handleMigrationComplete = () => {
    setCurrentStep('upload');
    setSourceData([]);
    setFilename('');
    setMappings([]);
  };

  const steps = [
    { id: 'upload', label: 'Upload Data', icon: Database, description: 'Upload your POS data file' },
    { id: 'mapping', label: 'AI Mapping', icon: Brain, description: 'AI analyzes and maps fields' },
    { id: 'preview', label: 'Preview & Validate', icon: Eye, description: 'Review data before import' },
    { id: 'migration', label: 'Migrate to Shopify', icon: Zap, description: 'Import to Shopify POS' }
  ];

  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center space-x-2 bg-primary text-primary-foreground px-6 py-3 rounded-full shadow-lg">
            <Brain className="h-6 w-6" />
            <span className="font-bold text-lg">Shopify POS Migration Engine</span>
          </div>
          <h1 className="text-4xl font-bold">
            AI-Powered Data Migration
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Seamlessly migrate your POS data to Shopify with intelligent field mapping, 
            real-time validation, and automated data transformation
          </p>
        </div>

        {/* Progress Steps */}
        <Card>
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
                    <div className={`flex flex-col items-center space-y-2 transition-all duration-300 ${
                      isActive ? 'text-primary scale-110' : 
                      isCompleted ? 'text-green-600' : 
                      'text-muted-foreground'
                    }`}>
                      <div className={`p-4 rounded-full border-2 transition-all duration-300 ${
                        isActive 
                          ? 'border-primary bg-primary text-primary-foreground shadow-lg' 
                          : isCompleted 
                          ? 'border-green-600 bg-green-600 text-white' 
                          : 'border-border bg-background'
                      }`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="text-center max-w-24">
                        <p className="text-sm font-medium">{step.label}</p>
                        <p className="text-xs text-muted-foreground hidden md:block">{step.description}</p>
                      </div>
                    </div>
                    {index < steps.length - 1 && (
                      <ArrowRight className={`h-6 w-6 mx-4 transition-colors duration-300 ${
                        index < currentStepIndex ? 'text-green-600' : 'text-muted-foreground'
                      }`} />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Data Preview */}
        {sourceData.length > 0 && currentStep !== 'upload' && (
          <DataGridPreview data={sourceData} filename={filename} maxRows={5} />
        )}

        {/* Step Content */}
        <div className="transition-all duration-500 ease-in-out">
          {currentStep === 'upload' && (
            <DataUploadStep
              onDataUploaded={handleDataUploaded}
              onNext={() => setCurrentStep('mapping')}
            />
          )}

          {currentStep === 'mapping' && (
            <MappingStep
              data={sourceData}
              onMappingComplete={handleMappingComplete}
              onNext={() => setCurrentStep('preview')}
              onBack={() => setCurrentStep('upload')}
            />
          )}

          {currentStep === 'preview' && (
            <PreviewStep
              data={sourceData}
              mappings={mappings}
              filename={filename}
              onNext={() => setCurrentStep('migration')}
              onBack={() => setCurrentStep('mapping')}
            />
          )}

          {currentStep === 'migration' && (
            <MigrationStep
              data={sourceData}
              mappings={mappings}
              filename={filename}
              onComplete={handleMigrationComplete}
              onBack={() => setCurrentStep('preview')}
            />
          )}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground">
          <p>
            Powered by Google Gemini AI • Secure & GDPR Compliant • 
            <a href="#" className="text-primary hover:underline ml-1">
              View Security Details
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};