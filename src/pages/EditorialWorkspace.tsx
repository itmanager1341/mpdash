import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  PlusCircle, 
  Search, 
  FileText, 
  Clock, 
  BookOpen,
  Upload
} from "lucide-react";
import { toast } from "sonner";
import DraftsList from "@/components/editorial/DraftsList";
import DraftEditor from "@/components/editorial/DraftEditor";
import ContentAssistant from "@/components/editorial/ContentAssistant";
import CreateDraftDialog from "@/components/editorial/CreateDraftDialog";
import DragDropProvider from "@/components/editorial/DragDropProvider";
import ViewToggle from "@/components/editorial/ViewToggle";
import StatusColumn from "@/components/editorial/StatusColumn";
import WorkspaceDropZone from "@/components/editorial/WorkspaceDropZone";

export default function EditorialWorkspace() {
  const [selectedDraft, setSelectedDraft] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState("drafts");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [layoutView, setLayoutView] = useState<'list' | 'kanban'>('list');
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch drafts from editor_briefs table
  const { data: drafts, isLoading, refetch } = useQuery({
    queryKey: ['editorial-drafts'],
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

  // Filter drafts based on search term
  const filteredDrafts = drafts?.filter(draft => {
    const contentVariants = draft.content_variants as any;
    return draft.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      draft.theme?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contentVariants?.editorial_content?.headline?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const handleDraftSelect = (draft: any) => {
    console.log("Selected draft:", draft);
    setSelectedDraft(draft);
  };

  const handleDraftSave = () => {
    console.log("Draft saved, refreshing list");
    refetch();
    toast.success("Draft saved successfully");
  };

  const handleKeywordsSuggested = (keywords: string[]) => {
    if (selectedDraft) {
      const updatedContentVariants = {
        ...selectedDraft.content_variants,
        metadata: {
          ...selectedDraft.content_variants?.metadata,
          tags: keywords
        }
      };
      
      // Update the draft with new keywords
      setSelectedDraft({
        ...selectedDraft,
        content_variants: updatedContentVariants
      });
    }
  };

  const handleContentUpdated = async (updates: any) => {
    if (!selectedDraft) return;

    try {
      const currentContentVariants = selectedDraft.content_variants || {};
      const updatedContentVariants = {
        ...currentContentVariants,
        editorial_content: {
          ...currentContentVariants.editorial_content,
          ...updates
        }
      };

      const { error } = await supabase
        .from("editor_briefs")
        .update({
          content_variants: updatedContentVariants,
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedDraft.id);

      if (error) throw error;

      // Update local state
      setSelectedDraft({
        ...selectedDraft,
        content_variants: updatedContentVariants
      });

      refetch();
    } catch (error) {
      console.error("Error updating content:", error);
      toast.error("Failed to update content");
    }
  };

  const getDraftsByStatus = (status: string) => {
    return filteredDrafts?.filter(draft => draft.status === status) || [];
  };

  const handleDraftCreated = (newDraft: any) => {
    console.log("New draft created from file:", newDraft);
    setSelectedDraft(newDraft);
    refetch();
    toast.success("Draft created and ready for editing");
  };

  const handleManualDraftCreated = (newDraft: any) => {
    console.log("New draft created manually:", newDraft);
    setSelectedDraft(newDraft);
    refetch();
    toast.success("Draft created successfully - now editing");
  };

  const handleDraftDeleted = () => {
    console.log("Draft deleted, refreshing list");
    refetch();
    // If the deleted draft was selected, clear the selection
    if (selectedDraft) {
      setSelectedDraft(null);
    }
    toast.success("Draft deleted successfully");
  };

  const renderListView = () => (
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
          onDraftDeleted={handleDraftDeleted}
        />
      </div>
    </div>
  );

  const renderKanbanView = () => (
    <div className="flex-1 p-4 overflow-x-auto">
      <div className="flex gap-4 min-w-max">
        <StatusColumn
          status="draft"
          title="Draft"
          color="bg-gray-100 text-gray-800"
          drafts={getDraftsByStatus('draft')}
          selectedDraft={selectedDraft}
          onDraftSelect={handleDraftSelect}
          onDraftMoved={refetch}
        />
        <StatusColumn
          status="in_review"
          title="In Review"
          color="bg-blue-100 text-blue-800"
          drafts={getDraftsByStatus('in_review')}
          selectedDraft={selectedDraft}
          onDraftSelect={handleDraftSelect}
          onDraftMoved={refetch}
        />
        <StatusColumn
          status="revision_needed"
          title="Needs Revision"
          color="bg-orange-100 text-orange-800"
          drafts={getDraftsByStatus('revision_needed')}
          selectedDraft={selectedDraft}
          onDraftSelect={handleDraftSelect}
          onDraftMoved={refetch}
        />
      </div>
    </div>
  );

  const renderEmptyState = () => (
    <div className="flex-1 flex items-center justify-center bg-muted/10">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="relative">
            <FileText className="h-20 w-20 text-muted-foreground" />
            <Upload className="h-8 w-8 text-primary absolute -top-2 -right-2 bg-background rounded-full p-1" />
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-semibold">Start creating content</h3>
          <p className="text-muted-foreground">
            Choose a draft from the sidebar, create a new one, or drag files here to import
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => setShowCreateDialog(true)}>
            <PlusCircle className="h-4 w-4 mr-2" />
            Create New Draft
          </Button>
        </div>
        <div className="text-xs text-muted-foreground border-t pt-4">
          <p className="font-medium mb-1">💡 Quick tip:</p>
          <p>Drag and drop TXT, Markdown, HTML, Word, or PDF files anywhere on this page to instantly create drafts from them</p>
        </div>
      </div>
    </div>
  );

  return (
    <DragDropProvider>
      <DashboardLayout>
        <WorkspaceDropZone 
          onDraftCreated={handleDraftCreated}
          isProcessing={isProcessing}
        >
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
                <div className="flex items-center gap-3">
                  <ViewToggle view={layoutView} onViewChange={setLayoutView} />
                  <Button onClick={() => setShowCreateDialog(true)}>
                    <PlusCircle className="h-4 w-4 mr-2" />
                    New Draft
                  </Button>
                </div>
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
              {layoutView === 'list' ? (
                <>
                  {renderListView()}
                  
                  {/* Center Panel - Editor */}
                  <div className="flex-1 flex flex-col">
                    {selectedDraft ? (
                      <DraftEditor
                        draft={selectedDraft}
                        onSave={handleDraftSave}
                        researchContext={null}
                      />
                    ) : (
                      renderEmptyState()
                    )}
                  </div>

                  {/* Right Panel - Content Assistant */}
                  {selectedDraft && (
                    <div className="w-80 border-l bg-muted/20">
                      <ContentAssistant
                        draft={selectedDraft}
                        onKeywordsSuggested={handleKeywordsSuggested}
                        onContentUpdated={handleContentUpdated}
                      />
                    </div>
                  )}
                </>
              ) : (
                <>
                  {renderKanbanView()}
                  
                  {/* Right Panel - Editor & Content Assistant */}
                  {selectedDraft && (
                    <div className="w-96 border-l flex flex-col">
                      <div className="flex-1">
                        <DraftEditor
                          draft={selectedDraft}
                          onSave={handleDraftSave}
                          researchContext={null}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          <CreateDraftDialog
            open={showCreateDialog}
            onOpenChange={setShowCreateDialog}
            onDraftCreated={handleManualDraftCreated}
          />
        </WorkspaceDropZone>
      </DashboardLayout>
    </DragDropProvider>
  );
}
