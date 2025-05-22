
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, CheckIcon, Info } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ManualNewsImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    details?: {
      articles_found?: number;
      articles_inserted?: number;
      articles_skipped?: number;
    };
  } | null>(null);

  const runNewsImport = async () => {
    setIsImporting(true);
    toast.info("Starting manual news import...");

    try {
      const { data, error } = await supabase.functions.invoke('run-news-import', {
        body: { manual: true }
      });

      if (error) {
        throw error;
      }

      setLastResult(data);
      setDebugData(data);

      if (data.success) {
        toast.success(
          `News import successful! Found ${data.details?.articles_found} articles, added ${data.details?.articles_inserted} new articles.`
        );
      } else {
        toast.error(`News import failed: ${data.message}`);
      }
    } catch (err) {
      console.error("Error running news import:", err);
      toast.error("Failed to run news import");
      
      setLastResult({
        success: false,
        message: err instanceof Error ? err.message : "Unknown error occurred"
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Manual News Import</CardTitle>
          <CardDescription>
            Manually trigger the news import process to fetch the latest articles
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>Information</AlertTitle>
            <AlertDescription>
              Use this feature if scheduled imports are not working or if you want to immediately import new articles.
            </AlertDescription>
          </Alert>
          
          {lastResult && (
            <>
              <Separator />
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Last Import Results:</h4>
                <Alert variant={lastResult.success ? "default" : "destructive"}>
                  {lastResult.success ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    <AlertCircle className="h-4 w-4" />
                  )}
                  <AlertTitle>{lastResult.success ? "Success" : "Failed"}</AlertTitle>
                  <AlertDescription>
                    {lastResult.message}
                    {lastResult.details && (
                      <div className="mt-2 text-xs">
                        <p>Articles found: {lastResult.details.articles_found}</p>
                        <p>New articles added: {lastResult.details.articles_inserted}</p>
                        {lastResult.details.articles_skipped !== undefined && (
                          <p>Articles skipped (duplicates): {lastResult.details.articles_skipped}</p>
                        )}
                      </div>
                    )}
                    
                    {!lastResult.success && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="mt-2" 
                        onClick={() => setIsDebugOpen(true)}
                      >
                        View Debug Data
                      </Button>
                    )}
                  </AlertDescription>
                </Alert>
              </div>
            </>
          )}
        </CardContent>
        
        <CardFooter>
          <Button 
            onClick={runNewsImport} 
            disabled={isImporting}
            className="w-full"
          >
            {isImporting ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run News Import Now
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
      
      <Dialog open={isDebugOpen} onOpenChange={setIsDebugOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Debug Information</DialogTitle>
            <DialogDescription>
              Detailed information about the import process
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[400px] rounded-md border p-4">
            <pre className="text-xs whitespace-pre-wrap">
              {JSON.stringify(debugData, null, 2)}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
