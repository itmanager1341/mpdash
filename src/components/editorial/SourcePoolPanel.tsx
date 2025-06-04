
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  CheckSquare, 
  Square, 
  FileText,
  Calendar,
  Star
} from "lucide-react";
import { NewsItem } from "@/types/news";

interface SourcePoolPanelProps {
  newsItems: NewsItem[];
  selectedSources: NewsItem[];
  onSourceSelect: (newsItem: NewsItem) => void;
  isLoading: boolean;
  drafts: any[];
  onDraftSelect: (draft: any) => void;
  selectedDraft: any;
}

export default function SourcePoolPanel({
  newsItems,
  selectedSources,
  onSourceSelect,
  isLoading,
  drafts,
  onDraftSelect,
  selectedDraft
}: SourcePoolPanelProps) {
  const [activeTab, setActiveTab] = useState("sources");

  const isSelected = (newsItem: NewsItem) => {
    return selectedSources.some(s => s.id === newsItem.id);
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="text-sm text-muted-foreground">Loading sources...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <h3 className="font-semibold mb-3">Source Pool</h3>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="drafts">Drafts</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4">
          <Tabs value={activeTab}>
            <TabsContent value="sources" className="space-y-3">
              {newsItems.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No articles found
                </p>
              ) : (
                newsItems.map((newsItem) => (
                  <Card 
                    key={newsItem.id} 
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      isSelected(newsItem) ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={() => onSourceSelect(newsItem)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium line-clamp-2 mb-1">
                            {newsItem.original_title}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {newsItem.summary}
                          </p>
                        </div>
                        <div className="ml-2 flex-shrink-0">
                          {isSelected(newsItem) ? (
                            <CheckSquare className="h-4 w-4 text-primary" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span>{new Date(newsItem.timestamp).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs">
                            {newsItem.source}
                          </Badge>
                          {newsItem.perplexity_score && (
                            <Badge variant="secondary" className="text-xs">
                              {newsItem.perplexity_score.toFixed(1)}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="drafts" className="space-y-3">
              {drafts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No drafts found
                </p>
              ) : (
                drafts.map((draft) => (
                  <Card 
                    key={draft.id} 
                    className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedDraft?.id === draft.id ? 'ring-2 ring-primary bg-primary/5' : ''
                    }`}
                    onClick={() => onDraftSelect(draft)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium line-clamp-2 mb-1">
                            {draft.title || draft.theme}
                          </h4>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {draft.summary}
                          </p>
                        </div>
                        <FileText className="h-4 w-4 text-muted-foreground ml-2 flex-shrink-0" />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(draft.updated_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="outline" className="text-xs capitalize">
                            {draft.status?.replace('_', ' ')}
                          </Badge>
                          {draft.source_type && (
                            <Badge variant="secondary" className="text-xs">
                              {draft.source_type}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </ScrollArea>
    </div>
  );
}
