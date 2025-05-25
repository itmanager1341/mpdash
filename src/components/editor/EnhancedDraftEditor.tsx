
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
  SheetClose, 
  SheetContent, 
  SheetDescription, 
  SheetFooter, 
  SheetHeader, 
  SheetTitle 
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, Eye, ExternalLink, Lightbulb } from "lucide-react";
import { NewsItem } from "@/types/news";

interface EnhancedDraftEditorProps {
  newsItem: NewsItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

const EnhancedDraftEditor = ({ newsItem, open, onOpenChange, onSave }: EnhancedDraftEditorProps) => {
  // Source content (read-only)
  const sourceContent = newsItem.content_variants?.source_content || {
    original_title: newsItem.headline,
    original_summary: newsItem.summary
  };

  // Editorial content (editable)
  const [headline, setHeadline] = useState(
    newsItem.content_variants?.editorial_content?.headline || newsItem.headline
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

  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateHeadlineSuggestions = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: `You are an expert marketing copywriter specializing in compelling email newsletter headlines.

Original article: "${sourceContent.original_title}"
Summary: "${sourceContent.original_summary}"

Create 3 marketing-optimized headlines for this story that will:
1. Grab attention in an email inbox
2. Create curiosity and urgency
3. Are 8-12 words maximum
4. Use power words and emotional triggers
5. Are specific and benefit-focused

Guidelines:
- Use numbers when relevant
- Include emotional triggers (shocking, surprising, urgent)
- Make it benefit-focused for mortgage professionals
- Avoid clickbait - be authentic but compelling

Return only the 3 headlines, each on a new line, numbered.`,
          model: 'gpt-4o',
          input_data: {
            original_title: sourceContent.original_title,
            summary: sourceContent.original_summary
          }
        }
      });
      
      if (error) throw error;
      
      const suggestions = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      toast.success("Headlines generated! Check the suggestions below.", { duration: 4000 });
      
      // You could store these suggestions in state and display them as clickable options
      console.log("Headline suggestions:", suggestions);
      
    } catch (err) {
      console.error('Error generating headlines:', err);
      toast.error("Failed to generate headline suggestions");
    } finally {
      setIsGenerating(false);
    }
  };

  const generateCTASuggestions = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: `You are an expert email marketing copywriter creating compelling call-to-action teasers.

Article headline: "${headline}"
Article summary: "${summary}"

Create 3 compelling CTA teasers (1-2 sentences each) that will:
1. Create curiosity and urgency
2. Tease the key benefit without giving everything away
3. Use action-oriented language
4. Appeal to mortgage professionals' needs
5. Encourage clicking to read more

Each CTA should be different in approach:
- One curiosity-driven
- One benefit-focused  
- One urgency-based

Return only the 3 CTAs, each on a new line, numbered.`,
          model: 'gpt-4o',
          input_data: {
            headline,
            summary
          }
        }
      });
      
      if (error) throw error;
      
      const suggestions = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      toast.success("CTA suggestions generated!", { duration: 4000 });
      console.log("CTA suggestions:", suggestions);
      
    } catch (err) {
      console.error('Error generating CTAs:', err);
      toast.error("Failed to generate CTA suggestions");
    } finally {
      setIsGenerating(false);
    }
  };

  const expandToFullArticle = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: `You are a professional financial journalist writing for mortgage industry professionals.

Original source: "${sourceContent.original_title}"
Source summary: "${sourceContent.original_summary}"
Marketing headline: "${headline}"
Editor summary: "${summary}"

Expand this into a comprehensive 400-600 word article that:
1. Maintains journalistic integrity and accuracy
2. Provides actionable insights for mortgage professionals
3. Includes relevant context and implications
4. Uses clear, professional language
5. Structures information logically with clear paragraphs

Format as clean HTML with <p> tags for paragraphs. Include source attribution at the end.
Do not include the headline in the content - just the article body.`,
          model: 'gpt-4o',
          input_data: {
            original_title: sourceContent.original_title,
            original_summary: sourceContent.original_summary,
            headline,
            summary
          }
        }
      });
      
      if (error) throw error;
      
      const content = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      setFullContent(content);
      toast.success("Article content generated successfully!");
      
    } catch (err) {
      console.error('Error generating article:', err);
      toast.error("Failed to generate article content");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!headline.trim() || !summary.trim() || !cta.trim() || !fullContent.trim()) {
      toast.error("Please complete all fields before saving");
      return;
    }

    try {
      setIsSaving(true);

      const contentVariants = {
        source_content: {
          original_title: sourceContent.original_title,
          original_summary: sourceContent.original_summary,
          author: sourceContent.author || null,
          publication_date: sourceContent.publication_date || null
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
        status: "draft"
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

  const getPreviewHtml = () => {
    return `
      <div class="max-w-3xl mx-auto">
        <h1 class="text-2xl font-bold mb-4">${headline}</h1>
        <div class="text-sm text-gray-600 mb-2">Source: ${newsItem.source}</div>
        <div class="text-sm text-gray-500 mb-4 italic">${cta}</div>
        <div class="prose">
          ${fullContent}
        </div>
      </div>
    `;
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-4xl overflow-y-auto" side="right">
        <SheetHeader>
          <SheetTitle>MPDaily Article Editor</SheetTitle>
          <SheetDescription>
            Create marketing-optimized content for MPDaily publication
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* Source Content Reference */}
          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ExternalLink className="h-4 w-4" />
                Source Reference
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div>
                <Label className="text-xs text-muted-foreground">Original Title</Label>
                <p className="text-sm">{sourceContent.original_title}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Original Summary</Label>
                <p className="text-sm text-muted-foreground">{sourceContent.original_summary}</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline">{newsItem.source}</Badge>
                {newsItem.perplexity_score && (
                  <Badge variant="secondary">Score: {newsItem.perplexity_score.toFixed(1)}</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="edit" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="edit">
                <Lightbulb className="h-4 w-4 mr-2" />
                Edit Content
              </TabsTrigger>
              <TabsTrigger value="preview">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="edit" className="space-y-6">
              {/* Marketing Headline */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="headline">Marketing Headline</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={generateHeadlineSuggestions}
                    disabled={isGenerating}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isGenerating ? "Generating..." : "AI Suggestions"}
                  </Button>
                </div>
                <Input
                  id="headline"
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Compelling, marketing-optimized headline..."
                />
              </div>

              {/* Editorial Summary */}
              <div className="space-y-2">
                <Label htmlFor="summary">Editorial Summary</Label>
                <Textarea
                  id="summary"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="Editorial summary for meta description and reference..."
                  rows={3}
                />
              </div>

              {/* Call-to-Action */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="cta">Call-to-Action Teaser</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={generateCTASuggestions}
                    disabled={isGenerating}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isGenerating ? "Generating..." : "AI CTAs"}
                  </Button>
                </div>
                <Textarea
                  id="cta"
                  value={cta}
                  onChange={(e) => setCta(e.target.value)}
                  placeholder="Compelling 1-2 sentence teaser that creates curiosity..."
                  rows={2}
                />
              </div>

              <Separator />

              {/* Full Article Content */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="full-content">Full Article Content</Label>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={expandToFullArticle}
                    disabled={isGenerating}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    {isGenerating ? "Generating..." : "AI Expand"}
                  </Button>
                </div>
                <Textarea
                  id="full-content"
                  value={fullContent}
                  onChange={(e) => setFullContent(e.target.value)}
                  placeholder="Full article content with proper attribution..."
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>
            </TabsContent>
            
            <TabsContent value="preview">
              <div 
                className="border rounded-md p-6 bg-white min-h-[400px]"
                dangerouslySetInnerHTML={{ __html: getPreviewHtml() }}
              />
            </TabsContent>
          </Tabs>

          <SheetFooter className="mt-8">
            <Button 
              onClick={handleSaveDraft} 
              disabled={isSaving || isGenerating} 
              className="w-full sm:w-auto"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? "Saving..." : "Save Draft"}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EnhancedDraftEditor;
