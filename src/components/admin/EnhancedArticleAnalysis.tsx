import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
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
  ArrowDown,
  CheckCircle,
  Clock,
  XCircle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ArticleWithAnalysis {
  id: string;
  title: string;
  published_at: string;
  wordpress_id: number;
  status: string;
  analysis?: {
    id: string;
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
  };
}

type SortColumn = 'title' | 'quality_score' | 'analyzed_at' | 'status' | null;
type SortDirection = 'asc' | 'desc';
type FilterStatus = 'all' | 'analyzed' | 'pending' | 'failed';

export default function EnhancedArticleAnalysis() {
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState<Record<string, 'pending' | 'success' | 'error'>>({});
  const [selectedAnalysis, setSelectedAnalysis] = useState<ArticleWithAnalysis | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn>('analyzed_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');

  // Fetch all articles with their analysis data
  const { data: articles, isLoading, refetch } = useQuery({
    queryKey: ['all-articles-with-analysis', sortColumn, sortDirection, filterStatus],
    queryFn: async () => {
      let query = supabase
        .from('articles')
        .select(`
          id,
          title,
          published_at,
          wordpress_id,
          status,
          article_ai_analysis!left (
            id,
            analysis_version,
            content_quality_score,
            template_classification,
            extracted_keywords,
            matched_clusters,
            performance_prediction,
            analysis_data,
            analyzed_at
          )
        `)
        .not('wordpress_id', 'is', null);

      // Apply status filter
      if (filterStatus === 'analyzed') {
        query = query.not('article_ai_analysis.id', 'is', null);
      } else if (filterStatus === 'pending') {
        query = query.is('article_ai_analysis.id', null);
      }

      // Apply sorting
      if (sortColumn === 'title') {
        query = query.order('title', { ascending: sortDirection === 'asc' });
      } else if (sortColumn === 'analyzed_at') {
        query = query.order('published_at', { ascending: sortDirection === 'asc' });
      }

      const { data, error } = await query;
      if (error) throw error;

      // Transform the data to match our interface with proper type casting
      const transformedData: ArticleWithAnalysis[] = data.map(article => ({
        id: article.id,
        title: article.title,
        published_at: article.published_at,
        wordpress_id: article.wordpress_id,
        status: article.status,
        analysis: article.article_ai_analysis?.[0] ? {
          id: article.article_ai_analysis[0].id,
          analysis_version: article.article_ai_analysis[0].analysis_version,
          content_quality_score: article.article_ai_analysis[0].content_quality_score,
          template_classification: article.article_ai_analysis[0].template_classification,
          extracted_keywords: Array.isArray(article.article_ai_analysis[0].extracted_keywords) 
            ? article.article_ai_analysis[0].extracted_keywords as string[]
            : [],
          matched_clusters: Array.isArray(article.article_ai_analysis[0].matched_clusters)
            ? article.article_ai_analysis[0].matched_clusters as string[]
            : [],
          performance_prediction: article.article_ai_analysis[0].performance_prediction as {
            engagement_score: number;
            shareability: number;
            seo_potential: number;
            target_audience: string;
          } || {
            engagement_score: 0,
            shareability: 0,
            seo_potential: 0,
            target_audience: 'Unknown'
          },
          analysis_data: article.article_ai_analysis[0].analysis_data,
          analyzed_at: article.article_ai_analysis[0].analyzed_at,
        } : undefined
      }));

      // Apply client-side sorting for analysis-specific fields
      if (sortColumn === 'quality_score') {
        transformedData.sort((a, b) => {
          const scoreA = a.analysis?.content_quality_score || 0;
          const scoreB = b.analysis?.content_quality_score || 0;
          return sortDirection === 'asc' ? scoreA - scoreB : scoreB - scoreA;
        });
      }

      return transformedData;
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

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedArticles(new Set(articles?.map(a => a.id) || []));
    } else {
      setSelectedArticles(new Set());
    }
  };

  const handleSelectArticle = (articleId: string, checked: boolean) => {
    const newSelected = new Set(selectedArticles);
    if (checked) {
      newSelected.add(articleId);
    } else {
      newSelected.delete(articleId);
    }
    setSelectedArticles(newSelected);
  };

  const analyzeArticle = async (articleId: string) => {
    try {
      setProcessingStatus(prev => ({ ...prev, [articleId]: 'pending' }));
      
      const { data, error } = await supabase.functions.invoke('analyze-article-content', {
        body: { articleId, forceReanalysis: true }
      });

      if (error) throw error;

      if (data.success) {
        setProcessingStatus(prev => ({ ...prev, [articleId]: 'success' }));
        return true;
      } else {
        throw new Error(data.error || 'Analysis failed');
      }
    } catch (error) {
      console.error(`Analysis failed for article ${articleId}:`, error);
      setProcessingStatus(prev => ({ ...prev, [articleId]: 'error' }));
      return false;
    }
  };

  const handleBulkAnalysis = async (forceReanalysis = false) => {
    const articlesToAnalyze = Array.from(selectedArticles);
    
    if (articlesToAnalyze.length === 0) {
      toast.error("Please select articles to analyze");
      return;
    }

    // Filter out articles that already have analysis (unless forcing re-analysis)
    const filteredArticles = forceReanalysis 
      ? articlesToAnalyze
      : articlesToAnalyze.filter(id => {
          const article = articles?.find(a => a.id === id);
          return !article?.analysis;
        });

    if (filteredArticles.length === 0 && !forceReanalysis) {
      toast.info("Selected articles are already analyzed. Use 'Re-analyze Selected' to force re-analysis.");
      return;
    }

    setIsProcessing(true);
    setProcessingProgress(0);
    
    const actionText = forceReanalysis ? 'Re-analyzing' : 'Analyzing';
    toast.info(`${actionText} ${filteredArticles.length} selected articles...`);

    let successCount = 0;
    
    for (let i = 0; i < filteredArticles.length; i++) {
      const articleId = filteredArticles[i];
      const success = await analyzeArticle(articleId);
      
      if (success) successCount++;
      
      setProcessingProgress(((i + 1) / filteredArticles.length) * 100);
      
      // Add delay between requests to avoid rate limiting
      if (i < filteredArticles.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    setIsProcessing(false);
    setSelectedArticles(new Set());
    
    toast.success(`${actionText} completed: ${successCount}/${filteredArticles.length} articles processed successfully`);
    refetch();
  };

  const getAnalysisStatus = (article: ArticleWithAnalysis) => {
    if (processingStatus[article.id] === 'pending') {
      return <Clock className="h-4 w-4 text-yellow-500" />;
    }
    if (processingStatus[article.id] === 'error') {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (article.analysis) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <Clock className="h-4 w-4 text-gray-400" />;
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

  const analyzedCount = articles?.filter(a => a.analysis).length || 0;
  const totalCount = articles?.length || 0;
  const selectedCount = selectedArticles.size;
  const analysisProgress = totalCount > 0 ? (analyzedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Stats and Controls */}
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
                Analysis Progress: {analyzedCount} analyzed, {totalCount - analyzedCount} pending
              </div>
              <Progress value={analysisProgress} className="w-64" />
            </div>
            
            <div className="flex items-center gap-2">
              {/* Filter Dropdown */}
              <select 
                value={filterStatus} 
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="px-3 py-2 border rounded-md text-sm"
              >
                <option value="all">All Articles</option>
                <option value="analyzed">Analyzed Only</option>
                <option value="pending">Pending Only</option>
              </select>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedCount > 0 && (
            <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium">
                {selectedCount} article{selectedCount !== 1 ? 's' : ''} selected
              </span>
              <div className="flex gap-2">
                <Button 
                  onClick={() => handleBulkAnalysis(false)}
                  disabled={isProcessing}
                  size="sm"
                >
                  {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TrendingUp className="mr-2 h-4 w-4" />}
                  Analyze Selected
                </Button>
                <Button 
                  onClick={() => handleBulkAnalysis(true)}
                  disabled={isProcessing}
                  variant="outline"
                  size="sm"
                >
                  Re-analyze Selected
                </Button>
                <Button 
                  onClick={() => setSelectedArticles(new Set())}
                  variant="ghost"
                  size="sm"
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          )}

          {/* Processing Progress */}
          {isProcessing && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">Processing articles...</div>
              <Progress value={processingProgress} className="w-full" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Articles Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Articles ({totalCount})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox 
                      checked={selectedCount === totalCount && totalCount > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Status</TableHead>
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
                {articles?.map((article) => (
                  <TableRow key={article.id}>
                    <TableCell>
                      <Checkbox 
                        checked={selectedArticles.has(article.id)}
                        onCheckedChange={(checked) => handleSelectArticle(article.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell>
                      {getAnalysisStatus(article)}
                    </TableCell>
                    <TableCell className="max-w-md">
                      <div className="font-medium truncate">{article.title}</div>
                      <div className="text-xs text-muted-foreground">
                        WP ID: {article.wordpress_id}
                      </div>
                    </TableCell>
                    <TableCell>
                      {article.analysis ? (
                        <Badge className={getQualityScoreColor(article.analysis.content_quality_score)}>
                          {article.analysis.content_quality_score}/100
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {article.analysis ? (
                        <span className="text-sm capitalize">
                          {article.analysis.template_classification?.replace('_', ' ') || 'Unknown'}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {article.analysis ? (
                        <Badge variant="outline">
                          {article.analysis.extracted_keywords?.length || 0} keywords
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {article.analysis ? (
                        <Badge variant="outline">
                          {article.analysis.matched_clusters?.length || 0} clusters
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {article.analysis ? (
                        <div className="text-sm">
                          {formatDistanceToNow(new Date(article.analysis.analyzed_at), { addSuffix: true })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {article.analysis && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => setSelectedAnalysis(article)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => analyzeArticle(article.id)}
                          disabled={processingStatus[article.id] === 'pending'}
                        >
                          {processingStatus[article.id] === 'pending' ? (
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
                    <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">
                      No articles found
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
            <DialogTitle>Analysis Details: {selectedAnalysis?.title}</DialogTitle>
          </DialogHeader>
          {selectedAnalysis?.analysis && (
            <div className="space-y-6">
              {/* Performance Prediction */}
              <div>
                <h3 className="font-semibold mb-3">Performance Prediction</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="text-sm text-muted-foreground">Engagement Score</div>
                    <div className="text-2xl font-bold text-blue-600">
                      {selectedAnalysis.analysis.performance_prediction?.engagement_score || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="text-sm text-muted-foreground">Shareability</div>
                    <div className="text-2xl font-bold text-green-600">
                      {selectedAnalysis.analysis.performance_prediction?.shareability || 'N/A'}
                    </div>
                  </div>
                  <div className="bg-purple-50 p-3 rounded-lg">
                    <div className="text-sm text-muted-foreground">SEO Potential</div>
                    <div className="text-2xl font-bold text-purple-600">
                      {selectedAnalysis.analysis.performance_prediction?.seo_potential || 'N/A'}
                    </div>
                  </div>
                </div>
                {selectedAnalysis.analysis.performance_prediction?.target_audience && (
                  <div className="mt-3">
                    <span className="text-sm font-medium">Target Audience: </span>
                    <Badge variant="outline">{selectedAnalysis.analysis.performance_prediction.target_audience}</Badge>
                  </div>
                )}
              </div>

              {/* Keywords and Clusters */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold mb-3">Extracted Keywords</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedAnalysis.analysis.extracted_keywords?.map((keyword, index) => (
                      <Badge key={index} variant="secondary">{keyword}</Badge>
                    )) || <span className="text-muted-foreground">No keywords extracted</span>}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3">Matched Clusters</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedAnalysis.analysis.matched_clusters?.map((cluster, index) => (
                      <Badge key={index} variant="outline">{cluster}</Badge>
                    )) || <span className="text-muted-foreground">No clusters matched</span>}
                  </div>
                </div>
              </div>

              {/* Readability Analysis */}
              {selectedAnalysis.analysis.analysis_data?.readability_analysis && (
                <div>
                  <h3 className="font-semibold mb-3">Readability Analysis</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Reading Level: </span>
                      <Badge variant="outline">
                        {selectedAnalysis.analysis.analysis_data.readability_analysis.reading_level}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Complexity: </span>
                      <Badge variant="outline">
                        {selectedAnalysis.analysis.analysis_data.readability_analysis.sentence_complexity}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Jargon Level: </span>
                      <Badge variant="outline">
                        {selectedAnalysis.analysis.analysis_data.readability_analysis.jargon_level}
                      </Badge>
                    </div>
                  </div>
                </div>
              )}

              {/* Content Suggestions */}
              {selectedAnalysis.analysis.analysis_data?.content_suggestions && (
                <div>
                  <h3 className="font-semibold mb-3">Content Suggestions</h3>
                  <ul className="list-disc list-inside space-y-1">
                    {selectedAnalysis.analysis.analysis_data.content_suggestions.map((suggestion: string, index: number) => (
                      <li key={index} className="text-sm">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Analysis Metadata */}
              <div className="border-t pt-4">
                <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                  <div>Analysis Version: {selectedAnalysis.analysis.analysis_version}</div>
                  <div>Quality Score: {selectedAnalysis.analysis.content_quality_score}/100</div>
                  <div>Template: {selectedAnalysis.analysis.template_classification}</div>
                  <div>Analyzed: {new Date(selectedAnalysis.analysis.analyzed_at).toLocaleString()}</div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
