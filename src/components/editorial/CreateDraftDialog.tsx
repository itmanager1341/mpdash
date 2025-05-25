
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [type, setType] = useState("article");
  const [description, setDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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
            full_content: "",
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
      
      // Reset form
      setTitle("");
      setType("article");
      setDescription("");
    } catch (error) {
      console.error("Error creating draft:", error);
      toast.error("Failed to create draft");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Draft</DialogTitle>
          <DialogDescription>
            Start a new editorial piece from scratch
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
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
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create Draft"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
