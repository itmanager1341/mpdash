
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PlusCircle, Settings, TestTube2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import ModelTestingForm from "./ModelTestingForm";
import ModelConfigForm from "./ModelConfigForm";
import { Skeleton } from "@/components/ui/skeleton";

interface ModelProvider {
  name: string;
  models: Model[];
}

interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
  capabilities: string[];
  maxTokens: number;
  isAvailable: boolean;
  defaultSettings: Record<string, any>;
}

export default function ModelsTab() {
  const [selectedProvider, setSelectedProvider] = useState("all");
  const [isAddingConfig, setIsAddingConfig] = useState(false);
  const [showTesting, setShowTesting] = useState(false);
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  
  // Mock data for now - in a real implementation this would come from the database
  const providers: ModelProvider[] = [
    {
      name: "openai",
      models: [
        {
          id: "gpt-4o",
          name: "GPT-4o",
          provider: "openai",
          description: "Most capable GPT-4 model for text and vision tasks",
          capabilities: ["text", "vision", "function-calling"],
          maxTokens: 128000,
          isAvailable: true,
          defaultSettings: { temperature: 0.7, topP: 1 }
        },
        {
          id: "gpt-4o-mini",
          name: "GPT-4o Mini",
          provider: "openai",
          description: "Smaller, faster and cheaper version of GPT-4o",
          capabilities: ["text", "vision"],
          maxTokens: 128000,
          isAvailable: true,
          defaultSettings: { temperature: 0.7, topP: 1 }
        }
      ]
    },
    {
      name: "perplexity",
      models: [
        {
          id: "llama-3.1-sonar-small-128k-online",
          name: "Llama 3.1 Sonar Small",
          provider: "perplexity",
          description: "8B parameter model with online search capabilities",
          capabilities: ["text", "search"],
          maxTokens: 127072,
          isAvailable: true,
          defaultSettings: { temperature: 0.2, topP: 0.9 }
        },
        {
          id: "llama-3.1-sonar-large-128k-online",
          name: "Llama 3.1 Sonar Large",
          provider: "perplexity",
          description: "70B parameter model with online search capabilities",
          capabilities: ["text", "search"],
          maxTokens: 127072,
          isAvailable: true,
          defaultSettings: { temperature: 0.2, topP: 0.9 }
        }
      ]
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

  const handleModelSelect = (model: Model) => {
    setSelectedModel(model);
    setShowTesting(true);
  };

  const handleConfigureModel = (model: Model) => {
    setSelectedModel(model);
    setIsAddingConfig(true);
  };

  // Filter models based on selected provider
  const filteredModels = providers.flatMap(provider => 
    selectedProvider === "all" || provider.name === selectedProvider 
      ? provider.models
      : []
  );

  // Check if a provider has an active API key
  const hasActiveKey = (providerName: string): boolean => {
    if (isLoadingKeys || !apiKeys) return false;
    return apiKeys.some(key => 
      key.service.toLowerCase() === providerName.toLowerCase() && key.is_active
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4 mb-6">
        <Tabs 
          value={selectedProvider} 
          onValueChange={setSelectedProvider}
          className="w-full sm:w-auto"
        >
          <TabsList>
            <TabsTrigger value="all">All Providers</TabsTrigger>
            {providers.map(provider => (
              <TabsTrigger 
                key={provider.name} 
                value={provider.name}
                className="flex items-center gap-2"
              >
                {provider.name.charAt(0).toUpperCase() + provider.name.slice(1)}
                {hasActiveKey(provider.name) ? (
                  <Badge className="bg-green-100 text-green-800 ml-1">Active</Badge>
                ) : (
                  <Badge variant="outline" className="ml-1">No Key</Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <Button 
          onClick={() => {
            toast.info("API keys management", {
              description: "Please configure API keys in the Admin Settings.",
              action: {
                label: "Go to Admin Settings",
                onClick: () => window.location.href = "/admin-settings"
              }
            });
          }}
          variant="outline"
          className="whitespace-nowrap"
        >
          <Settings className="mr-2 h-4 w-4" />
          API Keys
        </Button>
      </div>

      {isLoadingKeys ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-16 w-full mb-4" />
                <div className="flex justify-between">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredModels.map(model => {
            const hasKey = hasActiveKey(model.provider);
            
            return (
              <Card key={model.id} className={!hasKey ? "opacity-70" : undefined}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex justify-between items-center">
                    {model.name}
                    <Badge>{model.provider}</Badge>
                  </CardTitle>
                  <CardDescription>{model.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {model.capabilities.map(capability => (
                        <Badge key={capability} variant="outline">
                          {capability}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Max tokens: {model.maxTokens.toLocaleString()}
                    </p>
                  </div>
                  <div className="flex justify-between mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleConfigureModel(model)}
                      disabled={!hasKey}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Configure
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleModelSelect(model)}
                      disabled={!hasKey}
                    >
                      <TestTube2 className="mr-2 h-4 w-4" />
                      Test
                    </Button>
                  </div>
                  {!hasKey && (
                    <p className="text-xs text-amber-600 mt-2">
                      API key required. Configure in Admin Settings.
                    </p>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {showTesting && selectedModel && (
        <ModelTestingForm
          model={selectedModel}
          open={showTesting}
          onOpenChange={setShowTesting}
        />
      )}

      {isAddingConfig && selectedModel && (
        <ModelConfigForm
          model={selectedModel}
          open={isAddingConfig}
          onOpenChange={setIsAddingConfig}
        />
      )}
    </div>
  );
}
