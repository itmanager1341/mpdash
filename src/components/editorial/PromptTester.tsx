
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  TestTube, 
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  TrendingUp
} from "lucide-react";

interface PromptTesterProps {
  prompt: {
    id: string;
    function_name: string;
    model: string;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TestResult {
  success: boolean;
  articles: any[];
  debug?: any;
  execution_time?: string;
  error?: string;
}

export default function PromptTester({ prompt, open, onOpenChange }: PromptTesterProps) {
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const testPromptMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-perplexity-news', {
        body: {
          keywords: ['mortgage rates', 'housing market', 'federal reserve'], // Default test keywords
          promptId: prompt.id,
          minScore: 0.6,
          limit: 5,
          test: true // Flag to indicate this is a test run
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setTestResult({
        success: true,
        articles: data.articles || [],
        debug: data.debug,
        execution_time: new Date().toISOString()
      });
      toast.success('Prompt test completed successfully');
    },
    onError: (error) => {
      setTestResult({
        success: false,
        articles: [],
        error: error.message,
        execution_time: new Date().toISOString()
      });
      toast.error('Prompt test failed: ' + error.message);
    }
  });

  const handleRunTest = () => {
    setTestResult(null);
    testPromptMutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Test Prompt: {prompt.function_name}
          </DialogTitle>
          <DialogDescription>
            Run a live test of this prompt to see what articles it would find
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Badge variant="outline">{prompt.model}</Badge>
              <p className="text-sm text-muted-foreground">
                Test keywords: mortgage rates, housing market, federal reserve
              </p>
            </div>
            <Button 
              onClick={handleRunTest}
              disabled={testPromptMutation.isPending}
              className="flex items-center gap-2"
            >
              {testPromptMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4" />
                  Run Test
                </>
              )}
            </Button>
          </div>

          {testResult && (
            <div className="border rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  )}
                  <span className="font-medium">
                    {testResult.success ? 'Test Successful' : 'Test Failed'}
                  </span>
                </div>
                <Badge variant="secondary">
                  {testResult.articles.length} articles found
                </Badge>
              </div>

              {testResult.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-700 text-sm">{testResult.error}</p>
                </div>
              )}

              {testResult.success && testResult.articles.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Sample Results
                  </h4>
                  <ScrollArea className="h-64 border rounded-lg p-3">
                    <div className="space-y-3">
                      {testResult.articles.map((article, index) => (
                        <div key={index} className="border-l-2 border-blue-500 pl-3 space-y-1">
                          <h5 className="font-medium text-sm">{article.title}</h5>
                          <p className="text-xs text-muted-foreground">{article.summary}</p>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {article.source}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              Score: {article.relevance_score?.toFixed(2)}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {testResult.success && testResult.articles.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-amber-700 text-sm">
                    No articles found. Consider adjusting your prompt criteria or keywords.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
