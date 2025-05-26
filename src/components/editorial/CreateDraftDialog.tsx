
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import DocumentDropZone from "./DocumentDropZone";
import { ProcessedDocument } from "@/utils/documentProcessor";

interface CreateDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftCreated: (draft: any) => void;
  initialDocument?: ProcessedDocument | null;
}

export default function CreateDraftDialog({ 
  open, 
  onOpenChange, 
  onDraftCreated,
  initialDocument 
}: CreateDraftDialogProps) {
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [fullContent, setFullContent] = useState("");
  const [sourceType, setSourceType] = useState("manual");
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");

  // Pre-populate form when initialDocument is provided
  useEffect(() => {
    if (initialDocument) {
      setTitle(initialDocument.title);
      setTheme(initialDocument.title);
      setDescription(initialDocument.content.substring(0, 200) + (initialDocument.content.length > 200 ? '...' : ''));
      setFullContent(initialDocument.content);
      setSourceType("document");
      setActiveTab("manual"); // Switch to manual tab to review/edit
    }
  }, [initialDocument]);

  const handleDocumentProcessed = (document: ProcessedDocument) => {
    setTitle(document.title);
    setTheme(document.title);
    setDescription(document.content.substring(0, 200) + (document.content.length > 200 ? '...' : ''));
    setFullContent(document.content);
    setSourceType("document");
    setActiveTab("manual"); // Switch to manual tab to review/edit
  };

  const resetForm = () => {
    setTitle("");
    setTheme("");
    setDescription("");
    setFullContent("");
    setSourceType("manual");
    setActiveTab("manual");
  };

  const handleCreate = async () => {
    if (!title.trim() && !theme.trim()) {
      toast.error("Please enter a title or theme");
      return;
    }

    setIsCreating(true);
    try {
      const newDraft = {
        title: title || theme,
        theme: theme || title,
        summary: description,
        outline: fullContent,
        source_type: sourceType,
        status: 'draft',
        content_variants: {
          editorial_content: {
            headline: title || theme,
            summary: description,
            full_content: fullContent,
            cta: "Read more..."
          },
          metadata: {
            seo_title: title || theme,
            seo_description: description.substring(0, 160),
            tags: []
          },
          status: 'draft'
        },
        destinations: [],
        sources: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log("Creating editor brief with data:", newDraft);

      const { data, error } = await supabase
        .from('editor_briefs')
        .insert([newDraft])
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        throw error;
      }

      console.log("Editor brief created successfully:", data);
      toast.success("Draft created successfully");
      onDraftCreated(data);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error creating draft:", error);
      toast.error("Failed to create draft: " + (error.message || "Unknown error"));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialDocument ? 'Review Imported Document' : 'Create New Editorial Draft'}
          </DialogTitle>
          <DialogDescription>
            {initialDocument 
              ? 'Review and edit the imported content before creating your draft'
              : 'Start a new editorial piece from scratch or import an existing document'
            }
          </DialogDescription>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {!initialDocument && (
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              <TabsTrigger value="import">Import Document</TabsTrigger>
            </TabsList>
          )}
          
          {!initialDocument && (
            <TabsContent value="import" className="space-y-4">
              <DocumentDropZone 
                onDocumentProcessed={handleDocumentProcessed}
                isProcessing={false}
              />
            </TabsContent>
          )}
          
          <TabsContent value="manual" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter article title..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">Theme/Topic</Label>
              <Input
                id="theme"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                placeholder="Editorial theme or main topic..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Brief Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will this editorial piece cover?"
                rows={3}
              />
            </div>

            {fullContent && (
              <div className="space-y-2">
                <Label htmlFor="content">Full Content</Label>
                <Textarea
                  id="content"
                  value={fullContent}
                  onChange={(e) => setFullContent(e.target.value)}
                  placeholder="Full article content or outline..."
                  rows={8}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Content imported from document. You can edit it above.
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={isCreating || (!title.trim() && !theme.trim())}
          >
            {isCreating ? "Creating..." : "Create Draft"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
