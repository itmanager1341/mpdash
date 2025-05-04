
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, ShieldAlert, KeyRound, Clock, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

export type ApiKey = {
  id: string;
  name: string;
  key_masked: string;
  service: string;
  is_active: boolean;
  created_at: string;
};

interface ApiKeysListProps {
  apiKeys: ApiKey[];
  isLoading: boolean;
  onRefresh: () => Promise<void>;
}

export default function ApiKeysList({ apiKeys, isLoading, onRefresh }: ApiKeysListProps) {
  const [processingKeyId, setProcessingKeyId] = useState<string | null>(null);

  const handleDeleteApiKey = async (keyId: string) => {
    setProcessingKeyId(keyId);
    try {
      // Call edge function to delete the API key
      const { error } = await supabase.functions.invoke('delete-api-key', {
        body: { id: keyId }
      });

      if (error) {
        throw new Error(error.message);
      }

      // Refresh the list of API keys
      await onRefresh();
      toast.success("API key deleted successfully", {
        description: "The API key has been permanently removed."
      });
    } catch (error) {
      console.error("Error deleting API key:", error);
      toast.error("Failed to delete API key", {
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setProcessingKeyId(null);
    }
  };

  const handleToggleKeyStatus = async (keyId: string, currentStatus: boolean) => {
    setProcessingKeyId(keyId);
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
      await onRefresh();
      toast.success(`API key ${!currentStatus ? 'activated' : 'deactivated'} successfully`, {
        description: `The API key is now ${!currentStatus ? 'active' : 'inactive'}.`
      });
    } catch (error) {
      console.error("Error toggling API key status:", error);
      toast.error("Failed to update API key status", {
        description: error instanceof Error ? error.message : "Unknown error occurred"
      });
    } finally {
      setProcessingKeyId(null);
    }
  };

  const getServiceBadgeColor = (service: string): string => {
    switch (service.toLowerCase()) {
      case 'perplexity': return 'bg-purple-100 text-purple-800';
      case 'openai': return 'bg-green-100 text-green-800';
      case 'fred': return 'bg-blue-100 text-blue-800';
      case 'hubspot': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium flex items-center">
          <KeyRound className="mr-2 h-5 w-5" /> 
          Stored API Keys
        </h3>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : "Refresh"}
        </Button>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : apiKeys.length > 0 ? (
        <div className="space-y-3">
          {apiKeys.map((key) => (
            <div key={key.id} className="flex flex-wrap md:flex-nowrap items-center justify-between p-4 border rounded-md hover:bg-slate-50 transition-colors">
              <div className="w-full md:w-auto mb-2 md:mb-0">
                <div className="flex items-center">
                  <h4 className="font-medium text-sm">{key.name}</h4>
                  {!key.is_active && (
                    <Badge variant="outline" className="ml-2 bg-amber-100 text-amber-800 border-amber-200">
                      Inactive
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap gap-2 mt-1 items-center text-sm text-muted-foreground">
                  <Badge className={`${getServiceBadgeColor(key.service)}`}>
                    {key.service}
                  </Badge>
                  <div className="flex items-center text-xs">
                    <Clock className="h-3 w-3 mr-1" />
                    {key.created_at ? (
                      formatDistanceToNow(new Date(key.created_at), { addSuffix: true })
                    ) : (
                      'Unknown date'
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {key.key_masked ? `Key: ${key.key_masked}` : 'Key: •••••••••••••••••••'}
                </p>
              </div>
              <div className="flex items-center space-x-2 w-full md:w-auto justify-end">
                <div className="flex items-center mr-2" title={key.is_active ? "Active" : "Inactive"}>
                  <Checkbox 
                    checked={key.is_active} 
                    onCheckedChange={() => handleToggleKeyStatus(key.id, key.is_active)}
                    disabled={processingKeyId === key.id}
                    id={`active-${key.id}`}
                  />
                  <label 
                    htmlFor={`active-${key.id}`} 
                    className="ml-1 text-sm cursor-pointer select-none"
                  >
                    Active
                  </label>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button 
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                      disabled={processingKeyId === key.id}
                    >
                      {processingKeyId === key.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center">
                        <ShieldAlert className="h-5 w-5 text-red-500 mr-2" />
                        Delete API Key
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete the "{key.name}" API key for {key.service}? 
                        This action cannot be undone and may break functionality that relies on this key.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDeleteApiKey(key.id)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Delete Key
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center p-8 border rounded-md bg-muted/20">
          <KeyRound className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-muted-foreground mb-2">No API keys added yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Add API keys for external services using the form above. Keys are stored securely
            and will never be displayed in full after saving.
          </p>
        </div>
      )}
    </div>
  );
}
