
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Import, Loader2, Code, Maximize2, Minimize2, FileCheck, Clock, Globe } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

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
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  
  // Extract settings from metadata
  const settings = metadata?.search_settings || {};
  const keywords = settings.keywords || [];
  const clusters = settings.selected_themes?.primary || [];
  
  // Clean prompt text (remove metadata block)
  const cleanPromptText = prompt.prompt_text.replace(/\/\*\n[\s\S]*?\n\*\/\n/, '');
  
  // Function to determine if this is a structured prompt
  const isStructuredPrompt = cleanPromptText.includes("SEARCH & FILTER RULES") || 
                            cleanPromptText.includes("Source Prioritization") ||
                            cleanPromptText.includes("Topical Relevance");

  // Extract tiers from structured prompt
  const extractTiers = () => {
    const tiers: string[] = [];
    const tierRegex = /Tier \d+:\s*([^\n]+)/g;
    let match;
    
    while ((match = tierRegex.exec(cleanPromptText)) !== null) {
      tiers.push(match[1].trim());
    }
    
    return tiers;
  };
  
  // Extract time range from structured prompt
  const extractTimeRange = () => {
    const timeMatch = cleanPromptText.match(/Time Range:[\s\S]*?include articles published within the last ([^\n\.]+)/);
    return timeMatch ? timeMatch[1] : settings.recency_filter || 'Default';
  };
  
  // Extract topical clusters from structured prompt
  const extractClusters = () => {
    const clusters: { theme: string, keywords: string[] }[] = [];
    
    // Try to extract the Cluster Keywords section
    const clusterSection = cleanPromptText.match(/Cluster Keywords[\s\S]*?(?=OUTPUT FORMAT|$)/i);
    
    if (clusterSection) {
      const lines = clusterSection[0].split('\n');
      let currentTheme = '';
      let currentKeywords: string[] = [];
      
      lines.forEach(line => {
        // Skip header lines
        if (line.includes("Cluster Keywords")) return;
        
        const trimmedLine = line.trim();
        if (!trimmedLine) return;
        
        // Check if this is a new theme line
        const themeMatch = trimmedLine.match(/^([A-Za-z &]+) (.*)/);
        if (themeMatch) {
          // If we already have a theme, add it to our results
          if (currentTheme && currentKeywords.length > 0) {
            clusters.push({
              theme: currentTheme,
              keywords: currentKeywords
            });
          }
          
          // Start new theme
          currentTheme = themeMatch[1].trim();
          currentKeywords = themeMatch[2].split(',').map(k => k.trim());
        }
      });
      
      // Add the last theme
      if (currentTheme && currentKeywords.length > 0) {
        clusters.push({
          theme: currentTheme,
          keywords: currentKeywords
        });
      }
    }
    
    return clusters;
  };
  
  // Extract sources from structured prompt
  const extractSources = () => {
    const sources: {tier: string, sites: string[]}[] = [];
    
    // Look for site: directives grouped by tiers
    const tierSections = cleanPromptText.match(/Tier \d+:[\s\S]*?(?=Tier \d+:|3\. Topical|$)/g);
    
    if (tierSections) {
      tierSections.forEach(section => {
        const tierMatch = section.match(/Tier (\d+):\s*([^\n]+)/);
        if (!tierMatch) return;
        
        const tierNumber = tierMatch[1];
        const tierName = tierMatch[2].trim();
        
        // Extract site: directives
        const siteRegex = /site:([a-zA-Z0-9.-]+)/g;
        let siteMatch;
        const sites: string[] = [];
        
        while ((siteMatch = siteRegex.exec(section)) !== null) {
          sites.push(siteMatch[1].trim());
        }
        
        if (sites.length > 0) {
          sources.push({
            tier: `Tier ${tierNumber}: ${tierName}`,
            sites: sites
          });
        }
      });
    }
    
    return sources;
  };
  
  const timeRange = isStructuredPrompt ? extractTimeRange() : (settings.recency_filter || 'Default');
  const tiers = isStructuredPrompt ? extractTiers() : [];
  const extractedClusters = isStructuredPrompt ? extractClusters() : [];
  const sources = isStructuredPrompt ? extractSources() : [];
  
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
              {isStructuredPrompt ? (
                <Badge variant="secondary" className="mr-2">Structured Editorial Format</Badge>
              ) : null}
              {prompt.model.includes('perplexity') 
                ? 'Perplexity News Search'
                : prompt.model.includes('sonar')
                ? 'Llama Sonar with online search'
                : prompt.model}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-4">
            {isStructuredPrompt ? (
              <>
                {/* Time Range */}
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center">
                    <Clock className="mr-2 h-4 w-4" />
                    Time Range
                  </h3>
                  <p className="text-sm ml-6">Articles published within the last {timeRange}</p>
                </div>
              
                {/* Sources by tier */}
                {sources.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2 flex items-center">
                      <Globe className="mr-2 h-4 w-4" />
                      Source Prioritization
                    </h3>
                    <div className="space-y-2 ml-6">
                      {sources.map((tier, idx) => (
                        <div key={idx} className="space-y-1">
                          <p className="text-sm font-medium">{tier.tier}</p>
                          <div className="flex flex-wrap gap-2">
                            {tier.sites.map((site, siteIdx) => (
                              <Badge key={siteIdx} variant="outline" className="text-xs">{site}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Clusters section with keywords */}
                {extractedClusters.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold mb-2">Content Clusters</h3>
                    <div className="space-y-3 ml-6">
                      {extractedClusters.map((cluster, idx) => (
                        <div key={idx} className="space-y-1">
                          <p className="text-sm font-medium">{cluster.theme}</p>
                          <div className="flex flex-wrap gap-1">
                            {cluster.keywords.map((keyword, kidx) => (
                              <Badge key={kidx} variant="secondary" className="text-xs">{keyword}</Badge>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Alert className="bg-green-50">
                  <FileCheck className="h-4 w-4" />
                  <AlertTitle>Optimized Editorial Structure</AlertTitle>
                  <AlertDescription className="text-xs">
                    This prompt uses the recommended structured editorial format with tiered sources, 
                    cluster-based keyword organization, and standardized output formats.
                  </AlertDescription>
                </Alert>
              </>
            ) : (
              <>
                {/* Legacy format display */}
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
              </>
            )}
            
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
                {isStructuredPrompt && (
                  <Badge variant="secondary">Editorial Structure</Badge>
                )}
              </div>
            </div>
            
            {/* Prompt preview snippet with expand toggle */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold">Prompt Preview</h3>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 px-2"
                  onClick={() => setShowFullPrompt(!showFullPrompt)}
                >
                  {showFullPrompt ? (
                    <><Minimize2 className="h-3.5 w-3.5 mr-1" /> Collapse</>
                  ) : (
                    <><Maximize2 className="h-3.5 w-3.5 mr-1" /> Expand</>
                  )}
                </Button>
              </div>
              
              <div className={`bg-muted rounded-md ${showFullPrompt ? "" : "max-h-48"} overflow-hidden`}>
                {showFullPrompt ? (
                  <ScrollArea className="h-[400px] p-3">
                    <pre className="whitespace-pre-wrap text-xs">{prompt.prompt_text}</pre>
                  </ScrollArea>
                ) : (
                  <div className="p-3 text-xs overflow-y-auto max-h-48">
                    <pre className="whitespace-pre-wrap">{cleanPromptText}</pre>
                    {cleanPromptText.length > 500 && !showFullPrompt && (
                      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted to-transparent pointer-events-none"></div>
                    )}
                  </div>
                )}
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
                  <Import className="mr-2 h-4 w-4" />
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
