
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Brain, 
  TrendingUp, 
  Search, 
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  Play,
  Pause,
  ExternalLink,
  Loader2,
  Filter,
  ChevronDown,
  ChevronRight,
  Settings
} from "lucide-react";
import { ensureAnalysisPromptExists } from "@/utils/analysisPromptUtils";
import { useNavigate } from "react-router-dom";

interface AnalysisResult {
  id: string;
  article_id: string;
  content_quality_score: number;
  template_classification: string;
  extracted_keywords: string[];
  matched_clusters: string[];
  performance_prediction: {
    engagement_score?: number;
    shareability?: number;
    seo_potential?: number;
    target_audience?: string;
  };
  analysis_data: {
    template_compliance_score?: number;
    readability_analysis?: {
      reading_level?: string;
      sentence_complexity?: string;
      jargon_level?: string;
    };
    template_insights?: {
      structure_score?: number;
      required_elements_present?: string[];
      missing_elements?: string[];
      template_specific_suggestions?: string[];
    };
    content_suggestions?: string[];
  };
  analyzed_at: string;
  ai_model_used: string;
}

interface ArticleWithAnalysis {
  id: string;
  title: string;
  status: string;
  created_at: string;
  word_count?: number;
  source_system?: string;
  analysis?: AnalysisResult;
}

interface EnhancedArticleAnalysisProps {
  onAnalysisComplete?: (results: AnalysisResult[]) => void;
}

