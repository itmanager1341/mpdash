
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AdminSettings = () => {
  const [openAIKey, setOpenAIKey] = useState("");
  const [perplexityKey, setPerplexityKey] = useState("");
  const [fredApiKey, setFredApiKey] = useState("");

  const { data: secrets, isLoading } = useQuery({
    queryKey: ['supabaseSecrets'],
    queryFn: async () => {
      // In a real implementation, we would fetch the existence of secrets
      // Here we're simulating that data since we can't access the actual secret values
      return {
        OPENAI_API_KEY: true,
        PERPLEXITY_API_KEY: false,
        FRED_API_KEY: true
      };
    }
  });

  const handleSaveApiKey = async (keyName: string, keyValue: string) => {
    if (!keyValue.trim()) {
      toast.error("API key cannot be empty");
      return;
    }

    try {
      // In a real implementation, we would call a Supabase Edge Function to securely store the API key
      toast.success(`${keyName} saved successfully`);
      
      // Reset the input field
      switch (keyName) {
        case "OpenAI API Key":
          setOpenAIKey("");
          break;
        case "Perplexity API Key":
          setPerplexityKey("");
          break;
        case "FRED API Key":
          setFredApiKey("");
          break;
      }
    } catch (error) {
      console.error("Error saving API key:", error);
      toast.error(`Failed to save ${keyName}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Settings</h1>
        <p className="text-muted-foreground">
          Configure system settings and manage API connections
        </p>
      </div>

      <Tabs defaultValue="api-keys">
        <TabsList className="mb-6">
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="keyword-clusters">Keyword Clusters</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="users">User Management</TabsTrigger>
        </TabsList>
        
        <TabsContent value="api-keys">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>OpenAI API Configuration</CardTitle>
                <CardDescription>
                  Configure the OpenAI API for article generation and enrichment
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="openai-key">OpenAI API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      id="openai-key" 
                      type="password" 
                      placeholder={secrets?.OPENAI_API_KEY ? "••••••••••••••••••••••" : "Enter OpenAI API Key"} 
                      value={openAIKey}
                      onChange={(e) => setOpenAIKey(e.target.value)}
                    />
                    <Button onClick={() => handleSaveApiKey("OpenAI API Key", openAIKey)}>
                      {secrets?.OPENAI_API_KEY ? "Update" : "Save"}
                    </Button>
                  </div>
                  {secrets?.OPENAI_API_KEY && (
                    <p className="text-xs text-green-600">✓ API key configured</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Perplexity API Configuration</CardTitle>
                <CardDescription>
                  Configure the Perplexity API for trend analysis
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="perplexity-key">Perplexity API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      id="perplexity-key" 
                      type="password" 
                      placeholder={secrets?.PERPLEXITY_API_KEY ? "••••••••••••••••••••••" : "Enter Perplexity API Key"} 
                      value={perplexityKey}
                      onChange={(e) => setPerplexityKey(e.target.value)}
                    />
                    <Button onClick={() => handleSaveApiKey("Perplexity API Key", perplexityKey)}>
                      {secrets?.PERPLEXITY_API_KEY ? "Update" : "Save"}
                    </Button>
                  </div>
                  {secrets?.PERPLEXITY_API_KEY ? (
                    <p className="text-xs text-green-600">✓ API key configured</p>
                  ) : (
                    <p className="text-xs text-amber-600">! API key not configured</p>
                  )}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>FRED API Configuration</CardTitle>
                <CardDescription>
                  Configure the FRED API for economic data integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="fred-key">FRED API Key</Label>
                  <div className="flex items-center gap-2">
                    <Input 
                      id="fred-key" 
                      type="password" 
                      placeholder={secrets?.FRED_API_KEY ? "••••••••••••••••••••••" : "Enter FRED API Key"} 
                      value={fredApiKey}
                      onChange={(e) => setFredApiKey(e.target.value)}
                    />
                    <Button onClick={() => handleSaveApiKey("FRED API Key", fredApiKey)}>
                      {secrets?.FRED_API_KEY ? "Update" : "Save"}
                    </Button>
                  </div>
                  {secrets?.FRED_API_KEY && (
                    <p className="text-xs text-green-600">✓ API key configured</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="keyword-clusters">
          <Card>
            <CardHeader>
              <CardTitle>Keyword Cluster Management</CardTitle>
              <CardDescription>
                Manage keyword clusters for content categorization
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Keyword cluster management interface to be implemented.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="sources">
          <Card>
            <CardHeader>
              <CardTitle>Sources Management</CardTitle>
              <CardDescription>
                Manage external content sources and priority tiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Sources management interface to be implemented.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user roles and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                User management interface to be implemented.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default AdminSettings;
