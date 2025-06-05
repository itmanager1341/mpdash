
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Pause, Settings, Trash2, Edit } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export default function ScheduledJobsTable() {
  const [isLoading, setIsLoading] = useState(false);

  const { data: jobs, isLoading: jobsLoading, refetch } = useQuery({
    queryKey: ['scheduled-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_job_settings')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const toggleJobStatus = async (jobId: string, enabled: boolean) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('scheduled_job_settings')
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', jobId);
      
      if (error) throw error;
      
      toast.success(`Job ${enabled ? 'enabled' : 'disabled'} successfully`);
      refetch();
    } catch (error) {
      console.error('Error toggling job status:', error);
      toast.error('Failed to toggle job status');
    } finally {
      setIsLoading(false);
    }
  };

  const runJobNow = async (job: any) => {
    setIsLoading(true);
    try {
      // Extract parameters
      const params = job.parameters as { promptId?: string; limit?: number; model?: string };
      
      const { data, error } = await supabase.functions.invoke('run-news-import', {
        body: {
          manual: true,
          promptId: params?.promptId,
          modelOverride: params?.model,
          limit: params?.limit || 20,
          triggeredBy: 'manual_ui'
        }
      });
      
      if (error) throw error;
      
      if (data?.success) {
        toast.success(`Job executed successfully: ${data.details?.articles_inserted || 0} articles imported`);
        
        // Update last_run timestamp
        await supabase
          .from('scheduled_job_settings')
          .update({ last_run: new Date().toISOString() })
          .eq('id', job.id);
          
        refetch();
      } else {
        toast.warning(data?.message || "Job completed but no new articles found");
      }
    } catch (error) {
      console.error('Error running job:', error);
      toast.error('Failed to run job: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteJob = async (jobId: string) => {
    try {
      const { error } = await supabase
        .from('scheduled_job_settings')
        .delete()
        .eq('id', jobId);
      
      if (error) throw error;
      
      toast.success('Job deleted successfully');
      refetch();
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
    }
  };

  const getJobTypeLabel = (jobName: string) => {
    if (jobName.includes('news_search')) return 'News Search';
    if (jobName.includes('perplexity')) return 'Perplexity Import';
    return 'General Task';
  };

  const getScheduleDescription = (schedule: string) => {
    const scheduleMap: { [key: string]: string } = {
      '0 */6 * * *': 'Every 6 hours',
      '0 */12 * * *': 'Every 12 hours',
      '0 9 * * *': 'Daily at 9 AM',
      '0 6 * * *': 'Daily at 6 AM',
      '* * * * *': 'Every minute',
      '*/5 * * * *': 'Every 5 minutes',
      '0 * * * *': 'Hourly'
    };
    
    return scheduleMap[schedule] || schedule;
  };

  if (jobsLoading) {
    return <div>Loading scheduled jobs...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Scheduled Jobs</CardTitle>
        <CardDescription>
          Manage automated tasks and their execution schedules
        </CardDescription>
      </CardHeader>
      <CardContent>
        {jobs?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Settings className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
            <p>No scheduled jobs found</p>
            <p className="text-sm">Jobs will appear here when created from News Search Prompts</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Schedule</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Run</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs?.map((job) => (
                <TableRow key={job.id}>
                  <TableCell className="font-medium">{job.job_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getJobTypeLabel(job.job_name)}</Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{getScheduleDescription(job.schedule)}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={job.is_enabled ? "default" : "secondary"}>
                      {job.is_enabled ? "Enabled" : "Disabled"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {job.last_run 
                        ? new Date(job.last_run).toLocaleString()
                        : "Never"
                      }
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleJobStatus(job.id, !job.is_enabled)}
                        disabled={isLoading}
                      >
                        {job.is_enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => runJobNow(job)}
                        disabled={isLoading}
                      >
                        <Play className="h-4 w-4" />
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Job</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{job.job_name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteJob(job.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
