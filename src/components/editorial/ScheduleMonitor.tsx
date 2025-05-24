
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { 
  Clock, 
  Play, 
  Pause,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Activity,
  Settings,
  TrendingUp
} from "lucide-react";

export default function ScheduleMonitor() {
  const queryClient = useQueryClient();

  // Fetch job settings
  const { data: jobSettings, isLoading: settingsLoading } = useQuery({
    queryKey: ['scheduled-job-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_job_settings')
        .select('*')
        .eq('job_name', 'news_import')
        .maybeSingle();
        
      if (error) throw error;
      return data;
    }
  });

  // Fetch recent news import activity (since job_logs table doesn't exist)
  const { data: recentActivity } = useQuery({
    queryKey: ['recent-import-activity'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('timestamp, source, status')
        .order('timestamp', { ascending: false })
        .limit(10);
        
      if (error) throw error;
      return data || [];
    }
  });

  // Check cron status
  const { data: cronStatus, refetch: refetchCronStatus } = useQuery({
    queryKey: ['cron-status'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('check-cron-status');
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  // Update job settings mutation
  const updateJobMutation = useMutation({
    mutationFn: async (settings: any) => {
      const { error } = await supabase.functions.invoke('update-scheduled-job', {
        body: { job_name: 'news_import', settings }
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduled-job-settings'] });
      toast.success('Job settings updated');
    },
    onError: (error) => {
      toast.error('Failed to update settings: ' + error.message);
    }
  });

  // Manual run mutation
  const runManualMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('run-news-import', {
        body: { 
          manual: true,
          modelOverride: "llama-3.1-sonar-small-128k-online"
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast.success(`Manual import completed: ${data.details?.articles_inserted || 0} articles inserted`);
      } else {
        toast.error(`Import failed: ${data.message}`);
      }
      queryClient.invalidateQueries({ queryKey: ['recent-import-activity'] });
      refetchCronStatus();
    },
    onError: (error) => {
      toast.error('Failed to run manual import: ' + error.message);
    }
  });

  const toggleJobEnabled = () => {
    if (!jobSettings) return;
    
    updateJobMutation.mutate({
      is_enabled: !jobSettings.is_enabled,
      schedule: jobSettings.schedule,
      parameters: jobSettings.parameters
    });
  };

  const getStatusIcon = () => {
    if (!cronStatus?.success) {
      return <AlertCircle className="h-5 w-5 text-red-500" />;
    }
    
    if (cronStatus.recommendations?.job_enabled) {
      return <CheckCircle2 className="h-5 w-5 text-green-500" />;
    }
    
    return <Pause className="h-5 w-5 text-amber-500" />;
  };

  const getStatusText = () => {
    if (!cronStatus?.success) return "Error";
    if (cronStatus.recommendations?.job_enabled) return "Active";
    return "Paused";
  };

  const getLastRunInfo = () => {
    if (recentActivity && recentActivity.length > 0) {
      const lastImport = recentActivity[0];
      const timeDiff = new Date().getTime() - new Date(lastImport.timestamp).getTime();
      const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
      return {
        time: hoursAgo < 24 ? `${hoursAgo}h ago` : new Date(lastImport.timestamp).toLocaleDateString(),
        count: recentActivity.filter(item => 
          new Date(item.timestamp).toDateString() === new Date(lastImport.timestamp).toDateString()
        ).length
      };
    }
    return { time: "Never", count: 0 };
  };

  const lastRunInfo = getLastRunInfo();

  return (
    <div className="space-y-6">
      {/* Job Status Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Job Status</CardTitle>
            {getStatusIcon()}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{getStatusText()}</div>
            <p className="text-xs text-muted-foreground">
              {jobSettings?.schedule || "No schedule configured"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Run</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastRunInfo.time}</div>
            <p className="text-xs text-muted-foreground">
              {lastRunInfo.count} articles imported
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Articles</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastRunInfo.count}</div>
            <p className="text-xs text-muted-foreground">
              Last import
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Job Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Job Controls
          </CardTitle>
          <CardDescription>
            Manage automated news import scheduling and execution
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="font-medium">Automated Import</span>
              <p className="text-sm text-muted-foreground">
                Run news import automatically on schedule
              </p>
            </div>
            <Switch 
              checked={jobSettings?.is_enabled || false}
              onCheckedChange={toggleJobEnabled}
              disabled={updateJobMutation.isPending || settingsLoading}
            />
          </div>

          <div className="flex gap-4">
            <Button 
              onClick={() => runManualMutation.mutate()}
              disabled={runManualMutation.isPending}
              className="flex items-center gap-2"
            >
              {runManualMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Import Now
                </>
              )}
            </Button>

            <Button 
              variant="outline"
              onClick={() => refetchCronStatus()}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Recent Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivity && recentActivity.length > 0 ? recentActivity.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {item.status === 'approved' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : item.status === 'dismissed' ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500" />
                    )}
                    <span className="font-medium">Article from {item.source}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={
                    item.status === 'approved' ? 'default' : 
                    item.status === 'dismissed' ? 'destructive' : 'secondary'
                  }>
                    {item.status || 'pending'}
                  </Badge>
                </div>
              </div>
            )) : (
              <p className="text-center text-muted-foreground py-4">
                No recent activity found
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
