import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertCircle, CheckCircle2, RefreshCw, Database, Calendar, Workflow } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScheduledJobSettings } from "@/types/database";
import { Json } from "@/integrations/supabase/types";
import { SyncOperationDetails } from "./SyncOperationDetails";

const JobExecutionHistory = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [jobHistory, setJobHistory] = useState<ScheduledJobSettings[]>([]);
  const [syncOperations, setSyncOperations] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pgCronStatus, setPgCronStatus] = useState<{isAvailable: boolean, error?: string} | null>(null);

  // Fetch job execution history and sync operations
  const fetchData = async () => {
    try {
      // Fetch scheduled job settings
      const { data: jobSettings, error: settingsError } = await supabase
        .from('scheduled_job_settings')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (settingsError) throw settingsError;
      setJobHistory(jobSettings || []);

      // Fetch sync operations
      const { data: syncOps, error: syncError } = await supabase
        .from('sync_operations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      if (syncError) throw syncError;
      setSyncOperations(syncOps || []);

      // Check if pg_cron is installed and accessible
      try {
        // Try to fetch cron jobs using our custom function
        const { data: cronJobs, error: cronError } = await supabase
          .rpc('get_job_settings', { job_name_param: 'daily-perplexity-news-fetch' });
          
        if (cronError) {
          console.error("Error fetching job settings:", cronError);
          setPgCronStatus({ 
            isAvailable: false, 
            error: `Error fetching job settings: ${cronError.message}`
          });
        } else {
          // Check if the job exists in the database
          const jobExists = cronJobs && cronJobs.length > 0;
          
          // Try to check if pg_cron exists via custom RPC function
          const { data: cronFunctions, error: cronFuncError } = await supabase
            .rpc('get_cron_jobs');
          
          if (cronFuncError) {
            console.error("Could not verify pg_cron extension:", cronFuncError);
            setPgCronStatus({ 
              isAvailable: jobExists, 
              error: jobExists ? undefined : "Cannot directly verify pg_cron status, but job exists"
            });
          } else {
            setPgCronStatus({ 
              isAvailable: true,
              error: undefined
            });
          }
        }
      } catch (cronCheckError) {
        console.error("Error checking pg_cron availability:", cronCheckError);
        setPgCronStatus({ 
          isAvailable: false, 
          error: cronCheckError instanceof Error ? cronCheckError.message : 'Unknown error checking pg_cron'
        });
      }
      
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load execution history");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchData();
  }, []);

  // Handle manual refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  // Format date for display
  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never executed";
    try {
      const date = parseISO(dateString);
      return `${format(date, 'MMM d, yyyy h:mm a')} (${formatDistanceToNow(date, { addSuffix: true })})`;
    } catch (e) {
      return dateString;
    }
  };

  // Helper function to safely display JSON parameters
  const formatJobParameters = (params: Json) => {
    if (!params) return "{}";
    
    try {
      if (typeof params === 'string') {
        return params;
      }
      return JSON.stringify(params, null, 2);
    } catch (e) {
      return String(params);
    }
  };

  // Attempt to diagnose the job execution issues
  const getDiagnosticMessage = () => {
    // Check if any news fetch jobs exist
    const newsJob = jobHistory.find(job => job.job_name === 'daily-perplexity-news-fetch');
    
    if (!newsJob) {
      return {
        title: "Job Configuration Missing",
        message: "The daily-perplexity-news-fetch job is not defined in the database. This job needs to be created in the scheduled_job_settings table.",
        severity: "destructive"
      };
    }
    
    if (!newsJob.is_enabled) {
      return {
        title: "Job is Disabled",
        message: "The news fetch job exists but is currently disabled. Enable it in the Scheduled Tasks section.",
        severity: "warning"
      };
    }
    
    if (!pgCronStatus?.isAvailable) {
      return {
        title: "Database Scheduler Issue",
        message: `The pg_cron extension may not be properly installed or configured: ${pgCronStatus?.error || 'Unable to query cron jobs'}`,
        severity: "destructive"
      };
    }
    
    if (!newsJob.last_run) {
      return {
        title: "Job Never Executed",
        message: "The job is configured but has never been executed. Try using the 'Run Now' button in the Scheduled Tasks section to manually trigger it.",
        severity: "warning"
      };
    }
    
    // If we get here, the job is configured and has run before
    return {
      title: "Job Configuration Appears Valid",
      message: "The job is properly configured and has run before. Check for API errors in the function logs.",
      severity: "default"
    };
  };
  
  const diagnostics = getDiagnosticMessage();

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle>Execution History</CardTitle>
          <CardDescription>
            Recent scheduled jobs and sync operations
          </CardDescription>
        </div>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={handleRefresh} 
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="sync-operations" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sync-operations" className="flex items-center gap-2">
              <Workflow className="h-4 w-4" />
              Sync Operations
            </TabsTrigger>
            <TabsTrigger value="scheduled-jobs" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduled Jobs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="sync-operations" className="space-y-4 mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Loading sync operations...</p>
              </div>
            ) : syncOperations.length === 0 ? (
              <div className="text-center p-4 border border-dashed rounded-md">
                <p className="text-muted-foreground">No sync operations found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {syncOperations.map((operation) => (
                  <SyncOperationDetails
                    key={operation.id}
                    operation={operation}
                    onRefresh={fetchData}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="scheduled-jobs" className="space-y-4 mt-4">
            <Alert variant={diagnostics.severity as any}>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{diagnostics.title}</AlertTitle>
              <AlertDescription>
                {diagnostics.message}
              </AlertDescription>
            </Alert>
            
            {pgCronStatus && (
              <div className="flex items-center space-x-2 text-sm">
                <Database className="h-4 w-4" />
                <span>Database Scheduler Status:</span>
                {pgCronStatus.isAvailable ? (
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                    Available
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                    Unavailable
                  </Badge>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Loading job history...</p>
              </div>
            ) : jobHistory.length === 0 ? (
              <div className="text-center p-4 border border-dashed rounded-md">
                <p className="text-muted-foreground">No job history found</p>
              </div>
            ) : (
              <div className="space-y-5">
                {jobHistory.map((job) => (
                  <div key={job.id} className="border rounded-md p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium">{job.job_name.replace(/-/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}</h3>
                      <Badge variant={job.is_enabled ? "outline" : "secondary"}>
                        {job.is_enabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex items-center">
                        <span className="text-muted-foreground min-w-[100px]">Schedule:</span>
                        <span className="font-mono">{job.schedule}</span>
                      </div>
                      <div className="flex items-center">
                        <span className="text-muted-foreground min-w-[100px]">Last Run:</span>
                        <span className="flex items-center">
                          {job.last_run ? (
                            <>
                              <CheckCircle2 className="h-4 w-4 text-green-500 mr-1" />
                              {formatDate(job.last_run)}
                            </>
                          ) : (
                            <>
                              <AlertCircle className="h-4 w-4 text-amber-500 mr-1" />
                              Never executed
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex items-start">
                        <span className="text-muted-foreground min-w-[100px]">Parameters:</span>
                        <div className="font-mono text-xs bg-muted p-2 rounded-md overflow-auto max-w-[300px]">
                          {formatJobParameters(job.parameters)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default JobExecutionHistory;
