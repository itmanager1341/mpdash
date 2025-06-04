import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Save, 
  Eye, 
  Sparkles, 
  FileText, 
  Link, 
  BarChart,
  Clock,
  CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { NewsItem } from "@/types/news";
import DraftPreviewModal from "./DraftPreviewModal";

interface UnifiedArticleEditorProps {
  draft: any;
  selectedSources: NewsItem[];
  onSave: () => void;
  onRefresh: () => void;
}

export default function UnifiedArticleEditor({ 
  draft, 
  selectedSources, 
  onSave, 
  onRefresh 
}: UnifiedArticleEditorProps) {
  const [title, setTitle] = useState(draft?.title || draft?.theme || '');
  const [theme, setTheme] = useState(draft?.theme || '');
  const [headline, setHeadline] = useState(draft?.content_variants?.editorial_content?.headline || '');
  const [summary, setSummary] = useState(draft?.content_variants?.editorial_content?.summary || draft.summary || '');
  const [content, setContent] = useState(draft?.content_variants?.editorial_content?.full_content || draft.outline || '');
  const [tags, setTags] = useState<string[]>(draft?.content_variants?.metadata?.tags || []);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // SEO scoring
  const [seoScore, setSeoScore] = useState(0);

  useEffect(() => {
    // Update state when draft changes
    if (draft) {
      setTitle(draft.title || draft.theme || '');
      setTheme(draft.theme || '');
      setHeadline(draft.content_variants?.editorial_content?.headline || '');
      setSummary(draft.content_variants?.editorial_content?.summary || draft.summary || '');
      setContent(draft.content_variants?.editorial_content?.full_content || draft.outline || '');
      setTags(draft.content_variants?.metadata?.tags || []);
    }
  }, [draft]);

  const generateFromSources = async () => {
    if (selectedSources.length === 0) {
      toast.warning("Please select sources first");
      return;
    }

    setIsGenerating(true);
    toast.info("Generating content from selected sources...");
    
    try {
      const sourcesContext = selectedSources.map(source => 
        `Title: ${source.original_title}\nSummary: ${source.summary}\nSource: ${source.source}`
      ).join('\n\n---\n\n');

      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: `Based on these ${selectedSources.length} source articles, create a comprehensive article for mortgage industry professionals:

${sourcesContext}

Generate:
1. A compelling headline (8-12 words)
2. A 2-3 sentence summary 
3. A 400-600 word article with practical insights

Focus on:
- Market implications for mortgage professionals
- Actionable insights
- Industry trends and analysis
- Professional development angles

Format the response as JSON with: {"headline": "...", "summary": "...", "content": "..."}`,
          model: 'gpt-4o',
          input_data: { 
            sources: selectedSources.map(s => ({ 
              title: s.original_title, 
              summary: s.summary, 
              source: s.source 
            }))
          }
        }
      });
      
      if (error) throw error;
      
      try {
        const result = typeof data.output === 'string' ? JSON.parse(data.output) : data.output;
        setHeadline(result.headline || '');
        setSummary(result.summary || '');
        setContent(result.content || '');
        toast.success("Content generated from sources!");
      } catch (parseError) {
        // Fallback if JSON parsing fails
        const output = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
        setContent(output);
        toast.success("Content generated! Please review and format as needed.");
      }
      
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error("Failed to generate content from sources");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const contentVariants = {
        ...draft.content_variants,
        editorial_content: {
          headline,
          summary,
          full_content: content,
          cta: "Read more..."
        },
        metadata: {
          seo_title: headline || title,
          seo_description: summary,
          tags,
          ...(draft.content_variants?.metadata || {})
        },
        status: content.trim() && headline.trim() ? "ready" : "draft"
      };

      console.log("Saving editor brief with data:", { title, theme, contentVariants });

      const { error } = await supabase
        .from("editor_briefs")
        .update({
          title: title || theme,
          theme,
          summary,
          content_variants: contentVariants,
          updated_at: new Date().toISOString()
        })
        .eq("id", draft.id);

      if (error) {
        console.error("Save error:", error);
        throw error;
      }

      toast.success("Draft saved successfully");
      onSave();
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft: " + (error.message || "Unknown error"));
    } finally {
      setIsSaving(false);
    }
  };

  if (!draft && selectedSources.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
          <p className="text-lg font-medium mb-2">No Article Selected</p>
          <p className="text-sm">Select sources or choose a draft to start editing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="border-b p-4 bg-background">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {draft ? "Editing Draft" : "New Article"}
          </h2>
          <div className="flex items-center gap-2">
            {selectedSources.length > 0 && (
              <Button
                variant="outline"
                onClick={generateFromSources}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Content
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Draft
            </Button>
          </div>
        </div>

        {/* Selected Sources Display */}
        {selectedSources.length > 0 && (
          <div className="mb-4">
            <h4 className="text-sm font-medium mb-2">Source Articles ({selectedSources.length})</h4>
            <div className="flex flex-wrap gap-2">
              {selectedSources.map((source) => (
                <Badge key={source.id} variant="secondary" className="text-xs">
                  {source.source}: {source.headline.slice(0, 30)}...
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-sm font-medium">Article Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter article title..."
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Headline</label>
          <Input
            value={headline}
            onChange={(e) => setHeadline(e.target.value)}
            placeholder="Enter compelling headline..."
            className="mt-1"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Summary</label>
          <Textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="Enter article summary..."
            className="mt-1 min-h-20"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Article Content</label>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Enter article content..."
            className="mt-1 min-h-80"
          />
        </div>
      </div>

      <DraftPreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        title={title}
        headline={headline}
        summary={summary}
        content={content}
      />
    </div>
  );
}
