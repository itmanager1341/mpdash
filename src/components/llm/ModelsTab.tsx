
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Settings, TestTube2, Search, DollarSign, Zap, Clock, CheckCircle, AlertCircle, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ModelTestingForm from "./ModelTestingForm";
import ModelConfigForm from "./ModelConfigForm";

interface EnhancedModel {
  id: string;
  name: string;
  provider: string;
  type: string;
  description: string;
  capabilities: string[];
  maxTokens: number;
  isAvailable: boolean;
  defaultSettings: Record<string, any>;
  costPer1MTokens?: {
    input: number;
    output: number;
  };
  avgResponseTime?: string;
  recommendedFor?: string[];
  contextWindow: number;
  speed: 'Fast' | 'Medium' | 'Slow';
  costTier: 'Budget' | 'Standard' | 'Premium';
}

export default function ModelsTab() {
  const [filterProvider, setFilterProvider] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedModel, setSelectedModel] = useState<EnhancedModel | null>(null);
  const [showTesting, setShowTesting] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Updated model data with current Perplexity pricing and naming
  const models: EnhancedModel[] = [
    {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "OpenAI",
      type: "Text + Vision",
      description: "Most capable GPT-4 model for complex reasoning and multimodal tasks",
      capabilities: ["text", "vision", "function-calling", "json-mode"],
      maxTokens: 4096,
      contextWindow: 128000,
      isAvailable: true,
      defaultSettings: { temperature: 0.7, topP: 1 },
      costPer1MTokens: { input: 2.50, output: 10.00 },
      avgResponseTime: "2-4s",
      speed: "Medium",
      costTier: "Premium",
      recommendedFor: ["Complex editorial analysis", "Multi-step reasoning", "Content generation with citations", "Vision + text analysis", "Function calling for data retrieval"]
    },
    {
      id: "gpt-4o-mini",
      name: "GPT-4o Mini",
      provider: "OpenAI",
      type: "Text + Vision",
      description: "Faster, more cost-effective version of GPT-4o",
      capabilities: ["text", "vision", "function-calling"],
      maxTokens: 4096,
      contextWindow: 128000,
      isAvailable: true,
      defaultSettings: { temperature: 0.7, topP: 1 },
      costPer1MTokens: { input: 0.15, output: 0.60 },
      avgResponseTime: "1-2s",
      speed: "Fast",
      costTier: "Budget",
      recommendedFor: ["Quick article summaries", "Simple content tasks", "High-volume operations", "Basic content analysis", "Fast content generation"]
    },
    {
      id: "text-embedding-3-small",
      name: "Text Embedding 3 Small",
      provider: "OpenAI",
      type: "Embeddings",
      description: "High-performance embedding model for semantic search and similarity",
      capabilities: ["embeddings", "semantic-search"],
      maxTokens: 0,
      contextWindow: 8191,
      isAvailable: true,
      defaultSettings: {},
      costPer1MTokens: { input: 0.02, output: 0 },
      avgResponseTime: "200-500ms",
      speed: "Fast",
      costTier: "Budget",
      recommendedFor: ["Content similarity analysis", "Semantic search", "Content clustering", "Related article detection", "Keyword matching"]
    },
    {
      id: "llama-3.1-sonar-small-128k-online",
      name: "Llama 3.1 Sonar Small Online",
      provider: "Perplexity",
      type: "Real-time Search",
      description: "8B parameter model with live internet search capabilities",
      capabilities: ["text", "real-time-search", "current-events"],
      maxTokens: 4096,
      contextWindow: 127072,
      isAvailable: true,
      defaultSettings: { temperature: 0.2, topP: 0.9 },
      costPer1MTokens: { input: 0.20, output: 0.20 },
      avgResponseTime: "3-8s",
      speed: "Medium",
      costTier: "Budget",
      recommendedFor: ["News research", "Current market trends", "Real-time competitor analysis", "Breaking news monitoring", "Quick fact-checking"]
    },
    {
      id: "llama-3.1-sonar-large-128k-online",
      name: "Llama 3.1 Sonar Large Online",
      provider: "Perplexity",
      type: "Real-time Search",
      description: "70B parameter model with comprehensive search capabilities",
      capabilities: ["text", "real-time-search", "analysis"],
      maxTokens: 4096,
      contextWindow: 127072,
      isAvailable: true,
      defaultSettings: { temperature: 0.2, topP: 0.9 },
      costPer1MTokens: { input: 1.00, output: 1.00 },
      avgResponseTime: "5-12s",
      speed: "Slow",
      costTier: "Standard",
      recommendedFor: ["Deep market research", "Complex trend analysis", "Comprehensive news synthesis", "Multi-source fact verification", "Industry intelligence gathering"]
    },
    {
      id: "llama-3.1-sonar-huge-128k-online",
      name: "Llama 3.1 Sonar Huge Online",
      provider: "Perplexity",
      type: "Real-time Search",
      description: "405B parameter model for the most demanding search and analysis tasks",
      capabilities: ["text", "real-time-search", "advanced-analysis"],
      maxTokens: 4096,
      contextWindow: 127072,
      isAvailable: true,
      defaultSettings: { temperature: 0.2, topP: 0.9 },
      costPer1MTokens: { input: 5.00, output: 5.00 },
      avgResponseTime: "8-20s",
      speed: "Slow",
      costTier: "Premium",
      recommendedFor: ["Executive-level research", "Strategic market analysis", "Complex regulatory research", "Multi-layered industry investigations", "High-stakes content verification"]
    },
    {
      id: "claude-3-5-sonnet",
      name: "Claude 3.5 Sonnet",
      provider: "Anthropic",
      type: "Text + Vision",
      description: "Balanced model with strong reasoning capabilities",
      capabilities: ["text", "vision", "analysis", "long-context"],
      maxTokens: 4096,
      contextWindow: 200000,
      isAvailable: false,
      defaultSettings: { temperature: 0.7 },
      costPer1MTokens: { input: 3.00, output: 15.00 },
      avgResponseTime: "3-6s",
      speed: "Medium",
      costTier: "Premium",
      recommendedFor: ["Long-form editorial analysis", "Document synthesis", "Complex reasoning tasks", "Research paper analysis", "Multi-document comparison"]
    }
  ];

  // Check if API keys are available for each provider
  const { data: apiKeys, isLoading: isLoadingKeys } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('api-keys', {
          body: { operation: 'list' }
        });
        
        if (error) throw error;
        return data.keys || [];
      } catch (error) {
        console.error("Error fetching API keys:", error);
        return [];
      }
    }
  });

  // Check if a provider has an active API key
  const hasActiveKey = (providerName: string): boolean => {
    if (isLoadingKeys || !apiKeys) return false;
    return apiKeys.some(key => 
      key.service.toLowerCase() === providerName.toLowerCase() && key.is_active
    );
  };

  // Filter and sort models
  const filteredModels = models
    .filter(model => {
      const matchesProvider = filterProvider === "all" || model.provider.toLowerCase() === filterProvider.toLowerCase();
      const matchesType = filterType === "all" || model.type.toLowerCase().includes(filterType.toLowerCase());
      const matchesSearch = searchTerm === "" || 
        model.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        model.recommendedFor?.some(use => use.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchesProvider && matchesType && matchesSearch;
    })
    .sort((a, b) => {
      let aValue, bValue;
      
      switch (sortBy) {
        case "cost":
          aValue = a.costPer1MTokens?.input || 0;
          bValue = b.costPer1MTokens?.input || 0;
          break;
        case "speed":
          const speedOrder = { "Fast": 1, "Medium": 2, "Slow": 3 };
          aValue = speedOrder[a.speed];
          bValue = speedOrder[b.speed];
          break;
        case "tokens":
          aValue = a.contextWindow;
          bValue = b.contextWindow;
          break;
        default:
          aValue = a.name;
          bValue = b.name;
      }
      
      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

  const providers = [...new Set(models.map(m => m.provider))];
  const types = [...new Set(models.map(m => m.type))];

  const handleTest = (model: EnhancedModel) => {
    setSelectedModel(model);
    setShowTesting(true);
  };

  const handleConfigure = (model: EnhancedModel) => {
    setSelectedModel(model);
    setShowConfig(true);
  };

  const getCostTierColor = (tier: string) => {
    switch (tier) {
      case "Budget": return "bg-green-100 text-green-800";
      case "Standard": return "bg-blue-100 text-blue-800";
      case "Premium": return "bg-purple-100 text-purple-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getSpeedIcon = (speed: string) => {
    switch (speed) {
      case "Fast": return <Zap className="h-4 w-4 text-green-600" />;
      case "Medium": return <Clock className="h-4 w-4 text-yellow-600" />;
      case "Slow": return <Clock className="h-4 w-4 text-red-600" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div>
            <h2 className="text-2xl font-bold">AI Models</h2>
            <p className="text-muted-foreground">Compare and manage AI models with real-time pricing and performance data</p>
          </div>
          <Button 
            onClick={() => {
              toast.info("API keys management", {
                description: "Configure API keys in the API Keys tab.",
              });
            }}
            variant="outline"
          >
            <Settings className="mr-2 h-4 w-4" />
            Manage API Keys
          </Button>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Filter & Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search models..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filterProvider} onValueChange={setFilterProvider}>
                <SelectTrigger>
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  {providers.map(provider => (
                    <SelectItem key={provider} value={provider.toLowerCase()}>{provider}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {types.map(type => (
                    <SelectItem key={type} value={type.toLowerCase()}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger>
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Name</SelectItem>
                  <SelectItem value="cost">Cost</SelectItem>
                  <SelectItem value="speed">Speed</SelectItem>
                  <SelectItem value="tokens">Context Size</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'} Sort
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Models Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Model</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Cost/1M Tokens</TableHead>
                  <TableHead>Speed</TableHead>
                  <TableHead>Best For</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredModels.map((model) => {
                  const hasKey = hasActiveKey(model.provider);
                  
                  return (
                    <TableRow key={model.id} className={!hasKey ? "opacity-70" : ""}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{model.name}</div>
                          <div className="text-sm text-muted-foreground max-w-xs">{model.description}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{model.provider}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{model.type}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {model.contextWindow.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {model.costPer1MTokens ? (
                            <>
                              <div className="text-sm">
                                <span className="text-muted-foreground">In:</span> ${model.costPer1MTokens.input}
                              </div>
                              {model.costPer1MTokens.output > 0 && (
                                <div className="text-sm">
                                  <span className="text-muted-foreground">Out:</span> ${model.costPer1MTokens.output}
                                </div>
                              )}
                              <Badge className={getCostTierColor(model.costTier)} variant="outline">
                                {model.costTier}
                              </Badge>
                            </>
                          ) : (
                            <span className="text-muted-foreground">N/A</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getSpeedIcon(model.speed)}
                          <span className="text-sm">{model.avgResponseTime}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="space-y-1 max-w-40">
                              {model.recommendedFor?.slice(0, 2).map((use, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs mr-1">
                                  {use.length > 20 ? `${use.substring(0, 20)}...` : use}
                                </Badge>
                              ))}
                              {(model.recommendedFor?.length || 0) > 2 && (
                                <div className="text-xs text-muted-foreground flex items-center gap-1">
                                  +{(model.recommendedFor?.length || 0) - 2} more
                                  <Info className="h-3 w-3" />
                                </div>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="left" className="max-w-sm">
                            <div className="space-y-1">
                              <p className="font-semibold">Best for:</p>
                              <ul className="text-sm space-y-1">
                                {model.recommendedFor?.map((use, idx) => (
                                  <li key={idx}>• {use}</li>
                                ))}
                              </ul>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {hasKey ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <AlertCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className="text-sm">
                            {hasKey ? "Available" : "No API Key"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConfigure(model)}
                            disabled={!hasKey}
                          >
                            <Settings className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handleTest(model)}
                            disabled={!hasKey}
                          >
                            <TestTube2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {filteredModels.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No models found matching your criteria
              </div>
            )}
          </CardContent>
        </Card>

        {/* Testing Modal */}
        {showTesting && selectedModel && (
          <ModelTestingForm
            model={selectedModel}
            open={showTesting}
            onOpenChange={setShowTesting}
          />
        )}

        {/* Configuration Modal */}
        {showConfig && selectedModel && (
          <ModelConfigForm
            model={selectedModel}
            open={showConfig}
            onOpenChange={setShowConfig}
          />
        )}
      </div>
    </TooltipProvider>
  );
}
