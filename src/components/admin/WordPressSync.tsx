
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Download, RefreshCw } from "lucide-react";

export default function WordPressSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [syncResults, setSyncResults] = useState(null);
  const [config, setConfig] = useState({
    wordpressUrl: '',
    username: '',
    password: '',
    page: 1,
    perPage: 50
  });

  const handleSync = async () => {
    if (!config.wordpressUrl || !config.username || !config.password) {
      toast.error("Please fill in all WordPress credentials");
      return;
    }

    setIsLoading(true);
    setSyncResults(null);

    try {
      const { data, error } = await supabase.functions.invoke('wordpress-sync', {
        body: config
      });

      if (error) throw error;

      if (data.success) {
        setSyncResults(data.results);
        toast.success(`WordPress sync completed! Synced: ${data.results.synced}, Updated: ${data.results.updated}`);
      } else {
        throw new Error(data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('WordPress sync error:', error);
      toast.error(`Sync failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            WordPress Article Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="wp-url">WordPress URL</Label>
              <Input
                id="wp-url"
                placeholder="https://mortgagepoint.com"
                value={config.wordpressUrl}
                onChange={(e) => setConfig(prev => ({ ...prev, wordpressUrl: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="wp-username">Username</Label>
              <Input
                id="wp-username"
                placeholder="WordPress username"
                value={config.username}
                onChange={(e) => setConfig(prev => ({ ...prev, username: e.target.value }))}
              />
            </div>
          </div>
          
          <div>
            <Label htmlFor="wp-password">Application Password</Label>
            <Input
              id="wp-password"
              type="password"
              placeholder="WordPress application password"
              value={config.password}
              onChange={(e) => setConfig(prev => ({ ...prev, password: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="page">Page</Label>
              <Input
                id="page"
                type="number"
                min="1"
                value={config.page}
                onChange={(e) => setConfig(prev => ({ ...prev, page: parseInt(e.target.value) || 1 }))}
              />
            </div>
            <div>
              <Label htmlFor="per-page">Articles per page</Label>
              <Input
                id="per-page"
                type="number"
                min="1"
                max="100"
                value={config.perPage}
                onChange={(e) => setConfig(prev => ({ ...prev, perPage: parseInt(e.target.value) || 50 }))}
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
                Synced: {syncResults.synced}
              </Badge>
              <Badge variant="outline" className="bg-blue-50 text-blue-700">
                Updated: {syncResults.updated}
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
