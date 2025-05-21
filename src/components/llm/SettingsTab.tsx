
import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Save, Shield, Sparkles, Clock, AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SettingsTab() {
  const [generalSettings, setGeneralSettings] = useState({
    defaultModel: "gpt-4o-mini",
    defaultTemperature: 0.7,
    cacheEnabled: true,
    cacheDuration: 24,
  });

  const [safetySettings, setSafetySettings] = useState({
    contentFiltering: "medium",
    blockSensitiveTopics: true,
    requireApproval: true,
  });

  const [rateLimits, setRateLimits] = useState({
    dailyTokenLimit: 100000,
    enforceLimit: true,
    reportOnly: false,
  });

  const [loadingState, setLoadingState] = useState({
    general: false,
    safety: false,
    rateLimits: false
  });

  const handleGeneralSettingsChange = (key: string, value: string | number | boolean) => {
    setGeneralSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSafetySettingsChange = (key: string, value: string | boolean) => {
    setSafetySettings(prev => ({ ...prev, [key]: value }));
  };

  const handleRateLimitsChange = (key: string, value: number | boolean) => {
    setRateLimits(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = (section: "general" | "safety" | "rateLimits") => {
    setLoadingState(prev => ({ ...prev, [section]: true }));
    
    // Simulate API call
    setTimeout(() => {
      setLoadingState(prev => ({ ...prev, [section]: false }));
      toast.success(`${section.charAt(0).toUpperCase() + section.slice(1)} settings saved successfully`);
    }, 1000);
  };

  return (
    <div className="space-y-6">
      <Alert className="mb-6 bg-blue-50 border-blue-100">
        <Sparkles className="h-4 w-4 text-blue-600" />
        <AlertTitle>Global LLM Settings</AlertTitle>
        <AlertDescription>
          These settings apply to all LLM operations across the platform. Model-specific settings can be configured in the Models tab.
        </AlertDescription>
      </Alert>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sparkles className="mr-2 h-5 w-5 text-primary" />
            General Settings
          </CardTitle>
          <CardDescription>
            Configure default behavior for all LLM operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="default-model">Default Model</Label>
              <Select 
                value={generalSettings.defaultModel}
                onValueChange={(value) => handleGeneralSettingsChange("defaultModel", value)}
              >
                <SelectTrigger id="default-model">
                  <SelectValue placeholder="Select Model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                  <SelectItem value="llama-3-sonar">Llama 3 Sonar (Perplexity)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="default-temperature">Default Temperature: {generalSettings.defaultTemperature}</Label>
              <Slider 
                id="default-temperature"
                min={0}
                max={2}
                step={0.1}
                value={[generalSettings.defaultTemperature]}
                onValueChange={(value) => handleGeneralSettingsChange("defaultTemperature", value[0])} 
              />
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="cache-enabled">Response Caching</Label>
                <p className="text-sm text-muted-foreground">
                  Cache identical requests to improve performance and reduce costs
                </p>
              </div>
              <Switch 
                id="cache-enabled"
                checked={generalSettings.cacheEnabled}
                onCheckedChange={(checked) => handleGeneralSettingsChange("cacheEnabled", checked)}
              />
            </div>
            
            {generalSettings.cacheEnabled && (
              <div className="space-y-2">
                <Label htmlFor="cache-duration">Cache Duration (hours): {generalSettings.cacheDuration}</Label>
                <Slider 
                  id="cache-duration"
                  min={1}
                  max={72}
                  step={1}
                  value={[generalSettings.cacheDuration]}
                  onValueChange={(value) => handleGeneralSettingsChange("cacheDuration", value[0])}
                  disabled={!generalSettings.cacheEnabled}
                />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => saveSettings("general")}
            disabled={loadingState.general}
            className="ml-auto"
          >
            {loadingState.general ? "Saving..." : "Save General Settings"}
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Shield className="mr-2 h-5 w-5 text-primary" />
            Content Safety
          </CardTitle>
          <CardDescription>
            Configure content filtering and safety measures
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>Content Filtering Level</Label>
            <RadioGroup 
              value={safetySettings.contentFiltering}
              onValueChange={(value) => handleSafetySettingsChange("contentFiltering", value)}
              className="flex flex-col space-y-1"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="filtering-low" />
                <Label htmlFor="filtering-low">Low - Minimal filtering</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="filtering-medium" />
                <Label htmlFor="filtering-medium">Medium - Standard filtering (recommended)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="filtering-high" />
                <Label htmlFor="filtering-high">High - Strict content filtering</Label>
              </div>
            </RadioGroup>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="block-sensitive">Block Sensitive Topics</Label>
                <p className="text-sm text-muted-foreground">
                  Automatically block prompts on sensitive or controversial topics
                </p>
              </div>
              <Switch 
                id="block-sensitive"
                checked={safetySettings.blockSensitiveTopics}
                onCheckedChange={(checked) => handleSafetySettingsChange("blockSensitiveTopics", checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="require-approval">Require Approval for Risky Content</Label>
                <p className="text-sm text-muted-foreground">
                  Require admin approval for content that may be unsafe
                </p>
              </div>
              <Switch 
                id="require-approval"
                checked={safetySettings.requireApproval}
                onCheckedChange={(checked) => handleSafetySettingsChange("requireApproval", checked)}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => saveSettings("safety")}
            disabled={loadingState.safety}
            className="ml-auto"
          >
            {loadingState.safety ? "Saving..." : "Save Safety Settings"}
          </Button>
        </CardFooter>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="mr-2 h-5 w-5 text-primary" />
            Rate Limiting
          </CardTitle>
          <CardDescription>
            Configure usage limits and quotas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="daily-token-limit">Daily Token Limit: {rateLimits.dailyTokenLimit.toLocaleString()}</Label>
            <Slider 
              id="daily-token-limit"
              min={10000}
              max={1000000}
              step={10000}
              value={[rateLimits.dailyTokenLimit]}
              onValueChange={(value) => handleRateLimitsChange("dailyTokenLimit", value[0])}
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of tokens to process per day across all models
            </p>
          </div>
          
          <Separator />
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enforce-limit">Enforce Token Limits</Label>
                <p className="text-sm text-muted-foreground">
                  Block requests once the limit is reached
                </p>
              </div>
              <Switch 
                id="enforce-limit"
                checked={rateLimits.enforceLimit}
                onCheckedChange={(checked) => handleRateLimitsChange("enforceLimit", checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="report-only">Report-Only Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Only report when limits are exceeded, but don't block requests
                </p>
              </div>
              <Switch 
                id="report-only"
                checked={rateLimits.reportOnly}
                onCheckedChange={(checked) => handleRateLimitsChange("reportOnly", checked)}
                disabled={!rateLimits.enforceLimit}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={() => saveSettings("rateLimits")}
            disabled={loadingState.rateLimits}
            className="ml-auto"
          >
            {loadingState.rateLimits ? "Saving..." : "Save Rate Limiting Settings"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
