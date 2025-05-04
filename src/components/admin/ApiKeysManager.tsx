
import { useState } from "react";
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";

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
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyValue, setNewKeyValue] = useState("");
  const [newKeyService, setNewKeyService] = useState("perplexity");
  const [newPromptName, setNewPromptName] = useState("");
  const [newPromptTemplate, setNewPromptTemplate] = useState("");
  const [newPromptUsage, setNewPromptUsage] = useState("news_analysis");
  const [isOpenKeys, setIsOpenKeys] = useState(true);
  const [isOpenPrompts, setIsOpenPrompts] = useState(true);

  // Fetch API keys and prompt templates would go here in a real implementation
  // useEffect(() => { fetchApiKeys(); fetchPromptTemplates(); }, []);

  const handleAddApiKey = async () => {
    if (!newKeyName || !newKeyValue || !newKeyService) {
      toast.error("Please fill all required fields");
      return;
    }

    setIsLoading(true);
    try {
      // In a real implementation, this would be stored in Supabase or in env vars
      // For this demo, we'd just update the state
      const maskedKey = newKeyValue.substring(0, 3) + "..." + newKeyValue.substring(newKeyValue.length - 4);
      const newKey = {
        id: Date.now().toString(),
        name: newKeyName,
        key_masked: maskedKey,
        service: newKeyService,
        is_active: true
      };
      
      setApiKeys([...apiKeys, newKey]);
      setNewKeyName("");
      setNewKeyValue("");
      toast.success("API key added successfully");
    } catch (error) {
      console.error("Error adding API key:", error);
      toast.error("Failed to add API key");
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
            <CardFooter>
              <Button 
                onClick={handleAddApiKey} 
                disabled={isLoading || !newKeyName || !newKeyValue}
              >
                {isLoading ? "Adding..." : "Add API Key"}
              </Button>
            </CardFooter>
          </Card>

          <div className="mt-6">
            <h4 className="text-lg font-medium mb-4">Stored API Keys</h4>
            {apiKeys.length > 0 ? (
              <div className="space-y-2">
                {apiKeys.map((key) => (
                  <div key={key.id} className="flex items-center justify-between p-4 border rounded-md">
                    <div>
                      <p className="font-medium">{key.name}</p>
                      <p className="text-sm text-muted-foreground">Service: {key.service}</p>
                      <p className="text-sm text-muted-foreground">Key: {key.key_masked}</p>
                    </div>
                    <div className="flex gap-2">
                      <Checkbox checked={key.is_active} />
                      <Button variant="outline" size="sm">Edit</Button>
                      <Button variant="destructive" size="sm">Delete</Button>
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
                    Use {"{{"}"placeholder{"}}}"} for dynamic content
                  </p>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleAddPromptTemplate} 
                disabled={isLoading || !newPromptName || !newPromptTemplate}
              >
                {isLoading ? "Adding..." : "Add Template"}
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
