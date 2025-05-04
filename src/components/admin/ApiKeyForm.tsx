
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Eye, EyeOff, HelpCircle, Loader2, KeyRound } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

interface ApiKeyFormProps {
  onSuccess: () => Promise<void>;
  service?: string;
}

type ServiceInfo = {
  name: string;
  pattern?: RegExp;
  docUrl: string;
  description: string;
};

const serviceInfo: Record<string, ServiceInfo> = {
  perplexity: {
    name: "Perplexity",
    pattern: /^pplx-[a-zA-Z0-9]{40,50}$/,
    docUrl: "https://docs.perplexity.ai/docs/getting-started",
    description: "Used for news search and article generation via the Perplexity API"
  },
  openai: {
    name: "OpenAI",
    pattern: /^sk-[a-zA-Z0-9]{32,}$/,
    docUrl: "https://platform.openai.com/api-keys",
    description: "Used for content enhancement and analysis via the OpenAI API"
  },
  fred: {
    name: "FRED API",
    pattern: /^[a-zA-Z0-9]{32,}$/,
    docUrl: "https://fred.stlouisfed.org/docs/api/api_key.html",
    description: "Federal Reserve Economic Data for economic metrics and trends"
  },
  hubspot: {
    name: "HubSpot",
    pattern: /^[a-zA-Z0-9]{8,}-[a-zA-Z0-9]{4,}-[a-zA-Z0-9]{4,}-[a-zA-Z0-9]{4,}-[a-zA-Z0-9]{12,}$/,
    docUrl: "https://developers.hubspot.com/docs/api/overview",
    description: "Used for email management and campaign tracking"
  },
  other: {
    name: "Other Service",
    docUrl: "",
    description: "Custom API service integration"
  }
};

export default function ApiKeyForm({ onSuccess, service = "perplexity" }: ApiKeyFormProps) {
  const [keyName, setKeyName] = useState("");
  const [keyValue, setKeyValue] = useState("");
  const [selectedService, setSelectedService] = useState(service);
  const [isLoading, setIsLoading] = useState(false);
  const [showKeyValue, setShowKeyValue] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Validate key format based on service
  const validateKeyFormat = (key: string, serviceType: string): boolean => {
    // Skip validation for "other" service or if no pattern defined
    if (serviceType === "other" || !serviceInfo[serviceType]?.pattern) {
      return true;
    }
    
    return serviceInfo[serviceType].pattern?.test(key) || false;
  };

  const handleValidateAndSubmit = () => {
    // Clear previous errors
    setValidationError("");
    
    // Validate fields
    if (!keyName.trim()) {
      setValidationError("Please provide a name for this API key");
      return;
    }
    
    if (!keyValue.trim()) {
      setValidationError("Please enter an API key value");
      return;
    }
    
    // Validate key format
    if (!validateKeyFormat(keyValue, selectedService)) {
      setValidationError(`This doesn't appear to be a valid ${serviceInfo[selectedService].name} API key format`);
      return;
    }
    
    // Show confirmation dialog before saving
    setShowConfirmDialog(true);
  };

  const handleAddApiKey = async () => {
    setShowConfirmDialog(false);
    setIsLoading(true);
    try {
      // Call consolidated edge function to store the API key
      const { data, error } = await supabase.functions.invoke('api-keys', {
        body: {
          operation: 'create',
          name: keyName,
          key: keyValue,
          service: selectedService
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.message || "Unknown error occurred");
      }

      // Clear form
      setKeyName("");
      setKeyValue("");
      
      // Notify success with appropriate message
      if (data.secret_stored) {
        toast.success("API key added successfully", {
          description: `The ${serviceInfo[selectedService].name} API key has been securely stored`
        });
      } else {
        // The metadata was stored but the secret wasn't
        toast.success("API key added with warning", {
          description: `The ${serviceInfo[selectedService].name} API key metadata was saved, but the secret couldn't be stored. The API may not function until this is resolved.`,
          duration: 6000
        });
      }

      // Trigger parent component refresh
      await onSuccess();
    } catch (error) {
      console.error("Error adding API key:", error);
      toast.error(`Failed to add API key: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Update the selected service when the service prop changes
  useEffect(() => {
    if (service) {
      setSelectedService(service);
    }
  }, [service]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <KeyRound className="mr-2 h-5 w-5" />
          Add New API Key
        </CardTitle>
        <CardDescription>
          Add API keys for external services like Perplexity, OpenAI, etc. Keys are securely stored as Supabase secrets.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {validationError && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{validationError}</AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="key-name">Key Name</Label>
            <Input
              id="key-name"
              placeholder="e.g., Production Perplexity API"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">A descriptive name to identify this API key</p>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="key-service">Service</Label>
              {serviceInfo[selectedService]?.docUrl && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a 
                        href={serviceInfo[selectedService].docUrl} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        <HelpCircle className="h-3 w-3 mr-1" />
                        Get API Key
                      </a>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Visit {serviceInfo[selectedService].name} to get your API key</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            
            <Select value={selectedService} onValueChange={(value) => {
              setSelectedService(value);
              setValidationError("");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(serviceInfo).map(([key, info]) => (
                  <SelectItem key={key} value={key}>
                    {info.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{serviceInfo[selectedService]?.description || "API service integration"}</p>
          </div>
          
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="key-value">API Key</Label>
            <div className="relative">
              <Input
                id="key-value"
                type={showKeyValue ? "text" : "password"}
                placeholder={`Enter ${serviceInfo[selectedService]?.name || "service"} API key`}
                value={keyValue}
                onChange={(e) => {
                  setKeyValue(e.target.value);
                  setValidationError("");
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 py-2"
                onClick={() => setShowKeyValue(!showKeyValue)}
              >
                {showKeyValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Your API key will be stored securely and never displayed in full again</p>
          </div>
        </div>
      </CardContent>
      <CardFooter>
        <Button 
          onClick={handleValidateAndSubmit} 
          disabled={isLoading || !keyName || !keyValue}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : "Add API Key"}
        </Button>
      </CardFooter>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm API Key Storage</DialogTitle>
            <DialogDescription>
              You're about to store a {serviceInfo[selectedService]?.name || "service"} API key. 
              This key will be stored securely as a Supabase secret and referenced in the database.
              Only the last few characters will be visible after storage.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm font-medium">Name: {keyName}</p>
            <p className="text-sm font-medium">Service: {serviceInfo[selectedService]?.name || selectedService}</p>
            <p className="text-sm font-medium mt-2">
              Key: {showKeyValue 
                ? keyValue 
                : `${keyValue.substring(0, 3)}...${keyValue.substring(keyValue.length - 4)}`
              }
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>Cancel</Button>
            <Button onClick={handleAddApiKey}>Confirm & Save Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
