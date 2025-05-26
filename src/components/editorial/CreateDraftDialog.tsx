
import { useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CreateDraftDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDraftCreated: (draft: any) => void;
}

export default function CreateDraftDialog({ 
  open, 
  onOpenChange, 
  onDraftCreated
}: CreateDraftDialogProps) {
  const [title, setTitle] = useState("");
  const [theme, setTheme] = useState("");
  const [description, setDescription] = useState("");
  const [fullContent, setFullContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const resetForm = () => {
    setTitle("");
    setTheme("");
    setDescription("");
    setFullContent("");
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
        source_type: 'manual',
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Editorial Draft</DialogTitle>
          <DialogDescription>
            Start a new editorial piece from scratch
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
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

          <div className="space-y-2">
            <Label htmlFor="content">Initial Content (Optional)</Label>
            <Textarea
              id="content"
              value={fullContent}
              onChange={(e) => setFullContent(e.target.value)}
              placeholder="Start writing your content or leave blank to fill in later..."
              rows={6}
            />
          </div>
        </div>

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
