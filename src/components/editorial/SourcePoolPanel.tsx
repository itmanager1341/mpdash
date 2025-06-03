
import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckSquare, Square, Clock, FileText } from "lucide-react";
import { NewsItem } from "@/types/news";
import { Button } from "@/components/ui/button";

interface SourcePoolPanelProps {
  newsItems: NewsItem[];
  selectedSources: NewsItem[];
  onSourceSelect: (item: NewsItem) => void;
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

  const isSelected = (item: NewsItem) => selectedSources.some(s => s.id === item.id);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      approved: { variant: "default", label: "Approved" },
      queued_mpdaily: { variant: "blue", label: "MPDaily" },
      queued_magazine: { variant: "purple", label: "Magazine" },
      dismissed: { variant: "outline", label: "Dismissed" }
    };
    
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getDraftStatus = (draft: any) => {
    const status = draft.status;
    const variants: Record<string, { variant: any; label: string }> = {
      draft: { variant: "secondary", label: "Draft" },
      in_review: { variant: "blue", label: "Review" },
      revision_needed: { variant: "orange", label: "Revision" }
    };
    
    const config = variants[status] || variants.draft;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="sources">
              <FileText className="h-4 w-4 mr-2" />
              Sources
            </TabsTrigger>
            <TabsTrigger value="drafts">
              <Clock className="h-4 w-4 mr-2" />
              Drafts
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <Tabs value={activeTab}>
          <TabsContent value="sources" className="p-4 space-y-3">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                Loading sources...
              </div>
            ) : newsItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sources found
              </div>
            ) : (
              newsItems.map((item) => (
                <Card 
                  key={item.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isSelected(item) ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => onSourceSelect(item)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-sm line-clamp-2">
                          {item.headline}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        {isSelected(item) ? (
                          <CheckSquare className="h-4 w-4 text-primary" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {item.summary}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {item.source}
                      </span>
                      {getStatusBadge(item.status)}
                    </div>
                    {item.perplexity_score && (
                      <div className="mt-1">
                        <span className="text-xs text-muted-foreground">
                          Score: {item.perplexity_score.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="drafts" className="p-4 space-y-3">
            {drafts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No drafts found
              </div>
            ) : (
              drafts.map((draft) => (
                <Card 
                  key={draft.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedDraft?.id === draft.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => onDraftSelect(draft)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm line-clamp-2">
                      {draft.title || "Untitled Draft"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        {new Date(draft.updated_at).toLocaleDateString()}
                      </span>
                      {getDraftStatus(draft)}
                    </div>
                    {draft.theme && (
                      <div className="mt-1">
                        <span className="text-xs text-muted-foreground">
                          Theme: {draft.theme}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
}
