
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { AuthorSelector } from "@/components/editorial/AuthorSelector";
import { toast } from "sonner";

interface ArticleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  article: any;
  onSave: (id: string, updates: any) => void;
}

export function ArticleEditDialog({ open, onOpenChange, article, onSave }: ArticleEditDialogProps) {
  const [formData, setFormData] = useState({
    wordpress_id: article?.wordpress_id || '',
    source_url: article?.source_url || '',
    primary_author_id: article?.primary_author_id || '',
    wordpress_author_name: article?.wordpress_author_name || '',
    status: article?.status || 'draft',
    published_at: article?.published_at ? article.published_at.split('T')[0] : ''
  });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Validate WordPress ID is a number if provided
      if (formData.wordpress_id && isNaN(Number(formData.wordpress_id))) {
        toast.error("WordPress ID must be a number");
        return;
      }

      // Validate URL format if provided
      if (formData.source_url && formData.source_url.trim()) {
        try {
          new URL(formData.source_url);
        } catch {
          toast.error("Please enter a valid URL");
          return;
        }
      }

      const updates = {
        wordpress_id: formData.wordpress_id ? Number(formData.wordpress_id) : null,
        source_url: formData.source_url || null,
        primary_author_id: formData.primary_author_id || null,
        wordpress_author_name: formData.wordpress_author_name || null,
        status: formData.status,
        published_at: formData.published_at ? new Date(formData.published_at).toISOString() : null
      };

      onSave(article.id, updates);
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAuthorChange = (authorId: string | undefined) => {
    setFormData(prev => ({
      ...prev,
      primary_author_id: authorId || ''
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Article</DialogTitle>
          <DialogDescription>
            Update article metadata and WordPress connection details.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="wordpress_id" className="text-right">
              WordPress ID
            </Label>
            <Input
              id="wordpress_id"
              type="number"
              value={formData.wordpress_id}
              onChange={(e) => handleInputChange('wordpress_id', e.target.value)}
              className="col-span-3"
              placeholder="Enter WordPress post ID"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="source_url" className="text-right">
              WordPress URL
            </Label>
            <Input
              id="source_url"
              value={formData.source_url}
              onChange={(e) => handleInputChange('source_url', e.target.value)}
              className="col-span-3"
              placeholder="https://themortgagepoint.com/..."
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">
              Author
            </Label>
            <div className="col-span-3">
              <AuthorSelector
                selectedAuthorId={formData.primary_author_id}
                onAuthorChange={handleAuthorChange}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="wordpress_author_name" className="text-right">
              WP Author Name
            </Label>
            <Input
              id="wordpress_author_name"
              value={formData.wordpress_author_name}
              onChange={(e) => handleInputChange('wordpress_author_name', e.target.value)}
              className="col-span-3"
              placeholder="WordPress author name"
            />
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="status" className="text-right">
              Status
            </Label>
            <Select value={formData.status} onValueChange={(value) => handleInputChange('status', value)}>
              <SelectTrigger className="col-span-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="published">Published</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="published_at" className="text-right">
              Published Date
            </Label>
            <Input
              id="published_at"
              type="date"
              value={formData.published_at}
              onChange={(e) => handleInputChange('published_at', e.target.value)}
              className="col-span-3"
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
