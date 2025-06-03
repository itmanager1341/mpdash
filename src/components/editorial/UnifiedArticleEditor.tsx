
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Save, Sparkles, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { NewsItem } from "@/types/news";

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
  const [title, setTitle] = useState("");
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch default model settings
  const { data: modelSettings } = useQuery({
    queryKey: ['model-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('llm_prompts')
        .select('*')
        .eq('function_name', 'default_content_generation')
        .single();
      
      if (error) {
        // Return default if no settings found
        return { model: 'gpt-4o-mini' };
      }
      return { model: data.model };
    }
  });

  // Update form when draft changes
  useEffect(() => {
    if (draft) {
      const editorialContent = draft.content_variants?.editorial_content || {};
      setTitle(draft.title || "");
      setHeadline(editorialContent.headline || "");
      setSummary(editorialContent.summary || "");
      setContent(editorialContent.full_content || "");
    } else {
      setTitle("");
      setHeadline("");
      setSummary("");
      setContent("");
    }
  }, [draft]);

  const handleGenerateOutline = async () => {
    if (selectedSources.length === 0 && !draft) {
      toast.warning("Please select sources or create a draft first");
      return;
    }

    setIsGenerating(true);
    
    try {
      const sourcesText = selectedSources.map(s => 
        `Title: ${s.headline}\nSummary: ${s.summary}\nSource: ${s.source}`
      ).join('\n\n');

      const prompt = `Based on the following source articles, create a comprehensive article outline and draft:

${sourcesText}

Please provide:
1. A compelling headline (8-12 words)
2. A concise summary (2-3 sentences)
3. A detailed article structure with key points
4. Initial content draft (400-600 words)

Focus on insights relevant to mortgage industry professionals.`;

      const model = modelSettings?.model || 'gpt-4o-mini';
      
      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: prompt,
          model: model,
          input_data: { sources: selectedSources }
        }
      });

      if (error) throw error;

      // Parse the AI response and populate fields
      const aiContent = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      const lines = aiContent.split('\n').filter(line => line.trim());
      
      // Extract headline, summary, and content from AI response
      let generatedHeadline = "";
      let generatedSummary = "";
      let generatedContent = aiContent;

      // Simple parsing - look for patterns
      const headlineMatch = aiContent.match(/(?:headline|title):\s*(.+)/i);
      if (headlineMatch) {
        generatedHeadline = headlineMatch[1].trim();
      }

      const summaryMatch = aiContent.match(/(?:summary):\s*(.+)/i);
      if (summaryMatch) {
        generatedSummary = summaryMatch[1].trim();
      }

      setHeadline(generatedHeadline || `AI Analysis: ${selectedSources[0]?.headline || 'Multi-Source Article'}`);
      setSummary(generatedSummary || "AI-generated article based on selected sources");
      setContent(generatedContent);
      
      toast.success("Article outline generated successfully");
    } catch (error) {
      console.error("Error generating outline:", error);
      toast.error("Failed to generate outline");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!draft && !title) {
      toast.warning("Please enter a title");
      return;
    }

    setIsSaving(true);

    try {
      const draftData = {
        title: title || "Untitled Article",
        status: 'draft',
        theme: selectedSources.length > 0 ? 'multi-source' : 'original',
        content_variants: {
          ...draft?.content_variants,
          editorial_content: {
            headline,
            summary,
            full_content: content,
            cta: "Learn more about this development..."
          },
          metadata: {
            ...draft?.content_variants?.metadata,
            source_count: selectedSources.length,
            last_edited: new Date().toISOString(),
            editor_notes: "Edited in unified dashboard"
          }
        }
      };

      if (draft?.id) {
        // Update existing draft
        const { error } = await supabase
          .from('editor_briefs')
          .update(draftData)
          .eq('id', draft.id);

        if (error) throw error;
      } else {
        // Create new draft
        const { error } = await supabase
          .from('editor_briefs')
          .insert(draftData);

        if (error) throw error;
      }

      onSave();
    } catch (error) {
      console.error("Error saving draft:", error);
      toast.error("Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  };

  if (!draft && selectedSources.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/10">
        <div className="text-center space-y-6 max-w-md">
          <div className="flex justify-center">
            <FileText className="h-20 w-20 text-muted-foreground" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-semibold">Ready to create</h3>
            <p className="text-muted-foreground">
              Select sources from the left panel and click "Create Article" to begin, or choose an existing draft
            </p>
          </div>
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
                onClick={handleGenerateOutline}
                disabled={isGenerating}
              >
                {isGenerating ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4 mr-2" />
                )}
                Generate Outline
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
    </div>
  );
}
