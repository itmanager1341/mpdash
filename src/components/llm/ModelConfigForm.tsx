
import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Settings, Save } from "lucide-react";

interface Model {
  id: string;
  name: string;
  provider: string;
  description: string;
  defaultSettings: Record<string, any>;
}

interface ModelConfigFormProps {
  model: Model;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ModelConfigForm({ model, open, onOpenChange }: ModelConfigFormProps) {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [settings, setSettings] = useState({
    temperature: model.defaultSettings.temperature || 0.7,
    topP: model.defaultSettings.topP || 1,
    maxTokens: 2000,
    frequencyPenalty: 0,
    presencePenalty: 0,
    includeClusters: false,
    includeSourcesMap: false,
    includeTrackingSummary: false,
  });

  const handleChange = (field: string, value: number | boolean) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    setIsLoading(true);
    
    // For now, we're just simulating saving to a database
    setTimeout(() => {
      setIsLoading(false);
      onOpenChange(false);
      toast.success("Model configuration saved", {
        description: `Settings for ${model.name} have been updated.`
      });
    }, 1000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle className="flex items-center justify-between">
            Model Configuration
            <Badge>{model.name}</Badge>
          </SheetTitle>
          <SheetDescription>
            Configure default settings for this model
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Model Parameters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="temperature">Temperature: {settings.temperature}</Label>
                </div>
                <Slider 
                  id="temperature"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[settings.temperature]}
                  onValueChange={(value) => handleChange("temperature", value[0])} 
                />
                <p className="text-xs text-muted-foreground">
                  Controls randomness. Lower values are more deterministic, higher are more creative.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="top-p">Top P: {settings.topP}</Label>
                </div>
                <Slider 
                  id="top-p"
                  min={0}
                  max={1}
                  step={0.05}
                  value={[settings.topP]}
                  onValueChange={(value) => handleChange("topP", value[0])} 
                />
                <p className="text-xs text-muted-foreground">
                  Controls diversity via nucleus sampling.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="max-tokens">Max Tokens: {settings.maxTokens}</Label>
                </div>
                <Slider 
                  id="max-tokens"
                  min={100}
                  max={4000}
                  step={100}
                  value={[settings.maxTokens]}
                  onValueChange={(value) => handleChange("maxTokens", value[0])} 
                />
                <p className="text-xs text-muted-foreground">
                  Maximum number of tokens to generate.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="frequency-penalty">Frequency Penalty: {settings.frequencyPenalty}</Label>
                </div>
                <Slider 
                  id="frequency-penalty"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[settings.frequencyPenalty]}
                  onValueChange={(value) => handleChange("frequencyPenalty", value[0])} 
                />
                <p className="text-xs text-muted-foreground">
                  Reduces repetition of frequent tokens.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label htmlFor="presence-penalty">Presence Penalty: {settings.presencePenalty}</Label>
                </div>
                <Slider 
                  id="presence-penalty"
                  min={0}
                  max={2}
                  step={0.1}
                  value={[settings.presencePenalty]}
                  onValueChange={(value) => handleChange("presencePenalty", value[0])} 
                />
                <p className="text-xs text-muted-foreground">
                  Reduces repetition of topics.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Context Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="include-clusters">Include Keyword Clusters</Label>
                <Switch 
                  id="include-clusters"
                  checked={settings.includeClusters}
                  onCheckedChange={(checked) => handleChange("includeClusters", checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="include-sources">Include Sources Map</Label>
                <Switch 
                  id="include-sources"
                  checked={settings.includeSourcesMap}
                  onCheckedChange={(checked) => handleChange("includeSourcesMap", checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="include-tracking">Include Tracking Summary</Label>
                <Switch 
                  id="include-tracking"
                  checked={settings.includeTrackingSummary}
                  onCheckedChange={(checked) => handleChange("includeTrackingSummary", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <SheetFooter className="pt-4">
          <Button onClick={handleSave} disabled={isLoading} className="w-full">
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Configuration
              </>
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
