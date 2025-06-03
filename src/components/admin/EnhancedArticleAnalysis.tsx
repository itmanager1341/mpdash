import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { 
  Brain, 
  TrendingUp, 
  Users, 
  Eye, 
  MessageSquare,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Lightbulb,
  Target,
  BarChart3,
  RefreshCw,
  Play,
  Pause,
  ExternalLink,
  FileText
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

interface Article {
  id: string;
  title: string;
  status: string;
  created_at: string;
  word_count?: number;
  source_system?: string;
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
  const [currentAnalysisId, setCurrentAnalysisId] = useState<string>("");
  const [shouldPauseAnalysis, setShouldPauseAnalysis] = useState(false);
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

  // Fetch all articles with their LATEST analysis data
  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ['articles-for-analysis'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, status, created_at, word_count, source_system')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Article[];
    }
  });

  const { data: analysisResults, isLoading: resultsLoading, refetch: refetchResults } = useQuery({
    queryKey: ['analysis-results'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('article_ai_analysis')
        .select(`
          *,
          articles!inner(id, title, status)
        `)
        .order('analyzed_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as (AnalysisResult & { articles: { id: string; title: string; status: string } })[];
    }
  });

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
    onSuccess: (data, articleId) => {
      console.log(`Analysis completed for article ${articleId}:`, data);
      queryClient.invalidateQueries({ queryKey: ['analysis-results'] });
      toast.success(`Analysis completed for article`);
    },
    onError: (error, articleId) => {
      console.error(`Analysis failed for article ${articleId}:`, error);
      toast.error(`Analysis failed: ${error.message}`);
    }
  });

  const handleBulkAnalysis = async () => {
    if (selectedArticles.length === 0) {
      toast.error("Please select at least one article to analyze");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setShouldPauseAnalysis(false);
    
    const total = selectedArticles.length;
    let completed = 0;
    const results: AnalysisResult[] = [];

    for (const articleId of selectedArticles) {
      if (shouldPauseAnalysis) {
        toast.info("Analysis paused by user");
        break;
      }

      try {
        setCurrentAnalysisId(articleId);
        const article = articles?.find(a => a.id === articleId);
        setAnalysisStatus(`Analyzing: ${article?.title || 'Unknown Article'}`);
        
        const result = await analyzeArticleMutation.mutateAsync(articleId);
        if (result) {
          results.push(result.analysis);
        }
        
        completed++;
        setAnalysisProgress((completed / total) * 100);
        
        // Brief delay between analyses to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`Failed to analyze article ${articleId}:`, error);
        // Continue with next article even if one fails
        completed++;
        setAnalysisProgress((completed / total) * 100);
      }
    }

    setIsAnalyzing(false);
    setAnalysisStatus("");
    setCurrentAnalysisId("");
    setSelectedArticles([]);
    
    if (results.length > 0) {
      toast.success(`Successfully analyzed ${results.length} articles`);
      onAnalysisComplete?.(results);
      refetchResults();
    }
  };

  const handleSelectAll = () => {
    if (selectedArticles.length === articles?.length) {
      setSelectedArticles([]);
    } else {
      setSelectedArticles(articles?.map(a => a.id) || []);
    }
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Navigation */}
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
            <BarChart3 className="h-4 w-4 mr-2" />
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

      <Tabs defaultValue="bulk-analysis" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="bulk-analysis">Bulk Analysis</TabsTrigger>
          <TabsTrigger value="results">Analysis Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="bulk-analysis" className="space-y-4">
          {/* Bulk Analysis Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Bulk Article Analysis
              </CardTitle>
              <CardDescription>
                Select articles to analyze with AI for content quality, template compliance, and performance prediction
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isAnalyzing && (
                <div className="mb-6 p-4 border rounded-lg bg-blue-50">
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

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedArticles.length === articles?.length && articles?.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                    <Label>Select All ({articles?.length || 0} articles)</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setSelectedArticles([])}
                      variant="outline"
                      size="sm"
                      disabled={selectedArticles.length === 0}
                    >
                      Clear Selection
                    </Button>
                    <Button
                      onClick={handleBulkAnalysis}
                      disabled={selectedArticles.length === 0 || isAnalyzing}
                      className="min-w-32"
                    >
                      {isAnalyzing ? (
                        <>
                          <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                          Analyzing...
                        </>
                      ) : (
                        <>
                          <Brain className="h-4 w-4 mr-2" />
                          Analyze {selectedArticles.length} Article{selectedArticles.length !== 1 ? 's' : ''}
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {articlesLoading ? (
                  <div className="text-center py-8">
                    <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p>Loading articles...</p>
                  </div>
                ) : (
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Select</TableHead>
                          <TableHead>Article Title</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Word Count</TableHead>
                          <TableHead>Source</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {articles?.map((article) => (
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
                            <TableCell>{article.source_system || 'Unknown'}</TableCell>
                            <TableCell>
                              {new Date(article.created_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => analyzeArticleMutation.mutate(article.id)}
                                disabled={isAnalyzing}
                              >
                                <Brain className="h-4 w-4 mr-1" />
                                Analyze
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {/* Analysis Results Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Analysis Results
                  </CardTitle>
                  <CardDescription>
                    View detailed AI analysis results including quality scores, template compliance, and insights
                  </CardDescription>
                </div>
                <Button onClick={() => refetchResults()} variant="outline" size="sm">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {resultsLoading ? (
                <div className="text-center py-8">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p>Loading analysis results...</p>
                </div>
              ) : analysisResults && analysisResults.length > 0 ? (
                <div className="space-y-6">
                  {analysisResults.map((result) => (
                    <Card key={result.id} className="p-4">
                      <div className="space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-semibold flex items-center gap-2">
                              <Button
                                variant="link"
                                className="p-0 h-auto text-left font-semibold"
                                onClick={() => navigate(`/articles/${result.article_id}`)}
                              >
                                {result.articles.title}
                                <ExternalLink className="h-3 w-3 ml-1" />
                              </Button>
                            </h3>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>Analyzed {new Date(result.analyzed_at).toLocaleString()}</span>
                              <Badge variant="outline">{result.ai_model_used}</Badge>
                            </div>
                          </div>
                          <Badge 
                            variant={getQualityScoreBadgeVariant(result.content_quality_score)}
                            className="text-lg px-3 py-1"
                          >
                            {result.content_quality_score}/100
                          </Badge>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="text-center p-3 bg-blue-50 rounded-lg">
                            <TrendingUp className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                            <div className="text-sm font-medium text-blue-600">Quality Score</div>
                            <div className={`text-xl font-bold ${getQualityScoreColor(result.content_quality_score)}`}>
                              {result.content_quality_score}
                            </div>
                          </div>

                          {result.analysis_data.template_compliance_score && (
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                              <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto mb-1" />
                              <div className="text-sm font-medium text-green-600">Template Score</div>
                              <div className="text-xl font-bold text-green-900">
                                {result.analysis_data.template_compliance_score}
                              </div>
                            </div>
                          )}

                          {result.performance_prediction.engagement_score && (
                            <div className="text-center p-3 bg-purple-50 rounded-lg">
                              <Users className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                              <div className="text-sm font-medium text-purple-600">Engagement</div>
                              <div className="text-xl font-bold text-purple-900">
                                {result.performance_prediction.engagement_score}
                              </div>
                            </div>
                          )}

                          {result.performance_prediction.seo_potential && (
                            <div className="text-center p-3 bg-orange-50 rounded-lg">
                              <Eye className="h-6 w-6 text-orange-600 mx-auto mb-1" />
                              <div className="text-sm font-medium text-orange-600">SEO Potential</div>
                              <div className="text-xl font-bold text-orange-900">
                                {result.performance_prediction.seo_potential}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Template Classification & Clusters */}
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="capitalize">
                            {result.template_classification.replace('_', ' ')}
                          </Badge>
                          {result.matched_clusters.map((cluster, index) => (
                            <Badge key={index} variant="outline">
                              {cluster}
                            </Badge>
                          ))}
                        </div>

                        {/* Template Insights */}
                        {result.analysis_data.template_insights && (
                          <div className="space-y-3">
                            <h4 className="font-medium flex items-center gap-2">
                              <Target className="h-4 w-4" />
                              Template Analysis
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {result.analysis_data.template_insights.required_elements_present && (
                                <div>
                                  <h5 className="text-sm font-medium text-green-600 mb-2 flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4" />
                                    Present Elements
                                  </h5>
                                  <div className="flex flex-wrap gap-1">
                                    {result.analysis_data.template_insights.required_elements_present.map((element, index) => (
                                      <Badge key={index} variant="outline" className="text-xs text-green-700 border-green-200">
                                        {element}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {result.analysis_data.template_insights.missing_elements && result.analysis_data.template_insights.missing_elements.length > 0 && (
                                <div>
                                  <h5 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                                    <XCircle className="h-4 w-4" />
                                    Missing Elements
                                  </h5>
                                  <div className="flex flex-wrap gap-1">
                                    {result.analysis_data.template_insights.missing_elements.map((element, index) => (
                                      <Badge key={index} variant="outline" className="text-xs text-red-700 border-red-200">
                                        {element}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Suggestions */}
                        {result.analysis_data.content_suggestions && result.analysis_data.content_suggestions.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium flex items-center gap-2">
                              <Lightbulb className="h-4 w-4" />
                              AI Suggestions
                            </h4>
                            <ul className="space-y-1">
                              {result.analysis_data.content_suggestions.map((suggestion, index) => (
                                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 mt-0.5 text-blue-500 flex-shrink-0" />
                                  {suggestion}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Keywords */}
                        {result.extracted_keywords.length > 0 && (
                          <div className="space-y-2">
                            <h4 className="font-medium">Extracted Keywords</h4>
                            <div className="flex flex-wrap gap-1">
                              {result.extracted_keywords.map((keyword, index) => (
                                <Badge key={index} variant="outline" className="text-xs">
                                  {keyword}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Brain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Analysis Results</h3>
                  <p className="text-muted-foreground mb-4">
                    Run bulk analysis on articles to see AI-powered insights here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
