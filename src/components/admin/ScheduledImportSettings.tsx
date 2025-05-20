
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// Define interfaces for database records
interface ScheduledJobSettings {
  id: string;
  job_name: string;
  is_enabled: boolean;
  schedule: string;
  parameters: {
    minScore: number;
    keywords: string[];
    limit: number;
  };
  last_run: string | null;
}

export default function ScheduledImportSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [frequency, setFrequency] = useState("daily");
  const [minScore, setMinScore] = useState("2.5");
  const [keywords, setKeywords] = useState("mortgage, housing market, federal reserve, interest rates");
  const [limit, setLimit] = useState("20");
  
  const queryClient = useQueryClient();

  // Map frequency to cron expression
  const frequencyToCron = {
    hourly: "0 * * * *",    // Run at minute 0 of every hour
    daily: "0 6 * * *",     // Run at 6:00 AM every day
    weekly: "0 6 * * 1"     // Run at 6:00 AM every Monday
  };

  // Fetch job settings from the database using raw SQL query
  const { data: jobSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ['scheduled-job-settings'],
    queryFn: async () => {
      // Use RPC to fetch data since the table isn't in TypeScript definitions
      const { data, error } = await supabase.rpc('get_job_settings', {
        job_name_param: 'daily-perplexity-news-fetch'
      }).maybeSingle();
      
      if (error) {
        console.error("Error fetching job settings:", error);
        
        // Fallback to direct SQL query if RPC fails
        const { data: sqlData, error: sqlError } = await supabase
          .from('scheduled_job_settings')
          .select('*')
          .eq('job_name', 'daily-perplexity-news-fetch')
          .maybeSingle();
          
        if (sqlError) {
          console.error("Fallback query error:", sqlError);
          return null;
        }
        
        return sqlData as unknown as ScheduledJobSettings;
      }
      
      return data as ScheduledJobSettings;
    }
  });

  // Update job settings in the database
  const updateSettings = useMutation({
    mutationFn: async (settings: Partial<ScheduledJobSettings>) => {
      // Use the raw query method to avoid type issues
      const { error } = await supabase.rpc('update_job_settings', {
        job_name_param: 'daily-perplexity-news-fetch',
        settings_json: settings
      });
      
      if (error) {
        // Fallback to direct SQL if RPC fails
        const { error: sqlError } = await supabase
          .from('scheduled_job_settings')
          .update(settings)
          .eq('job_name', 'daily-perplexity-news-fetch');
          
        if (sqlError) throw sqlError;
      }
      
      return true;
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
        toast.success(`Import completed: ${data.results.inserted} items imported, ${data.results.skipped.duplicates} duplicates skipped`);
      } else {
        toast.error(`Import failed: ${data.error}`);
      }
    } catch (error) {
      console.error("Error running scheduled import:", error);
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
          {isLoading ? "Running..." : "Run Now"}
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
