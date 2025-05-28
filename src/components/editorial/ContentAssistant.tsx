
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  Lightbulb, 
  Target, 
  TrendingUp,
  FileText,
  Zap,
  CheckCircle,
  AlertCircle,
  BookOpen
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface ContentAssistantProps {
  draft: any;
  onKeywordsSuggested: (keywords: string[]) => void;
  onContentUpdated: (updates: any) => void;
}

export default function ContentAssistant({ draft, onKeywordsSuggested, onContentUpdated }: ContentAssistantProps) {
  const [contentAnalysis, setContentAnalysis] = useState<any>(null);
  const [suggestedKeywords, setSuggestedKeywords] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [qualityScore, setQualityScore] = useState(0);

  const content = draft?.content_variants?.editorial_content?.full_content || draft?.outline || '';
  const title = draft?.title || '';

  // Analyze content quality and structure
  useEffect(() => {
    if (content) {
      analyzeContent();
    }
  }, [content]);

  const analyzeContent = () => {
    const words = content.split(/\s+/).length;
    const sentences = content.split(/[.!?]+/).length;
    const paragraphs = content.split(/\n\s*\n/).length;
    const avgWordsPerSentence = words / sentences;
    const avgSentencesPerParagraph = sentences / paragraphs;

    // Calculate readability score (simplified Flesch formula)
    const syllables = content.split(/[aeiouy]+/g).length - 1;
    const readabilityScore = Math.max(0, 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * (syllables / words)));

    // Content quality checks
    const hasGoodLength = words >= 300 && words <= 2000;
    const hasGoodParagraphStructure = paragraphs >= 3;
    const hasGoodSentenceLength = avgWordsPerSentence >= 10 && avgWordsPerSentence <= 25;
    const hasTitle = title.length > 0;

    let score = 0;
    if (hasTitle) score += 25;
    if (hasGoodLength) score += 25;
    if (hasGoodParagraphStructure) score += 25;
    if (hasGoodSentenceLength) score += 25;

    setQualityScore(score);
    setContentAnalysis({
      words,
      sentences,
      paragraphs,
      avgWordsPerSentence: Math.round(avgWordsPerSentence),
      readabilityScore: Math.round(readabilityScore),
      checks: {
        hasTitle,
        hasGoodLength,
        hasGoodParagraphStructure,
        hasGoodSentenceLength
      }
    });
  };

  const generateKeywords = async () => {
    if (!content) {
      toast.error("No content to analyze");
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: `Analyze this article content and extract 8-12 relevant keywords for SEO and categorization:

Title: "${title}"
Content: "${content.substring(0, 1000)}..."

Return keywords as a comma-separated list. Focus on:
- Primary topics and themes
- Industry-specific terms
- Action words and concepts
- Long-tail keyword phrases (2-3 words)

Example format: mortgage rates, home financing, first-time buyers, refinancing options`,
          model: 'gpt-4o',
          input_data: { title, content: content.substring(0, 1000) }
        }
      });
      
      if (error) throw error;
      
      const keywordText = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      const keywords = keywordText
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0)
        .slice(0, 12);

      setSuggestedKeywords(keywords);
      onKeywordsSuggested(keywords);
      toast.success(`Generated ${keywords.length} keyword suggestions`);
      
    } catch (err) {
      console.error('Error generating keywords:', err);
      toast.error("Failed to generate keywords");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateMetaDescription = async () => {
    if (!content || !title) {
      toast.error("Need title and content to generate meta description");
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: `Create an SEO-optimized meta description (120-160 characters) for this article:

Title: "${title}"
Content: "${content.substring(0, 500)}..."

Requirements:
- 120-160 characters exactly
- Include primary keywords naturally
- Compelling and informative
- Action-oriented language for mortgage professionals`,
          model: 'gpt-4o',
          input_data: { title, content: content.substring(0, 500) }
        }
      });
      
      if (error) throw error;
      
      const metaDescription = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      onContentUpdated({ summary: metaDescription.trim() });
      toast.success("Meta description generated");
      
    } catch (err) {
      console.error('Error generating meta description:', err);
      toast.error("Failed to generate meta description");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateHeadline = async () => {
    if (!content || !title) {
      toast.error("Need title and content to generate headline");
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-llm-prompt', {
        body: {
          prompt_text: `Create a compelling marketing headline for this article:

Original Title: "${title}"
Content: "${content.substring(0, 500)}..."

Requirements:
- 8-12 words maximum
- Create curiosity and urgency
- Professional tone for mortgage industry
- Include benefit or value proposition`,
          model: 'gpt-4o',
          input_data: { title, content: content.substring(0, 500) }
        }
      });
      
      if (error) throw error;
      
      const headline = typeof data.output === 'string' ? data.output : JSON.stringify(data.output);
      onContentUpdated({ headline: headline.trim() });
      toast.success("Marketing headline generated");
      
    } catch (err) {
      console.error('Error generating headline:', err);
      toast.error("Failed to generate headline");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!draft) {
    return (
      <div className="p-6 text-center">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h3 className="font-medium mb-1">No content selected</h3>
        <p className="text-sm text-muted-foreground">
          Select a draft to see content analysis and suggestions
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          Content Assistant
        </h3>
        
        {/* Quality Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>Content Quality</span>
            <span className={qualityScore >= 75 ? 'text-green-600' : qualityScore >= 50 ? 'text-yellow-600' : 'text-red-600'}>
              {qualityScore}%
            </span>
          </div>
          <Progress value={qualityScore} className="h-2" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="analysis" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-background">
            <TabsTrigger value="analysis" className="text-xs">
              <TrendingUp className="h-3 w-3 mr-1" />
              Analysis
            </TabsTrigger>
            <TabsTrigger value="keywords" className="text-xs">
              <Target className="h-3 w-3 mr-1" />
              Keywords
            </TabsTrigger>
            <TabsTrigger value="enhance" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Enhance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis" className="p-4 space-y-4">
            {contentAnalysis && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Content Metrics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Words:</span>
                        <span className="ml-2 font-medium">{contentAnalysis.words}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Sentences:</span>
                        <span className="ml-2 font-medium">{contentAnalysis.sentences}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Paragraphs:</span>
                        <span className="ml-2 font-medium">{contentAnalysis.paragraphs}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Readability:</span>
                        <span className="ml-2 font-medium">{contentAnalysis.readabilityScore}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Quality Checks</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {Object.entries(contentAnalysis.checks).map(([key, passed]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        {passed ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={passed ? 'text-green-700' : 'text-red-700'}>
                          {key === 'hasTitle' && 'Has title'}
                          {key === 'hasGoodLength' && 'Good length (300-2000 words)'}
                          {key === 'hasGoodParagraphStructure' && 'Good paragraph structure'}
                          {key === 'hasGoodSentenceLength' && 'Good sentence length'}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="keywords" className="p-4 space-y-4">
            <div className="space-y-3">
              <Button 
                onClick={generateKeywords} 
                disabled={isAnalyzing || !content}
                className="w-full"
                variant="outline"
              >
                <Target className="h-4 w-4 mr-2" />
                {isAnalyzing ? "Analyzing..." : "Generate Keywords"}
              </Button>

              {suggestedKeywords.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Suggested Keywords</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {suggestedKeywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="enhance" className="p-4 space-y-3">
            <div className="space-y-3">
              <Button 
                onClick={generateHeadline} 
                disabled={isAnalyzing || !content || !title}
                variant="outline"
                className="w-full justify-start"
              >
                <Zap className="h-4 w-4 mr-2" />
                Generate Marketing Headline
              </Button>

              <Button 
                onClick={generateMetaDescription} 
                disabled={isAnalyzing || !content || !title}
                variant="outline"
                className="w-full justify-start"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Generate Meta Description
              </Button>

              <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/50 rounded">
                <p className="font-medium mb-1">💡 Enhancement Tips:</p>
                <ul className="space-y-1">
                  <li>• Use active voice for better readability</li>
                  <li>• Include numbers and data points</li>
                  <li>• Add subheadings every 200-300 words</li>
                  <li>• Include a clear call-to-action</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
