
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ChevronUp, ChevronDown, KeyRound } from "lucide-react";
import ApiKeyForm from "./ApiKeyForm";
import ApiKeysList, { ApiKey } from "./ApiKeysList";
import ApiKeyTester from "./ApiKeyTester";

export default function ApiKeysManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(true);
  const [selectedService, setSelectedService] = useState("perplexity");

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    setIsFetching(true);
    try {
      console.log("Fetching API keys...");
      // Call the edge function to get API keys
      const { data, error } = await supabase.functions.invoke('list-api-keys', {});
      
      if (error) {
        console.error("Error fetching API keys:", error);
        toast.error(`Error fetching API keys: ${error.message}`);
        return;
      }
      
      if (data && Array.isArray(data.keys)) {
        setApiKeys(data.keys);
      } else {
        console.warn("No keys found or invalid response format:", data);
        setApiKeys([]);
      }
    } catch (error) {
      console.error("Exception when fetching API keys:", error);
      toast.error(`Failed to fetch API keys: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFetching(false);
    }
  };

  const serviceHasKey = (service: string): boolean => {
    return apiKeys.some(key => key.service.toLowerCase() === service.toLowerCase() && key.is_active);
  };
  
  const getServiceKeyCount = (service: string): number => {
    return apiKeys.filter(key => key.service.toLowerCase() === service.toLowerCase()).length;
  };

  return (
    <div className="space-y-6">
      <Collapsible 
        open={isCollapsibleOpen} 
        onOpenChange={setIsCollapsibleOpen} 
        className="w-full border rounded-lg overflow-hidden"
      >
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="flex w-full justify-between p-4 rounded-none border-0 hover:bg-accent/20">
            <div className="flex items-center">
              <KeyRound className="mr-2 h-5 w-5" />
              <h3 className="text-xl font-semibold">API Keys Management</h3>
            </div>
            <span>{isCollapsibleOpen ? <ChevronUp /> : <ChevronDown />}</span>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="p-6 bg-card">
          <Tabs defaultValue="perplexity" onValueChange={setSelectedService} className="w-full">
            <TabsList className="mb-6 w-full justify-start">
              <TabsTrigger value="perplexity" className="relative">
                Perplexity
                {serviceHasKey("perplexity") && (
                  <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">Active</Badge>
                )}
                {getServiceKeyCount("perplexity") > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                    {getServiceKeyCount("perplexity")}
                  </span>
                )}
              </TabsTrigger>
              
              <TabsTrigger value="openai" className="relative">
                OpenAI
                {serviceHasKey("openai") && (
                  <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">Active</Badge>
                )}
                {getServiceKeyCount("openai") > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                    {getServiceKeyCount("openai")}
                  </span>
                )}
              </TabsTrigger>
              
              <TabsTrigger value="fred" className="relative">
                FRED API
                {serviceHasKey("fred") && (
                  <Badge className="ml-2 bg-green-100 text-green-800 border-green-200">Active</Badge>
                )}
                {getServiceKeyCount("fred") > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                    {getServiceKeyCount("fred")}
                  </span>
                )}
              </TabsTrigger>
              
              <TabsTrigger value="other" className="relative">
                Other Services
                {getServiceKeyCount("hubspot") + getServiceKeyCount("other") > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white rounded-full w-5 h-5 text-xs flex items-center justify-center">
                    {getServiceKeyCount("hubspot") + getServiceKeyCount("other")}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="perplexity" className="space-y-6">
              <ApiKeyTester service="perplexity" />
              <ApiKeyForm onSuccess={fetchApiKeys} />
              <ApiKeysList 
                apiKeys={apiKeys.filter(key => key.service.toLowerCase() === "perplexity")}
                isLoading={isFetching}
                onRefresh={fetchApiKeys}
              />
            </TabsContent>
            
            <TabsContent value="openai" className="space-y-6">
              <ApiKeyTester service="openai" />
              <ApiKeyForm onSuccess={fetchApiKeys} />
              <ApiKeysList 
                apiKeys={apiKeys.filter(key => key.service.toLowerCase() === "openai")}
                isLoading={isFetching}
                onRefresh={fetchApiKeys}
              />
            </TabsContent>
            
            <TabsContent value="fred" className="space-y-6">
              <ApiKeyTester service="fred" />
              <ApiKeyForm onSuccess={fetchApiKeys} />
              <ApiKeysList 
                apiKeys={apiKeys.filter(key => key.service.toLowerCase() === "fred")}
                isLoading={isFetching}
                onRefresh={fetchApiKeys}
              />
            </TabsContent>
            
            <TabsContent value="other" className="space-y-6">
              <ApiKeyForm onSuccess={fetchApiKeys} />
              <ApiKeysList 
                apiKeys={apiKeys.filter(key => 
                  !["perplexity", "openai", "fred"].includes(key.service.toLowerCase())
                )}
                isLoading={isFetching}
                onRefresh={fetchApiKeys}
              />
            </TabsContent>
          </Tabs>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
