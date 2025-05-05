
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Sheet, 
  SheetClose, 
  SheetContent, 
  SheetDescription, 
  SheetFooter, 
  SheetHeader, 
  SheetTitle 
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Check, FileText, Save } from "lucide-react";

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source?: string; // Make source optional
  content_variants?: {
    title?: string;
    summary?: string;
    cta?: string;
    full_content?: string;
  };
  status: string | null;
  url?: string; // Add url field
}

interface DraftEditorProps {
  newsItem: NewsItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const DraftEditor = ({ newsItem, open, onOpenChange, onSave }: DraftEditorProps) => {
  const [title, setTitle] = useState(newsItem.content_variants?.title || newsItem.headline);
  const [summary, setSummary] = useState(newsItem.content_variants?.summary || newsItem.summary);
  const [cta, setCta] = useState(newsItem.content_variants?.cta || "Read more about this story...");
  const [fullContent, setFullContent] = useState(newsItem.content_variants?.full_content || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveDraft = async () => {
    if (!title.trim() || !summary.trim() || !cta.trim() || !fullContent.trim()) {
      toast.error("Please complete all fields before saving");
      return;
    }

    try {
      setIsSaving(true);

      const contentVariants = {
        title,
        summary,
        cta,
        full_content: fullContent
      };

      // Update the news item with the drafted content and change status
      const { error } = await supabase
        .from("news")
        .update({
          content_variants: contentVariants,
          status: "drafted_mpdaily"
        })
        .eq("id", newsItem.id);

      if (error) throw error;

      toast.success("Draft saved successfully");
      onSave();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  // Function to format the preview HTML
  const getPreviewHtml = () => {
    const sourceText = newsItem.source ? `Source: ${newsItem.source}` : '';
    
    return `
      <div class="max-w-3xl mx-auto">
        <h1 class="text-2xl font-bold mb-4">${title}</h1>
        <div class="text-sm text-gray-600 mb-4">${sourceText}</div>
        <p class="mb-6">${summary}</p>
        <p class="mb-6"><em>${cta}</em></p>
        <div class="prose">
          ${fullContent.split('\n').map(para => `<p>${para}</p>`).join('')}
        </div>
      </div>
    `;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto" side="right">
        <SheetHeader>
          <SheetTitle>Create Draft Article</SheetTitle>
          <SheetDescription>
            Create content for MPDaily email and website
          </SheetDescription>
        </SheetHeader>
        
        <Tabs defaultValue="edit" className="mt-6">
          <TabsList className="mb-4">
            <TabsTrigger value="edit">
              <FileText className="h-4 w-4 mr-2" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Check className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="edit" className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Article title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="A brief summary of the article"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cta">
                Call-to-Action (1-2 lines)
                <span className="text-xs text-muted-foreground ml-2">(Shown in email)</span>
              </Label>
              <Input
                id="cta"
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Read more about this story..."
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="full-content">
                Full Article Content
                <span className="text-xs text-muted-foreground ml-2">(Shown on website)</span>
              </Label>
              <Textarea
                id="full-content"
                value={fullContent}
                onChange={(e) => setFullContent(e.target.value)}
                placeholder="Write the full article content here..."
                rows={10}
                className="font-mono"
              />
            </div>
          </TabsContent>
          
          <TabsContent value="preview">
            <div 
              className="border rounded-md p-6 bg-white"
              dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
            />
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-8">
          <Button onClick={handleSaveDraft} disabled={isSaving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Draft"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default DraftEditor;
