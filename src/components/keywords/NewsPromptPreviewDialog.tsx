
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";

interface NewsPromptPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: LlmPrompt;
  metadata: any;
}

export default function NewsPromptPreviewDialog({ 
  open, 
  onOpenChange, 
  prompt, 
  metadata 
}: NewsPromptPreviewDialogProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [confirmImportOpen, setConfirmImportOpen] = useState(false);
  
  // Extract settings from metadata
  const settings = metadata?.search_settings || {};
  const keywords = settings.keywords || [];
  const clusters = settings.selected_themes?.primary || [];
  
  // Function to handle the import now action
  const handleImportNow = async () => {
    setIsImporting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('run-news-import', {
        body: { 
          manual: true,
          promptId: prompt.id
        }
      });
      
      if (error) {
        throw new Error(`Function error: ${error.message}`);
      }
      
      if (data.success) {
        toast.success(`News import completed: ${data.details?.articles_inserted || 0} new articles added`);
        onOpenChange(false);
      } else {
        toast.error(`Import failed: ${data.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error("Error running news import:", err);
      toast.error(`Import failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsImporting(false);
      setConfirmImportOpen(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{prompt.function_name}</DialogTitle>
            <DialogDescription>
              {prompt.model.includes('perplexity') 
                ? 'Perplexity News Search'
                : prompt.model.includes('sonar')
                ? 'Llama Sonar with online search'
                : prompt.model}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-4">
            {/* Keywords section */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Keywords</h3>
              {keywords.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {keywords.map((keyword: string, idx: number) => (
                    <Badge key={idx} variant="outline">{keyword}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No specific keywords configured. Will use system defaults.</p>
              )}
            </div>
            
            {/* Clusters section */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Selected Clusters</h3>
              {clusters.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {clusters.map((cluster: string, idx: number) => (
                    <Badge key={idx} variant="secondary">{cluster}</Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No specific clusters selected.</p>
              )}
            </div>
            
            <Separator />
            
            {/* Search settings */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Search Settings</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Time Range</p>
                  <p className="font-medium">{settings.recency_filter || 'Default'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Domain Filter</p>
                  <p className="font-medium">{settings.domain_filter || 'Auto'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Min Score</p>
                  <p className="font-medium">{settings.minScore || 'System default'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Results Limit</p>
                  <p className="font-medium">{settings.limit || 'System default'}</p>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* Enhanced features */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Enhanced Features</h3>
              <div className="flex flex-wrap gap-2">
                {prompt.include_clusters && (
                  <Badge variant="secondary">Cluster Matching</Badge>
                )}
                {prompt.include_tracking_summary && (
                  <Badge variant="secondary">Keyword Tracking</Badge>
                )}
                {prompt.include_sources_map && (
                  <Badge variant="secondary">Source Mapping</Badge>
                )}
              </div>
            </div>
            
            {/* Prompt preview snippet */}
            <div>
              <h3 className="text-sm font-semibold mb-2">Prompt Preview</h3>
              <div className="bg-muted p-3 rounded-md text-xs max-h-32 overflow-y-auto">
                <pre className="whitespace-pre-wrap">
                  {prompt.prompt_text.substring(0, 500)}
                  {prompt.prompt_text.length > 500 ? '...' : ''}
                </pre>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
            <Button 
              onClick={() => setConfirmImportOpen(true)}
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Import Now
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Confirmation dialog */}
      <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Run news import?</AlertDialogTitle>
            <AlertDialogDescription>
              This will run a manual news import using the "{prompt.function_name}" prompt.
              New articles will be added to Today's Briefing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleImportNow}>
              {isImporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Importing...
                </>
              ) : (
                'Run Import'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
