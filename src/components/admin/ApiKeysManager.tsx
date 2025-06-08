
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, KeyRound } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ApiKeysTable } from "./ApiKeysTable";

export default function ApiKeysManager() {
  const [isCollapsibleOpen, setIsCollapsibleOpen] = useState(true);

  // Use React Query to fetch API keys
  const { 
    data: apiKeys = [], 
    isLoading: isFetching, 
    error: fetchError, 
    refetch: refetchApiKeys 
  } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.functions.invoke('api-keys', {
          body: { operation: 'list' }
        });
        
        if (error) throw new Error(error.message);
        return data.keys || [];
      } catch (error) {
        console.error("Error fetching API keys:", error);
        throw error;
      }
    },
    refetchOnWindowFocus: false
  });

  // Create a wrapper function that returns Promise<void>
  const fetchApiKeys = async (): Promise<void> => {
    await refetchApiKeys();
    return;
  };

  // Get stats for the header
  const activeKeys = apiKeys.filter(key => key.is_active).length;
  const totalServices = new Set(apiKeys.map(key => key.service)).size;

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
              <div className="flex gap-2 ml-4">
                <Badge variant="secondary">{activeKeys} Active</Badge>
                <Badge variant="outline">{totalServices} Services</Badge>
              </div>
            </div>
            <span>{isCollapsibleOpen ? <ChevronUp /> : <ChevronDown />}</span>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="p-6 bg-card">
          {fetchError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Error fetching API keys</AlertTitle>
              <AlertDescription>
                {fetchError instanceof Error ? fetchError.message : 'Unknown error'}
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => fetchApiKeys()} 
                  className="ml-2"
                >
                  Try Again
                </Button>
              </AlertDescription>
            </Alert>
          )}
          
          <Card>
            <CardHeader>
              <CardTitle>Manage API Keys</CardTitle>
              <CardDescription>
                Configure API keys for various services. Costs are shown as estimates - check provider documentation for current pricing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ApiKeysTable 
                apiKeys={apiKeys}
                isLoading={isFetching}
                onRefresh={fetchApiKeys}
              />
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
