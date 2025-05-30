
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Settings } from "lucide-react";

export default function WordPressSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [config, setConfig] = useState({
    maxArticles: 100,
    startDate: '',
    endDate: ''
  });

  const handleSync = async () => {
    setIsLoading(true);
    setSyncResults(null);

    try {
      console.log('Starting WordPress sync with stored credentials...');
      
      const { data, error } = await supabase.functions.invoke('wordpress-sync', {
        body: config
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data.success) {
        setSyncResults(data.results);
        const total = data.results.synced + data.results.updated;
        toast.success(`WordPress sync completed! ${total} articles processed (${data.results.synced} new, ${data.results.updated} updated)`);
      } else {
        throw new Error(data.error || 'WordPress sync failed');
      }
    } catch (error) {
      console.error('WordPress sync error:', error);
      toast.error(`WordPress sync failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            WordPress Article Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Using Stored Credentials</span>
            </div>
            <p className="text-sm text-blue-700">
              WordPress credentials are securely stored in Supabase secrets. 
              The sync will use your configured WordPress URL, username, and application password.
            </p>
          </div>

          <div>
            <Label htmlFor="max-articles">Maximum Articles to Sync</Label>
            <Input
              id="max-articles"
              type="number"
              min="1"
              max="1000"
              value={config.maxArticles}
              onChange={(e) => setConfig(prev => ({ ...prev, maxArticles: parseInt(e.target.value) || 100 }))}
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Limit the number of articles to sync (1-1000). Higher numbers may take longer.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start-date">Start Date</Label>
              <Input
                id="start-date"
                type="date"
                value={config.startDate}
                onChange={(e) => setConfig(prev => ({ ...prev, startDate: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            <div>
              <Label htmlFor="end-date">End Date</Label>
              <Input
                id="end-date"
                type="date"
                value={config.endDate}
                onChange={(e) => setConfig(prev => ({ ...prev, endDate: e.target.value }))}
                disabled={isLoading}
              />
            </div>
          </div>

          <Button 
            onClick={handleSync} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing WordPress Articles...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync WordPress Articles
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {syncResults && (
        <Card>
          <CardHeader>
            <CardTitle>Sync Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Badge variant="outline" className="bg-green-50 text-green-700">
                New: {syncResults.synced}
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                Updated: {syncResults.updated}
              </Badge>
              <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                Duplicates Skipped: {syncResults.duplicates}
              </Badge>
              {syncResults.errors?.length > 0 && (
                <Badge variant="destructive">
                  Errors: {syncResults.errors.length}
                </Badge>
              )}
            </div>
            
            {syncResults.errors?.length > 0 && (
              <div>
                <Label>Errors:</Label>
                <Textarea
                  value={syncResults.errors.join('\n')}
                  readOnly
                  className="mt-2 h-32"
                />
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
