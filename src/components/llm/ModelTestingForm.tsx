
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
  defaultSettings: Record<string, any>;
}

interface ModelTestingFormProps {
  model: Model;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ModelTestingForm({ model, open, onOpenChange }: ModelTestingFormProps) {
  const [prompt, setPrompt] = useState<string>("");
  const [response, setResponse] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [temperature, setTemperature] = useState<number>(model.defaultSettings.temperature || 0.7);
  const [maxTokens, setMaxTokens] = useState<number>(1000);
  const [timing, setTiming] = useState<number | null>(null);

  const handleTest = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt");
      return;
    }

    setIsLoading(true);
    setResponse(null);
    setTiming(null);

    try {
      const startTime = Date.now();
      
      const { data, error } = await supabase.functions.invoke("test-llm-prompt", {
        body: {
          model: model.id,
          prompt_text: prompt,
          input_data: {},
          include_clusters: false,
          include_tracking_summary: false,
          include_sources_map: false
        }
      });

      const endTime = Date.now();
      
      if (error) throw new Error(error.message);
      
      setResponse(typeof data.output === 'string' ? data.output : JSON.stringify(data.output, null, 2));
      setTiming(endTime - startTime);
      
      toast.success("Model test completed");
    } catch (error) {
      console.error("Error testing model:", error);
      toast.error("Failed to test model", { 
        description: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center justify-between">
            Test Model
            <Badge>{model.name}</Badge>
          </SheetTitle>
          <SheetDescription>
            Try out the model with different prompts and parameters
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Enter your prompt here..."
              className="min-h-[120px]"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="temperature">Temperature: {temperature}</Label>
              </div>
              <Slider 
                id="temperature"
                min={0}
                max={2}
                step={0.1}
                value={[temperature]}
                onValueChange={(value) => setTemperature(value[0])} 
              />
              <p className="text-xs text-muted-foreground">
                Lower values produce more deterministic responses, higher values make output more random
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="max-tokens">Max Tokens: {maxTokens}</Label>
              </div>
              <Slider 
                id="max-tokens"
                min={100}
                max={4000}
                step={100}
                value={[maxTokens]}
                onValueChange={(value) => setMaxTokens(value[0])} 
              />
            </div>
          </div>

          <Button 
            onClick={handleTest} 
            disabled={isLoading || !prompt.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Test Model
              </>
            )}
          </Button>

          {response && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Response
                  {timing && (
                    <Badge variant="outline" className="font-normal">
                      <Clock className="mr-1 h-3 w-3" /> {(timing / 1000).toFixed(2)}s
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-muted p-3 rounded whitespace-pre-wrap text-sm">
                  {response}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
