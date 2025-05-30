
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Loader2, 
  Brain, 
  TrendingUp, 
  FileText, 
  Eye, 
  ArrowUpDown,
  ArrowUp,
  ArrowDown
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface AnalysisData {
  id: string;
  article_id: string;
  analysis_version: number;
  content_quality_score: number;
  template_classification: string;
  extracted_keywords: string[];
  matched_clusters: string[];
  performance_prediction: {
    engagement_score: number;
    shareability: number;
    seo_potential: number;
    target_audience: string;
  };
  analysis_data: any;
  analyzed_at: string;
  articles: {
    id: string;
    title: string;
    published_at: string;
    wordpress_id: number;
  };
}

type SortColumn = 'quality_score' | 'analyzed_at' | 'title' | null;
type SortDirection = 'asc' | 'desc';

export default function EnhancedArticleAnalysis() {
  const [analyzingArticle, setAnalyzingArticle] = useState<string | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisData | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('analyzed_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // Fetch analyzed articles with full details
  const { data: analysisResults, isLoading, refetch } = useQuery({
    queryKey: ['enhanced-analysis-results', sortColumn, sortDirection],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('article_ai_analysis')
        .select(`
          id,
          article_id,
          analysis_version,
          content_quality_score,
          template_classification,
          extracted_keywords,
          matched_clusters,
          performance_prediction,
          analysis_data,
          analyzed_at,
          articles!inner (
            id,
            title,
            published_at,
            wordpress_id
          )
        `)
        .not('articles.wordpress_id', 'is', null)
        .order('analyzed_at', { ascending: sortDirection === 'asc' });

      if (error) throw error;
      return data as AnalysisData[];
    }
  });

  // Fetch articles without analysis
  const { data: pendingArticles } = useQuery({
    queryKey: ['pending-analysis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select(`
          id, title, published_at, wordpress_id,
          article_ai_analysis!left (id)
        `)
        .not('wordpress_id', 'is', null)
        .is('article_ai_analysis.id', null)
        .order('published_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    }
  });

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
  };

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
    if (!pendingArticles || pendingArticles.length === 0) {
      toast.info("No articles need analysis");
      return;
    }

    const articlesToProcess = pendingArticles.slice(0, 5);
    toast.info(`Starting batch analysis of ${articlesToProcess.length} articles...`);

    for (const article of articlesToProcess) {
      try {
        await handleAnalyzeArticle(article.id);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`Failed to analyze article ${article.id}:`, error);
      }
    }
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const analyzedCount = analysisResults?.length || 0;
  const pendingCount = pendingArticles?.length || 0;
  const totalCount = analyzedCount + pendingCount;
  const analysisProgress = totalCount > 0 ? (analyzedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Enhanced AI Article Analysis
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                Analysis Progress: {analyzedCount} analyzed, {pendingCount} pending
              </div>
              <Progress value={analysisProgress} className="w-64" />
            </div>
            <Button 
              onClick={handleBatchAnalysis} 
              variant="outline"
              disabled={pendingCount === 0}
            >
              <TrendingUp className="mr-2 h-4 w-4" />
              Batch Analyze (Next {Math.min(pendingCount, 5)})
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Analysis Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50" 
                    onClick={() => handleSort('title')}
                  >
                    <div className="flex items-center gap-1">
                      Article Title
                      {getSortIcon('title')}
                    </div>
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50" 
                    onClick={() => handleSort('quality_score')}
                  >
                    <div className="flex items-center gap-1">
                      Quality Score
                      {getSortIcon('quality_score')}
                    </div>
                  </TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Keywords</TableHead>
                  <TableHead>Clusters</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:bg-gray-50" 
                    onClick={() => handleSort('analyzed_at')}
                  >
                    <div className="flex items-center gap-1">
                      Analyzed
                      {getSortIcon('analyzed_at')}
                    </div>
                  </TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysisResults?.map((analysis) => (
                  <TableRow key={analysis.id}>
                    <TableCell className="max-w-md">
                      <div className="font-medium truncate">{analysis.articles.title}</div>
                      <div className="text-xs text-muted-foreground">
                        WP ID: {analysis.articles.wordpress_id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={getQualityScoreColor(analysis.content_quality_score)}>
                        {analysis.content_quality_score}/100
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm capitalize">
                        {analysis.template_classification?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {analysis.extracted_keywords?.length || 0} keywords
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {analysis.matched_clusters?.length || 0} clusters
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {formatDistanceToNow(new Date(analysis.analyzed_at), { addSuffix: true })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => setSelectedAnalysis(analysis)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleAnalyzeArticle(analysis.article_id)}
                          disabled={analyzingArticle === analysis.article_id}
                        >
                          {analyzingArticle === analysis.article_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )) || (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                      No analysis results found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Detail Modal */}
      <Dialog open={!!selectedAnalysis} onOpenChange={() => setSelectedAnalysis(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Analysis Details: {selectedAnalysis?.articles.title}</DialogTitle>
          </DialogHeader>
          {selectedAnalysis && (
            <div className="space-y-6">
              {/* Performance Prediction */}
              <div>
                <h3 className="font-semibold mb-3">Performance Prediction</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm text-muted-foreground">Engagement Score</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedAnalysis.performance_prediction?.engagement_score || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-sm text-muted-foreground">Shareability</div>
                    <div className="text-2xl font-bold text-green-600">
                      {selectedAnalysis.performance_prediction?.shareability || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="text-sm text-muted-foreground">SEO Potential</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedAnalysis.performance_prediction?.seo_potential || 'N/A'}
                    </div>
                  </div>
                </div>
                {selectedAnalysis.performance_prediction?.target_audience && (
                  <div className="mt-3">
                    <span className="text-sm font-medium">Target Audience: </span>
                    <Badge variant="outline">{selectedAnalysis.performance_prediction.target_audience}</Badge>
                  </div>
                )}
              </div>

              {/* Keywords and Clusters */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Extracted Keywords</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedAnalysis.extracted_keywords?.map((keyword, index) => (
                      <Badge key={index} variant="secondary">{keyword}</Badge>
                    )) || <span className="text-muted-foreground">No keywords extracted</span>}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Matched Clusters</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedAnalysis.matched_clusters?.map((cluster, index) => (
                      <Badge key={index} variant="outline">{cluster}</Badge>
                    )) || <span className="text-muted-foreground">No clusters matched</span>}
                  </div>
                </div>
              </div>

              {/* Readability Analysis */}
              {selectedAnalysis.analysis_data?.readability_analysis && (
                <div>
                  <h3 className="font-semibold mb-3">Readability Analysis</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Reading Level: </span>
                      <Badge variant="outline">
                        {selectedAnalysis.analysis_data.readability_analysis.reading_level}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Complexity: </span>
                      <Badge variant="outline">
                        {selectedAnalysis.analysis_data.readability_analysis.sentence_complexity}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Jargon Level: </span>
                      <Badge variant="outline">
                        {selectedAnalysis.analysis_data.readability_analysis.jargon_level}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Suggestions */}
              {selectedAnalysis.analysis_data?.content_suggestions && (
                <div>
                  <h3 className="font-semibold mb-3">Content Suggestions</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedAnalysis.analysis_data.content_suggestions.map((suggestion: string, index: number) => (
                      <li key={index} className="text-sm">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Analysis Metadata */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>Analysis Version: {selectedAnalysis.analysis_version}</div>
                  <div>Quality Score: {selectedAnalysis.content_quality_score}/100</div>
                  <div>Template: {selectedAnalysis.template_classification}</div>
                  <div>Analyzed: {new Date(selectedAnalysis.analyzed_at).toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
