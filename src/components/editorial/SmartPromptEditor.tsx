
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { 
  Sparkles, 
  Eye, 
  Save, 
  RefreshCw,
  Target,
  TrendingUp,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

interface Source {
  id: string;
  source_name: string;
  source_url: string;
  priority_tier: number;
  source_type: string;
  cluster_alignment: string[] | null;
  created_at: string;
}

interface Prompt {
  id: string;
  function_name: string;
  prompt_text: string;
  model: string;
  is_active: boolean;
}

interface Cluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  description?: string;
  keywords?: string[];
}

export default function SmartPromptEditor() {
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [promptContent, setPromptContent] = useState("");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [promptName, setPromptName] = useState("");
  const [selectedModel, setSelectedModel] = useState("llama-3.1-sonar-small-128k-online");
  const queryClient = useQueryClient();

  // Fetch news search prompts
  const { data: prompts, isLoading: promptsLoading } = useQuery({
    queryKey: ['news-search-prompts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('llm_prompts')
        .select('*')
        .eq('is_active', true)
        .like('function_name', '%news%')
        .order('function_name');
        
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch sources data for intelligent suggestions
  const { data: sources } = useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sources')
        .select('*')
        .order('priority_tier');
        
      if (error) throw error;
      return data || [];
    }
  });

  // Fetch keyword clusters
  const { data: clusters } = useQuery({
    queryKey: ['keyword-clusters'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('keyword_clusters')
        .select('*')
        .order('primary_theme');
        
      if (error) throw error;
      return data || [];
    }
  });

  // Save prompt mutation
  const savePromptMutation = useMutation({
    mutationFn: async ({ id, content, name, model }: { id?: string, content: string, name: string, model: string }) => {
      const promptData = {
        function_name: name,
        prompt_text: content,
        model: model,
        is_active: true,
        include_clusters: true,
        include_tracking_summary: true
      };

      if (id) {
        const { error } = await supabase
          .from('llm_prompts')
          .update(promptData)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('llm_prompts')
          .insert(promptData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-search-prompts'] });
      toast.success('Prompt saved successfully');
    },
    onError: (error) => {
      toast.error('Failed to save prompt: ' + error.message);
    }
  });

  // Generate optimized prompt based on current data
  const generateOptimizedPrompt = () => {
    const prioritySources = sources?.filter(s => s.priority_tier <= 2) || [];
    const competitorSources = sources?.filter(s => s.source_type === 'competitor') || [];
    const primaryThemes = clusters?.map(c => c.primary_theme).slice(0, 5) || [];

    const optimizedPrompt = `You are an expert mortgage industry analyst. Search for the most relevant and actionable news for mortgage professionals.

PRIORITY FOCUS AREAS:
${primaryThemes.map(theme => `• ${theme}`).join('\n')}

SEARCH REQUIREMENTS:
1. Focus on BUSINESS IMPACT - regulatory changes, market shifts, technology disruptions
2. Prioritize PRIMARY SOURCES - government agencies, Fed announcements, industry leaders
3. Exclude consumer-focused content and basic homebuying advice
4. Look for competitive intelligence and market opportunities

PREFERRED SOURCES (search these first):
${prioritySources.map(s => `• ${s.source_name} (${s.source_url})`).join('\n')}

EXCLUDE COMPETITOR COVERAGE:
${competitorSources.map(s => `• Avoid ${s.source_name}`).join('\n')}

SCORING CRITERIA:
- Direct impact on mortgage business operations (30%)
- Regulatory/policy implications (25%)
- Market trends and data (20%)
- Technology and innovation (15%)
- Competitive landscape changes (10%)

Search for articles from the last 24 hours that meet these criteria. Provide a relevance score (0-100) and brief justification for each article.`;

    setPromptContent(optimizedPrompt);
    setPromptName('optimized_mortgage_news_search');
    toast.success('Generated optimized prompt based on your current sources and clusters');
  };

  // Load selected prompt
  useEffect(() => {
    if (selectedPrompt && prompts) {
      const prompt = prompts.find(p => p.id === selectedPrompt);
      if (prompt) {
        setPromptContent(prompt.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, '')); // Remove metadata
        setPromptName(prompt.function_name);
        setSelectedModel(prompt.model);
      }
    }
  }, [selectedPrompt, prompts]);

  const handleSave = () => {
    if (!promptName.trim() || !promptContent.trim()) {
      toast.error('Please provide both prompt name and content');
      return;
    }

    savePromptMutation.mutate({
      id: selectedPrompt || undefined,
      content: promptContent,
      name: promptName,
      model: selectedModel
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with AI optimization */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Smart Prompt Editor
          </CardTitle>
          <CardDescription>
            AI-powered prompt optimization using your sources and keyword data
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Button onClick={generateOptimizedPrompt} className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              Generate Optimized Prompt
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              {isPreviewMode ? "Edit Mode" : "Preview Mode"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Prompt Selection and Editor */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Prompt Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="existing-prompt">Load Existing Prompt</Label>
                  <Select value={selectedPrompt || ""} onValueChange={setSelectedPrompt}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a prompt to edit" />
                    </SelectTrigger>
                    <SelectContent>
                      {prompts?.map((prompt) => (
                        <SelectItem key={prompt.id} value={prompt.id}>
                          {prompt.function_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="model">AI Model</Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llama-3.1-sonar-small-128k-online">
                        Llama 3.1 Sonar Small (Fast, Real-time)
                      </SelectItem>
                      <SelectItem value="llama-3.1-sonar-large-128k-online">
                        Llama 3.1 Sonar Large (Powerful, Real-time)
                      </SelectItem>
                      <SelectItem value="gpt-4o">
                        GPT-4o (OpenAI)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt-name">Prompt Name</Label>
                <Input
                  id="prompt-name"
                  value={promptName}
                  onChange={(e) => setPromptName(e.target.value)}
                  placeholder="e.g., optimized_mortgage_news_search"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt-content">Prompt Content</Label>
                <Textarea
                  id="prompt-content"
                  value={promptContent}
                  onChange={(e) => setPromptContent(e.target.value)}
                  rows={12}
                  placeholder="Enter your news search prompt here..."
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => {
                  setSelectedPrompt(null);
                  setPromptContent("");
                  setPromptName("");
                }}>
                  Clear
                </Button>
                <Button onClick={handleSave} disabled={savePromptMutation.isPending}>
                  {savePromptMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Prompt
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Live Data Insights */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Source Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Priority Sources</span>
                  <Badge variant="secondary">{sources?.filter(s => s.priority_tier <= 2).length || 0}</Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Competitors (Excluded)</span>
                  <Badge variant="destructive">{sources?.filter(s => s.source_type === 'competitor').length || 0}</Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span>Active Clusters</span>
                  <Badge variant="outline">{clusters?.length || 0}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Optimization Tips</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Include specific business impact criteria</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <CheckCircle className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                <span>Exclude competitor coverage automatically</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 flex-shrink-0" />
                <span>Focus on regulatory and policy changes</span>
              </div>
              <div className="flex items-start gap-2 text-xs">
                <TrendingUp className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
                <span>Prioritize market trend analysis</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
