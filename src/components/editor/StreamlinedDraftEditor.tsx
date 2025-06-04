import { useState, useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetFooter 
} from "@/components/ui/sheet";
import { Save, Eye } from "lucide-react";
import { NewsItem } from "@/types/news";
import { SourceContentCard } from "./SourceContentCard";
import { InlineAISuggestions } from "./InlineAISuggestions";
import { EnhancedEmailPreview } from "./EnhancedEmailPreview";

interface StreamlinedDraftEditorProps {
  newsItem: NewsItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export default function StreamlinedDraftEditor({ 
  newsItem, 
  open, 
  onOpenChange, 
  onSave 
}: StreamlinedDraftEditorProps) {
  // Editorial content state
  const [headline, setHeadline] = useState(
    newsItem.content_variants?.editorial_content?.headline || newsItem.original_title
  );
  const [summary, setSummary] = useState(
    newsItem.content_variants?.editorial_content?.summary || newsItem.summary
  );
  const [cta, setCta] = useState(
    newsItem.content_variants?.editorial_content?.cta || "Read the full story..."
  );
  const [fullContent, setFullContent] = useState(
    newsItem.content_variants?.editorial_content?.full_content || ""
  );

  // AI suggestions state
  const [headlineSuggestions, setHeadlineSuggestions] = useState<string[]>([]);
  const [ctaSuggestions, setCtaSuggestions] = useState<string[]>([]);
  const [summarySuggestions, setSummarySuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("content");

  // Auto-save functionality
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (headline.trim() && summary.trim()) {
        handleAutoSave();
      }
    }, 30000); // Auto-save every 30 seconds

