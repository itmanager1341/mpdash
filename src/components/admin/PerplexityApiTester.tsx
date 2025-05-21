
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CheckCircle2, AlertCircle, TestTube2 } from "lucide-react";

export default function PerplexityApiTester() {
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{success: boolean, message: string, details?: string} | null>(null);
  
  const testApiKey = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('test-perplexity-key', {});
      
      if (error) {
        throw new Error(error.message);
      }
      
      setTestResult({
        success: data.success,
        message: data.message,
        details: data.sample_result || data.details
      });
      
      if (data.success) {
        toast.success("Perplexity API connection successful");
      } else {
        toast.error(data.message, {
          description: data.details
        });
      }
    } catch (error) {
      console.error("Error testing Perplexity API key:", error);
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
      toast.error("Error testing Perplexity API key");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center">
          <TestTube2 className="mr-2 h-5 w-5" />
          Test Perplexity API Connection
        </CardTitle>
      </CardHeader>
      <CardContent>
        {testResult && (
          <Alert className={`${testResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'} mb-4`}>
            <div className="flex items-start">
              {testResult.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 mr-2" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 mr-2" />
              )}
              <div>
                <AlertTitle className={testResult.success ? 'text-green-800' : 'text-red-800'}>
                  {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                </AlertTitle>
                <AlertDescription className={testResult.success ? 'text-green-700' : 'text-red-700'}>
                  {testResult.message}
                </AlertDescription>
                
                {testResult.details && (
                  <div className="mt-2 p-2 bg-white rounded border border-gray-100">
                    <p className="text-xs">{testResult.details}</p>
                  </div>
                )}
              </div>
            </div>
          </Alert>
        )}
        
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground mr-4">
            Verify if the Perplexity API key is valid and the service is accessible.
          </p>
          
          <Button
            onClick={testApiKey}
            variant="outline"
            disabled={isLoading}
            className="min-w-[120px]"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
