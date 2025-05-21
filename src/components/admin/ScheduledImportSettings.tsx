import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScheduledJobSettings } from "@/types/database";
import { AlertCircle, Loader2, PlayCircle } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";

export default function ScheduledImportSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [frequency, setFrequency] = useState("daily");
  const [minScore, setMinScore] = useState("2.5");
  const [keywords, setKeywords] = useState("mortgage, housing market, federal reserve, interest rates");
  const [limit, setLimit] = useState("20");
  const [lastRunInfo, setLastRunInfo] = useState<{time: string | null, success: boolean, message: string} | null>(null);
  
  const queryClient = useQueryClient();

  // Map frequency to cron expression
  const frequencyToCron = {
    hourly: "0 * * * *",    // Run at minute 0 of every hour
    daily: "0 6 * * *",     // Run at 6:00 AM every day
    weekly: "0 6 * * 1"     // Run at 6:00 AM every Monday
  };

  // Fetch job settings from the database using custom RPC function
  const { data: jobSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['scheduled-job-settings'],
    queryFn: async () => {
      try {
        // Try to use RPC function first
        const { data, error } = await supabase.functions.invoke('get-scheduled-job', {
          body: { job_name: 'daily-perplexity-news-fetch' }
        });
        
        if (error) throw error;
        return data as ScheduledJobSettings;
      } catch (rpcError) {
        console.error("Error invoking function:", rpcError);
        
        try {
          // Direct DB query as fallback
          const { data, error } = await supabase
            .from('scheduled_job_settings')
            .select('*')
            .eq('job_name', 'daily-perplexity-news-fetch')
            .maybeSingle();
            
          if (error) throw error;
          return data as ScheduledJobSettings;
        } catch (dbError) {
          console.error("Database query error:", dbError);
          
          // Return default values if all else fails
          return {
            id: '',
            job_name: 'daily-perplexity-news-fetch',
            is_enabled: true,
            schedule: '0 6 * * *', // Daily at 6am
            parameters: {
              minScore: 2.5,
              keywords: ['mortgage', 'housing market', 'federal reserve', 'interest rates'],
              limit: 20
            },
            last_run: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
      }
    }
  });

  // Update job settings using edge function
  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<ScheduledJobSettings>) => {
      try {
        // Try to update with edge function first
        const { data, error } = await supabase.functions.invoke('update-scheduled-job', {
          body: {
            job_name: 'daily-perplexity-news-fetch',
            settings
          }
        });
        
        if (error) throw error;
        return data;
      } catch (fnError) {
        console.error("Error invoking update function:", fnError);
        
        // Fallback to direct database update
        const { error } = await supabase
          .from('scheduled_job_settings')
          .update(settings)
          .eq('job_name', 'daily-perplexity-news-fetch');
          
        if (error) throw error;
        return true;
      }
    },
    onSuccess: () => {
      toast.success("Settings saved");
      queryClient.invalidateQueries({ queryKey: ['scheduled-job-settings'] });
    },
    onError: (error) => {
      console.error("Error updating job settings:", error);
      toast.error("Failed to save settings");
    }
  });

  // Initialize form values from database
  useEffect(() => {
    if (jobSettings) {
      setIsEnabled(jobSettings.is_enabled);
      
      // Determine frequency from cron expression
      if (jobSettings.schedule === "0 * * * *") {
        setFrequency("hourly");
      } else if (jobSettings.schedule === "0 6 * * 1") {
        setFrequency("weekly");
      } else {
        setFrequency("daily"); // Default
      }
      
      setMinScore(jobSettings.parameters.minScore.toString());
      setKeywords(jobSettings.parameters.keywords.join(', '));
      setLimit(jobSettings.parameters.limit.toString());
      
      // Format last run info if available
      if (jobSettings.last_run) {
        try {
          const lastRunDate = parseISO(jobSettings.last_run);
          const timeAgo = formatDistanceToNow(lastRunDate, { addSuffix: true });
          setLastRunInfo({
            time: timeAgo,
            success: true,
            message: `Last executed ${timeAgo}`
          });
        } catch (e) {
          setLastRunInfo({
            time: jobSettings.last_run,
            success: true,
            message: `Last executed ${jobSettings.last_run}`
          });
        }
      } else {
        setLastRunInfo({
          time: null,
          success: false,
          message: "Job has never run"
        });
      }
    }
  }, [jobSettings]);

  const handleManualRun = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-perplexity-news', {
        body: {
          minScore: parseFloat(minScore),
          keywords: keywords.split(',').map(k => k.trim()),
          limit: parseInt(limit, 10),
          skipDuplicateCheck: false
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        // Update last run info
        setLastRunInfo({
          time: "just now",
          success: true,
          message: `Last executed just now`
        });
        
        toast.success(`Import completed: ${data.results.inserted} items imported, ${data.results.skipped.duplicates} duplicates skipped`);
        
        // If no articles were inserted, show a more descriptive message
        if (data.results.inserted === 0) {
          if (data.results.skipped.duplicates > 0) {
            toast.info(`No new articles were imported because ${data.results.skipped.duplicates} articles were found to be duplicates.`);
          } else if (data.results.skipped.lowScore > 0) {
            toast.info(`No articles were imported because ${data.results.skipped.lowScore} articles had scores below the minimum threshold of ${minScore}.`);
          } else {
            toast.info("No new articles were found matching your criteria. Try adjusting your keywords or minimum score.");
          }
        }
        
        // Refresh any queries that might be affected
        queryClient.invalidateQueries({ queryKey: ['news'] });
      } else {
        setLastRunInfo({
          time: "just now",
          success: false,
          message: `Failed: ${data.error}`
        });
        toast.error(`Import failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Error running scheduled import:", error);
      setLastRunInfo({
        time: "just now",
        success: false,
        message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
      toast.error("Failed to run scheduled import");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSchedule = async () => {
    updateSettings.mutate({
      is_enabled: !isEnabled
    });
    setIsEnabled(!isEnabled);
  };

  const handleSaveSettings = () => {
    const keywordArray = keywords.split(',').map(k => k.trim()).filter(k => k);
    
    updateSettings.mutate({
      schedule: frequencyToCron[frequency as keyof typeof frequencyToCron],
      parameters: {
        minScore: parseFloat(minScore),
        keywords: keywordArray,
        limit: parseInt(limit, 10)
      }
    });
  };

  if (isLoadingSettings) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Scheduled News Import</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <p className="text-muted-foreground">Loading settings...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Scheduled News Import</CardTitle>
        <CardDescription>
          Configure automatic import of news data from Perplexity API
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {lastRunInfo && (
          <Alert variant={lastRunInfo.success ? "default" : "destructive"}>
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Execution Status</AlertTitle>
            <AlertDescription>
              {lastRunInfo.message}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <h4 className="font-medium">Enable Scheduled Import</h4>
            <p className="text-sm text-muted-foreground">
              Automatically fetch news on a schedule
            </p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={handleToggleSchedule} />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="frequency">Import Frequency</Label>
            <Select value={frequency} onValueChange={setFrequency} disabled={!isEnabled}>
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hourly">Hourly</SelectItem>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="min-score">Minimum Perplexity Score</Label>
            <Input
              id="min-score"
              type="number"
              min="0"
              max="5"
              step="0.1"
              value={minScore}
              onChange={(e) => setMinScore(e.target.value)}
              disabled={!isEnabled}
            />
            <p className="text-xs text-muted-foreground">
              Only import news with scores above this threshold (0-5)
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="limit">Maximum Articles to Fetch</Label>
            <Input
              id="limit"
              type="number"
              min="1"
              max="50"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              disabled={!isEnabled}
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of articles to fetch per run (1-50)
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="keywords">Keywords (comma-separated)</Label>
            <Input
              id="keywords"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={!isEnabled}
            />
            <p className="text-xs text-muted-foreground">
              News will be fetched for each of these keywords
            </p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button
          onClick={handleManualRun}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <PlayCircle className="mr-2 h-4 w-4" />
              Run Now
            </>
          )}
        </Button>
        
        <Button
          variant="outline"
          onClick={handleSaveSettings}
          disabled={!isEnabled || updateSettings.isPending}
        >
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </Button>
      </CardFooter>
    </Card>
  );
}
