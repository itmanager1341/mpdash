
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Target,
  BarChart3,
  Users,
  Globe
} from "lucide-react";

export default function ContentIntelligence() {
  const [timeRange, setTimeRange] = useState('7d');

  // Fetch recent news for analysis
  const { data: recentNews } = useQuery({
    queryKey: ['recent-news', timeRange],
    queryFn: async () => {
      const daysBack = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 1;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from('news')
        .select('*')
        .gte('timestamp', startDate.toISOString())
        .order('timestamp', { ascending: false });
        
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch sources performance
  const { data: sources } = useQuery({
    queryKey: ['sources-performance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sources')
        .select('*');
        
      if (error) throw error;
      return data || [];
    }
  });

  // Calculate content intelligence metrics
  const contentMetrics = {
    totalArticles: recentNews?.length || 0,
    approvedArticles: recentNews?.filter(n => n.status === 'approved').length || 0,
    dismissedArticles: recentNews?.filter(n => n.status === 'dismissed').length || 0,
    pendingArticles: recentNews?.filter(n => n.status === 'pending').length || 0,
    averageScore: recentNews?.length ? 
      (recentNews.reduce((sum, n) => sum + (n.perplexity_score || 0), 0) / recentNews.length) : 0,
    topSources: sources?.slice(0, 5) || [],
    // Use source_type to identify competitors since relationship_type doesn't exist
    competitorSources: sources?.filter(s => s.source_type === 'competitor').length || 0
  };

  const approvalRate = contentMetrics.totalArticles > 0 ? 
    (contentMetrics.approvedArticles / contentMetrics.totalArticles * 100) : 0;

  // Analyze content themes from recent articles
  const getContentThemes = () => {
    if (!recentNews) return [];
    
    const themes = new Map();
    recentNews.forEach(article => {
      if (article.matched_clusters && Array.isArray(article.matched_clusters)) {
        article.matched_clusters.forEach((cluster: string) => {
          themes.set(cluster, (themes.get(cluster) || 0) + 1);
        });
      }
    });
    
    return Array.from(themes.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 8)
      .map(([theme, count]) => ({ theme, count }));
  };

  const contentThemes = getContentThemes();

  return (
    <div className="space-y-6">
      {/* Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contentMetrics.totalArticles}</div>
            <p className="text-xs text-muted-foreground">
              Last {timeRange === '7d' ? '7 days' : timeRange === '30d' ? '30 days' : 'day'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approval Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{approvalRate.toFixed(1)}%</div>
            <Progress value={approvalRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Relevance</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contentMetrics.averageScore.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Out of 1.0
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sources</CardTitle>
            <Globe className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{contentMetrics.topSources.length}</div>
            <p className="text-xs text-muted-foreground">
              {contentMetrics.competitorSources} competitors excluded
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Content Quality Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Content Themes</CardTitle>
            <CardDescription>
              Most frequently covered topics in recent articles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {contentThemes.map(({ theme, count }) => (
                <div key={theme} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{theme}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{count}</Badge>
                    <div className="w-20 bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full" 
                        style={{ 
                          width: `${(count / (contentThemes[0]?.count || 1)) * 100}%` 
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {contentThemes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No theme data available
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Article Status Breakdown</CardTitle>
            <CardDescription>
              How articles are being processed and approved
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Approved</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{contentMetrics.approvedArticles}</span>
                  <Badge variant="default">{approvalRate.toFixed(1)}%</Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span>Pending Review</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{contentMetrics.pendingArticles}</span>
                  <Badge variant="secondary">
                    {contentMetrics.totalArticles > 0 ? 
                      ((contentMetrics.pendingArticles / contentMetrics.totalArticles) * 100).toFixed(1) : '0'}%
                  </Badge>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-red-500" />
                  <span>Dismissed</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{contentMetrics.dismissedArticles}</span>
                  <Badge variant="destructive">
                    {contentMetrics.totalArticles > 0 ? 
                      ((contentMetrics.dismissedArticles / contentMetrics.totalArticles) * 100).toFixed(1) : '0'}%
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Optimization Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Optimization Recommendations</CardTitle>
          <CardDescription>
            AI-powered suggestions to improve content quality and relevance
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {approvalRate < 50 && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-amber-900">Low Approval Rate</h4>
                  <p className="text-sm text-amber-700">
                    Your approval rate is {approvalRate.toFixed(1)}%. Consider refining your prompts to focus on more specific business-relevant criteria.
                  </p>
                </div>
              </div>
            )}

            {contentMetrics.competitorSources > 0 && (
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-blue-900">Competitor Exclusion Active</h4>
                  <p className="text-sm text-blue-700">
                    {contentMetrics.competitorSources} competitor sources are being excluded from search results.
                  </p>
                </div>
              </div>
            )}

            {contentMetrics.averageScore < 0.6 && (
              <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-red-900">Low Relevance Scores</h4>
                  <p className="text-sm text-red-700">
                    Average relevance score is {contentMetrics.averageScore.toFixed(2)}. Consider updating your keyword clusters and source priorities.
                  </p>
                </div>
              </div>
            )}

            {approvalRate >= 70 && contentMetrics.averageScore >= 0.7 && (
              <div className="flex items-start gap-3 p-3 bg-green-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-green-900">Excellent Performance</h4>
                  <p className="text-sm text-green-700">
                    Your content quality is excellent with {approvalRate.toFixed(1)}% approval rate and {contentMetrics.averageScore.toFixed(2)} average relevance.
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
