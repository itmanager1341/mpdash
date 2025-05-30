
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { RefreshCw, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  const [importProgress, setImportProgress] = useState<{
    status: string;
    articlesFound: number;
    articlesImported: number;
    articlesUpdated: number;
    duplicatesSkipped: number;
    errors: string[];
  } | null>(null);

  const handleImport = async () => {
    setIsImporting(true);
    setImportProgress({ 
      status: 'starting', 
      articlesFound: 0, 
      articlesImported: 0, 
      articlesUpdated: 0,
      duplicatesSkipped: 0,
      errors: []
    });

    try {
      console.log('Starting WordPress sync...');
      
      const { data, error } = await supabase.functions.invoke('wordpress-legacy-sync', {
        body: { maxArticles, startDate, endDate }
      });

      if (error) {
        console.error('Supabase function error:', error);
        throw error;
      }

      if (data.success) {
        setImportProgress({
          status: 'completed',
          articlesFound: data.totalArticles,
          articlesImported: data.results.created || 0,
          articlesUpdated: data.results.updated || 0,
          duplicatesSkipped: data.results.skipped || 0,
          errors: data.results.errors || []
        });
        
        const total = (data.results.created || 0) + (data.results.updated || 0);
        toast.success(`WordPress sync completed! ${total} articles processed (${data.results.created || 0} new, ${data.results.updated || 0} updated, ${data.results.skipped || 0} skipped)`);
        onImportComplete();
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
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            WordPress Article Sync
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will sync articles from your WordPress site using stored credentials.
              Duplicate articles will be automatically detected and skipped.
            </AlertDescription>
          </Alert>

          {!importProgress && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="max-articles">Maximum Articles to Sync</Label>
                <Input
                  id="max-articles"
                  type="number"
                  min="1"
                  max="1000"
                  value={maxArticles}
                  onChange={(e) => setMaxArticles(parseInt(e.target.value) || 100)}
                  disabled={isImporting}
                />
                <p className="text-xs text-gray-500">
                  Limit the number of articles to sync (1-1000). Higher numbers may take longer.
                </p>
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
            </div>
          )}

          {importProgress && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {importProgress.status === 'completed' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                )}
                <span className="text-sm font-medium">
                  {importProgress.status === 'starting' && 'Starting WordPress sync...'}
                  {importProgress.status === 'completed' && 'WordPress sync completed!'}
                </span>
              </div>
              
              {importProgress.status === 'completed' && (
                <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                  <div>Articles found: {importProgress.articlesFound}</div>
                  <div className="text-green-600">New articles: {importProgress.articlesImported}</div>
                  <div className="text-blue-600">Updated articles: {importProgress.articlesUpdated}</div>
                  <div className="text-yellow-600">Articles skipped: {importProgress.duplicatesSkipped}</div>
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
              {importProgress?.status === 'completed' ? 'Close' : 'Cancel'}
            </Button>
            <Button 
              onClick={handleImport} 
              disabled={isImporting}
            >
              {isImporting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Start WordPress Sync
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
