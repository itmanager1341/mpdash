
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, RefreshCw, Database, Calendar } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const JobExecutionHistory = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [jobHistory, setJobHistory] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pgCronStatus, setPgCronStatus] = useState<{isAvailable: boolean, error?: string} | null>(null);

  // Fetch job execution history
  const fetchJobHistory = async () => {
    try {
      const { data: jobSettings, error: settingsError } = await supabase
        .from('scheduled_job_settings')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (settingsError) throw settingsError;
      
      setJobHistory(jobSettings || []);

      // Check if pg_cron is installed and accessible
      try {
        const { data: cronJobs, error: cronError } = await supabase
          .rpc('get_cron_jobs')
          .select('*');
          
        if (cronError) {
          console.error("Error fetching cron jobs:", cronError);
          setPgCronStatus({ isAvailable: false, error: cronError.message });
        } else {
          setPgCronStatus({ isAvailable: true });
          console.log("Cron jobs:", cronJobs);
        }
      } catch (cronCheckError) {
        console.error("Error checking pg_cron availability:", cronCheckError);
        setPgCronStatus({ 
          isAvailable: false, 
          error: cronCheckError instanceof Error ? cronCheckError.message : 'Unknown error checking pg_cron'
        });
      }
      
    } catch (error) {
      console.error("Error fetching job history:", error);
      toast.error("Failed to load job execution history");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchJobHistory();
  }, []);

  // Handle manual refresh
  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchJobHistory();
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
          <CardTitle>Job Execution History</CardTitle>
          <CardDescription>
            Recent scheduled job runs and their status
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
      <CardContent className="space-y-4">
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
                      {JSON.stringify(job.parameters, null, 2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default JobExecutionHistory;
