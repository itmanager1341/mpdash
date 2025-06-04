
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Play, Settings, Trash2, Plus, RefreshCw, Eye, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import JobSettingsModal from "./JobSettingsModal";
import { formatDistanceToNow } from "date-fns";

interface ScheduledJob {
  id: string;
  job_name: string;
  schedule: string;
  is_enabled: boolean;
  last_run: string | null;
  parameters: any;
  created_at: string;
  updated_at: string;
}

const ScheduledJobsTable = () => {
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [viewingLogsFor, setViewingLogsFor] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ["scheduled-jobs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_job_settings")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as ScheduledJob[];
    },
  });

  const toggleJobMutation = useMutation({
    mutationFn: async ({ jobId, enabled }: { jobId: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("scheduled_job_settings")
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq("id", jobId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      toast.success("Job status updated");
    },
    onError: (error) => {
      console.error("Error updating job:", error);
      toast.error("Failed to update job status");
    },
  });

  const runJobMutation = useMutation({
    mutationFn: async (jobName: string) => {
      const { data, error } = await supabase.functions.invoke('run-news-import', {
        body: { manual: true, jobName }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Job executed: ${data.message || 'Success'}`);
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["job-execution-logs"] });
    },
    onError: (error) => {
      console.error("Error running job:", error);
      toast.error("Failed to run job: " + error.message);
    },
  });

  const deleteJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from("scheduled_job_settings")
        .delete()
        .eq("id", jobId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      toast.success("Job deleted");
    },
    onError: (error) => {
      console.error("Error deleting job:", error);
      toast.error("Failed to delete job");
    },
  });

  const getJobHealthStatus = (job: ScheduledJob) => {
    if (!job.is_enabled) {
      return { 
        status: "disabled", 
        icon: <XCircle className="h-4 w-4 text-gray-500" />, 
        color: "text-gray-500",
        message: "Job is disabled"
      };
    }
    
    if (!job.last_run) {
      return { 
        status: "pending", 
        icon: <Clock className="h-4 w-4 text-blue-500" />, 
        color: "text-blue-500",
        message: "Waiting for first execution"
      };
    }
    
    const lastRun = new Date(job.last_run);
    const now = new Date();
    const hoursSinceLastRun = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);
    
    // Parse cron to estimate expected frequency
    const cronParts = job.schedule.split(' ');
    let expectedHours = 24; // Default to daily
    
    if (cronParts[1] && cronParts[1].includes('*/')) {
      expectedHours = parseInt(cronParts[1].replace('*/', ''));
    }
    
    if (hoursSinceLastRun > expectedHours * 2) {
      return { 
        status: "overdue", 
        icon: <AlertTriangle className="h-4 w-4 text-amber-500" />, 
        color: "text-amber-500",
        message: `Overdue by ${Math.round(hoursSinceLastRun - expectedHours)} hours`
      };
    }
    
    return { 
      status: "healthy", 
      icon: <CheckCircle2 className="h-4 w-4 text-green-500" />, 
      color: "text-green-500",
      message: "Running normally"
    };
  };

  const formatNextRun = (schedule: string, lastRun: string | null) => {
    // Simple estimation based on common patterns
    const patterns: Record<string, string> = {
      "0 */12 * * *": "Next 12-hour interval",
      "0 8 * * *": "Tomorrow at 8:00 AM",
      "0 0 * * 1": "Next Monday",
      "0 * * * *": "Next hour",
      "*/15 * * * *": "Next 15 minutes"
    };
    
    return patterns[schedule] || "Per schedule";
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground">Loading scheduled jobs...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load scheduled jobs: {error.message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Scheduled Jobs</h3>
          <Button onClick={() => setIsCreatingJob(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Job
          </Button>
        </div>

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Name</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Next Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    <div className="flex flex-col items-center gap-2">
                      <Clock className="h-8 w-8 text-muted-foreground" />
                      <p>No scheduled jobs found</p>
                      <Button variant="outline" onClick={() => setIsCreatingJob(true)}>
                        Create your first job
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                jobs?.map((job) => {
                  const health = getJobHealthStatus(job);
                  return (
                    <TableRow key={job.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {job.job_name}
                          {health.icon}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <code className="text-xs bg-muted px-1 py-0.5 rounded">{job.schedule}</code>
                          <p className="text-xs text-muted-foreground">
                            {formatNextRun(job.schedule, job.last_run)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant="outline" className={health.color}>
                              {health.status}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{health.message}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.last_run ? (
                          <div>
                            <div>{new Date(job.last_run).toLocaleString()}</div>
                            <div className="text-xs">
                              {formatDistanceToNow(new Date(job.last_run), { addSuffix: true })}
                            </div>
                          </div>
                        ) : (
                          "Never"
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {job.is_enabled ? formatNextRun(job.schedule, job.last_run) : "Disabled"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={job.is_enabled ? "default" : "secondary"}>
                          {job.is_enabled ? "Enabled" : "Disabled"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end space-x-1">
                          <Switch
                            checked={job.is_enabled}
                            onCheckedChange={(checked) => 
                              toggleJobMutation.mutate({ jobId: job.id, enabled: checked })
                            }
                          />
                          
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => runJobMutation.mutate(job.job_name)}
                                disabled={!job.is_enabled || runJobMutation.isPending}
                              >
                                <Play className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Run job manually</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingLogsFor(job.job_name)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>View execution logs</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingJob(job)}
                              >
                                <Settings className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Edit job configuration</p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete ${job.job_name}?`)) {
                                    deleteJobMutation.mutate(job.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Remove scheduled job</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Job Settings Modal */}
        <JobSettingsModal
          job={editingJob}
          isOpen={!!editingJob || isCreatingJob}
          onClose={() => {
            setEditingJob(null);
            setIsCreatingJob(false);
          }}
          isCreating={isCreatingJob}
        />
      </div>
    </TooltipProvider>
  );
};

export default ScheduledJobsTable;
