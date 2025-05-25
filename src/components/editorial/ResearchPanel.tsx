
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  ExternalLink, 
  BookOpen, 
  TrendingUp,
  Target,
  Link as LinkIcon,
  Lightbulb
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ResearchPanelProps {
  draft: any;
  researchContext: any;
  onContextUpdate: (context: any) => void;
}

export default function ResearchPanel({ draft, researchContext, onContextUpdate }: ResearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data: relatedArticles } = useQuery({
    queryKey: ['related-articles', draft?.matched_clusters],
    queryFn: async () => {
      if (!draft?.matched_clusters || draft.matched_clusters.length === 0) {
        return [];
      }

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .overlaps('matched_clusters', draft.matched_clusters)
        .neq('id', draft.id)
        .eq('status', 'published')
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    enabled: !!draft?.matched_clusters
  });

  const { data: keywordClusters } = useQuery({
    queryKey: ['keyword-clusters', draft?.matched_clusters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('*')
        .limit(20);

      if (error) throw error;
      return data || [];
    }
  });

  const { data: sources } = useQuery({
    queryKey: ['research-sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .order('priority_tier', { ascending: true })
        .limit(15);

      if (error) throw error;
      return data || [];
    }
  });

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold mb-3">Research & Context</h3>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search research..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="related" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-background">
            <TabsTrigger value="related" className="text-xs">
              <BookOpen className="h-3 w-3 mr-1" />
              Related
            </TabsTrigger>
            <TabsTrigger value="keywords" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              Keywords
            </TabsTrigger>
            <TabsTrigger value="sources" className="text-xs">
              <LinkIcon className="h-3 w-3 mr-1" />
              Sources
            </TabsTrigger>
          </TabsList>

          <TabsContent value="related" className="p-4 space-y-3">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Related Articles</h4>
              {relatedArticles && relatedArticles.length > 0 ? (
                relatedArticles.map((article) => {
                  const contentVariants = article.content_variants as any;
                  return (
                    <Card key={article.id} className="p-3">
                      <h5 className="text-sm font-medium line-clamp-2 mb-1">
                        {contentVariants?.editorial_content?.headline || article.title}
                      </h5>
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                        {contentVariants?.editorial_content?.summary}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {new Date(article.published_at || article.updated_at).toLocaleDateString()}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      </div>
                    </Card>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground">No related articles found</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="keywords" className="p-4 space-y-3">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Keyword Clusters</h4>
              {keywordClusters && keywordClusters.length > 0 ? (
                keywordClusters
                  .filter(cluster => 
                    !searchTerm || 
                    cluster.primary_theme.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    cluster.sub_theme.toLowerCase().includes(searchTerm.toLowerCase())
                  )
                  .map((cluster) => (
                    <Card key={cluster.id} className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <h5 className="text-sm font-medium">{cluster.primary_theme}</h5>
                        <Badge variant="outline" className="text-xs">
                          {cluster.keywords?.length || 0} keywords
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {cluster.sub_theme}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {cluster.keywords?.slice(0, 3).map((keyword: string, index: number) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {keyword}
                          </Badge>
                        ))}
                        {cluster.keywords && cluster.keywords.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{cluster.keywords.length - 3}
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))
              ) : (
                <p className="text-xs text-muted-foreground">No keyword clusters found</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="sources" className="p-4 space-y-3">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Trusted Sources</h4>
              {sources && sources.length > 0 ? (
                sources.map((source) => (
                  <Card key={source.id} className="p-3">
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="text-sm font-medium">{source.source_name}</h5>
                      <Badge variant="outline" className="text-xs">
                        Tier {source.priority_tier}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">
                      {source.source_type}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs p-1"
                      onClick={() => window.open(source.source_url, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Visit
                    </Button>
                  </Card>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No sources available</p>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Context Intelligence */}
      <div className="border-t p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <h4 className="text-sm font-medium">AI Insights</h4>
        </div>
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• Consider adding economic data from FRED</p>
          <p>• Link to 3 related mortgage articles</p>
          <p>• Include industry expert quotes</p>
        </div>
      </div>
    </div>
  );
}
