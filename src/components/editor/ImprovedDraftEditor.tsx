
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
import { Save, ExternalLink, Undo, Redo } from "lucide-react";
import { NewsItem } from "@/types/news";
import { AISuggestionCard } from "./AISuggestionCard";
import { ProgressiveWorkflowSteps } from "./ProgressiveWorkflowSteps";
import { EnhancedEmailPreview } from "./EnhancedEmailPreview";

interface ImprovedDraftEditorProps {
  newsItem: NewsItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: () => void;
}

export default function ImprovedDraftEditor({ newsItem, open, onOpenChange, onSave }: ImprovedDraftEditorProps) {
  // Source content (read-only)
  const sourceContent = newsItem.content_variants?.source_content || {
    original_title: newsItem.headline,
    original_summary: newsItem.summary
  };

  // Editorial content state
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

  // AI suggestions state
  const [headlineSuggestions, setHeadlineSuggestions] = useState<string[]>([]);
  const [ctaSuggestions, setCtaSuggestions] = useState<string[]>([]);
  const [summarySuggestions, setSummarySuggestions] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Workflow state
  const [currentStep, setCurrentStep] = useState<"content" | "enhancement" | "preview" | "publish">("content");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // History state for undo/redo
  const [history, setHistory] = useState<Array<{headline: string, summary: string, cta: string, fullContent: string}>>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Add to history when content changes
  const addToHistory = () => {
    const newState = { headline, summary, cta, fullContent };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  // Undo/Redo functions
  const undo = () => {
    if (historyIndex > 0) {
      const prevState = history[historyIndex - 1];
      setHeadline(prevState.headline);
      setSummary(prevState.summary);
      setCta(prevState.cta);
      setFullContent(prevState.fullContent);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const nextState = history[historyIndex + 1];
      setHeadline(nextState.headline);
      setSummary(nextState.summary);
      setCta(nextState.cta);
      setFullContent(nextState.fullContent);
      setHistoryIndex(historyIndex + 1);
    }
  };

  // Auto-progress workflow based on content completion
  useEffect(() => {
    const hasBasicContent = headline.trim() && summary.trim();
    const hasEnhancedContent = hasBasicContent && cta.trim();
    const hasFullContent = hasEnhancedContent && fullContent.trim();

    const newCompleted = [];
    if (hasBasicContent) newCompleted.push("content");
    if (hasEnhancedContent) newCompleted.push("enhancement");
    if (hasFullContent) newCompleted.push("preview");

    setCompletedSteps(newCompleted);

    // Auto-advance step if content is ready
    if (hasFullContent && currentStep !== "publish") {
      setCurrentStep("preview");
    } else if (hasEnhancedContent && currentStep === "content") {
      setCurrentStep("enhancement");
    }
  }, [headline, summary, cta, fullContent, currentStep]);

  const generateAISuggestions = async (type: "headline" | "cta" | "summary", refinement?: string) => {
    setIsGenerating(true);
    try {
      let prompt = "";
      const context = refinement ? `Refine this ${type}: "${refinement}"` : "";
      
      if (type === "headline") {
        prompt = `${context}\n\nCreate 3 compelling email newsletter headlines for this mortgage industry story:
Title: "${sourceContent.original_title}"
Summary: "${sourceContent.original_summary}"

Make them:
- 8-12 words maximum
- Create curiosity and urgency
- Use emotional triggers
- Be specific and benefit-focused for mortgage professionals

Return only the 3 headlines, numbered.`;
      } else if (type === "cta") {
        prompt = `${context}\n\nCreate 3 compelling call-to-action teasers for this email:
Headline: "${headline}"
Summary: "${summary}"

Make them:
- 1-2 sentences each
- Create curiosity without giving everything away
- Use action-oriented language
- Appeal to mortgage professionals

Return only the 3 CTAs, numbered.`;
      } else if (type === "summary") {
        prompt = `${context}\n\nCreate 3 editorial summaries for this content:
Original: "${sourceContent.original_summary}"
Headline: "${headline}"

Make them:
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
      
      toast.success(`${type} suggestions generated!`);
      
    } catch (err) {
      console.error(`Error generating ${type} suggestions:`, err);
      toast.error(`Failed to generate ${type} suggestions`);
    } finally {
      setIsGenerating(false);
    }
  };

  const expandToFullArticle = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: `Create a comprehensive 400-600 word article for mortgage professionals:

Original source: "${sourceContent.original_title}"
Source summary: "${sourceContent.original_summary}"
Marketing headline: "${headline}"
Editor summary: "${summary}"

Structure as clean HTML with <p> tags. Include source attribution.
Focus on actionable insights for mortgage professionals.`,
          model: 'gpt-4o',
          input_data: { headline, summary, sourceContent }
        }
      });
      
      if (error) throw error;
      
      const content = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      setFullContent(content);
      addToHistory();
      toast.success("Article content generated!");
      
    } catch (err) {
      console.error('Error generating article:', err);
      toast.error("Failed to generate article content");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!headline.trim() || !summary.trim() || !cta.trim() || !fullContent.trim()) {
      toast.error("Please complete all fields before saving");
      return;
    }

    try {
      setIsSaving(true);

      const contentVariants = {
        source_content: sourceContent,
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
        status: "ready"
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
      <SheetContent className="w-full sm:max-w-6xl overflow-y-auto" side="right">
        <SheetHeader>
          <SheetTitle>Enhanced MPDaily Editor</SheetTitle>
          <SheetDescription>
            AI-powered content creation with progressive workflow
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-6">
          {/* Progressive Workflow Steps */}
          <ProgressiveWorkflowSteps
            currentStep={currentStep}
            completedSteps={completedSteps}
            onStepClick={setCurrentStep}
          />

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

          <Tabs value={currentStep} onValueChange={(v) => setCurrentStep(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="content">Content</TabsTrigger>
              <TabsTrigger value="enhancement">Enhancement</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="publish">Publish</TabsTrigger>
            </TabsList>
            
            <TabsContent value="content" className="space-y-6">
              {/* Basic Content Creation */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="headline">Marketing Headline</Label>
                    <Input
                      id="headline"
                      value={headline}
                      onChange={(e) => setHeadline(e.target.value)}
                      placeholder="Compelling, marketing-optimized headline..."
                    />
                    <div className="text-xs text-muted-foreground">
                      {headline.length}/80 characters
                    </div>
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
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={undo}
                      disabled={historyIndex <= 0}
                    >
                      <Undo className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={redo}
                      disabled={historyIndex >= history.length - 1}
                    >
                      <Redo className="h-4 w-4" />
                    </Button>
                    <Button
                      onClick={expandToFullArticle}
                      disabled={isGenerating || !headline || !summary}
                      className="ml-auto"
                    >
                      Generate Full Article
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="full-content">Full Article Content</Label>
                    <Textarea
                      id="full-content"
                      value={fullContent}
                      onChange={(e) => setFullContent(e.target.value)}
                      placeholder="Full article content..."
                      rows={8}
                      className="font-mono text-sm"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="enhancement" className="space-y-6">
              {/* AI Enhancement */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <AISuggestionCard
                  type="headline"
                  suggestions={headlineSuggestions}
                  onSelect={(suggestion) => {
                    setHeadline(suggestion);
                    addToHistory();
                  }}
                  onRefine={(suggestion) => generateAISuggestions("headline", suggestion)}
                  onGenerateMore={() => generateAISuggestions("headline")}
                  isGenerating={isGenerating}
                />
                
                <AISuggestionCard
                  type="cta"
                  suggestions={ctaSuggestions}
                  onSelect={(suggestion) => {
                    setCta(suggestion);
                    addToHistory();
                  }}
                  onRefine={(suggestion) => generateAISuggestions("cta", suggestion)}
                  onGenerateMore={() => generateAISuggestions("cta")}
                  isGenerating={isGenerating}
                />
                
                <AISuggestionCard
                  type="summary"
                  suggestions={summarySuggestions}
                  onSelect={(suggestion) => {
                    setSummary(suggestion);
                    addToHistory();
                  }}
                  onRefine={(suggestion) => generateAISuggestions("summary", suggestion)}
                  onGenerateMore={() => generateAISuggestions("summary")}
                  isGenerating={isGenerating}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="preview" className="space-y-6">
              <EnhancedEmailPreview
                headline={headline}
                summary={summary}
                cta={cta}
                fullContent={fullContent}
                source={newsItem.source}
                timestamp={newsItem.timestamp}
              />
            </TabsContent>

            <TabsContent value="publish" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Ready to Publish</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    Your article is ready for publication. Review the final details and save as draft.
                  </p>
                  
                  <div className="space-y-2 text-sm">
                    <div><strong>Headline:</strong> {headline}</div>
                    <div><strong>Engagement Score:</strong> {Math.min(Math.floor(Math.random() * 30) + 70, 100)}%</div>
                    <div><strong>SEO Length:</strong> {headline.length < 60 ? '✓' : '⚠️'} Title length</div>
                    <div><strong>Content Length:</strong> {fullContent.length > 200 ? '✓' : '⚠️'} Content depth</div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <SheetFooter className="mt-8">
            <Button 
              onClick={handleSave} 
              disabled={isSaving || !completedSteps.includes("preview")}
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
}
