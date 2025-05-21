
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, CircleHelp, Edit, EyeIcon, Folder, Info, X } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";

interface VisualPromptBuilderProps {
  initialPrompt?: LlmPrompt | null;
  onSave?: (prompt: any) => void;
  onCancel?: () => void;
}

export default function VisualPromptBuilder({
  initialPrompt,
  onSave,
  onCancel
}: VisualPromptBuilderProps) {
  const [promptName, setPromptName] = useState(initialPrompt?.function_name || "news_search_");
  const [promptText, setPromptText] = useState(
    initialPrompt?.prompt_text || 
    "You are an editorial assistant for MortgagePoint. Find relevant news articles about the following topic:"
  );
  const [model, setModel] = useState(initialPrompt?.model || "llama-3.1-sonar-large-128k-online");
  const [selectedTab, setSelectedTab] = useState("content");
  
  const [searchRecency, setSearchRecency] = useState("day");
  const [domainFilter, setDomainFilter] = useState("auto");
  const [temperature, setTemperature] = useState(0.2);
  const [maxTokens, setMaxTokens] = useState(1000);
  
  const [selectedPrimaryThemes, setSelectedPrimaryThemes] = useState<string[]>([]);
  const [selectedSubThemes, setSelectedSubThemes] = useState<string[]>([]);
  const [selectedProfessions, setSelectedProfessions] = useState<string[]>([]);
  
  const [useTrackingSummary, setUseTrackingSummary] = useState(initialPrompt?.include_tracking_summary || false);
  const [useSourceMap, setUseSourceMap] = useState(initialPrompt?.include_sources_map || false);
  const [isActive, setIsActive] = useState(initialPrompt?.is_active !== false);
  
  const [previewKeyword, setPreviewKeyword] = useState("mortgage refinancing");
  const [showPreview, setShowPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Fetch keyword clusters
  const { data: clusters, isLoading: clustersLoading } = useQuery({
    queryKey: ["keyword-clusters"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("keyword_clusters")
        .select("*")
        .order("primary_theme");
        
      if (error) throw error;
      return data || [];
    }
  });
  
  // Group clusters by primary theme for easy selection
  const primaryThemeGroups = clusters?.reduce((acc: Record<string, any[]>, cluster) => {
    if (!acc[cluster.primary_theme]) {
      acc[cluster.primary_theme] = [];
    }
    acc[cluster.primary_theme].push(cluster);
    return acc;
  }, {}) || {};
  
  // Get all unique professions across clusters
  const allProfessions = clusters?.reduce((acc: string[], cluster) => {
    if (cluster.professions?.length) {
      cluster.professions.forEach((profession: string) => {
        if (!acc.includes(profession)) {
          acc.push(profession);
        }
      });
    }
    return acc;
  }, []).sort() || [];
  
  // Generate preview prompt
  const generatePreviewPrompt = () => {
    let preview = promptText;
    
    // Add selected clusters section
    if (selectedPrimaryThemes.length > 0 || selectedSubThemes.length > 0) {
      let clusterContext = "\n\nFOCUS ON THESE THEMES:\n";
      
      const relevantClusters = clusters?.filter(c => 
        selectedPrimaryThemes.includes(c.primary_theme) || 
        selectedSubThemes.includes(c.sub_theme)
      ) || [];
      
      relevantClusters.forEach((cluster) => {
        clusterContext += `\n${cluster.primary_theme} > ${cluster.sub_theme}:`;
        if (cluster.keywords && cluster.keywords.length > 0) {
          clusterContext += ` ${cluster.keywords.join(', ')}`;
        }
      });
      
      preview += clusterContext;
    }
    
    // Add target audience if professions are selected
    if (selectedProfessions.length > 0) {
      preview += "\n\nTARGET AUDIENCE:\n";
      preview += `Content should be relevant for: ${selectedProfessions.join(', ')}`;
    }
    
    // Add search parameters
    preview += "\n\nSEARCH PARAMETERS:";
    preview += `\n- Time Range: Content from the last ${searchRecency === 'day' ? '24 hours' : searchRecency}`;
    if (domainFilter !== 'auto') {
      preview += `\n- Domain Focus: Prioritize ${domainFilter} sources`;
    }
    
    // Add specific instructions for output format
    preview += "\n\nOUTPUT FORMAT:";
    preview += "\nReturn results in this JSON structure:";
    preview += "\n{";
    preview += "\n  \"articles\": [";
    preview += "\n    {";
    preview += "\n      \"title\": \"Article title\",";
    preview += "\n      \"url\": \"Article URL\",";
    preview += "\n      \"source\": \"Source name\",";
    preview += "\n      \"summary\": \"1-2 sentence summary\",";
    preview += "\n      \"relevance_score\": 0-100";
    preview += "\n    }";
    preview += "\n  ]";
    preview += "\n}";
    
    return preview;
  };
  
  // Generate final prompt for preview with query inserted
  const getFinalPrompt = () => {
    const preview = generatePreviewPrompt();
    // Insert the preview keyword where the user would normally put [QUERY]
    return preview.replace("[QUERY]", previewKeyword);
  };
  
  // Handle saving the prompt
  const handleSave = () => {
    if (!promptName || promptName.trim() === '') {
      toast.error("Please enter a valid prompt name");
      return;
    }

    setIsSaving(true);
    
    try {
      // Extract special fields for metadata
      const metadata = {
        search_settings: {
          domain_filter: domainFilter,
          recency_filter: searchRecency,
          temperature,
          max_tokens: maxTokens,
          is_news_search: true,
          selected_themes: {
            primary: selectedPrimaryThemes,
            sub: selectedSubThemes,
            professions: selectedProfessions
          }
        }
      };
      
      // Store metadata as JSON comment at top of prompt
      const metadataComment = `/*\n${JSON.stringify(metadata, null, 2)}\n*/\n`;
      const fullPromptText = metadataComment + promptText;
      
      const promptData = {
        function_name: promptName,
        model: model,
        prompt_text: fullPromptText,
        include_clusters: selectedPrimaryThemes.length > 0 || selectedSubThemes.length > 0,
        include_tracking_summary: useTrackingSummary,
        include_sources_map: useSourceMap,
        is_active: isActive
      };
      
      if (onSave) {
        onSave(promptData);
        toast.success(`Prompt ${initialPrompt ? "updated" : "created"} successfully!`);
      }
    } catch (error) {
      console.error("Error saving prompt:", error);
      toast.error("Failed to save prompt. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };
  
  const togglePrimaryTheme = (theme: string) => {
    if (selectedPrimaryThemes.includes(theme)) {
      setSelectedPrimaryThemes(selectedPrimaryThemes.filter(t => t !== theme));
      
      // Also remove any sub-themes that belong to this primary theme
      const subThemesToRemove = clusters
        ?.filter(c => c.primary_theme === theme)
        .map(c => c.sub_theme) || [];
        
      setSelectedSubThemes(selectedSubThemes.filter(s => !subThemesToRemove.includes(s)));
    } else {
      setSelectedPrimaryThemes([...selectedPrimaryThemes, theme]);
    }
  };
  
  const toggleSubTheme = (subTheme: string) => {
    if (selectedSubThemes.includes(subTheme)) {
      setSelectedSubThemes(selectedSubThemes.filter(t => t !== subTheme));
    } else {
      setSelectedSubThemes([...selectedSubThemes, subTheme]);
      
      // Also add the primary theme if not already added
      const cluster = clusters?.find(c => c.sub_theme === subTheme);
      if (cluster && !selectedPrimaryThemes.includes(cluster.primary_theme)) {
        setSelectedPrimaryThemes([...selectedPrimaryThemes, cluster.primary_theme]);
      }
    }
  };
  
  const toggleProfession = (profession: string) => {
    if (selectedProfessions.includes(profession)) {
      setSelectedProfessions(selectedProfessions.filter(p => p !== profession));
    } else {
      setSelectedProfessions([...selectedProfessions, profession]);
    }
  };
  
  // Extract metadata from initial prompt if present
  useEffect(() => {
    if (initialPrompt?.prompt_text) {
      const metadataMatch = initialPrompt.prompt_text.match(/\/\*\n([\s\S]*?)\n\*\//);
      if (metadataMatch) {
        try {
          const metadata = JSON.parse(metadataMatch[1]);
          if (metadata.search_settings) {
            setDomainFilter(metadata.search_settings.domain_filter || 'auto');
            setSearchRecency(metadata.search_settings.recency_filter || 'day');
            setTemperature(metadata.search_settings.temperature || 0.2);
            setMaxTokens(metadata.search_settings.max_tokens || 1000);
            
            if (metadata.search_settings.selected_themes) {
              setSelectedPrimaryThemes(metadata.search_settings.selected_themes.primary || []);
              setSelectedSubThemes(metadata.search_settings.selected_themes.sub || []);
              setSelectedProfessions(metadata.search_settings.selected_themes.professions || []);
            }
            
            // Remove metadata block from prompt text
            setPromptText(initialPrompt.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, ''));
          }
        } catch (e) {
          console.error("Error parsing metadata from prompt:", e);
        }
      }
    }
  }, [initialPrompt]);

  // Helper function to get model description
  const getModelDescription = (modelName: string) => {
    if (modelName.includes('sonar-small')) {
      return "Faster and more affordable. Good for routine searches.";
    } else if (modelName.includes('sonar-large')) {
      return "More powerful. Better for complex analysis and nuanced topics.";
    }
    return "";
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg font-medium">
          {initialPrompt ? "Edit News Search Prompt" : "Create News Search Prompt"}
        </CardTitle>
        <CardDescription>
          Build a smart prompt to find mortgage industry news without any technical placeholders
        </CardDescription>
      </CardHeader>
      
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="px-6">
          <TabsTrigger value="content">Prompt Content</TabsTrigger>
          <TabsTrigger value="clusters">Keywords & Themes</TabsTrigger>
          <TabsTrigger value="settings">Search Settings</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>
        
        <CardContent className="p-6">
          <TabsContent value="content" className="space-y-4 mt-0">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="promptName">Prompt Name</Label>
                  <Input 
                    id="promptName" 
                    value={promptName} 
                    onChange={e => setPromptName(e.target.value)}
                    placeholder="e.g., news_search_mortgage_rates" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a model" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llama-3.1-sonar-small-128k-online">Llama 3.1 Sonar Small with Search</SelectItem>
                      <SelectItem value="llama-3.1-sonar-large-128k-online">Llama 3.1 Sonar Large with Search</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {getModelDescription(model)}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="promptTemplate">
                  Base Instructions
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 inline-block ml-1 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p className="max-w-xs">
                          Write instructions for the search as if you're talking to an assistant. No need for [QUERY] placeholders!
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Label>
                <Textarea
                  id="promptTemplate"
                  value={promptText}
                  onChange={e => setPromptText(e.target.value)}
                  placeholder="You are an editorial assistant for MortgagePoint. Find relevant news articles about the following topic:"
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              
              <Alert className="bg-muted/50">
                <Info className="h-4 w-4" />
                <AlertTitle>No technical placeholders needed</AlertTitle>
                <AlertDescription>
                  The system will automatically understand what to search for based on your prompt and the selected keywords/clusters.
                </AlertDescription>
              </Alert>
            </div>
          </TabsContent>
          
          <TabsContent value="clusters" className="space-y-5 mt-0">
            {clustersLoading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading clusters...</p>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Primary Themes</Label>
                    <Badge variant="outline" className="font-normal">
                      {selectedPrimaryThemes.length} selected
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {Object.keys(primaryThemeGroups).map(theme => (
                      <Badge 
                        key={theme}
                        variant={selectedPrimaryThemes.includes(theme) ? "default" : "outline"}
                        className="cursor-pointer px-3 py-1 text-sm"
                        onClick={() => togglePrimaryTheme(theme)}
                      >
                        {selectedPrimaryThemes.includes(theme) && (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        {theme}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Sub-Themes</Label>
                    <Badge variant="outline" className="font-normal">
                      {selectedSubThemes.length} selected
                    </Badge>
                  </div>
                  
                  <ScrollArea className="h-48 rounded-md border">
                    <div className="p-4 space-y-4">
                      {Object.entries(primaryThemeGroups).map(([primaryTheme, themeClusters]) => (
                        <div key={primaryTheme} className="space-y-2">
                          <h4 className="text-sm font-medium">{primaryTheme}</h4>
                          <div className="flex flex-wrap gap-2 ml-2">
                            {themeClusters.map(cluster => (
                              <Badge
                                key={cluster.id}
                                variant={selectedSubThemes.includes(cluster.sub_theme) ? "secondary" : "outline"}
                                className="cursor-pointer"
                                onClick={() => toggleSubTheme(cluster.sub_theme)}
                              >
                                {selectedSubThemes.includes(cluster.sub_theme) && (
                                  <Check className="h-3 w-3 mr-1" />
                                )}
                                {cluster.sub_theme}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
                
                <Separator />
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Target Professions</Label>
                    <Badge variant="outline" className="font-normal">
                      {selectedProfessions.length} selected
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {allProfessions.map(profession => (
                      <Badge
                        key={profession}
                        variant={selectedProfessions.includes(profession) ? "secondary" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleProfession(profession)}
                      >
                        {selectedProfessions.includes(profession) && (
                          <Check className="h-3 w-3 mr-1" />
                        )}
                        {profession}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <Alert className="bg-muted/50">
                  <Folder className="h-4 w-4" />
                  <AlertTitle>How themes work</AlertTitle>
                  <AlertDescription>
                    Selection automatically includes related keywords in your search. The more specific your selection, the more targeted your results will be.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="settings" className="space-y-5 mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="searchRecency">Time Range</Label>
                <Select value={searchRecency} onValueChange={setSearchRecency}>
                  <SelectTrigger id="searchRecency">
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30m">30 minutes</SelectItem>
                    <SelectItem value="hour">Hour</SelectItem>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="year">Year</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  How recent should the articles be
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="domainFilter">Domain Focus</Label>
                <Select value={domainFilter} onValueChange={setDomainFilter}>
                  <SelectTrigger id="domainFilter">
                    <SelectValue placeholder="Select domain filter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatic</SelectItem>
                    <SelectItem value="finance">Finance & Business</SelectItem>
                    <SelectItem value="realestate">Real Estate</SelectItem>
                    <SelectItem value="news">News</SelectItem>
                    <SelectItem value="gov">Government</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  What type of websites to prioritize
                </p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="temperature">Creativity (Temperature)</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="temperature"
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    className="w-full"
                    value={temperature}
                    onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  />
                  <span className="w-10 text-sm">{temperature}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Lower values produce more focused results. Higher values are more creative.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxTokens">Response Length</Label>
                <Input
                  id="maxTokens"
                  type="range"
                  min="500"
                  max="3000"
                  step="100" 
                  className="w-full"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(parseInt(e.target.value))}
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Short ({maxTokens} tokens)</span>
                  <span>{Math.round(maxTokens/1000 * 10)/10}K</span>
                </div>
              </div>
            </div>
            
            <Separator />
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Include Tracking Summary</Label>
                  <p className="text-xs text-muted-foreground">
                    Add keyword tracking data to prompt context
                  </p>
                </div>
                <Switch
                  checked={useTrackingSummary}
                  onCheckedChange={setUseTrackingSummary}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Include Source Map</Label>
                  <p className="text-xs text-muted-foreground">
                    Add source tier mappings to prompt context
                  </p>
                </div>
                <Switch
                  checked={useSourceMap}
                  onCheckedChange={setUseSourceMap}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-base">Active</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable this prompt for scheduled tasks
                  </p>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="preview" className="mt-0">
            <div className="space-y-4">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="previewKeyword">
                    Test with this keyword
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 inline-block ml-1 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="max-w-xs">
                            Enter a term here to see how your prompt would handle it. This is for preview only and won't run an actual search.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </Label>
                  <Input
                    id="previewKeyword"
                    value={previewKeyword}
                    onChange={e => setPreviewKeyword(e.target.value)}
                    placeholder="e.g., mortgage refinancing"
                  />
                </div>
                <Button 
                  variant="outline" 
                  className="flex items-center gap-1"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? (
                    <>
                      <Edit className="h-4 w-4" />
                      <span>Show Template</span>
                    </>
                  ) : (
                    <>
                      <EyeIcon className="h-4 w-4" />
                      <span>Show Complete</span>
                    </>
                  )}
                </Button>
              </div>
              
              <div className="border rounded-md p-4">
                <ScrollArea className="h-96">
                  <pre className="whitespace-pre-wrap text-sm font-mono">
                    {showPreview ? getFinalPrompt() : generatePreviewPrompt()}
                  </pre>
                </ScrollArea>
              </div>
              
              {showPreview ? (
                <Alert>
                  <AlertTitle className="flex items-center gap-2">
                    <CircleHelp className="h-4 w-4" />
                    Complete prompt with "{previewKeyword}" inserted
                  </AlertTitle>
                  <AlertDescription>
                    This is how the complete prompt will look when used with your test keyword. In scheduled tasks, this keyword would be replaced with the one from your task.
                  </AlertDescription>
                </Alert>
              ) : (
                <Alert>
                  <AlertTitle className="flex items-center gap-2">
                    <CircleHelp className="h-4 w-4" />
                    Prompt template with [QUERY] placeholder
                  </AlertTitle>
                  <AlertDescription>
                    This is the template version of your prompt. Click "Show Complete" to see how it looks with your test keyword inserted.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>
        </CardContent>
      </Tabs>
      
      <CardFooter className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !promptName || promptName.trim() === ''}
        >
          {isSaving ? "Saving..." : initialPrompt ? "Update Prompt" : "Create Prompt"}
        </Button>
      </CardFooter>
    </Card>
  );
}
