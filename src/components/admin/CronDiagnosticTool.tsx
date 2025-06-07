
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, CheckCircle2, Wrench, Play, Settings, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DiagnosticResult {
  success: boolean;
  result?: {
    cronJobs?: any[];
    jobSettings?: any[];
    recentLogs?: any[];
    timestamp?: string;
    errors?: any;
  };
  error?: string;
}

const CronDiagnosticTool = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<DiagnosticResult | null>(null);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const runFullDiagnostic = async () => {
    setIsLoading(true);
    setLastError(null);
    
    try {
      console.log("Running full diagnostic...");
      const { data, error } = await supabase.functions.invoke('test-cron-system', {
        body: { action: 'full_diagnostic' }
      });
      
      if (error) {
        console.error("Diagnostic error:", error);
        throw error;
      }
      
      console.log("Diagnostic result:", data);
      setDiagnosticResult(data);
      
      if (data.success) {
        toast.success("Diagnostic completed successfully");
      } else {
        setLastError(data.error);
        toast.error(`Diagnostic error: ${data.error}`);
      }
    } catch (err) {
      console.error("Error running diagnostic:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setLastError(errorMessage);
      toast.error("Failed to run diagnostic");
      setDiagnosticResult({
        success: false,
        error: errorMessage
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeLegacyCronJob = async (jobName: string) => {
    setIsLoading(true);
    setLastError(null);
    
    try {
      console.log("Removing legacy job:", jobName);
      const { data, error } = await supabase.functions.invoke('test-cron-system', {
        body: { action: 'remove_legacy_job', jobName }
      });
      
      if (error) {
        console.error("Remove job error:", error);
        throw error;
      }
      
      console.log("Remove job result:", data);
      
      if (data.success) {
        if (data.result.removeError) {
          setLastError(data.result.removeError);
          toast.error(`Error removing job: ${data.result.removeError}`);
        } else {
          toast.success(data.result.removeResult || `Legacy job removed: ${jobName}`);
          // Refresh diagnostic data
          await runFullDiagnostic();
        }
      } else {
        setLastError(data.error);
        toast.error(`Could not remove job: ${data.error}`);
      }
    } catch (err) {
      console.error("Exception removing legacy job:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setLastError(errorMessage);
      toast.error("Failed to remove legacy job");
    } finally {
      setIsLoading(false);
    }
  };

  const fixBrokenJob = async (jobName: string) => {
    setIsLoading(true);
    setLastError(null);
    
    try {
      console.log("Fixing broken job:", jobName);
      
      // First try to trigger the database trigger by updating the job
      console.log("Testing database trigger...");
      const { data: triggerData, error: triggerError } = await supabase.functions.invoke('test-cron-system', {
        body: { action: 'test_trigger', jobName }
      });
      
      if (triggerError) {
        console.warn("Trigger test error:", triggerError);
      } else {
        console.log("Trigger test result:", triggerData);
      }

      // Then try the reactivation function
      console.log("Attempting job reactivation...");
      const { data, error } = await supabase.functions.invoke('test-cron-system', {
        body: { action: 'reactivate_job', jobName }
      });
      
      if (error) {
        console.error("Reactivate job error:", error);
        throw error;
      }
      
      console.log("Reactivate job result:", data);
      
      if (data.success) {
        if (data.result.reactivateError) {
          const errorMsg = data.result.reactivateError.message || JSON.stringify(data.result.reactivateError);
          setLastError(errorMsg);
          toast.error(`Fix attempt failed: ${errorMsg}`);
        } else {
          toast.success(data.result.reactivateResult || `Job fixed: ${jobName}`);
          // Refresh diagnostic data
          await runFullDiagnostic();
        }
      } else {
        setLastError(data.error);
        toast.error(`Fix attempt failed: ${data.error}`);
      }
    } catch (err) {
      console.error("Exception fixing job:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setLastError(errorMessage);
      toast.error(`Failed to fix job: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const createMissingJob = async () => {
    setIsLoading(true);
    setLastError(null);
    
    try {
      console.log("Creating default news search job...");
      const { error } = await supabase
        .from('scheduled_job_settings')
        .upsert({
          job_name: 'news_search_daily_news_search1',
          schedule: '0 */6 * * *', // Every 6 hours
          is_enabled: true,
          parameters: {
            promptId: null,
            limit: 20,
            model: 'llama-3.1-sonar-small-128k-online'
          }
        });
      
      if (error) {
        console.error("Create job error:", error);
        throw error;
      }
      
      toast.success("Default news search job created. Configure it in the Jobs management section.");
      await runFullDiagnostic();
    } catch (err) {
      console.error("Error creating job:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setLastError(errorMessage);
      toast.error(`Failed to create default job: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getBrokenJobs = () => {
    if (!diagnosticResult?.result || !diagnosticResult.result.cronJobs || !diagnosticResult.result.jobSettings) {
      return [];
    }
    
    const { cronJobs, jobSettings } = diagnosticResult.result;
    
    return jobSettings.filter(setting => {
      const hasCronJob = cronJobs.some(cron => cron.jobname === setting.job_name);
      return setting.is_enabled && !hasCronJob;
    });
  };

  const getWorkingJobs = () => {
    if (!diagnosticResult?.result || !diagnosticResult.result.cronJobs || !diagnosticResult.result.jobSettings) {
      return [];
    }
    
    const { cronJobs, jobSettings } = diagnosticResult.result;
    
    return jobSettings.filter(setting => {
      const hasCronJob = cronJobs.some(cron => cron.jobname === setting.job_name);
      return setting.is_enabled && hasCronJob;
    });
  };

  const getLegacyJobs = () => {
    if (!diagnosticResult?.result || !diagnosticResult.result.cronJobs || !diagnosticResult.result.jobSettings) {
      return [];
    }
    
    const { cronJobs, jobSettings } = diagnosticResult.result;
    
    // Find cron jobs that don't have corresponding job settings (legacy jobs)
    return cronJobs.filter(cronJob => {
      const hasSettings = jobSettings.some(setting => setting.job_name === cronJob.jobname);
      return !hasSettings;
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Cron System Diagnostic & Repair
        </CardTitle>
        <CardDescription>
          Diagnose and fix issues with the scheduled job system
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={runFullDiagnostic} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Diagnostic
              </>
            )}
          </Button>

          <Button 
            onClick={createMissingJob}
            disabled={isLoading}
            variant="secondary"
          >
            <Play className="h-4 w-4 mr-2" />
            Create Default Job
          </Button>
        </div>

        {/* Error Display */}
        {lastError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Last Error</AlertTitle>
            <AlertDescription className="font-mono text-sm">
              {lastError}
            </AlertDescription>
          </Alert>
        )}

        {diagnosticResult && (
          <div className="space-y-4">
            {diagnosticResult.success ? (
              <>
                {/* Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="text-2xl font-bold text-green-600">
                      {getWorkingJobs().length}
                    </div>
                    <p className="text-sm text-green-600">Working</p>
                  </div>
                  
                  <div className="text-center p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="text-2xl font-bold text-red-600">
                      {getBrokenJobs().length}
                    </div>
                    <p className="text-sm text-red-600">Broken</p>
                  </div>
                  
                  <div className="text-center p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="text-2xl font-bold text-yellow-600">
                      {getLegacyJobs().length}
                    </div>
                    <p className="text-sm text-yellow-600">Legacy</p>
                  </div>
                  
                  <div className="text-center p-3 bg-blue-50 border border-blue-200 rounded-md">
                    <div className="text-2xl font-bold text-blue-600">
                      {diagnosticResult.result?.cronJobs?.length || 0}
                    </div>
                    <p className="text-sm text-blue-600">Total Cron Jobs</p>
                  </div>
                </div>

                {/* Issues Found */}
                {(getBrokenJobs().length > 0 || getLegacyJobs().length > 0) && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Issues Found</AlertTitle>
                    <AlertDescription>
                      {getBrokenJobs().length > 0 && `${getBrokenJobs().length} job(s) are enabled but not scheduled. `}
                      {getLegacyJobs().length > 0 && `${getLegacyJobs().length} legacy job(s) found without settings.`}
                    </AlertDescription>
                  </Alert>
                )}

                {/* Job Status Details */}
                <div className="space-y-3">
                  <h4 className="font-medium">Job Status:</h4>
                  
                  {/* Working Jobs */}
                  {getWorkingJobs().map(job => (
                    <div key={job.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-md">
                      <div>
                        <div className="font-medium text-green-800">{job.job_name}</div>
                        <div className="text-sm text-green-600">Schedule: {job.schedule}</div>
                        <div className="text-xs text-green-500">
                          Last run: {job.last_run ? new Date(job.last_run).toLocaleString() : 'Never'}
                        </div>
                      </div>
                      <Badge className="bg-green-100 text-green-800">
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        Active
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
                          onClick={() => fixBrokenJob(job.job_name)}
                          disabled={isLoading}
                        >
                          <Wrench className="h-3 w-3 mr-1" />
                          Fix
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* Legacy Jobs */}
                  {getLegacyJobs().map(job => (
                    <div key={job.jobname} className="flex items-center justify-between p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                      <div>
                        <div className="font-medium text-yellow-800">{job.jobname}</div>
                        <div className="text-sm text-yellow-600">Schedule: {job.schedule}</div>
                        <div className="text-xs text-yellow-500">Legacy job without settings</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-yellow-100 text-yellow-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Legacy
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => removeLegacyCronJob(job.jobname)}
                          disabled={isLoading}
                        >
                          <Trash2 className="h-3 w-3 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                  ))}

                  {/* If no jobs at all */}
                  {getWorkingJobs().length === 0 && getBrokenJobs().length === 0 && getLegacyJobs().length === 0 && (
                    <div className="text-center p-4 border border-dashed rounded-md">
                      <p className="text-muted-foreground">No scheduled jobs found</p>
                      <p className="text-sm text-muted-foreground">Create a default job to get started</p>
                    </div>
                  )}
                </div>

                {/* Recent Logs */}
                {diagnosticResult.result?.recentLogs && diagnosticResult.result.recentLogs.length > 0 && (
                  <div className="p-3 bg-muted rounded-md">
                    <h4 className="font-medium mb-2">Recent Activity:</h4>
                    <div className="space-y-1 text-sm">
                      {diagnosticResult.result.recentLogs.slice(0, 3).map((log: any) => (
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

                {/* Debug Info */}
                <Collapsible open={showDebugInfo} onOpenChange={setShowDebugInfo}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      {showDebugInfo ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      Debug Information
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-2">
                    <div className="p-3 bg-muted rounded-md">
                      <h5 className="font-medium mb-2">Raw Diagnostic Data:</h5>
                      <pre className="text-xs overflow-auto max-h-60 bg-background p-2 rounded border">
                        {JSON.stringify(diagnosticResult.result, null, 2)}
                      </pre>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </>
            ) : (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Diagnostic Failed</AlertTitle>
                <AlertDescription>
                  {diagnosticResult.error || 'Unknown error occurred'}
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground">
          Last diagnostic: {diagnosticResult?.result?.timestamp ? new Date(diagnosticResult.result.timestamp).toLocaleString() : 'Never'}
        </div>
      </CardContent>
    </Card>
  );
};

export default CronDiagnosticTool;
