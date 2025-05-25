
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  PlusCircle, 
  Search, 
  Filter, 
  FileText, 
  Clock, 
  User,
  BookOpen,
  Sparkles,
  Target
} from "lucide-react";
import { toast } from "sonner";
import DraftsList from "@/components/editorial/DraftsList";
import DraftEditor from "@/components/editorial/DraftEditor";
import ResearchPanel from "@/components/editorial/ResearchPanel";
import CreateDraftDialog from "@/components/editorial/CreateDraftDialog";

export default function EditorialWorkspace() {
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState("drafts");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [researchContext, setResearchContext] = useState<any>(null);

  const { data: drafts, isLoading, refetch } = useQuery({
    queryKey: ['editorial-drafts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .in('status', ['draft', 'in_review', 'revision_needed'])
        .order('updated_at', { ascending: false });
      
      if (error) throw error;
      return data;
    }
  });

  const filteredDrafts = drafts?.filter(draft => {
    const contentVariants = draft.content_variants as any;
    return draft.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contentVariants?.editorial_content?.headline?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleDraftSelect = (draft: any) => {
    setSelectedDraft(draft);
    // Load research context for the selected draft
    setResearchContext({
      keywords: draft.matched_clusters || [],
      relatedArticles: [],
      sources: []
    });
  };

  const handleDraftSave = () => {
    refetch();
    toast.success("Draft saved successfully");
  };

  return (
    <DashboardLayout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b bg-background p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold">Editorial Workspace</h1>
              <p className="text-muted-foreground">
                Create, edit, and manage editorial content with AI assistance
              </p>
            </div>
            <Button onClick={() => setShowCreateDialog(true)}>
              <PlusCircle className="h-4 w-4 mr-2" />
              New Draft
            </Button>
          </div>

          <Tabs value={activeView} onValueChange={setActiveView}>
            <TabsList>
              <TabsTrigger value="drafts">
                <FileText className="h-4 w-4 mr-2" />
                My Drafts
              </TabsTrigger>
              <TabsTrigger value="review">
                <Clock className="h-4 w-4 mr-2" />
                In Review
              </TabsTrigger>
              <TabsTrigger value="published">
                <BookOpen className="h-4 w-4 mr-2" />
                Published
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Panel - Drafts List */}
          <div className="w-80 border-r bg-muted/20 flex flex-col">
            <div className="p-4 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search drafts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <DraftsList
                drafts={filteredDrafts || []}
                selectedDraft={selectedDraft}
                onDraftSelect={handleDraftSelect}
                isLoading={isLoading}
                activeView={activeView}
              />
            </div>
          </div>

          {/* Center Panel - Editor */}
          <div className="flex-1 flex flex-col">
            {selectedDraft ? (
              <DraftEditor
                draft={selectedDraft}
                onSave={handleDraftSave}
                researchContext={researchContext}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center bg-muted/10">
                <div className="text-center space-y-4">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground" />
                  <h3 className="text-xl font-semibold">Select a draft to edit</h3>
                  <p className="text-muted-foreground max-w-md">
                    Choose a draft from the sidebar or create a new one to start editing
                  </p>
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Create New Draft
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Right Panel - Research & Context */}
          {selectedDraft && (
            <div className="w-80 border-l bg-muted/20">
              <ResearchPanel
                draft={selectedDraft}
                researchContext={researchContext}
                onContextUpdate={setResearchContext}
              />
            </div>
          )}
        </div>
      </div>

      <CreateDraftDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onDraftCreated={(draft) => {
          setSelectedDraft(draft);
          refetch();
        }}
      />
    </DashboardLayout>
  );
}
