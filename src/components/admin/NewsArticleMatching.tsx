
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Link2, CheckCircle, AlertCircle } from "lucide-react";

export default function NewsArticleMatching() {
  const [matchingNews, setMatchingNews] = useState<string | null>(null);

  // Fetch published news items for matching
  const { data: newsItems, isLoading, refetch } = useQuery({
    queryKey: ['news-for-matching'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('news')
        .select(`
          id, headline, summary, publication_status, 
          published_article_id, publication_confidence_score,
          timestamp
        `)
        .eq('publication_status', 'published')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    }
  });

  const handleMatchNews = async (newsId: string) => {
    setMatchingNews(newsId);

    try {
      const { data, error } = await supabase.functions.invoke('match-news-to-articles', {
        body: { newsId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(`News matched to article: ${data.match.articleTitle}`);
        refetch();
      } else {
        toast.warning(data.message || 'No suitable match found');
      }
    } catch (error) {
      console.error('News matching error:', error);
      toast.error(`Matching failed: ${error.message}`);
    } finally {
      setMatchingNews(null);
    }
  };

  const handleBatchMatching = async () => {
    const unmatchedNews = newsItems?.filter(item => !item.published_article_id) || [];

    if (unmatchedNews.length === 0) {
      toast.info("No unmatched news items");
      return;
    }

    toast.info(`Starting batch matching of ${unmatchedNews.length} news items...`);

    for (const newsItem of unmatchedNews.slice(0, 10)) { // Limit to 10 at a time
      try {
        await handleMatchNews(newsItem.id);
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`Failed to match news ${newsItem.id}:`, error);
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

  const matchedCount = newsItems?.filter(item => item.published_article_id).length || 0;
  const totalCount = newsItems?.length || 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            News to Article Matching
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Matched: {matchedCount} of {totalCount} published news items
            </div>
            <Button onClick={handleBatchMatching} variant="outline">
              <Link2 className="mr-2 h-4 w-4" />
              Batch Match (Next 10)
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Published News Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {newsItems?.map((newsItem) => {
              const isMatched = !!newsItem.published_article_id;
              
              return (
                <div key={newsItem.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium truncate">{newsItem.headline}</div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(newsItem.timestamp).toLocaleDateString()}
                    </div>
                    {newsItem.summary && (
                      <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {newsItem.summary}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isMatched ? (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-green-50 text-green-700">
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Matched ({Math.round((newsItem.publication_confidence_score || 0) * 100)}%)
                        </Badge>
                      </div>
                    ) : (
                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
                        <AlertCircle className="mr-1 h-3 w-3" />
                        Unmatched
                      </Badge>
                    )}
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleMatchNews(newsItem.id)}
                      disabled={matchingNews === newsItem.id}
                    >
                      {matchingNews === newsItem.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Link2 className="h-4 w-4" />
                      )}
                      {isMatched ? 'Re-match' : 'Match'}
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
