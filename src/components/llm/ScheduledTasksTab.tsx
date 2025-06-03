
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Pause, Settings, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import CronStatusChecker from "@/components/admin/CronStatusChecker";

export default function ScheduledTasksTab() {
  const [isCreating, setIsCreating] = useState(false);

  // Fetch scheduled tasks
  const { data: tasks, isLoading, refetch } = useQuery({
    queryKey: ['scheduled-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-scheduled-tasks');
      if (error) throw error;
      return data.tasks || [];
    }
  });

  const toggleTask = async (taskId: string, enabled: boolean) => {
    try {
      const { error } = await supabase.functions.invoke('toggle-scheduled-task', {
        body: { taskId, enabled }
      });
      
      if (error) throw error;
      
      toast.success(`Task ${enabled ? 'enabled' : 'disabled'} successfully`);
      refetch();
    } catch (error) {
      console.error('Error toggling task:', error);
      toast.error('Failed to toggle task');
    }
  };

  const runTaskNow = async (taskId: string) => {
    try {
      const { error } = await supabase.functions.invoke('run-task-now', {
        body: { taskId }
      });
      
      if (error) throw error;
      
      toast.success('Task executed successfully');
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
          <h2 className="text-2xl font-bold">Scheduled Tasks</h2>
          <p className="text-muted-foreground">Manage automated news imports and content processing</p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Clock className="mr-2 h-4 w-4" />
          New Schedule
        </Button>
      </div>

      {/* Daily News Import Status */}
      <CronStatusChecker />

      {/* Scheduled Tasks List */}
      <div className="grid gap-4">
        {tasks?.map((task: any) => (
          <Card key={task.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-base">{task.name}</CardTitle>
                <CardDescription>{task.description}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={task.enabled ? "default" : "secondary"}>
                  {task.enabled ? "Active" : "Inactive"}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleTask(task.id, !task.enabled)}
                >
                  {task.enabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
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
                  <span className="font-medium">Next Run:</span>
                  <p className="text-muted-foreground">
                    {task.next_run ? new Date(task.next_run).toLocaleString() : 'Not scheduled'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => runTaskNow(task.id)}
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
            <h3 className="text-lg font-medium mb-2">No Scheduled Tasks</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first scheduled task to automate news imports and content processing.
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
