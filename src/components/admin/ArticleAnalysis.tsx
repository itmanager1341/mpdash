
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Brain, TrendingUp, FileText } from "lucide-react";

export default function ArticleAnalysis() {
  const [analyzingArticle, setAnalyzingArticle] = useState<string | null>(null);

  // Fetch articles without AI analysis
  const { data: articles, isLoading, refetch } = useQuery({
    queryKey: ['articles-for-analysis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select(`
          id, title, status, created_at, wordpress_id,
          article_ai_analysis!left (id, analysis_version, content_quality_score)
        `)
        .eq('status', 'published')
        .not('wordpress_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    }
  });

  const handleAnalyzeArticle = async (articleId: string) => {
    setAnalyzingArticle(articleId);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-article-content', {
        body: { articleId, forceReanalysis: false }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Article analysis completed!");
        refetch();
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error('Article analysis error:', error);
      toast.error(`Analysis failed: ${error.message}`);
    } finally {
      setAnalyzingArticle(null);
    }
  };

  const handleBatchAnalysis = async () => {
    const unanalyzedArticles = articles?.filter(article => 
      !article.article_ai_analysis || article.article_ai_analysis.length === 0
    ) || [];

    if (unanalyzedArticles.length === 0) {
      toast.info("No articles need analysis");
      return;
    }

    toast.info(`Starting batch analysis of ${unanalyzedArticles.length} articles...`);

    for (const article of unanalyzedArticles.slice(0, 5)) { // Limit to 5 at a time
      try {
        await handleAnalyzeArticle(article.id);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to analyze article ${article.id}:`, error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const analyzedCount = articles?.filter(article => 
    article.article_ai_analysis && article.article_ai_analysis.length > 0
  ).length || 0;

  const totalCount = articles?.length || 0;
  const analysisProgress = totalCount > 0 ? (analyzedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Article Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Analysis Progress: {analyzedCount} of {totalCount} articles
              </div>
              <Progress value={analysisProgress} className="w-64" />
            </div>
            <Button onClick={handleBatchAnalysis} variant="outline">
              <TrendingUp className="mr-2 h-4 w-4" />
              Batch Analyze (Next 5)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published Articles</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {articles?.map((article) => {
              const hasAnalysis = article.article_ai_analysis && article.article_ai_analysis.length > 0;
              const latestAnalysis = hasAnalysis ? article.article_ai_analysis[0] : null;
              
              return (
                <div key={article.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium truncate">{article.title}</div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <span>WP ID: {article.wordpress_id}</span>
                      {hasAnalysis && (
                        <>
                          <Badge variant="outline" className="bg-green-50 text-green-700">
                            Quality: {latestAnalysis.content_quality_score}/100
                          </Badge>
                          <Badge variant="outline">
                            v{latestAnalysis.analysis_version}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {hasAnalysis ? (
                      <Badge variant="outline" className="bg-green-50 text-green-700">
                        <Brain className="mr-1 h-3 w-3" />
                        Analyzed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                        Pending
                      </Badge>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAnalyzeArticle(article.id)}
                      disabled={analyzingArticle === article.id}
                    >
                      {analyzingArticle === article.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      {hasAnalysis ? 'Re-analyze' : 'Analyze'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
