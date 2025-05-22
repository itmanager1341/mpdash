
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, AlertCircle, CheckIcon, Info, Bug } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export default function ManualNewsImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [debugData, setDebugData] = useState<any>(null);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    message: string;
    details?: {
      articles_found?: number;
      valid_articles?: number;
      articles_inserted?: number;
      articles_skipped?: number;
      articles_error?: number;
      debug?: any;
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

  const runNewsImportWithCustomPrompt = async (promptId: string) => {
    setIsImporting(true);
    toast.info(`Starting manual news import with custom prompt (ID: ${promptId})...`);

    try {
      const { data, error } = await supabase.functions.invoke('run-news-import', {
        body: { manual: true, promptId }
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
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-medium">Last Import Results:</h4>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setIsDebugOpen(true)}
                  >
                    <Bug className="h-4 w-4 mr-1" />
                    Debug Data
                  </Button>
                </div>
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
                      <div className="mt-2 text-xs space-y-1">
                        <div className="flex flex-wrap gap-2 mt-1">
                          <Badge variant="outline">
                            Articles found: {lastResult.details.articles_found || 0}
                          </Badge>
                          {lastResult.details.valid_articles !== undefined && (
                            <Badge variant="outline">
                              Valid articles: {lastResult.details.valid_articles}
                            </Badge>
                          )}
                          <Badge variant={lastResult.details.articles_inserted ? "success" : "outline"}>
                            New articles added: {lastResult.details.articles_inserted || 0}
                          </Badge>
                          {lastResult.details.articles_skipped !== undefined && (
                            <Badge variant="secondary">
                              Duplicates skipped: {lastResult.details.articles_skipped}
                            </Badge>
                          )}
                          {lastResult.details.articles_error !== undefined && lastResult.details.articles_error > 0 && (
                            <Badge variant="destructive">
                              Errors: {lastResult.details.articles_error}
                            </Badge>
                          )}
                        </div>
                        
                        {lastResult.details.debug && (
                          <div className="mt-2">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-xs p-0 h-6 text-muted-foreground hover:text-foreground" 
                              onClick={() => setIsDebugOpen(true)}
                            >
                              <Bug className="h-3 w-3 mr-1" />
                              View API Response Details
                            </Button>
                          </div>
                        )}
                      </div>
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
        <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Debug Information</DialogTitle>
            <DialogDescription>
              Detailed information about the import process
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="full" className="flex-1 flex flex-col">
            <TabsList>
              <TabsTrigger value="full">Full Response</TabsTrigger>
              <TabsTrigger value="articles">Articles</TabsTrigger>
              {debugData?.details?.debug && (
                <TabsTrigger value="apiResponse">API Response</TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="full" className="flex-1">
              <ScrollArea className="h-full rounded-md border p-4">
                <pre className="text-xs whitespace-pre-wrap">
                  {JSON.stringify(debugData, null, 2)}
                </pre>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="articles" className="flex-1">
              <ScrollArea className="h-full rounded-md border p-4">
                {debugData?.details?.articles && (
                  <div className="space-y-4">
                    {debugData.articles.map((article: any, index: number) => (
                      <div key={index} className="border p-3 rounded-md">
                        <h4 className="font-medium">{article.headline || article.title}</h4>
                        <div className="text-xs text-muted-foreground mt-1">{article.url}</div>
                        <p className="text-xs mt-2">{article.summary || article.description}</p>
                        {article.matched_clusters?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {article.matched_clusters.map((cluster: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {cluster}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) || <p className="text-muted-foreground">No article data available</p>}
              </ScrollArea>
            </TabsContent>
            
            {debugData?.details?.debug && (
              <TabsContent value="apiResponse" className="flex-1">
                <ScrollArea className="h-full rounded-md border p-4">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium">Raw Response Snippet</h4>
                      <pre className="text-xs whitespace-pre-wrap p-2 bg-muted rounded-md mt-1">
                        {debugData.details.debug.rawResponseSnippet}
                      </pre>
                    </div>
                    <div>
                      <h4 className="font-medium">Response Length</h4>
                      <p className="text-sm">{debugData.details.debug.rawResponseLength} characters</p>
                    </div>
                    <div>
                      <h4 className="font-medium">Parsing Method</h4>
                      <p className="text-sm">{debugData.details.debug.parsingMethod}</p>
                    </div>
                  </div>
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
