import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw, Settings, Users, Target } from "lucide-react";

interface SyncResults {
  processed: number;
  created: number;
  updated: number;
  matched: number;
  skipped: number;
  errors: string[];
  matchDetails: Array<{
    wordpress_id: number;
    article_id: string;
    match_type: string;
    confidence: number;
    title: string;
  }>;
}

export default function EnhancedWordPressSync() {
  const [isLoading, setIsLoading] = useState(false);
  const [syncResults, setSyncResults] = useState<SyncResults | null>(null);
  const [config, setConfig] = useState({
    maxArticles: 100,
    startDate: '',
    endDate: '',
    legacyMode: true
  });

  const handleEnhancedSync = async () => {
    setIsLoading(true);
    setSyncResults(null);

    try {
      console.log('Starting enhanced WordPress sync...');
      
      const { data, error } = await supabase.functions.invoke('wordpress-legacy-sync', {
        body: config
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data.success) {
        setSyncResults(data.results);
        const { results } = data;
        toast.success(`Enhanced sync completed! ${results.created} created, ${results.updated} updated, ${results.matched} matched`);
      } else {
        throw new Error(data.error || 'Enhanced WordPress sync failed');
      }
    } catch (error) {
      console.error('Enhanced WordPress sync error:', error);
      toast.error(`Enhanced WordPress sync failed: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const getMatchTypeColor = (matchType: string) => {
    switch (matchType) {
      case 'wordpress_id': return 'bg-green-100 text-green-800';
      case 'title_similarity': return 'bg-blue-100 text-blue-800';
      case 'exact_title': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 font-semibold';
    if (confidence >= 0.8) return 'text-blue-600 font-medium';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Enhanced WordPress Article Sync
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <Settings className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Enhanced Sync Features</span>
            </div>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Matches existing articles by title similarity</li>
              <li>• Updates legacy articles with WordPress metadata</li>
              <li>• Creates and maps authors automatically</li>
              <li>• Provides detailed matching confidence scores</li>
            </ul>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="legacy-mode"
              checked={config.legacyMode}
              onCheckedChange={(checked) => 
                setConfig(prev => ({ ...prev, legacyMode: checked }))
              }
            />
            <Label htmlFor="legacy-mode" className="text-sm">
              Legacy Mode (Match and update existing articles)
            </Label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="max-articles">Maximum Articles</Label>
              <Input
                id="max-articles"
                type="number"
                min="1"
                max="1000"
                value={config.maxArticles}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  maxArticles: parseInt(e.target.value) || 100 
                }))}
                disabled={isLoading}
              />
            </div>
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
            onClick={handleEnhancedSync} 
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running Enhanced Sync...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Run Enhanced WordPress Sync
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {syncResults && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Enhanced Sync Results
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{syncResults.processed}</div>
                <div className="text-sm text-muted-foreground">Processed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{syncResults.created}</div>
                <div className="text-sm text-muted-foreground">Created</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{syncResults.updated}</div>
                <div className="text-sm text-muted-foreground">Updated</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{syncResults.matched}</div>
                <div className="text-sm text-muted-foreground">Matched</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{syncResults.skipped}</div>
                <div className="text-sm text-muted-foreground">Skipped</div>
              </div>
            </div>

            {syncResults.matchDetails && syncResults.matchDetails.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Article Matches ({syncResults.matchDetails.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {syncResults.matchDetails.map((match, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="font-medium text-sm truncate">{match.title}</div>
                        <div className="text-xs text-muted-foreground">
                          WP ID: {match.wordpress_id} → Article: {match.article_id.substring(0, 8)}...
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={getMatchTypeColor(match.match_type)}>
                          {match.match_type.replace('_', ' ')}
                        </Badge>
                        <span className={`text-sm ${getConfidenceColor(match.confidence)}`}>
                          {(match.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {syncResults.errors && syncResults.errors.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-red-600">Errors ({syncResults.errors.length})</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {syncResults.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-600 bg-red-50 p-2 rounded">
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
