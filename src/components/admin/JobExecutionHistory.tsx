
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";
import { format, parseISO, formatDistanceToNow } from "date-fns";

const JobExecutionHistory = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [jobHistory, setJobHistory] = useState<any[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch job execution history
  const fetchJobHistory = async () => {
    try {
      const { data: jobSettings, error: settingsError } = await supabase
        .from('scheduled_job_settings')
        .select('*')
        .order('updated_at', { ascending: false });
      
      if (settingsError) throw settingsError;
      
      setJobHistory(jobSettings || []);
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
      <CardContent>
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
