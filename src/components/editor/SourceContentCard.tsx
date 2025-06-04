
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Calendar, User } from "lucide-react";
import { NewsItem } from "@/types/news";

interface SourceContentCardProps {
  newsItem: NewsItem;
}

export function SourceContentCard({ newsItem }: SourceContentCardProps) {
  const sourceContent = newsItem.content_variants?.source_content || {
    original_title: newsItem.original_title,
    original_summary: newsItem.summary,
    author: 'Unknown',
    publication_date: newsItem.timestamp
  };

  const handleSourceClick = () => {
    if (newsItem.url) {
      window.open(newsItem.url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <Card className="border-blue-200 bg-blue-50/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4" />
            Source Article
          </span>
          {newsItem.url && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleSourceClick}
              className="h-7 px-2 text-xs"
            >
              View Original
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h3 className="font-medium text-sm mb-1">{sourceContent.original_title}</h3>
          <p className="text-xs text-muted-foreground line-clamp-3">
            {sourceContent.original_summary}
          </p>
        </div>
        
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{sourceContent.author || newsItem.source}</span>
          </div>
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            <span>{new Date(sourceContent.publication_date || newsItem.timestamp).toLocaleDateString()}</span>
          </div>
        </div>
        
        <div className="flex gap-2">
          <Badge variant="outline" className="text-xs">{newsItem.source}</Badge>
          {newsItem.perplexity_score && (
            <Badge variant="secondary" className="text-xs">
              Score: {newsItem.perplexity_score.toFixed(1)}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