export default function EnhancedArticleAnalysis({ onAnalysisComplete }: EnhancedArticleAnalysisProps) {
  const navigate = useNavigate();
  const [selectedArticles, setSelectedArticles] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStatus, setAnalysisStatus] = useState<string>("");
  const [shouldPauseAnalysis, setShouldPauseAnalysis] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [analysisFilter, setAnalysisFilter] = useState<string>("all");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50);
  const queryClient = useQueryClient();

  // Initialize analysis prompt on component mount
  useEffect(() => {
    const initializePrompt = async () => {
      const success = await ensureAnalysisPromptExists();
      if (!success) {
        toast.error("Failed to initialize analysis prompt. Please check your database connection.");
      }
    };

    initializePrompt();
  }, []);

  // Fetch articles with their analysis data
  const { data: articlesData, isLoading: articlesLoading, refetch } = useQuery({
    queryKey: ['articles-with-analysis', currentPage, pageSize, searchTerm, statusFilter, analysisFilter],
    queryFn: async () => {
      let query = supabase
        .from('articles')
        .select(`
          id, title, status, created_at, word_count, source_system,
          article_ai_analysis (
            id, content_quality_score, template_classification, 
            extracted_keywords, matched_clusters, performance_prediction,
            analysis_data, analyzed_at, ai_model_used
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (searchTerm) {
        query = query.ilike('title', `%${searchTerm}%`);
      }
      
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      // Apply pagination
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // Transform the data to include analysis info
      const articlesWithAnalysis: ArticleWithAnalysis[] = data.map(article => ({
        ...article,
        analysis: article.article_ai_analysis?.[0] || undefined
      }));

      // Apply analysis filter
      let filteredArticles = articlesWithAnalysis;
      if (analysisFilter === 'analyzed') {
        filteredArticles = articlesWithAnalysis.filter(a => a.analysis);
      } else if (analysisFilter === 'unanalyzed') {
        filteredArticles = articlesWithAnalysis.filter(a => !a.analysis);
      } else if (analysisFilter === 'low-quality') {
        filteredArticles = articlesWithAnalysis.filter(a => a.analysis && a.analysis.content_quality_score < 60);
      }

      return {
        articles: filteredArticles,
        totalCount: count || 0
      };
    }
  });

  const articles = articlesData?.articles || [];
  const totalCount = articlesData?.totalCount || 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // Get unanalyzed articles count
  const unanalyzedCount = articles.filter(a => !a.analysis).length;
  const analyzedCount = articles.filter(a => a.analysis).length;
  const averageQuality = analyzedCount > 0 
    ? Math.round(articles.filter(a => a.analysis).reduce((sum, a) => sum + (a.analysis?.content_quality_score || 0), 0) / analyzedCount)
    : 0;

  // Analyze article mutation
  const analyzeArticleMutation = useMutation({
    mutationFn: async (articleId: string) => {
      const response = await supabase.functions.invoke('analyze-article-content', {
        body: { articleId, forceReanalysis: true }
      });

      if (response.error) {
        throw new Error(response.error.message || 'Analysis failed');
      }

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['articles-with-analysis'] });
      toast.success(`Analysis completed`);
    },
    onError: (error) => {
      console.error('Analysis failed:', error);
      toast.error(`Analysis failed: ${error.message}`);
    }
  });

  const handleBulkAnalysis = async (articleIds?: string[]) => {
    const toAnalyze = articleIds || selectedArticles;
    
    if (toAnalyze.length === 0) {
      toast.error("Please select articles to analyze");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setShouldPauseAnalysis(false);
    
    const total = toAnalyze.length;
    let completed = 0;

    for (const articleId of toAnalyze) {
      if (shouldPauseAnalysis) {
        toast.info("Analysis paused by user");
        break;
      }

      try {
        const article = articles.find(a => a.id === articleId);
        setAnalysisStatus(`Analyzing: ${article?.title || 'Unknown Article'}`);
        
        await analyzeArticleMutation.mutateAsync(articleId);
        
        completed++;
        setAnalysisProgress((completed / total) * 100);
        
        // Brief delay between analyses
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to analyze article ${articleId}:`, error);
        completed++;
        setAnalysisProgress((completed / total) * 100);
      }
    }

    setIsAnalyzing(false);
    setAnalysisStatus("");
    setSelectedArticles([]);
    refetch();
  };

  const handleAnalyzeAllUnanalyzed = () => {
    const unanalyzedIds = articles.filter(a => !a.analysis).map(a => a.id);
    handleBulkAnalysis(unanalyzedIds);
  };

  const handleSelectAll = () => {
    if (selectedArticles.length === articles.length) {
      setSelectedArticles([]);
    } else {
      setSelectedArticles(articles.map(a => a.id));
    }
  };

  const toggleRowExpansion = (articleId: string) => {
    const newExpanded = new Set(expandedRows);
    if (expandedRows.has(articleId)) {
      newExpanded.delete(articleId);
    } else {
      newExpanded.add(articleId);
    }
    setExpandedRows(newExpanded);
  };

  const getQualityScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getQualityScoreBadgeVariant = (score: number) => {
    if (score >= 80) return "default";
    if (score >= 60) return "secondary";
    return "destructive";
  };

  if (articlesLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">AI Article Analysis</h2>
          <p className="text-muted-foreground">
            Analyze articles for quality, template compliance, and performance prediction
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            onClick={() => navigate('/keyword-management?tab=tracking')}
          >
            <Search className="h-4 w-4 mr-2" />
            Keyword Tracking
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
          <Button 
            variant="outline"
            onClick={() => navigate('/llm-management?tab=prompts')}
          >
            <Brain className="h-4 w-4 mr-2" />
            AI Prompts
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-600">Total Articles</p>
                <p className="text-2xl font-bold text-blue-900">{totalCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-600">Analyzed</p>
                <p className="text-2xl font-bold text-green-900">{analyzedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <XCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-600">Unanalyzed</p>
                <p className="text-2xl font-bold text-red-900">{unanalyzedCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Brain className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm font-medium text-purple-600">Avg Quality</p>
                <p className="text-2xl font-bold text-purple-900">{averageQuality}/100</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Analysis Progress */}
      {isAnalyzing && (
        <div className="p-4 border rounded-lg bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">Analysis in Progress</span>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={shouldPauseAnalysis ? "default" : "outline"}
                onClick={() => setShouldPauseAnalysis(!shouldPauseAnalysis)}
              >
                {shouldPauseAnalysis ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                {shouldPauseAnalysis ? "Resume" : "Pause"}
              </Button>
            </div>
          </div>
          <Progress value={analysisProgress} className="mb-2" />
          <p className="text-sm text-muted-foreground">{analysisStatus}</p>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-64"
                />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={analysisFilter} onValueChange={setAnalysisFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Analysis Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Articles</SelectItem>
                  <SelectItem value="analyzed">Analyzed</SelectItem>
                  <SelectItem value="unanalyzed">Unanalyzed</SelectItem>
                  <SelectItem value="low-quality">Low Quality</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button
                onClick={handleAnalyzeAllUnanalyzed}
                disabled={unanalyzedCount === 0 || isAnalyzing}
                variant="secondary"
              >
                <Brain className="h-4 w-4 mr-2" />
                Analyze All Unanalyzed ({unanalyzedCount})
              </Button>
              <Button
                onClick={() => handleBulkAnalysis()}
                disabled={selectedArticles.length === 0 || isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Brain className="h-4 w-4 mr-2" />
                    Analyze Selected ({selectedArticles.length})
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Checkbox
              checked={selectedArticles.length === articles.length && articles.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <Label>Select All ({articles.length} articles)</Label>
            {selectedArticles.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedArticles([])}
              >
                Clear Selection
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Articles Table */}
      <Card>
        <CardContent className="p-0">
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">Select</TableHead>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Article Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Word Count</TableHead>
                  <TableHead>Quality Score</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Analysis Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {articles.map((article) => (
                  <>
                    <TableRow key={article.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedArticles.includes(article.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedArticles([...selectedArticles, article.id]);
                            } else {
                              setSelectedArticles(selectedArticles.filter(id => id !== article.id));
                            }
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {article.analysis && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleRowExpansion(article.id)}
                          >
                            {expandedRows.has(article.id) ? 
                              <ChevronDown className="h-4 w-4" /> : 
                              <ChevronRight className="h-4 w-4" />
                            }
                          </Button>
                        )}
                      </TableCell>
                      <TableCell className="font-medium">
                        <Button
                          variant="link"
                          className="p-0 h-auto text-left"
                          onClick={() => navigate(`/articles/${article.id}`)}
                        >
                          {article.title}
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </Button>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{article.status}</Badge>
                      </TableCell>
                      <TableCell>{article.word_count || 'N/A'}</TableCell>
                      <TableCell>
                        {article.analysis ? (
                          <Badge 
                            variant={getQualityScoreBadgeVariant(article.analysis.content_quality_score)}
                          >
                            {article.analysis.content_quality_score}/100
                          </Badge>
                        ) : (
                          <Badge variant="outline">Not Analyzed</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {article.analysis?.template_classification ? (
                          <Badge variant="secondary" className="capitalize">
                            {article.analysis.template_classification.replace('_', ' ')}
                          </Badge>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {article.analysis ? (
                          <span className="text-sm text-muted-foreground">
                            {new Date(article.analysis.analyzed_at).toLocaleDateString()}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => analyzeArticleMutation.mutate(article.id)}
                          disabled={isAnalyzing}
                        >
                          <Brain className="h-4 w-4 mr-1" />
                          {article.analysis ? 'Re-analyze' : 'Analyze'}
                        </Button>
                      </TableCell>
                    </TableRow>
                    
                    {/* Expanded Row Details */}
                    {expandedRows.has(article.id) && article.analysis && (
                      <TableRow>
                        <TableCell colSpan={9} className="bg-gray-50 p-6">
                          <div className="space-y-4">
                            {/* Performance Metrics */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              {article.analysis.performance_prediction.engagement_score && (
                                <div className="text-center p-3 bg-purple-50 rounded-lg">
                                  <div className="text-sm font-medium text-purple-600">Engagement</div>
                                  <div className="text-xl font-bold text-purple-900">
                                    {article.analysis.performance_prediction.engagement_score}
                                  </div>
                                </div>
                              )}
                              
                              {article.analysis.analysis_data.template_compliance_score && (
                                <div className="text-center p-3 bg-green-50 rounded-lg">
                                  <div className="text-sm font-medium text-green-600">Template Score</div>
                                  <div className="text-xl font-bold text-green-900">
                                    {article.analysis.analysis_data.template_compliance_score}
                                  </div>
                                </div>
                              )}
                              
                              {article.analysis.performance_prediction.seo_potential && (
                                <div className="text-center p-3 bg-orange-50 rounded-lg">
                                  <div className="text-sm font-medium text-orange-600">SEO Potential</div>
                                  <div className="text-xl font-bold text-orange-900">
                                    {article.analysis.performance_prediction.seo_potential}
                                  </div>
                                </div>
                              )}
                              
                              {article.analysis.performance_prediction.shareability && (
                                <div className="text-center p-3 bg-blue-50 rounded-lg">
                                  <div className="text-sm font-medium text-blue-600">Shareability</div>
                                  <div className="text-xl font-bold text-blue-900">
                                    {article.analysis.performance_prediction.shareability}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Clusters and Keywords */}
                            <div className="flex flex-wrap gap-2">
                              {article.analysis.matched_clusters.map((cluster, index) => (
                                <Badge key={index} variant="outline">
                                  {cluster}
                                </Badge>
                              ))}
                            </div>

                            {/* AI Suggestions */}
                            {article.analysis.analysis_data.content_suggestions && 
                             article.analysis.analysis_data.content_suggestions.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="font-medium flex items-center gap-2">
                                  <AlertCircle className="h-4 w-4" />
                                  AI Suggestions
                                </h4>
                                <ul className="space-y-1">
                                  {article.analysis.analysis_data.content_suggestions.map((suggestion, index) => (
                                    <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                      <AlertCircle className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                                      {suggestion}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t">
              <div className="text-sm text-muted-foreground">
                Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalCount)} of {totalCount} articles
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="flex items-center px-3 text-sm">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
