
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Plus, 
  FileText, 
  Sparkles,
  Filter,
  CheckSquare,
  Square
} from "lucide-react";
import { toast } from "sonner";
import { NewsItem } from "@/types/news";
import SourcePoolPanel from "@/components/editorial/SourcePoolPanel";
import UnifiedArticleEditor from "@/components/editorial/UnifiedArticleEditor";
import AIResearchPanel from "@/components/editorial/AIResearchPanel";

export default function UnifiedEditorial() {
  const [selectedSources, setSelectedSources] = useState<NewsItem[]>([]);
  const [currentDraft, setCurrentDraft] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeSourceTab, setActiveSourceTab] = useState<"approved" | "all">("approved");
  const [showFilters, setShowFilters] = useState(false);

  // Fetch all news items for source pool
  const { data: allNews, isLoading: isLoadingNews, refetch: refetchNews } = useQuery({
    queryKey: ['unified-news', activeSourceTab, searchTerm],
    queryFn: async () => {
      let query = supabase.from('news').select('*');
      
      if (activeSourceTab === "approved") {
        query = query.in('status', ['approved', 'queued_mpdaily', 'queued_magazine']);
      }
      
      if (searchTerm) {
        query = query.or(`headline.ilike.%${searchTerm}%,summary.ilike.%${searchTerm}%,source.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query.order('timestamp', { ascending: false });
      
      if (error) throw error;
      return data as NewsItem[];
    }
  });

  // Fetch current drafts
  const { data: drafts, refetch: refetchDrafts } = useQuery({
    queryKey: ['unified-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('editor_briefs')
        .select('*')
        .in('status', ['draft', 'in_review', 'revision_needed'])
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const handleSourceSelect = (newsItem: NewsItem) => {
    const isSelected = selectedSources.some(s => s.id === newsItem.id);
    
    if (isSelected) {
      setSelectedSources(prev => prev.filter(s => s.id !== newsItem.id));
    } else {
      setSelectedSources(prev => [...prev, newsItem]);
    }
  };

  const handleCreateFromSources = async () => {
    if (selectedSources.length === 0) {
      toast.warning("Please select at least one source article");
      return;
    }

    toast.info("Creating article from selected sources...");
    
    try {
      // Create a new draft with selected sources as context
      const newDraft = {
        title: `Article from ${selectedSources.length} sources`,
        status: 'draft',
        theme: 'multi-source',
        content_variants: {
          source_content: {
            selected_sources: selectedSources.map(s => ({
              id: s.id,
              headline: s.headline,
              summary: s.summary,
              source: s.source,
              url: s.url
            }))
          },
          editorial_content: {
            headline: "",
            summary: "",
            full_content: ""
          },
          metadata: {
            source_count: selectedSources.length,
            created_from: "multi_source_selection"
          }
        }
      };

      const { data, error } = await supabase
        .from('editor_briefs')
        .insert(newDraft)
        .select()
        .single();

      if (error) throw error;

      setCurrentDraft(data);
      setSelectedSources([]);
      refetchDrafts();
      toast.success("New article draft created from sources");
    } catch (error) {
      console.error("Error creating article:", error);
      toast.error("Failed to create article from sources");
    }
  };

  const handleDraftSelect = (draft: any) => {
    setCurrentDraft(draft);
  };

  const handleDraftSave = () => {
    refetchDrafts();
    toast.success("Draft saved successfully");
  };

  const clearSelection = () => {
    setSelectedSources([]);
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b bg-background p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Editorial Dashboard</h1>
              <p className="text-muted-foreground">
                Research, create, and enhance content with AI assistance
              </p>
            </div>
            <div className="flex items-center gap-3">
              {selectedSources.length > 0 && (
                <>
                  <Badge variant="secondary" className="px-3 py-1">
                    {selectedSources.length} sources selected
                  </Badge>
                  <Button onClick={handleCreateFromSources}>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Create Article
                  </Button>
                  <Button variant="outline" onClick={clearSelection}>
                    Clear
                  </Button>
                </>
              )}
              <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
                <Filter className="h-4 w-4 mr-2" />
                Filters
              </Button>
            </div>
          </div>

          {/* Search and filters */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search articles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <Tabs value={activeSourceTab} onValueChange={(v) => setActiveSourceTab(v as "approved" | "all")}>
              <TabsList>
                <TabsTrigger value="approved">Approved Sources</TabsTrigger>
                <TabsTrigger value="all">All Articles</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Main Content - Three Panel Layout */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Source Pool */}
          <div className="w-80 border-r bg-muted/20 flex flex-col">
            <SourcePoolPanel
              newsItems={allNews || []}
              selectedSources={selectedSources}
              onSourceSelect={handleSourceSelect}
              isLoading={isLoadingNews}
              drafts={drafts || []}
              onDraftSelect={handleDraftSelect}
              selectedDraft={currentDraft}
            />
          </div>

          {/* Center Panel - Article Editor */}
          <div className="flex-1 flex flex-col">
            <UnifiedArticleEditor
              draft={currentDraft}
              selectedSources={selectedSources}
              onSave={handleDraftSave}
              onRefresh={refetchNews}
            />
          </div>

          {/* Right Panel - AI Research Assistant */}
          <div className="w-80 border-l bg-muted/20">
            <AIResearchPanel
              selectedSources={selectedSources}
              currentDraft={currentDraft}
              onContentSuggestion={(content) => {
                // Handle AI content suggestions
                console.log("AI suggestion:", content);
              }}
            />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
