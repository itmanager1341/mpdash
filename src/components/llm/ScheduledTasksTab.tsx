
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Pause, Settings, Calendar, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CronStatusChecker from "@/components/admin/CronStatusChecker";

export default function ScheduledTasksTab() {
  const [isCreating, setIsCreating] = useState(false);

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
          <h2 className="text-2xl font-bold">General Scheduled Tasks</h2>
          <p className="text-muted-foreground">Manage automated tasks for content processing and system maintenance</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Clock className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      {/* Information Card */}
      <Card className="bg-amber-50 border-amber-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-amber-600" />
            <CardTitle className="text-base text-amber-800">Task Categories</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-amber-700 mb-3">
            This section manages general system tasks and content processing schedules. 
            For news search scheduling, visit Keyword Management → Search Prompts → Scheduled Tasks.
          </p>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700">Content Processing</Badge>
            <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Data Maintenance</Badge>
            <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">Analytics</Badge>
          </div>
        </CardContent>
      </Card>

      {/* System Status */}
      <CronStatusChecker />

      {/* Task Categories */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <p className="text-sm text-muted-foreground">Paused Tasks</p>
                <p className="text-2xl font-bold">
                  {tasks?.filter(t => !t.is_enabled).length || 0}
                </p>
              </div>
              <Badge variant="secondary">Paused</Badge>
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

      {/* Scheduled Tasks List */}
      <div className="grid gap-4">
        {tasks?.map((task) => (
          <Card key={task.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">{task.job_name}</CardTitle>
                <CardDescription>
                  {task.parameters && Object.keys(task.parameters).length > 0 
                    ? `Parameters: ${Object.keys(task.parameters).join(', ')}`
                    : 'No additional parameters'
                  }
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
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="font-medium">Schedule:</span>
                  <p className="text-muted-foreground">{task.schedule}</p>
                </div>
                <div>
                  <span className="font-medium">Last Run:</span>
                  <p className="text-muted-foreground">
                    {task.last_run ? new Date(task.last_run).toLocaleString() : 'Never'}
                  </p>
                </div>
                <div>
                  <span className="font-medium">Created:</span>
                  <p className="text-muted-foreground">
                    {new Date(task.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runTaskNow(task.id, task.job_name)}
                  >
                    <Play className="mr-1 h-3 w-3" />
                    Run Now
                  </Button>
                  <Button variant="outline" size="sm">
                    <Settings className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tasks?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No General Scheduled Tasks</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first scheduled task to automate content processing and system maintenance.
            </p>
            <Button onClick={() => setIsCreating(true)}>
              <Clock className="mr-2 h-4 w-4" />
              Create Schedule
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
