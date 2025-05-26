
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Save, 
  Eye, 
  Sparkles, 
  Target, 
  Link, 
  BarChart,
  Clock,
  CheckCircle
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { InlineAISuggestions } from "@/components/editor/InlineAISuggestions";
import DraftPreviewModal from "./DraftPreviewModal";

interface DraftEditorProps {
  draft: any;
  onSave: () => void;
  researchContext: any;
}

export default function DraftEditor({ draft, onSave, researchContext }: DraftEditorProps) {
  const [title, setTitle] = useState(draft?.title || '');
  const [headline, setHeadline] = useState(draft?.content_variants?.editorial_content?.headline || '');
  const [summary, setSummary] = useState(draft?.content_variants?.editorial_content?.summary || '');
  const [content, setContent] = useState(draft?.content_variants?.editorial_content?.full_content || '');
  const [tags, setTags] = useState<string[]>(draft?.content_variants?.metadata?.tags || []);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
  // AI suggestions state
  const [headlineSuggestions, setHeadlineSuggestions] = useState<string[]>([]);
  const [summarySuggestions, setSummarySuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // SEO scoring
  const [seoScore, setSeoScore] = useState(0);

  useEffect(() => {
    // Update state when draft changes
    if (draft) {
      setTitle(draft.title || '');
      setHeadline(draft.content_variants?.editorial_content?.headline || '');
      setSummary(draft.content_variants?.editorial_content?.summary || '');
      setContent(draft.content_variants?.editorial_content?.full_content || '');
      setTags(draft.content_variants?.metadata?.tags || []);
    }
  }, [draft]);

  useEffect(() => {
    // Calculate SEO score based on content
    const calculateSEOScore = () => {
      let score = 0;
      if (headline.length >= 30 && headline.length <= 60) score += 25;
      if (summary.length >= 120 && summary.length <= 160) score += 25;
      if (content.length >= 300) score += 25;
      if (tags.length >= 3) score += 25;
      setSeoScore(score);
    };
    
    calculateSEOScore();
  }, [headline, summary, content, tags]);

  const generateAISuggestions = async (type: "headline" | "summary") => {
    setIsGenerating(true);
    try {
      let prompt = "";
      
      if (type === "headline") {
        prompt = `Create 3 compelling headlines for this article:
Content: "${content.substring(0, 500)}..."
Current headline: "${headline}"

Requirements:
- 30-60 characters for SEO
- Engaging and clickable
- Professional tone for mortgage industry
- Include primary keyword if possible

Return only the 3 headlines, numbered.`;
      } else {
        prompt = `Create 3 SEO-optimized summaries:
Headline: "${headline}"
Content: "${content.substring(0, 500)}..."

Requirements:
- 120-160 characters for meta description
- Include primary keywords naturally
- Clear value proposition
- Action-oriented

Return only the 3 summaries, numbered.`;
      }

      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: prompt,
          model: 'gpt-4o',
          input_data: { type, headline, summary, content }
        }
      });
      
      if (error) throw error;
      
      const responseContent = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      const suggestions = responseContent.split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(line => line.length > 0)
        .slice(0, 3);

      if (type === "headline") setHeadlineSuggestions(suggestions);
      else setSummarySuggestions(suggestions);
      
    } catch (err) {
      console.error(`Error generating ${type} suggestions:`, err);
      toast.error(`Failed to generate ${type} suggestions`);
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
          seo_title: headline,
          seo_description: summary,
          tags
        },
        status: content.trim() ? "ready" : "draft"
      };

      console.log("Saving draft with data:", { title, contentVariants });

      const { error } = await supabase
        .from("articles")
        .update({
          title,
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

  const getSEOScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (!draft) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <p>Select a draft to start editing</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Editor Header */}
      <div className="border-b p-4 bg-background">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Draft Editor</h2>
            <Badge variant="outline" className="capitalize">
              {draft.status?.replace('_', ' ')}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4" />
              <span className={getSEOScoreColor(seoScore)}>SEO: {seoScore}%</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(true)}>
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </Button>
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1 block">Article Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter article title..."
              className="font-medium"
            />
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="content" className="flex flex-col h-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-background">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="seo">SEO & Keywords</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Marketing Headline</label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Compelling, SEO-optimized headline..."
                className="text-lg font-medium"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{headline.length}/60 characters (ideal: 30-60)</span>
                {headline.length >= 30 && headline.length <= 60 && (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                )}
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
              <label className="text-sm font-medium">Meta Description</label>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder="SEO-optimized summary for search engines..."
                rows={3}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{summary.length}/160 characters (ideal: 120-160)</span>
                {summary.length >= 120 && summary.length <= 160 && (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                )}
              </div>
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
              <label className="text-sm font-medium">Article Content</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Write your article content here..."
                rows={20}
                className="font-mono text-sm resize-none"
              />
              <div className="text-xs text-muted-foreground">
                {content.length} characters ({Math.round(content.length / 5)} words)
              </div>
            </div>
          </TabsContent>

          <TabsContent value="seo" className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <h3 className="font-medium">SEO Score</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Headline length</span>
                    <span className={headline.length >= 30 && headline.length <= 60 ? 'text-green-600' : 'text-red-600'}>
                      {headline.length >= 30 && headline.length <= 60 ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Meta description</span>
                    <span className={summary.length >= 120 && summary.length <= 160 ? 'text-green-600' : 'text-red-600'}>
                      {summary.length >= 120 && summary.length <= 160 ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Content length</span>
                    <span className={content.length >= 300 ? 'text-green-600' : 'text-red-600'}>
                      {content.length >= 300 ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Keywords/Tags</span>
                    <span className={tags.length >= 3 ? 'text-green-600' : 'text-red-600'}>
                      {tags.length >= 3 ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">Keywords & Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Tags will be automatically generated from article content
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="settings" className="flex-1 overflow-y-auto p-4">
            <div className="space-y-4">
              <h3 className="font-medium">Publication Settings</h3>
              <p className="text-sm text-muted-foreground">
                Publication settings and scheduling options will be available here.
              </p>
            </div>
          </TabsContent>
        </Tabs>
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
