
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
  const [type, setType] = useState("article");
  const [description, setDescription] = useState("");
  const [fullContent, setFullContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeTab, setActiveTab] = useState("manual");

  // Pre-populate form when initialDocument is provided
  useEffect(() => {
    if (initialDocument) {
      setTitle(initialDocument.title);
      setDescription(initialDocument.content.substring(0, 200) + (initialDocument.content.length > 200 ? '...' : ''));
      setFullContent(initialDocument.content);
      setActiveTab("manual"); // Switch to manual tab to review/edit
    }
  }, [initialDocument]);

  const handleDocumentProcessed = (document: ProcessedDocument) => {
    setTitle(document.title);
    setDescription(document.content.substring(0, 200) + (document.content.length > 200 ? '...' : ''));
    setFullContent(document.content);
    setActiveTab("manual"); // Switch to manual tab to review/edit
  };

  const resetForm = () => {
    setTitle("");
    setType("article");
    setDescription("");
    setFullContent("");
    setActiveTab("manual");
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }

    setIsCreating(true);
    try {
      const newDraft = {
        title,
        status: 'draft',
        content_variants: {
          editorial_content: {
            headline: title,
            summary: description,
            full_content: fullContent,
            cta: "Read more..."
          },
          metadata: {
            article_type: type,
            seo_title: title,
            seo_description: description.substring(0, 160),
            tags: []
          },
          status: 'draft'
        },
        matched_clusters: [],
        destinations: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('articles')
        .insert([newDraft])
        .select()
        .single();

      if (error) throw error;

      toast.success("Draft created successfully");
      onDraftCreated(data);
      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error("Error creating draft:", error);
      toast.error("Failed to create draft");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {initialDocument ? 'Review Imported Document' : 'Create New Draft'}
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
                isProcessing={isProcessing}
              />
            </TabsContent>
          )}
          
          <TabsContent value="manual" className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Article Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter article title..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Article Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="article">News Article</SelectItem>
                  <SelectItem value="analysis">Analysis Piece</SelectItem>
                  <SelectItem value="feature">Feature Story</SelectItem>
                  <SelectItem value="opinion">Opinion/Editorial</SelectItem>
                  <SelectItem value="guide">How-to Guide</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Brief Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will this article cover?"
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
                  placeholder="Full article content..."
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
            disabled={isCreating || !title.trim()}
          >
            {isCreating ? "Creating..." : "Create Draft"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
