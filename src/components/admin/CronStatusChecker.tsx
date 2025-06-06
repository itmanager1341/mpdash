
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, CheckCircle2, Clock, Settings, Wrench } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface CronDiagnostic {
  success: boolean;
  result?: {
    cronJobs?: any[];
    jobSettings?: any[];
    recentLogs?: any[];
    timestamp?: string;
  };
  error?: string;
}

const CronStatusChecker = () => {
  const [status, setStatus] = useState<CronDiagnostic | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const runDiagnostic = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-cron-system', {
        body: { action: 'full_diagnostic' }
      });
      
      if (error) throw error;
      
      setStatus(data);
      
      if (data.success) {
        toast.success("Cron diagnostic completed successfully");
      } else {
        toast.error(`Diagnostic error: ${data.error}`);
      }
    } catch (err) {
      console.error("Error running diagnostic:", err);
      toast.error("Failed to run diagnostic");
      setStatus({
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const reactivateJob = async (jobName: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('test-cron-system', {
        body: { action: 'reactivate_job', jobName }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(`Job reactivated: ${data.result.reactivateResult}`);
        runDiagnostic(); // Refresh data
      } else {
        toast.error(`Reactivation failed: ${data.result.reactivateError?.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error reactivating job:", err);
      toast.error("Failed to reactivate job");
    }
  };

  const manuallyTriggerImport = async () => {
    try {
      toast.info("Triggering manual news import...");
      
      const { data, error } = await supabase.functions.invoke('run-news-import', {
        body: { 
          manual: true,
          modelOverride: "llama-3.1-sonar-small-128k-online"
        }
      });
      
      if (error) throw error;
      
      if (data.success) {
        toast.success(`Manual import completed: ${data.details?.articles_inserted || 0} articles inserted`);
        setTimeout(() => runDiagnostic(), 1000);
      } else {
        toast.error(`Import failed: ${data.message}`);
      }
    } catch (err) {
      console.error("Error running manual import:", err);
      toast.error("Failed to run manual import");
    }
  };

  const getBrokenJobs = () => {
    if (!status?.result) return [];
    
    const { cronJobs = [], jobSettings = [] } = status.result;
    
    return jobSettings.filter(setting => {
      const hasCronJob = cronJobs.some(cron => cron.jobname === setting.job_name);
      return setting.is_enabled && !hasCronJob;
    });
  };

  const getWorkingJobs = () => {
    if (!status?.result) return [];
    
    const { cronJobs = [], jobSettings = [] } = status.result;
    
    return jobSettings.filter(setting => {
      const hasCronJob = cronJobs.some(cron => cron.jobname === setting.job_name);
      return setting.is_enabled && hasCronJob;
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Cron Job System Diagnostic
        </CardTitle>
        <CardDescription>
          Check and fix scheduled job system issues
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button 
            onClick={runDiagnostic} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running Diagnostic...
              </>
            ) : (
              <>
                <Settings className="h-4 w-4 mr-2" />
                Run Full Diagnostic
              </>
            )}
          </Button>
          
          <Button 
            onClick={manuallyTriggerImport}
            variant="default"
          >
            Test Manual Import
          </Button>
        </div>

        {status && (
          <div className="space-y-4">
            {status.success ? (
              <>
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {getWorkingJobs().length}
                    </div>
                    <p className="text-sm text-muted-foreground">Working Jobs</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {getBrokenJobs().length}
                    </div>
                    <p className="text-sm text-muted-foreground">Broken Jobs</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {status.result?.cronJobs?.length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Cron Jobs</p>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {status.result?.jobSettings?.length || 0}
                    </div>
                    <p className="text-sm text-muted-foreground">Job Settings</p>
                  </div>
                </div>

                {/* Broken Jobs Alert */}
                {getBrokenJobs().length > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Broken Jobs Found</AlertTitle>
                    <AlertDescription>
                      {getBrokenJobs().length} job(s) are enabled in settings but missing from the cron system.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Job Details */}
                <div className="space-y-3">
                  <h4 className="font-medium">Job Status Details:</h4>
                  
                  {/* Working Jobs */}
                  {getWorkingJobs().map(job => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                      <div>
                        <div className="font-medium text-green-800">{job.job_name}</div>
                        <div className="text-sm text-green-600">Schedule: {job.schedule}</div>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Working
                      </Badge>
                    </div>
                  ))}
                  
                  {/* Broken Jobs */}
                  {getBrokenJobs().map(job => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-md">
                      <div>
                        <div className="font-medium text-red-800">{job.job_name}</div>
                        <div className="text-sm text-red-600">Schedule: {job.schedule}</div>
                        <div className="text-xs text-red-500">Missing from cron system</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Broken
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => reactivateJob(job.job_name)}
                        >
                          <Wrench className="h-3 w-3 mr-1" />
                          Fix
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Recent Logs */}
                {status.result?.recentLogs && status.result.recentLogs.length > 0 && (
                  <div className="p-3 bg-muted rounded-md">
                    <h4 className="font-medium mb-2">Recent Job Logs:</h4>
                    <div className="space-y-1 text-sm">
                      {status.result.recentLogs.slice(0, 3).map((log: any) => (
                        <div key={log.id} className="flex justify-between">
                          <span>{log.job_name}</span>
                          <span className={log.status === 'success' ? 'text-green-600' : 'text-red-600'}>
                            {log.status} - {new Date(log.created_at).toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Diagnostic Failed</AlertTitle>
                <AlertDescription>
                  {status.error || 'Unknown error occurred'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Last diagnostic: {status?.result?.timestamp ? new Date(status.result.timestamp).toLocaleString() : 'Never'}
        </div>
      </CardContent>
    </Card>
  );
};

export default CronStatusChecker;
