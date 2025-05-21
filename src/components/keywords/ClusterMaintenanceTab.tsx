
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Sparkles, AlertCircle, TrendingUp, ChevronRight, Loader2, Check, X, Info } from "lucide-react";

interface KeywordCluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  keywords?: string[];
}

interface KeywordSuggestion {
  id?: string;
  keyword: string;
  score: number;
  related_clusters: string[];
  source: string;
  rationale?: string;
  status?: 'pending' | 'approved' | 'dismissed';
}

interface SuggestionApprovalData {
  suggestion: KeywordSuggestion;
  clusterId: string;
  clusterName: string;
}

interface ClusterMaintenanceTabProps {
  searchTerm: string;
}

const ClusterMaintenanceTab = ({ searchTerm }: ClusterMaintenanceTabProps) => {
  const [view, setView] = useState<"suggestions" | "maintenance">("suggestions");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [showRationale, setShowRationale] = useState<Record<string, boolean>>({});
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<SuggestionApprovalData | null>(null);
  
  const queryClient = useQueryClient();

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
  
  // Fetch existing suggestions (this would be stored in a new table)
  const { data: existingSuggestions, isLoading: suggestionsLoading, refetch: refetchSuggestions } = useQuery({
    queryKey: ['keyword-suggestions'],
    queryFn: async () => {
      // We would typically store suggestions in a database table
      // For now, we'll use session storage to persist suggestions during the session
      const savedSuggestions = sessionStorage.getItem('keyword-suggestions');
      return savedSuggestions ? JSON.parse(savedSuggestions) as KeywordSuggestion[] : [];
    },
    initialData: []
  });

  // Effect to update suggestions state when existingSuggestions changes
  useEffect(() => {
    if (existingSuggestions && existingSuggestions.length > 0) {
      setSuggestions(existingSuggestions.filter(s => s.status !== 'dismissed'));
    }
  }, [existingSuggestions]);

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
        // Add a unique ID and pending status to each suggestion
        const newSuggestions = data.suggestions.map((suggestion: KeywordSuggestion, index: number) => ({
          ...suggestion,
          id: `suggestion-${Date.now()}-${index}`,
          status: 'pending' as const
        }));
        
        // Save to session storage and update state
        const allSuggestions = [...newSuggestions, ...suggestions];
        sessionStorage.setItem('keyword-suggestions', JSON.stringify(allSuggestions));
        setSuggestions(allSuggestions);
        
        toast.success(`Generated ${data.suggestions.length} keyword suggestions using ${data.api_used} API`);
        
        // Ensure we're on the suggestions view
        setView("suggestions");
      } else {
        toast.warning("No suggestions were generated. Try again.");
      }
    } catch (err) {
      console.error("Error generating suggestions:", err);
      toast.error("Failed to generate keyword suggestions: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsLoading(false);
      refetchSuggestions();
    }
  };

  // Toggle showing rationale for a suggestion
  const toggleRationale = (keywordId: string) => {
    setShowRationale(prev => ({
      ...prev,
      [keywordId]: !prev[keywordId]
    }));
  };
  
  // Handle opening the approval dialog
  const openApprovalDialog = (suggestion: KeywordSuggestion, clusterId: string, clusterName: string) => {
    setSelectedApproval({
      suggestion,
      clusterId,
      clusterName
    });
    setIsApprovalDialogOpen(true);
  };
  
  // Mutation to add keyword to cluster
  const addToClusterMutation = useMutation({
    mutationFn: async ({ keyword, clusterId }: { keyword: string, clusterId: string }) => {
      // First get the current cluster
      const { data: clusterData, error: fetchError } = await supabase
        .from('keyword_clusters')
        .select('keywords')
        .eq('id', clusterId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Add the new keyword if it doesn't already exist
      const currentKeywords = clusterData.keywords || [];
      if (!currentKeywords.includes(keyword)) {
        const updatedKeywords = [...currentKeywords, keyword];
        
        const { error: updateError } = await supabase
          .from('keyword_clusters')
          .update({ keywords: updatedKeywords })
          .eq('id', clusterId);
        
        if (updateError) throw updateError;
      }
      
      // Update the suggestion status
      const updatedSuggestions = suggestions.map(s => 
        s.keyword === keyword ? { ...s, status: 'approved' as const } : s
      );
      sessionStorage.setItem('keyword-suggestions', JSON.stringify(updatedSuggestions));
      
      return { success: true };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['keyword-clusters'] });
      queryClient.invalidateQueries({ queryKey: ['keyword-clusters-summary'] });
      toast.success("Keyword added to cluster successfully");
      refetchSuggestions();
    },
    onError: (error) => {
      toast.error("Failed to add keyword to cluster: " + error.message);
    }
  });
  
  // Handle approval confirmation
  const handleApproveKeyword = () => {
    if (!selectedApproval) return;
    
    const { suggestion, clusterId } = selectedApproval;
    addToClusterMutation.mutate({ 
      keyword: suggestion.keyword, 
      clusterId 
    });
    
    setIsApprovalDialogOpen(false);
    setSelectedApproval(null);
  };
  
  // Handle dismiss suggestion
  const handleDismissSuggestion = (suggestion: KeywordSuggestion) => {
    // Mark the suggestion as dismissed
    const updatedSuggestions = suggestions.map(s => 
      s.keyword === suggestion.keyword ? { ...s, status: 'dismissed' as const } : s
    );
    sessionStorage.setItem('keyword-suggestions', JSON.stringify(updatedSuggestions));
    setSuggestions(updatedSuggestions.filter(s => s.status !== 'dismissed'));
    
    toast.info(`Suggestion "${suggestion.keyword}" dismissed`);
    refetchSuggestions();
  };

  // Get pending suggestion count for UI indicators
  const pendingSuggestionCount = suggestions.filter(s => s.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold">AI-Powered Keyword Management</h2>
          <p className="text-sm text-muted-foreground">
            Get AI suggestions to enhance your keyword clusters and optimize content planning
          </p>
        </div>
        
        <Tabs value={view} onValueChange={(v) => setView(v as "suggestions" | "maintenance")}>
          <TabsList>
            <TabsTrigger value="suggestions" className="relative">
              Keyword Suggestions
              {pendingSuggestionCount > 0 && (
                <Badge className="ml-2 bg-primary text-primary-foreground absolute -top-1 -right-1">
                  {pendingSuggestionCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="maintenance">Cluster Health</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      
      {view === "suggestions" && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-medium">AI-Generated Suggestions</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Review and approve keyword suggestions to enhance your content taxonomy
              </p>
            </div>
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
          
          {suggestionsLoading ? (
            <div className="text-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              <p className="text-muted-foreground mt-2">Loading suggestions...</p>
            </div>
          ) : suggestions.length > 0 ? (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <Card key={suggestion.id || suggestion.keyword} className="overflow-hidden">
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
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {suggestion.related_clusters.map((clusterName, cidx) => {
                            const matchedCluster = clusters?.find(c => 
                              `${c.primary_theme}: ${c.sub_theme}` === clusterName ||
                              c.sub_theme === clusterName
                            );
                            
                            return (
                              <Badge 
                                key={cidx} 
                                variant="secondary"
                                className="cursor-pointer hover:bg-secondary/80 transition-colors"
                                onClick={() => matchedCluster && openApprovalDialog(
                                  suggestion, 
                                  matchedCluster.id, 
                                  clusterName
                                )}
                              >
                                {clusterName}
                              </Badge>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    
                    {suggestion.rationale && (
                      <div className="mt-3">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => suggestion.id && toggleRationale(suggestion.id)}
                          className="p-0 h-auto text-sm text-muted-foreground hover:text-foreground flex items-center"
                        >
                          <Info className="h-3 w-3 mr-1" />
                          {suggestion.id && showRationale[suggestion.id] ? 'Hide rationale' : 'Show rationale'}
                        </Button>
                        
                        {suggestion.id && showRationale[suggestion.id] && (
                          <p className="text-sm mt-2 text-muted-foreground bg-muted/30 p-3 rounded-md">
                            {suggestion.rationale}
                          </p>
                        )}
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="flex justify-end gap-2 pt-2 pb-3">
                    <Button variant="outline" size="sm" onClick={() => handleDismissSuggestion(suggestion)}>
                      <X className="h-3.5 w-3.5 mr-1" />
                      Dismiss
                    </Button>
                    
                    {clusters && suggestion.related_clusters && suggestion.related_clusters.length > 0 && (
                      <Button variant="default" size="sm">
                        <Check className="h-3.5 w-3.5 mr-1" />
                        Add to Cluster
                      </Button>
                    )}
                  </CardFooter>
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
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
              <p className="text-muted-foreground mt-2">Analyzing clusters...</p>
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
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-2"
                          onClick={() => {
                            setView("suggestions");
                            generateSuggestions();
                          }}
                        >
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                          Generate suggestions
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}
      
      {/* Approval Dialog */}
      <AlertDialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Add Keyword to Cluster</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to add <strong>"{selectedApproval?.suggestion.keyword}"</strong> to 
              the <strong>"{selectedApproval?.clusterName}"</strong> cluster?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleApproveKeyword}>
              Add Keyword
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClusterMaintenanceTab;
