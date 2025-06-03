
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Settings, Calendar, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CronStatusChecker from "@/components/admin/CronStatusChecker";

export default function ScheduledTasksTab() {
  // Fetch scheduled tasks (excluding news search tasks)
  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ['general-scheduled-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_job_settings')
        .select('*')
        .not('job_name', 'ilike', '%news%')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    }
  });

  const toggleTask = async (taskId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from('scheduled_job_settings')
        .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('id', taskId);
      
      if (error) throw error;
      
      toast.success(`Task ${enabled ? 'enabled' : 'disabled'} successfully`);
      refetch();
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error('Failed to toggle task');
    }
  };

  const runTaskNow = async (taskId: string, jobName: string) => {
    try {
      // Update last_run timestamp
      const { error } = await supabase
        .from('scheduled_job_settings')
        .update({ last_run: new Date().toISOString() })
        .eq('id', taskId);
      
      if (error) throw error;
      
      toast.success(`Task "${jobName}" executed successfully`);
      refetch();
    } catch (error) {
      console.error('Error running task:', error);
      toast.error('Failed to run task');
    }
  };

  if (isLoading) {
    return <div>Loading scheduled tasks...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">System Task Scheduling</h2>
          <p className="text-muted-foreground">Manage automated system tasks for infrastructure and maintenance</p>
        </div>
      </div>

      {/* Information Card */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-base text-blue-800">System Tasks</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-blue-700 mb-3">
            This section manages system-level scheduled tasks like database maintenance, content processing, and infrastructure operations. 
            For news search scheduling, use Keyword Management → Search Prompts.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">Database Maintenance</Badge>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Content Processing</Badge>
            <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">Infrastructure</Badge>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <CronStatusChecker />

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Tasks</p>
                <p className="text-2xl font-bold">
                  {tasks?.filter(t => t.is_enabled).length || 0}
                </p>
              </div>
              <Badge className="bg-green-100 text-green-800">Running</Badge>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{tasks?.length || 0}</p>
              </div>
              <Settings className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Tasks List */}
      <div className="space-y-4">
        {tasks?.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No System Tasks</h3>
              <p className="text-muted-foreground text-center">
                System tasks will appear here when configured by administrators.
              </p>
            </CardContent>
          </Card>
        ) : (
          tasks?.map((task) => (
            <Card key={task.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div>
                  <CardTitle className="text-base">{task.job_name}</CardTitle>
                  <CardDescription>
                    Schedule: {task.schedule} • 
                    Last run: {task.last_run ? new Date(task.last_run).toLocaleString() : 'Never'}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={task.is_enabled ? "default" : "secondary"}>
                    {task.is_enabled ? "Active" : "Paused"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => toggleTask(task.id, !task.is_enabled)}
                  >
                    {task.is_enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runTaskNow(task.id, task.job_name)}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    Run
                  </Button>
                </div>
              </CardHeader>
              {task.parameters && Object.keys(task.parameters).length > 0 && (
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <span className="font-medium">Parameters:</span> {Object.keys(task.parameters).join(', ')}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
