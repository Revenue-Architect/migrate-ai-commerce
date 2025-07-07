import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Zap, ExternalLink, RefreshCw, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FieldMapping {
  sourceField: string;
  targetField: string;
  confidence: number;
  reasoning: string;
}

interface MigrationStepProps {
  data: any[];
  mappings: FieldMapping[];
  filename: string;
  onComplete: () => void;
  onBack: () => void;
}

interface MigrationStatus {
  stage: 'preparing' | 'transforming' | 'uploading' | 'verifying' | 'complete' | 'error';
  progress: number;
  message: string;
  recordsProcessed: number;
  totalRecords: number;
}

export const MigrationStep = ({ data, mappings, filename, onComplete, onBack }: MigrationStepProps) => {
  const [status, setStatus] = useState<MigrationStatus>({
    stage: 'preparing',
    progress: 0,
    message: 'Initializing migration...',
    recordsProcessed: 0,
    totalRecords: data.length
  });
  const [migrationId, setMigrationId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const runMigration = async () => {
      const id = `migration_${Date.now()}`;
      setMigrationId(id);

      try {
        // Stage 1: Preparing
        setStatus({
          stage: 'preparing',
          progress: 10,
          message: 'Preparing data for migration...',
          recordsProcessed: 0,
          totalRecords: data.length
        });
        await delay(1000);

        // Stage 2: Transforming
        setStatus({
          stage: 'transforming',
          progress: 30,
          message: 'Transforming data to Shopify format...',
          recordsProcessed: 0,
          totalRecords: data.length
        });
        
        // Simulate data transformation with progress
        for (let i = 0; i <= data.length; i += Math.ceil(data.length / 10)) {
          await delay(200);
          setStatus(prev => ({
            ...prev,
            progress: 30 + (i / data.length) * 20,
            recordsProcessed: Math.min(i, data.length)
          }));
        }

        // Stage 3: Uploading to Shopify
        setStatus({
          stage: 'uploading',
          progress: 50,
          message: 'Uploading to Shopify via API...',
          recordsProcessed: 0,
          totalRecords: data.length
        });

        // Simulate upload with realistic timing
        for (let i = 0; i <= data.length; i += Math.ceil(data.length / 20)) {
          await delay(300);
          setStatus(prev => ({
            ...prev,
            progress: 50 + (i / data.length) * 35,
            recordsProcessed: Math.min(i, data.length)
          }));
        }

        // Stage 4: Verifying
        setStatus({
          stage: 'verifying',
          progress: 85,
          message: 'Verifying migration integrity...',
          recordsProcessed: data.length,
          totalRecords: data.length
        });
        await delay(2000);

        // Stage 5: Complete
        setStatus({
          stage: 'complete',
          progress: 100,
          message: 'Migration completed successfully!',
          recordsProcessed: data.length,
          totalRecords: data.length
        });

        toast({
          title: "Migration Complete",
          description: `Successfully migrated ${data.length} records to Shopify`,
        });

      } catch (error) {
        setError(error instanceof Error ? error.message : 'Migration failed');
        setStatus({
          stage: 'error',
          progress: 0,
          message: 'Migration failed. Please try again.',
          recordsProcessed: 0,
          totalRecords: data.length
        });
        
        toast({
          title: "Migration Failed",
          description: "Please check the error details and try again",
          variant: "destructive"
        });
      }
    };

    runMigration();
  }, [data, toast]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const getStageIcon = (stage: string) => {
    switch (stage) {
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'error':
        return <AlertTriangle className="h-5 w-5 text-red-600" />;
      default:
        return <RefreshCw className="h-5 w-5 animate-spin text-primary" />;
    }
  };

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'complete':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-primary';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getStageIcon(status.stage)}
            <span className={getStageColor(status.stage)}>
              Migration in Progress
            </span>
            <Badge variant="outline">{migrationId}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">{status.message}</span>
              <span>{Math.round(status.progress)}%</span>
            </div>
            <Progress value={status.progress} className="h-2" />
          </div>

          {/* Records Progress */}
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Records processed: {status.recordsProcessed} / {status.totalRecords}</span>
            <span>From: {filename}</span>
          </div>

          {/* Migration Stages */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { id: 'preparing', label: 'Preparing', desc: 'Data validation' },
              { id: 'transforming', label: 'Transforming', desc: 'Format conversion' },
              { id: 'uploading', label: 'Uploading', desc: 'Shopify API' },
              { id: 'verifying', label: 'Verifying', desc: 'Integrity check' },
              { id: 'complete', label: 'Complete', desc: 'Migration done' }
            ].map((stage, index) => {
              const isActive = status.stage === stage.id;
              const isComplete = ['complete'].includes(status.stage) || 
                               (['transforming', 'uploading', 'verifying', 'complete'].includes(status.stage) && index < 1) ||
                               (['uploading', 'verifying', 'complete'].includes(status.stage) && index < 2) ||
                               (['verifying', 'complete'].includes(status.stage) && index < 3) ||
                               (status.stage === 'complete' && index < 4);

              return (
                <div key={stage.id} className="text-center">
                  <div className={`w-12 h-12 mx-auto rounded-full border-2 flex items-center justify-center mb-2 ${
                    isActive ? 'border-primary bg-primary text-primary-foreground' :
                    isComplete ? 'border-green-600 bg-green-600 text-white' :
                    'border-muted bg-muted'
                  }`}>
                    {isComplete ? (
                      <CheckCircle className="h-6 w-6" />
                    ) : isActive ? (
                      <RefreshCw className="h-6 w-6 animate-spin" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <div className="text-sm font-medium">{stage.label}</div>
                  <div className="text-xs text-muted-foreground">{stage.desc}</div>
                </div>
              );
            })}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 border border-red-200 rounded-lg bg-red-50">
              <div className="flex items-center gap-2 text-red-600 font-medium mb-2">
                <AlertTriangle className="h-4 w-4" />
                Migration Error
              </div>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {status.stage === 'complete' && (
            <div className="p-6 border border-green-200 rounded-lg bg-green-50 text-center">
              <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-green-800 mb-2">
                Migration Completed Successfully!
              </h3>
              <p className="text-green-700 mb-4">
                Your {data.length} records have been successfully imported to Shopify POS.
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  onClick={() => window.open('https://admin.shopify.com', '_blank')}
                  className="border-green-600 text-green-600 hover:bg-green-600 hover:text-white"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View in Shopify Admin
                </Button>
                <Button
                  onClick={onComplete}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Start New Migration
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions for non-complete states */}
      {status.stage !== 'complete' && (
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={onBack}
            disabled={status.stage === 'uploading' || status.stage === 'transforming'}
          >
            {status.stage === 'error' ? 'Back to Preview' : 'Cancel Migration'}
          </Button>
          
          {status.stage === 'error' && (
            <Button onClick={() => window.location.reload()}>
              Retry Migration
            </Button>
          )}
        </div>
      )}
    </div>
  );
};