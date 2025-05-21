
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, AlertCircle, TrendingUp, ChevronRight, Loader2 } from "lucide-react";

interface KeywordCluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  keywords?: string[];
}

interface KeywordSuggestion {
  keyword: string;
  score: number;
  related_clusters: string[];
  source: string;
  rationale?: string;
}

interface ClusterMaintenanceTabProps {
  searchTerm: string;
}

const ClusterMaintenanceTab = ({ searchTerm }: ClusterMaintenanceTabProps) => {
  const [view, setView] = useState<"suggestions" | "maintenance">("suggestions");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [showRationale, setShowRationale] = useState<Record<string, boolean>>({});

  // Fetch existing keyword clusters for reference
  const { data: clusters, isLoading: clustersLoading } = useQuery({
    queryKey: ['keyword-clusters-summary'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('id, primary_theme, sub_theme, keywords')
        .order('primary_theme', { ascending: true });
      
      if (error) throw error;
      return data as KeywordCluster[];
    }
  });
  
  // Fetch recent articles for context
  const { data: recentArticles } = useQuery({
    queryKey: ['recent-articles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select('headline, summary')
        .order('timestamp', { ascending: false })
        .limit(10);
      
      if (error) throw error;
      return data;
    }
  });

  // Analysis of clusters
  const clusterAnalysis = clusters ? {
    totalClusters: clusters.length,
    totalKeywords: clusters.reduce((sum, cluster) => sum + (cluster.keywords?.length || 0), 0),
    emptyClusters: clusters.filter(c => !c.keywords || c.keywords.length === 0).length,
    averageKeywordsPerCluster: clusters.reduce((sum, cluster) => sum + (cluster.keywords?.length || 0), 0) / 
      (clusters.length || 1)
  } : null;

  // Generate AI suggestions
  const generateSuggestions = async () => {
    setIsLoading(true);
    setSuggestions([]);
    
    try {
      toast.info("Analyzing content and generating keyword suggestions...");
      
      // Prepare the context data
      const context = {
        existingClusters: clusters,
        recentArticles: recentArticles
      };
      
      // Call our edge function
      const { data, error } = await supabase.functions.invoke('suggest-keywords', {
        body: { 
          source: "news_analysis",
          context
        }
      });
      
      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Failed to generate suggestions");
      }
      
      if (data?.success && data.suggestions?.length > 0) {
        setSuggestions(data.suggestions);
        toast.success(`Generated ${data.suggestions.length} keyword suggestions using ${data.api_used} API`);
      } else {
        toast.warning("No suggestions were generated. Try again.");
      }
    } catch (err) {
      console.error("Error generating suggestions:", err);
      toast.error("Failed to generate keyword suggestions: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle showing rationale for a suggestion
  const toggleRationale = (keywordId: string) => {
    setShowRationale(prev => ({
      ...prev,
      [keywordId]: !prev[keywordId]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold">Cluster Maintenance</h2>
          <p className="text-sm text-muted-foreground">
            Optimize your keyword clusters and discover new trends
          </p>
        </div>
        
        <Tabs value={view} onValueChange={(v) => setView(v as "suggestions" | "maintenance")}>
          <TabsList>
            <TabsTrigger value="suggestions">Keyword Suggestions</TabsTrigger>
            <TabsTrigger value="maintenance">Cluster Health</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {view === "suggestions" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-medium">AI-Generated Suggestions</h3>
            <Button onClick={generateSuggestions} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Suggestions
                </>
              )}
            </Button>
          </div>
          
          {suggestions.length > 0 ? (
            <div className="space-y-4">
              {suggestions.map((suggestion, idx) => (
                <Card key={idx} className="overflow-hidden">
                  <CardHeader className="bg-muted/30 pb-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-base">{suggestion.keyword}</CardTitle>
                        <CardDescription>Relevance Score: {suggestion.score.toFixed(2)}</CardDescription>
                      </div>
                      <Badge variant={suggestion.score > 0.85 ? "default" : "outline"}>
                        {suggestion.score > 0.85 ? "High Value" : "Potential"}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-3">
                    <div className="mb-3">
                      <p className="text-sm text-muted-foreground">
                        Source: <span className="font-medium">{suggestion.source}</span>
                      </p>
                    </div>
                    
                    {suggestion.related_clusters && suggestion.related_clusters.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Potential clusters to add to:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {suggestion.related_clusters.map((cluster, cidx) => (
                            <Badge key={cidx} variant="secondary">{cluster}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {suggestion.rationale && (
                      <div className="mt-3">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => toggleRationale(suggestion.keyword)}
                          className="p-0 h-auto text-sm text-muted-foreground hover:text-foreground"
                        >
                          {showRationale[suggestion.keyword] ? 'Hide rationale' : 'Show rationale'}
                        </Button>
                        
                        {showRationale[suggestion.keyword] && (
                          <p className="text-sm mt-2 text-muted-foreground">
                            {suggestion.rationale}
                          </p>
                        )}
                      </div>
                    )}
                    
                    <div className="mt-4 flex justify-end">
                      <Button variant="outline" size="sm">
                        Add to Cluster <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="bg-muted/50 rounded-md p-8 text-center">
              <h3 className="font-semibold mb-2">No suggestions yet</h3>
              <p className="text-muted-foreground mb-4">
                Generate AI-powered keyword suggestions based on your content, industry trends, and existing keyword clusters
              </p>
              <Button onClick={generateSuggestions} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate Suggestions
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      )}
      
      {view === "maintenance" && (
        <div className="space-y-6">
          {clustersLoading ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Analyzing clusters...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Clusters</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{clusterAnalysis?.totalClusters || 0}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Total Keywords</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">{clusterAnalysis?.totalKeywords || 0}</p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Avg. Keywords/Cluster</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold">
                      {clusterAnalysis?.averageKeywordsPerCluster.toFixed(1) || 0}
                    </p>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardDescription>Empty Clusters</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center gap-2">
                    <p className="text-2xl font-bold">{clusterAnalysis?.emptyClusters || 0}</p>
                    {(clusterAnalysis?.emptyClusters || 0) > 0 && (
                      <AlertCircle className="h-5 w-5 text-amber-500" />
                    )}
                  </CardContent>
                </Card>
              </div>
              
              <Card>
                <CardHeader>
                  <CardTitle>Cluster Health Analysis</CardTitle>
                  <CardDescription>Recommendations for optimizing your keyword clusters</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* This would be populated based on actual analysis of your clusters */}
                    <div className="flex gap-3 items-start pb-3 border-b">
                      <TrendingUp className="h-5 w-5 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Expand "Federal Reserve" cluster</h4>
                        <p className="text-sm text-muted-foreground">
                          This cluster is associated with high-performing content but has fewer keywords than average.
                          Consider adding more related keywords.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start pb-3 border-b">
                      <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Review overlapping keywords</h4>
                        <p className="text-sm text-muted-foreground">
                          5 keywords appear in multiple clusters which may cause inconsistent categorization.
                          Consider refining these keywords to be more specific to each cluster.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3 items-start">
                      <Sparkles className="h-5 w-5 text-blue-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Opportunity for new cluster</h4>
                        <p className="text-sm text-muted-foreground">
                          Recent content analysis shows emerging topics around "Mortgage Technology Innovations"
                          that don't fit well in existing clusters.
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ClusterMaintenanceTab;