    return () => clearInterval(saveInterval);
  }, [headline, summary, cta, fullContent]);

  const generateAISuggestions = async (type: "headline" | "cta" | "summary") => {
    setIsGenerating(true);
    try {
      let prompt = "";
      const sourceContent = newsItem.content_variants?.source_content || {
        original_title: newsItem.original_title,
        original_summary: newsItem.summary
      };
      
      if (type === "headline") {
        prompt = `Create 3 compelling email newsletter headlines for mortgage professionals:
Title: "${sourceContent.original_title}"
Summary: "${sourceContent.original_summary}"

Requirements:
- 8-12 words maximum
- Create curiosity and urgency
- Professional but engaging tone
- Include benefit or impact

Return only the 3 headlines, numbered.`;
      } else if (type === "cta") {
        prompt = `Create 3 compelling call-to-action teasers:
Headline: "${headline}"
Summary: "${summary}"

Requirements:
- 1-2 sentences each
- Create curiosity without revealing everything
- Action-oriented language
- Appeal to mortgage professionals

Return only the 3 CTAs, numbered.`;
      } else if (type === "summary") {
        prompt = `Create 3 editorial summaries:
Original: "${sourceContent.original_summary}"
Headline: "${headline}"

Requirements:
- 2-3 sentences each
- Professional and informative
- SEO-friendly
- Clear value proposition

Return only the 3 summaries, numbered.`;
      }

      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: prompt,
          model: 'gpt-4o',
          input_data: { type, headline, summary, sourceContent }
        }
      });
      
      if (error) throw error;
      
      const content = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      const suggestions = content.split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 3);

      if (type === "headline") setHeadlineSuggestions(suggestions);
      else if (type === "cta") setCtaSuggestions(suggestions);
      else if (type === "summary") setSummarySuggestions(suggestions);
      
    } catch (err) {
      console.error(`Error generating ${type} suggestions:`, err);
      toast.error(`Failed to generate ${type} suggestions`);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateFullContent = async () => {
    if (!headline.trim() || !summary.trim()) {
      toast.error("Please complete headline and summary first");
      return;
    }

    setIsGenerating(true);
    try {
      const sourceContent = newsItem.content_variants?.source_content || {
        original_title: newsItem.original_title,
        original_summary: newsItem.summary
      };

      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: `Create a comprehensive 400-600 word article for mortgage professionals:

Original source: "${sourceContent.original_title}"
Source summary: "${sourceContent.original_summary}"
Marketing headline: "${headline}"
Editor summary: "${summary}"

Structure as clean HTML with <p> tags. Include actionable insights for mortgage professionals.
Focus on practical implications and industry impact.`,
          model: 'gpt-4o',
          input_data: { headline, summary, sourceContent }
        }
      });
      
      if (error) throw error;
      
      const content = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      setFullContent(content);
      toast.success("Article content generated!");
      
    } catch (err) {
      console.error('Error generating article:', err);
      toast.error("Failed to generate article content");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutoSave = async () => {
    try {
      const contentVariants = {
        source_content: newsItem.content_variants?.source_content || {
          original_title: newsItem.original_title,
          original_summary: newsItem.summary,
          author: newsItem.source,
          publication_date: newsItem.timestamp
        },
        editorial_content: {
          headline,
          summary,
          cta,
          full_content: fullContent
        },
        metadata: {
          seo_title: headline,
          seo_description: summary.substring(0, 160),
          tags: []
        },
        status: fullContent.trim() ? "ready" : "draft"
      };

      await supabase
        .from("news")
        .update({ content_variants: contentVariants })
        .eq("id", newsItem.id);

    } catch (error) {
      console.error("Auto-save failed:", error);
    }
  };

  const handleSave = async () => {
    if (!headline.trim() || !summary.trim()) {
      toast.error("Please complete headline and summary");
      return;
    }

    try {
      setIsSaving(true);

      const contentVariants = {
        source_content: newsItem.content_variants?.source_content || {
          original_title: newsItem.original_title,
          original_summary: newsItem.summary,
          author: newsItem.source,
          publication_date: newsItem.timestamp
        },
        editorial_content: {
          headline,
          summary,
          cta,
          full_content: fullContent
        },
        metadata: {
          seo_title: headline,
          seo_description: summary.substring(0, 160),
          tags: []
        },
        status: fullContent.trim() ? "ready" : "draft"
      };

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto" side="right">
        <SheetHeader>
          <SheetTitle>MPDaily Editor</SheetTitle>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          <SourceContentCard newsItem={newsItem} />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="publish">Publish</TabsTrigger>
            </TabsList>
            
            <TabsContent value="content" className="space-y-6 mt-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="headline">Marketing Headline</Label>
                  <Input
                    id="headline"
                    value={headline}
                    onChange={(e) => setHeadline(e.target.value)}
                    placeholder="Compelling, marketing-optimized headline..."
                    className="text-lg font-medium"
                  />
                  <div className="text-xs text-muted-foreground">
                    {headline.length}/80 characters
                  </div>
                  <InlineAISuggestions
                    type="headline"
                    currentValue={headline}
                    suggestions={headlineSuggestions}
                    onApply={setHeadline}
                    onGenerate={() => generateAISuggestions("headline")}
                    isGenerating={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary">Editorial Summary</Label>
                  <Textarea
                    id="summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    placeholder="Editorial summary for meta description..."
                    rows={3}
                  />
                  <InlineAISuggestions
                    type="summary"
                    currentValue={summary}
                    suggestions={summarySuggestions}
                    onApply={setSummary}
                    onGenerate={() => generateAISuggestions("summary")}
                    isGenerating={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cta">Call-to-Action</Label>
                  <Textarea
                    id="cta"
                    value={cta}
                    onChange={(e) => setCta(e.target.value)}
                    placeholder="Compelling teaser that creates curiosity..."
                    rows={2}
                  />
                  <InlineAISuggestions
                    type="cta"
                    currentValue={cta}
                    suggestions={ctaSuggestions}
                    onApply={setCta}
                    onGenerate={() => generateAISuggestions("cta")}
                    isGenerating={isGenerating}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="full-content">Full Article Content</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={generateFullContent}
                      disabled={isGenerating || !headline.trim() || !summary.trim()}
                    >
                      {isGenerating ? "Generating..." : "Generate Article"}
                    </Button>
                  </div>
                  <Textarea
                    id="full-content"
                    value={fullContent}
                    onChange={(e) => setFullContent(e.target.value)}
                    placeholder="Full article content..."
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="preview" className="space-y-6 mt-6">
              <EnhancedEmailPreview
                headline={headline}
                summary={summary}
                cta={cta}
                fullContent={fullContent}
                source={newsItem.source}
                timestamp={newsItem.timestamp}
              />
            </TabsContent>

            <TabsContent value="publish" className="space-y-6 mt-6">
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-semibold text-green-900 mb-3">Ready to Publish</h3>
                <div className="space-y-2 text-sm text-green-800">
                  <div>✓ Headline: {headline.length > 0 ? `${headline.length} characters` : 'Missing'}</div>
                  <div>✓ Summary: {summary.length > 0 ? `${summary.length} characters` : 'Missing'}</div>
                  <div>✓ Call-to-Action: {cta.length > 0 ? 'Complete' : 'Missing'}</div>
                  <div>✓ Full Content: {fullContent.length > 0 ? `${fullContent.length} characters` : 'Missing'}</div>
                </div>
                <p className="text-sm text-green-700 mt-3">
                  Your article is ready for publication. All required fields are complete.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          <SheetFooter className="flex gap-2">
            <Button 
              variant="outline"
              onClick={() => setActiveTab("preview")}
              disabled={!headline.trim() || !summary.trim()}
            >
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !headline.trim() || !summary.trim()}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
