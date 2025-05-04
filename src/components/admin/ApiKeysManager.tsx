
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle, CheckCircle, Loader2 } from "lucide-react";

type ApiKey = {
  id: string;
  name: string;
  key_masked: string;
  service: string;
  is_active: boolean;
}

type AiPromptTemplate = {
  id: string;
  name: string;
  template: string;
  usage: string;
}

export default function ApiKeysManager() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [promptTemplates, setPromptTemplates] = useState<AiPromptTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyService, setNewKeyService] = useState("perplexity");
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptTemplate, setNewPromptTemplate] = useState("");
  const [newPromptUsage, setNewPromptUsage] = useState("news_analysis");
  const [isOpenKeys, setIsOpenKeys] = useState(true);
  const [isOpenPrompts, setIsOpenPrompts] = useState(true);
  const [isEdgeFunctionTested, setIsEdgeFunctionTested] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string} | null>(null);

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
      
      console.log("API keys response:", data);
      
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

  const handleAddApiKey = async () => {
    if (!newKeyName || !newKeyValue || !newKeyService) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsLoading(true);
    try {
      console.log("Adding new API key...");
      // Call edge function to store the API key
      const { data, error } = await supabase.functions.invoke('set-api-key', {
        body: {
          name: newKeyName,
          key: newKeyValue,
          service: newKeyService
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      console.log("API key added response:", data);
      
      if (!data?.success) {
        throw new Error(data?.message || "Unknown error occurred");
      }

      // Refresh the list of API keys
      await fetchApiKeys();
      
      setNewKeyName("");
      setNewKeyValue("");
      toast.success("API key added successfully");
    } catch (error) {
      console.error("Error adding API key:", error);
      toast.error(`Failed to add API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteApiKey = async (keyId: string) => {
    try {
      // Call edge function to delete the API key
      const { error } = await supabase.functions.invoke('delete-api-key', {
        body: { id: keyId }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Refresh the list of API keys
      await fetchApiKeys();
      toast.success("API key deleted successfully");
    } catch (error) {
      console.error("Error deleting API key:", error);
      toast.error("Failed to delete API key");
    }
  };

  const handleToggleKeyStatus = async (keyId: string, currentStatus: boolean) => {
    try {
      // Call edge function to toggle the API key status
      const { error } = await supabase.functions.invoke('toggle-api-key-status', {
        body: { 
          id: keyId,
          is_active: !currentStatus 
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Refresh the list of API keys
      await fetchApiKeys();
      toast.success(`API key ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
    } catch (error) {
      console.error("Error toggling API key status:", error);
      toast.error("Failed to update API key status");
    }
  };

  const testPerplexityApiKey = async () => {
    setIsLoading(true);
    try {
      // Call the edge function to test the Perplexity API key
      const { data, error } = await supabase.functions.invoke('test-perplexity-key', {});
      
      if (error) {
        throw new Error(error.message);
      }
      
      setTestResult({
        success: data.success,
        message: data.message
      });
      
      setIsEdgeFunctionTested(true);
      
      if (data.success) {
        toast.success("Perplexity API key is working correctly!");
      } else {
        toast.error(`API key test failed: ${data.message}`);
      }
    } catch (error) {
      console.error("Error testing API key:", error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      });
      toast.error("Failed to test API key");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPromptTemplate = () => {
    if (!newPromptName || !newPromptTemplate || !newPromptUsage) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsLoading(true);
    try {
      const newTemplate = {
        id: Date.now().toString(),
        name: newPromptName,
        template: newPromptTemplate,
        usage: newPromptUsage
      };
      
      setPromptTemplates([...promptTemplates, newTemplate]);
      setNewPromptName("");
      setNewPromptTemplate("");
      toast.success("Prompt template added successfully");
    } catch (error) {
      console.error("Error adding prompt template:", error);
      toast.error("Failed to add prompt template");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Collapsible open={isOpenKeys} onOpenChange={setIsOpenKeys} className="w-full">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="flex w-full justify-between p-4 rounded-md bg-muted/50">
            <h3 className="text-xl font-semibold">API Keys Management</h3>
            <span>{isOpenKeys ? "↑" : "↓"}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Add New API Key</CardTitle>
              <CardDescription>
                Add API keys for external services like Perplexity, OpenAI, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    placeholder="Perplexity API"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="key-service">Service</Label>
                  <Select value={newKeyService} onValueChange={setNewKeyService}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select service" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="perplexity">Perplexity</SelectItem>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="fred">FRED API</SelectItem>
                      <SelectItem value="hubspot">HubSpot</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="key-value">API Key</Label>
                  <Input
                    id="key-value"
                    type="password"
                    placeholder="Your API key"
                    value={newKeyValue}
                    onChange={(e) => setNewKeyValue(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col sm:flex-row gap-2">
              <Button 
                onClick={handleAddApiKey} 
                disabled={isLoading || !newKeyName || !newKeyValue}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : "Add API Key"}
              </Button>
              
              {newKeyService === "perplexity" && (
                <Button
                  onClick={testPerplexityApiKey}
                  variant="outline"
                  disabled={isLoading}
                >
                  {isLoading && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Test Perplexity Connection
                </Button>
              )}
            </CardFooter>
          </Card>

          {isEdgeFunctionTested && testResult && (
            <div className={`mt-4 p-4 rounded-md border ${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-start">
                {testResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5" />
                )}
                <div>
                  <h4 className={`font-medium ${testResult.success ? 'text-green-700' : 'text-red-700'}`}>
                    {testResult.success ? 'API Key Test Successful' : 'API Key Test Failed'}
                  </h4>
                  <p className={`text-sm ${testResult.success ? 'text-green-600' : 'text-red-600'}`}>
                    {testResult.message}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mt-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-medium">Stored API Keys</h4>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={fetchApiKeys}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : "Refresh"}
              </Button>
            </div>
            
            {isFetching ? (
              <div className="flex justify-center items-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : apiKeys.length > 0 ? (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-4 border rounded-md">
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-sm text-muted-foreground">Service: {key.service}</p>
                      <p className="text-sm text-muted-foreground">Key: {key.key_masked}</p>
                    </div>
                    <div className="flex gap-2">
                      <Checkbox 
                        checked={key.is_active} 
                        onCheckedChange={() => handleToggleKeyStatus(key.id, key.is_active)}
                      />
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={() => handleDeleteApiKey(key.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center p-4 border rounded-md">No API keys added yet</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={isOpenPrompts} onOpenChange={setIsOpenPrompts} className="w-full">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="flex w-full justify-between p-4 rounded-md bg-muted/50">
            <h3 className="text-xl font-semibold">AI Prompt Templates</h3>
            <span>{isOpenPrompts ? "↑" : "↓"}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Add Prompt Template</CardTitle>
              <CardDescription>
                Create reusable AI prompt templates for different use cases
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="prompt-name">Template Name</Label>
                    <Input
                      id="prompt-name"
                      placeholder="News Summary"
                      value={newPromptName}
                      onChange={(e) => setNewPromptName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="prompt-usage">Usage</Label>
                    <Select value={newPromptUsage} onValueChange={setNewPromptUsage}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select usage" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="news_analysis">News Analysis</SelectItem>
                        <SelectItem value="content_generation">Content Generation</SelectItem>
                        <SelectItem value="keyword_extraction">Keyword Extraction</SelectItem>
                        <SelectItem value="article_suggestion">Article Suggestion</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prompt-template">Prompt Template</Label>
                  <Textarea
                    id="prompt-template"
                    placeholder="You are an expert financial journalist analyzing mortgage industry news. Summarize the following article and highlight key trends relevant to mortgage professionals: {{placeholder}}"
                    className="min-h-32"
                    value={newPromptTemplate}
                    onChange={(e) => setNewPromptTemplate(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Use {"{{"}{`placeholder`}{"}}"} for dynamic content
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleAddPromptTemplate} 
                disabled={isLoading || !newPromptName || !newPromptTemplate}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : "Add Template"}
              </Button>
            </CardFooter>
          </Card>

          <div className="mt-6">
            <h4 className="text-lg font-medium mb-4">Saved Prompt Templates</h4>
            {promptTemplates.length > 0 ? (
              <div className="space-y-4">
                {promptTemplates.map((template) => (
                  <div key={template.id} className="p-4 border rounded-md">
                    <div className="flex justify-between items-start">
                      <div>
                        <h5 className="font-medium">{template.name}</h5>
                        <p className="text-sm text-muted-foreground">Usage: {template.usage}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Edit</Button>
                        <Button variant="destructive" size="sm">Delete</Button>
                      </div>
                    </div>
                    <p className="mt-2 text-sm border-t pt-2">{template.template}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center p-4 border rounded-md">No prompt templates added yet</p>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
