import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { KeywordSuggestion } from "@/types/database";
import { getSuggestions, saveSuggestions, updateSuggestionStatus } from "@/utils/suggestionUtils";
import { KeywordCluster } from "@/types/database";
import { NotificationBadge } from "@/components/ui/notification-badge";
import NewsFetchPrompts from "./NewsFetchPrompts";

interface ClusterMaintenanceTabProps {
  searchTerm: string;
}

export default function ClusterMaintenanceTab({ searchTerm }: ClusterMaintenanceTabProps) {
  const [suggestions, setSuggestions] = useState<KeywordSuggestion[]>([]);
  const [selectedTab, setSelectedTab] = useState<string>("suggestions");
  const [isGenerating, setIsGenerating] = useState(false);
  const [sourceForSuggestions, setSourceForSuggestions] = useState<string>("news_analysis");

  const { data: clusters, isLoading: clustersLoading } = useQuery({
    queryKey: ["keyword-clusters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("keyword_clusters")
        .select("*")
        .order("primary_theme");

      if (error) throw error;
      return data || [];
    },
  });

  const { data: recentArticles, isLoading: articlesLoading } = useQuery({
    queryKey: ["recent-articles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news")
        .select("headline, summary")
        .order("timestamp", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    // Load suggestions from storage
    const savedSuggestions = getSuggestions();
    if (savedSuggestions && savedSuggestions.length > 0) {
      setSuggestions(savedSuggestions);
    }
  }, []);

  const pendingSuggestions = suggestions.filter(s => s.status === 'pending').length;

  const handleGenerateSuggestions = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    toast.info("Generating keyword suggestions...");

    try {
      // Context to provide to the suggestion algorithm
      const context = {
        existingClusters: clusters?.map(c => ({
          primary_theme: c.primary_theme,
          sub_theme: c.sub_theme,
          keywords: c.keywords
        })),
        recentArticles: recentArticles?.map(a => ({
          headline: a.headline,
          summary: a.summary
        }))
      };

      // Call the Edge Function to generate suggestions
      const { data, error } = await supabase.functions.invoke("suggest-keywords", {
        body: { source: sourceForSuggestions, context }
      });

      if (error) throw error;

      if (data.success && data.suggestions) {
        // Add status to each suggestion
        const newSuggestions = data.suggestions.map((s: any) => ({
          ...s,
          status: 'pending'
        }));

        // Combine with existing pending suggestions
        const existing = suggestions.filter(s => s.status !== 'pending');
        const combined = [...existing, ...newSuggestions];
        
        setSuggestions(combined);
        saveSuggestions(combined);
        
        toast.success(`Generated ${newSuggestions.length} keyword suggestions using ${data.api_used}`);
      } else {
        throw new Error("No suggestions returned");
      }
    } catch (err) {
      console.error("Error generating suggestions:", err);
      toast.error("Failed to generate keyword suggestions");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSuggestionAction = (keyword: string, action: 'approve' | 'dismiss') => {
    const newStatus = action === 'approve' ? 'approved' : 'dismissed';
    const updated = updateSuggestionStatus(keyword, newStatus);
    setSuggestions(updated);
    
    toast.success(
      action === 'approve'
        ? `Added "${keyword}" to suggestions`
        : `Dismissed "${keyword}" suggestion`
    );
  };

  const filteredSuggestions = suggestions.filter(s => 
    s.keyword.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
        <TabsList>
          <TabsTrigger value="suggestions" className="flex items-center gap-2">
            AI Suggestions
            {pendingSuggestions > 0 && (
              <NotificationBadge variant="primary" size="sm">
                {pendingSuggestions}
              </NotificationBadge>
            )}
          </TabsTrigger>
          <TabsTrigger value="search-prompts">Search Prompts</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="space-y-6 mt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">Keyword Suggestions</h3>
              <p className="text-muted-foreground text-sm mb-4">
                Use AI to generate new keyword suggestions based on your existing clusters and content.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <select
                className="bg-background text-foreground border rounded px-3 py-2 text-sm"
                value={sourceForSuggestions}
                onChange={(e) => setSourceForSuggestions(e.target.value)}
              >
                <option value="news_analysis">News Analysis</option>
                <option value="search_trends">Search Trends</option>
                <option value="competitive_analysis">Competitive Analysis</option>
                <option value="content_gaps">Content Gaps</option>
              </select>
              <Button onClick={handleGenerateSuggestions} disabled={isGenerating || clustersLoading}>
                {isGenerating ? "Generating..." : "Generate Suggestions"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSuggestions.length === 0 ? (
              <div className="col-span-full text-center py-4 text-muted-foreground">
                No keyword suggestions found.
              </div>
            ) : (
              filteredSuggestions.map((suggestion) => (
                <div key={suggestion.keyword} className="border rounded-md p-4">
                  <h4 className="font-semibold">{suggestion.keyword}</h4>
                  <p className="text-sm text-muted-foreground">
                    Relevance Score: {suggestion.score.toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Source: {suggestion.source}
                  </p>
                  {suggestion.rationale && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Rationale: {suggestion.rationale}
                    </p>
                  )}
                  {suggestion.related_clusters && suggestion.related_clusters.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs font-medium">Related Clusters:</p>
                      <ul className="list-disc list-inside text-xs text-muted-foreground">
                        {suggestion.related_clusters.map((cluster, index) => (
                          <li key={index}>{cluster}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div className="mt-4 flex justify-end gap-2">
                    {suggestion.status === 'pending' && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSuggestionAction(suggestion.keyword, 'dismiss')}
                        >
                          Dismiss
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSuggestionAction(suggestion.keyword, 'approve')}
                        >
                          Approve
                        </Button>
                      </>
                    )}
                    {suggestion.status === 'approved' && (
                      <span className="text-green-500 text-sm">Approved</span>
                    )}
                    {suggestion.status === 'dismissed' && (
                      <span className="text-red-500 text-sm">Dismissed</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="search-prompts" className="space-y-6 mt-6">
          <NewsFetchPrompts />
        </TabsContent>
      </Tabs>
    </div>
  );
}
