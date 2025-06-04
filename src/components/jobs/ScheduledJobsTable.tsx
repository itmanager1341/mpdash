
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Play, Pause, Settings, Trash2, Plus, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

interface NewJobFormData {
  job_name: string;
  schedule: string;
  is_enabled: boolean;
  parameters: string;
}

const ScheduledJobsTable = () => {
  const [isAddingJob, setIsAddingJob] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | null>(null);
  const [newJobData, setNewJobData] = useState<NewJobFormData>({
    job_name: "",
    schedule: "0 */12 * * *",
    is_enabled: true,
    parameters: "{}"
  });
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
    },
    onError: (error) => {
      console.error("Error running job:", error);
      toast.error("Failed to run job");
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

  const addJobMutation = useMutation({
    mutationFn: async (jobData: NewJobFormData) => {
      let parameters;
      try {
        parameters = JSON.parse(jobData.parameters);
      } catch (e) {
        throw new Error("Invalid JSON in parameters");
      }

      const { error } = await supabase
        .from("scheduled_job_settings")
        .insert([{
          job_name: jobData.job_name,
          schedule: jobData.schedule,
          is_enabled: jobData.is_enabled,
          parameters
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      toast.success("Job created");
      setIsAddingJob(false);
      setNewJobData({
        job_name: "",
        schedule: "0 */12 * * *",
        is_enabled: true,
        parameters: "{}"
      });
    },
    onError: (error) => {
      console.error("Error creating job:", error);
      toast.error("Failed to create job");
    },
  });

  const formatNextRun = (schedule: string, lastRun: string | null) => {
    // Simple estimation - in a real app you'd use a cron parser
    if (!lastRun) return "On next schedule";
    return "Next scheduled run";
  };

  const getJobStatus = (job: ScheduledJob) => {
    if (!job.is_enabled) return { label: "Disabled", variant: "secondary" as const };
    if (job.last_run) return { label: "Active", variant: "default" as const };
    return { label: "Pending", variant: "outline" as const };
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-8">Loading scheduled jobs...</div>;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Scheduled Jobs</h3>
        <Dialog open={isAddingJob} onOpenChange={setIsAddingJob}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Job
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Scheduled Job</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="job_name">Job Name</Label>
                <Input
                  id="job_name"
                  value={newJobData.job_name}
                  onChange={(e) => setNewJobData({ ...newJobData, job_name: e.target.value })}
                  placeholder="e.g., daily-news-import"
                />
              </div>
              <div>
                <Label htmlFor="schedule">Schedule (Cron)</Label>
                <Select value={newJobData.schedule} onValueChange={(value) => setNewJobData({ ...newJobData, schedule: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0 */12 * * *">Every 12 hours</SelectItem>
                    <SelectItem value="0 8 * * *">Daily at 8am</SelectItem>
                    <SelectItem value="0 0 * * 1">Weekly on Monday</SelectItem>
                    <SelectItem value="0 * * * *">Every hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="parameters">Parameters (JSON)</Label>
                <Input
                  id="parameters"
                  value={newJobData.parameters}
                  onChange={(e) => setNewJobData({ ...newJobData, parameters: e.target.value })}
                  placeholder='{"key": "value"}'
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  checked={newJobData.is_enabled}
                  onCheckedChange={(checked) => setNewJobData({ ...newJobData, is_enabled: checked })}
                />
                <Label>Enabled</Label>
              </div>
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setIsAddingJob(false)}>
                  Cancel
                </Button>
                <Button onClick={() => addJobMutation.mutate(newJobData)}>
                  Create Job
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Job Name</TableHead>
              <TableHead>Schedule</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Last Run</TableHead>
              <TableHead>Next Run</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No scheduled jobs found
                </TableCell>
              </TableRow>
            ) : (
              jobs?.map((job) => {
                const status = getJobStatus(job);
                return (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">{job.job_name}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{job.schedule}</code>
                    </TableCell>
                    <TableCell>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {job.last_run 
                        ? new Date(job.last_run).toLocaleString()
                        : "Never"
                      }
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatNextRun(job.schedule, job.last_run)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end space-x-1">
                        <Switch
                          checked={job.is_enabled}
                          onCheckedChange={(checked) => 
                            toggleJobMutation.mutate({ jobId: job.id, enabled: checked })
                          }
                          size="sm"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => runJobMutation.mutate(job.job_name)}
                          disabled={!job.is_enabled}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingJob(job)}
                        >
                          <Settings className="h-4 w-4" />
                        </Button>
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
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default ScheduledJobsTable;
