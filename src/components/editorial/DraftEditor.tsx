
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
import DraftPreviewModal from "./DraftPreviewModal";

interface DraftEditorProps {
  draft: any;
  onSave: () => void;
  researchContext?: any; // Made optional since we're not using it much
}

export default function DraftEditor({ draft, onSave }: DraftEditorProps) {
  const [title, setTitle] = useState(draft?.title || draft?.theme || '');
  const [theme, setTheme] = useState(draft?.theme || '');
  const [headline, setHeadline] = useState(draft?.content_variants?.editorial_content?.headline || '');
  const [summary, setSummary] = useState(draft?.content_variants?.editorial_content?.summary || draft?.summary || '');
  const [content, setContent] = useState(draft?.content_variants?.editorial_content?.full_content || draft?.outline || '');
  const [tags, setTags] = useState<string[]>(draft?.content_variants?.metadata?.tags || []);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  
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

  useEffect(() => {
    // Calculate SEO score based on content
    const calculateSEOScore = () => {
      let score = 0;
      if (title.length > 0) score += 20;
      if (headline.length >= 30 && headline.length <= 60) score += 25;
      if (summary.length >= 120 && summary.length <= 160) score += 25;
      if (content.length >= 300) score += 20;
      if (tags.length >= 3) score += 10;
      setSeoScore(score);
    };
    
    calculateSEOScore();
  }, [title, headline, summary, content, tags]);

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
            <h2 className="text-lg font-semibold">Editorial Draft</h2>
            <Badge variant="outline" className="capitalize">
              {draft.status?.replace('_', ' ')}
            </Badge>
            {draft.source_type && (
              <Badge variant="secondary">
                {draft.source_type === 'news' ? 'From News' : 
                 draft.source_type === 'document' ? 'From Document' : 'Manual'}
              </Badge>
            )}
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
            <label className="text-sm font-medium mb-1 block">Document Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title (from filename)..."
              className="font-medium"
            />
          </div>
          
          <div>
            <label className="text-sm font-medium mb-1 block">Content Theme</label>
            <Input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Main topic or theme..."
            />
          </div>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="content" className="flex flex-col h-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-background">
            <TabsTrigger value="content">Content</TabsTrigger>
            <TabsTrigger value="marketing">Marketing</TabsTrigger>
            <TabsTrigger value="seo">SEO & Keywords</TabsTrigger>
          </TabsList>

          <TabsContent value="content" className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Article Content</label>
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Your article content appears here from the imported document..."
                rows={25}
                className="font-mono text-sm resize-none"
              />
              <div className="text-xs text-muted-foreground">
                {content.length} characters ({Math.round(content.length / 5)} words)
              </div>
            </div>
          </TabsContent>

          <TabsContent value="marketing" className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Marketing Headline</label>
              <Input
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Create a compelling headline for marketing..."
                className="text-lg font-medium"
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{headline.length}/60 characters (ideal: 30-60)</span>
                {headline.length >= 30 && headline.length <= 60 && (
                  <CheckCircle className="h-3 w-3 text-green-600" />
                )}
              </div>
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
            </div>

            <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded">
              <p className="font-medium mb-1">💡 Marketing Tip:</p>
              <p>Use the Content Assistant panel on the right to automatically generate these marketing fields from your article content.</p>
            </div>
          </TabsContent>

          <TabsContent value="seo" className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="grid grid-cols-1 gap-6">
              <div className="space-y-3">
                <h3 className="font-medium">SEO Checklist</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Title present</span>
                    <span className={title.length > 0 ? 'text-green-600' : 'text-red-600'}>
                      {title.length > 0 ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Headline length (30-60 chars)</span>
                    <span className={headline.length >= 30 && headline.length <= 60 ? 'text-green-600' : 'text-red-600'}>
                      {headline.length >= 30 && headline.length <= 60 ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Meta description (120-160 chars)</span>
                    <span className={summary.length >= 120 && summary.length <= 160 ? 'text-green-600' : 'text-red-600'}>
                      {summary.length >= 120 && summary.length <= 160 ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Content length (300+ words)</span>
                    <span className={content.length >= 1500 ? 'text-green-600' : 'text-red-600'}>
                      {content.length >= 1500 ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Keywords/Tags (3+)</span>
                    <span className={tags.length >= 3 ? 'text-green-600' : 'text-red-600'}>
                      {tags.length >= 3 ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-medium">Keywords & Tags ({tags.length})</h3>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <Badge key={index} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">
                  Use the Content Assistant panel to generate relevant keywords for this article.
                </p>
              </div>
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
