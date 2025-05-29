
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
import { Calendar, Download, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ArticleImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

export function ArticleImportDialog({ open, onOpenChange, onImportComplete }: ArticleImportDialogProps) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{
    status: string;
    articlesFound: number;
    articlesImported: number;
    articlesSkipped: number;
  } | null>(null);

  const handleImport = async () => {
    if (!startDate || !endDate) {
      toast.error("Please select both start and end dates");
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast.error("Start date must be before end date");
      return;
    }

    setIsImporting(true);
    setImportProgress({ status: 'starting', articlesFound: 0, articlesImported: 0, articlesSkipped: 0 });

    try {
      const { data, error } = await supabase.functions.invoke('fetch-website-articles', {
        body: { startDate, endDate }
      });

      if (error) throw error;

      if (data.success) {
        setImportProgress({
          status: 'completed',
          articlesFound: data.articlesFound,
          articlesImported: data.articlesImported,
          articlesSkipped: data.articlesSkipped
        });
        toast.success(`Import completed! ${data.articlesImported} articles imported, ${data.articlesSkipped} skipped`);
        onImportComplete();
      } else {
        throw new Error(data.error || 'Import failed');
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error(`Import failed: ${error.message}`);
      setImportProgress(null);
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    if (!isImporting) {
      onOpenChange(false);
      setImportProgress(null);
      setStartDate('');
      setEndDate('');
    }
  };

  // Set default date range to last 7 days
  const today = new Date();
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const defaultStartDate = lastWeek.toISOString().split('T')[0];
  const defaultEndDate = today.toISOString().split('T')[0];

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Import Website Articles
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This will fetch articles from themortgagepoint.com within the specified date range.
              Existing articles will be skipped automatically.
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={startDate || defaultStartDate}
                onChange={(e) => setStartDate(e.target.value)}
                disabled={isImporting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                End Date
              </Label>
              <Input
                id="end-date"
                type="date"
                value={endDate || defaultEndDate}
                onChange={(e) => setEndDate(e.target.value)}
                disabled={isImporting}
              />
            </div>
          </div>

          {importProgress && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {importProgress.status === 'completed' ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                )}
                <span className="text-sm font-medium">
                  {importProgress.status === 'starting' && 'Starting import...'}
                  {importProgress.status === 'completed' && 'Import completed!'}
                </span>
              </div>
              
              {importProgress.status === 'completed' && (
                <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                  <div>Articles found: {importProgress.articlesFound}</div>
                  <div className="text-green-600">Articles imported: {importProgress.articlesImported}</div>
                  <div className="text-yellow-600">Articles skipped: {importProgress.articlesSkipped}</div>
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
              disabled={isImporting || !startDate || !endDate}
            >
              {isImporting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Importing...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Start Import
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
