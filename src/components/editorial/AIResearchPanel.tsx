
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Brain, TrendingUp, FileSearch, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { NewsItem } from "@/types/news";

interface AIResearchPanelProps {
  selectedSources: NewsItem[];
  currentDraft: any;
  onContentSuggestion: (content: string) => void;
}

export default function AIResearchPanel({
  selectedSources,
  currentDraft,
  onContentSuggestion
}: AIResearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("search");

  // Fetch related articles based on current context
  const { data: relatedArticles } = useQuery({
    queryKey: ['related-articles', selectedSources.map(s => s.id)],
    queryFn: async () => {
      if (selectedSources.length === 0) return [];
      
      // Get keywords from selected sources
      const keywords = selectedSources.flatMap(s => 
        s.matched_clusters || []
      ).slice(0, 5);

      if (keywords.length === 0) return [];

      const { data, error } = await supabase
        .from('news')
        .select('*')
        .overlaps('matched_clusters', keywords)
        .not('id', 'in', `(${selectedSources.map(s => s.id).join(',')})`)
        .order('perplexity_score', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: selectedSources.length > 0
  });

  // Fetch trending clusters
  const { data: trendingClusters } = useQuery({
    queryKey: ['trending-clusters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('*')
        .order('priority_weight', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    }
  });

  const handleRAGSearch = async () => {
    if (!searchTerm.trim()) {
      toast.warning("Please enter a search term");
      return;
    }

    setIsSearching(true);
    
    try {
      // Perform RAG search using the search function
      const { data, error } = await supabase.functions.invoke('search-content-chunks', {
        body: {
          query: searchTerm,
          max_results: 10,
          similarity_threshold: 0.7
        }
      });

      if (error) throw error;

      setSearchResults(data.results || []);
      toast.success(`Found ${data.results?.length || 0} relevant content pieces`);
    } catch (error) {
      console.error("Error performing RAG search:", error);
      toast.error("Failed to search content");
    } finally {
      setIsSearching(false);
    }
  };

  const handleGenerateIdeas = async () => {
    if (selectedSources.length === 0) {
      toast.warning("Please select sources first");
      return;
    }

    toast.info("Generating content ideas...");
    
    try {
      const sourcesContext = selectedSources.map(s => 
        `${s.original_title}: ${s.summary}`
      ).join('\n\n');

      const prompt = `Based on these articles, suggest 3-5 unique angle ideas for new content:

${sourcesContext}

Provide creative angles that would interest mortgage industry professionals. Focus on:
- Market implications
- Actionable insights  
- Industry trends
- Professional development angles

Format as numbered list with brief explanations.`;

      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: prompt,
          model: 'gpt-4o-mini',
          input_data: { sources: selectedSources }
        }
      });

      if (error) throw error;

      onContentSuggestion(data.output);
      toast.success("Content ideas generated");
    } catch (error) {
      console.error("Error generating ideas:", error);
      toast.error("Failed to generate ideas");
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold mb-3">AI Research Assistant</h3>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">
              <Search className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="related">
              <FileSearch className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="trends">
              <TrendingUp className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <Tabs value={activeTab}>
            <TabsContent value="search" className="space-y-4">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Search knowledge base..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRAGSearch()}
                  />
                  <Button 
                    size="sm" 
                    onClick={handleRAGSearch}
                    disabled={isSearching}
                  >
                    <Search className="h-4 w-4" />
                  </Button>
                </div>

                {selectedSources.length > 0 && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleGenerateIdeas}
                    className="w-full"
                  >
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Generate Ideas
                  </Button>
                )}
              </div>

              <div className="space-y-3">
                {searchResults.map((result, index) => (
                  <Card key={index} className="text-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{result.article_title}</CardTitle>
                      <CardDescription className="text-xs">
                        Similarity: {(result.similarity * 100).toFixed(1)}%
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-3">
                        {result.content}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="related" className="space-y-3">
              {relatedArticles?.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Select sources to see related articles
                </p>
              ) : (
                relatedArticles?.map((article) => (
                  <Card key={article.id} className="text-sm">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm line-clamp-2">
                        {article.original_title}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {article.source} • Score: {article.perplexity_score?.toFixed(1)}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {article.summary}
                      </p>
                      {article.matched_clusters && (
                        <div className="flex flex-wrap gap-1">
                          {article.matched_clusters.slice(0, 2).map((cluster: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {cluster}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="trends" className="space-y-3">
              {trendingClusters?.map((cluster) => (
                <Card key={cluster.id} className="text-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {cluster.primary_theme}: {cluster.sub_theme}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Weight: {cluster.priority_weight}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {cluster.description}
                    </p>
                    {cluster.keywords && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {cluster.keywords.slice(0, 3).map((keyword: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
