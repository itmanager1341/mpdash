
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { RefreshCw, AlertCircle, CheckCircle, Settings, Zap, Info } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";

interface ArticleImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ArticleImportDialog({ open, onOpenChange, onImportComplete }: ArticleImportDialogProps) {
  const [maxArticles, setMaxArticles] = useState(100);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  
  // Processing options
  const [autoExtractContent, setAutoExtractContent] = useState(true);
  const [autoCalculateWordCount, setAutoCalculateWordCount] = useState(true);
  const [autoChunkArticles, setAutoChunkArticles] = useState(false);
  
  // Duplicate handling options - default to skip
  const [duplicateHandling, setDuplicateHandling] = useState('skip');
  const [dryRun, setDryRun] = useState(false);
  
  // Performance options
  const [apiDelay, setApiDelay] = useState(100);
  const [batchSize, setBatchSize] = useState(20);
  
  const [importProgress, setImportProgress] = useState<{
    status: string;
    articlesFound: number;
    articlesImported: number;
    articlesUpdated: number;
    duplicatesSkipped: number;
    contentExtracted: number;
    wordCountsCalculated: number;
    articlesChunked: number;
    errors: string[];
    duplicatesFound: number;
  } | null>(null);

  // Date validation
  const validateDates = () => {
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      toast.error("Start date cannot be after end date");
      return false;
    }
    return true;
  };

  const handleImport = async () => {
    if (!validateDates()) return;

    setIsImporting(true);
    setImportProgress({ 
      status: dryRun ? 'dry_run_starting' : 'starting', 
      articlesFound: 0, 
      articlesImported: 0, 
      articlesUpdated: 0,
      duplicatesSkipped: 0,
      duplicatesFound: 0,
      contentExtracted: 0,
      wordCountsCalculated: 0,
      articlesChunked: 0,
      errors: []
    });

    try {
      console.log(`Starting ${dryRun ? 'dry run' : 'enhanced'} WordPress sync using legacy mode...`);
      
      const { data, error } = await supabase.functions.invoke('wordpress-legacy-sync', {
        body: { 
          maxArticles, 
          startDate, 
          endDate,
          // Use legacy mode for proven functionality
          legacyMode: true,
          processingOptions: {
            autoExtractContent,
            autoCalculateWordCount,
            autoChunkArticles
          },
          performanceOptions: {
            apiDelay,
            batchSize
          },
          duplicateHandling: {
            mode: duplicateHandling,
            dryRun
          }
        }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data.success) {
        setImportProgress({
          status: dryRun ? 'dry_run_completed' : 'completed',
          articlesFound: data.totalArticles,
          articlesImported: data.results.created || 0,
          articlesUpdated: data.results.updated || 0,
          duplicatesSkipped: data.results.skipped || 0,
          duplicatesFound: data.results.duplicatesFound || 0,
          contentExtracted: data.results.contentExtracted || 0,
          wordCountsCalculated: data.results.wordCountsCalculated || 0,
          articlesChunked: data.results.articlesChunked || 0,
          errors: data.results.errors || []
        });
        
        if (dryRun) {
          const duplicateText = data.results.duplicatesFound > 0 ? ` (${data.results.duplicatesFound} duplicates found)` : '';
          toast.success(`Dry run completed! Found ${data.totalArticles} articles to process${duplicateText}`);
        } else {
          const total = (data.results.created || 0) + (data.results.updated || 0);
          let message = `WordPress sync completed! ${total} articles processed`;
          
          if (data.results.skipped > 0) {
            message += `, ${data.results.skipped} duplicates skipped`;
          }
          
          if (autoExtractContent || autoCalculateWordCount || autoChunkArticles) {
            const processed = [];
            if (autoExtractContent && data.results.contentExtracted > 0) {
              processed.push(`${data.results.contentExtracted} content extracted`);
            }
            if (autoCalculateWordCount && data.results.wordCountsCalculated > 0) {
              processed.push(`${data.results.wordCountsCalculated} word counts calculated`);
            }
            if (autoChunkArticles && data.results.articlesChunked > 0) {
              processed.push(`${data.results.articlesChunked} articles chunked`);
            }
            
            if (processed.length > 0) {
              message += ` (${processed.join(', ')})`;
            }
          }
          
          toast.success(message);
          onImportComplete();
        }
      } else {
        throw new Error(data.error || 'WordPress sync failed');
      }
    } catch (error) {
      console.error('WordPress sync error:', error);
      toast.error(`WordPress sync failed: ${error.message}`);
      setImportProgress(null);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      onOpenChange(false);
      setImportProgress(null);
      setMaxArticles(100);
      setStartDate('');
      setEndDate('');
      setAutoExtractContent(true);
      setAutoCalculateWordCount(true);
      setAutoChunkArticles(false);
      setDuplicateHandling('skip');
      setDryRun(false);
      setApiDelay(100);
      setBatchSize(20);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            WordPress Article Import
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Import articles using proven sync logic with smart duplicate handling and content processing. 
              Configure parameters to minimize WPEngine impact while maximizing automation.
            </AlertDescription>
          </Alert>

          {!importProgress && (
            <div className="space-y-6">
              {/* Basic Import Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Import Settings</h4>
                
                <div className="space-y-2">
                  <Label htmlFor="max-articles">Maximum Articles to Import</Label>
                  <Input
                    id="max-articles"
                    type="number"
                    min="1"
                    max="1000"
                    value={maxArticles}
                    onChange={(e) => setMaxArticles(parseInt(e.target.value) || 100)}
                    disabled={isImporting}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input
                      id="start-date"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      disabled={isImporting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input
                      id="end-date"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      disabled={isImporting}
                    />
                  </div>
                </div>

                {startDate && endDate && new Date(startDate) > new Date(endDate) && (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-red-600">
                      Start date cannot be after end date. Please adjust your date range.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              <Separator />

              {/* Duplicate Handling */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium">Duplicate Handling</h4>
                
                <RadioGroup value={duplicateHandling} onValueChange={setDuplicateHandling} disabled={isImporting}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="skip" id="skip" />
                    <Label htmlFor="skip" className="text-sm">
                      Skip duplicates (recommended)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="update" id="update" />
                    <Label htmlFor="update" className="text-sm">
                      Update existing articles
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="both" />
                    <Label htmlFor="both" className="text-sm">
                      Import new + update existing
                    </Label>
                  </div>
                </RadioGroup>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="dry-run"
                    checked={dryRun}
                    onCheckedChange={(checked) => setDryRun(checked === true)}
                    disabled={isImporting}
                  />
                  <Label htmlFor="dry-run" className="text-sm">
                    Dry run (preview only, no changes)
                  </Label>
                </div>

                <p className="text-xs text-gray-500">
                  Dry run mode shows what would happen without making actual changes.
                </p>
              </div>

              <Separator />

              {/* Processing Options */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Auto-Processing Options
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto-extract"
                      checked={autoExtractContent}
                      onCheckedChange={(checked) => setAutoExtractContent(checked === true)}
                      disabled={isImporting}
                    />
                    <Label htmlFor="auto-extract" className="text-sm">
                      Auto-extract clean content
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto-word-count"
                      checked={autoCalculateWordCount}
                      onCheckedChange={(checked) => setAutoCalculateWordCount(checked === true)}
                      disabled={isImporting}
                    />
                    <Label htmlFor="auto-word-count" className="text-sm">
                      Auto-calculate word counts
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="auto-chunk"
                      checked={autoChunkArticles}
                      onCheckedChange={(checked) => setAutoChunkArticles(checked === true)}
                      disabled={isImporting}
                    />
                    <Label htmlFor="auto-chunk" className="text-sm">
                      Auto-chunk articles (after word count)
                    </Label>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Performance Settings */}
              <div className="space-y-4">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Performance Settings
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="api-delay">API Delay (ms)</Label>
                    <Input
                      id="api-delay"
                      type="number"
                      min="0"
                      max="5000"
                      value={apiDelay}
                      onChange={(e) => setApiDelay(parseInt(e.target.value) || 100)}
                      disabled={isImporting}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="batch-size">Batch Size</Label>
                    <Input
                      id="batch-size"
                      type="number"
                      min="1"
                      max="100"
                      value={batchSize}
                      onChange={(e) => setBatchSize(parseInt(e.target.value) || 20)}
                      disabled={isImporting}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {importProgress && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {importProgress.status === 'completed' || importProgress.status === 'dry_run_completed' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                )}
                <span className="text-sm font-medium">
                  {importProgress.status === 'starting' && 'Starting enhanced WordPress sync...'}
                  {importProgress.status === 'dry_run_starting' && 'Starting dry run analysis...'}
                  {importProgress.status === 'completed' && 'Enhanced sync completed!'}
                  {importProgress.status === 'dry_run_completed' && 'Dry run analysis completed!'}
                </span>
              </div>
              
              {(importProgress.status === 'completed' || importProgress.status === 'dry_run_completed') && (
                <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                  <div>Articles found: {importProgress.articlesFound}</div>
                  {importProgress.status === 'dry_run_completed' ? (
                    <>
                      <div className="text-blue-600">Would import: {importProgress.articlesImported}</div>
                      <div className="text-orange-600">Would update: {importProgress.articlesUpdated}</div>
                      <div className="text-yellow-600">Would skip: {importProgress.duplicatesSkipped}</div>
                      {importProgress.duplicatesFound > 0 && (
                        <div className="text-purple-600">Duplicates found: {importProgress.duplicatesFound}</div>
                      )}
                    </>
                  ) : (
                    <>
                      <div className="text-green-600">New articles: {importProgress.articlesImported}</div>
                      <div className="text-blue-600">Updated articles: {importProgress.articlesUpdated}</div>
                      <div className="text-yellow-600">Articles skipped: {importProgress.duplicatesSkipped}</div>
                    </>
                  )}
                  
                  {(importProgress.contentExtracted > 0 || importProgress.wordCountsCalculated > 0 || importProgress.articlesChunked > 0) && (
                    <>
                      <Separator className="my-2" />
                      <div className="text-purple-600">Content extracted: {importProgress.contentExtracted}</div>
                      <div className="text-indigo-600">Word counts calculated: {importProgress.wordCountsCalculated}</div>
                      <div className="text-cyan-600">Articles chunked: {importProgress.articlesChunked}</div>
                    </>
                  )}
                  
                  {importProgress.errors.length > 0 && (
                    <div className="text-red-600">Errors: {importProgress.errors.length}</div>
                  )}
                </div>
              )}

              {importProgress.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto">
                  <Label className="text-red-600">Errors:</Label>
                  <div className="text-xs text-red-500 mt-1">
                    {importProgress.errors.map((error, index) => (
                      <div key={index}>{error}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose} disabled={isImporting}>
              {importProgress?.status === 'completed' || importProgress?.status === 'dry_run_completed' ? 'Close' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={isImporting || (startDate && endDate && new Date(startDate) > new Date(endDate))}
            >
              {isImporting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  {dryRun ? 'Analyzing...' : 'Processing...'}
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {dryRun ? 'Run Analysis' : 'Start Import Sync'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
