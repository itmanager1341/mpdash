
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

export default function ScheduledImportSettings() {
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [frequency, setFrequency] = useState("daily");
  const [minScore, setMinScore] = useState("2.5");
  const [keywords, setKeywords] = useState("mortgage, housing market, federal reserve, interest rates");

  const handleManualRun = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-perplexity-news', {
        body: {
          minScore: parseFloat(minScore),
          keywords: keywords.split(',').map(k => k.trim()),
          limit: 20,
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
    // In a real implementation, you would update a settings table in Supabase
    // or call an edge function to configure the scheduled job
    setIsEnabled(!isEnabled);
    toast.success(`Scheduled import ${!isEnabled ? 'enabled' : 'disabled'}`);
  };

  const handleSaveSettings = () => {
    // In a real implementation, you would update a settings table in Supabase
    toast.success("Settings saved");
  };

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
          disabled={!isEnabled}
        >
          Save Settings
        </Button>
      </CardFooter>
    </Card>
  );
}
