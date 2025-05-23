
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CronStatusData {
  success: boolean;
  job_settings?: any;
  recent_logs?: any[];
  cron_status?: any;
  current_time?: string;
  recommendations?: {
    job_exists: boolean;
    job_enabled: boolean;
    has_recent_runs: boolean;
    last_run: string | null;
  };
  error?: string;
}

const CronStatusChecker = () => {
  const [status, setStatus] = useState<CronStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkCronStatus = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-cron-status');
      
      if (error) throw error;
      
      setStatus(data);
      
      if (data.success) {
        toast.success("Cron status checked successfully");
      } else {
        toast.error(`Error checking status: ${data.error}`);
      }
    } catch (err) {
      console.error("Error checking cron status:", err);
      toast.error("Failed to check cron status");
      setStatus({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const manuallyTriggerImport = async () => {
    try {
      toast.info("Triggering manual news import...");
      
      const { data, error } = await supabase.functions.invoke('run-news-import', {
        body: { manual: true }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(`Manual import completed: ${data.details?.articles_inserted || 0} articles inserted`);
        // Refresh status after manual run
        setTimeout(() => checkCronStatus(), 1000);
      } else {
        toast.error(`Import failed: ${data.message}`);
      }
    } catch (err) {
      console.error("Error running manual import:", err);
      toast.error("Failed to run manual import");
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Daily Cron Job Status
        </CardTitle>
        <CardDescription>
          Check the status of the automated news import job
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={checkCronStatus} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Status
              </>
            )}
          </Button>
          
          <Button 
            onClick={manuallyTriggerImport}
            variant="default"
          >
            Run Import Now
          </Button>
        </div>

        {status && (
          <div className="space-y-4">
            {status.success ? (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {status.recommendations?.job_exists ? (
                        <CheckCircle2 className="h-8 w-8 text-green-500 mx-auto" />
                      ) : (
                        <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">Job Configured</p>
                  </div>
                  
                  <div className="text-center">
                    <Badge variant={status.recommendations?.job_enabled ? "default" : "secondary"}>
                      {status.recommendations?.job_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">Status</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-lg font-semibold">
                      {status.recent_logs?.length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Recent Runs</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-xs">
                      {status.recommendations?.last_run 
                        ? new Date(status.recommendations.last_run).toLocaleDateString()
                        : "Never"
                      }
                    </div>
                    <p className="text-sm text-muted-foreground">Last Run</p>
                  </div>
                </div>

                {status.job_settings && (
                  <div className="p-3 bg-muted rounded-md">
                    <h4 className="font-medium mb-2">Current Job Configuration:</h4>
                    <div className="text-sm space-y-1">
                      <div>Schedule: <code>{status.job_settings.schedule}</code></div>
                      <div>Enabled: {status.job_settings.is_enabled ? "Yes" : "No"}</div>
                      <div>Last Updated: {new Date(status.job_settings.updated_at).toLocaleString()}</div>
                    </div>
                  </div>
                )}

                {!status.recommendations?.job_enabled && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Job Disabled</AlertTitle>
                    <AlertDescription>
                      The news import job is currently disabled. Enable it in the Scheduled Tasks settings.
                    </AlertDescription>
                  </Alert>
                )}

                {!status.recommendations?.has_recent_runs && status.recommendations?.job_enabled && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>No Recent Runs</AlertTitle>
                    <AlertDescription>
                      The job is enabled but hasn't run recently. This could indicate a cron scheduling issue.
                    </AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error Checking Status</AlertTitle>
                <AlertDescription>
                  {status.error || 'Unknown error occurred'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Current time: {status?.current_time ? new Date(status.current_time).toLocaleString() : new Date().toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
};

export default CronStatusChecker;
