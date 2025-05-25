
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
  execution_time?: string;
  error?: string;
}

export default function PromptTester({ prompt, open, onOpenChange }: PromptTesterProps) {
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const testPromptMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-perplexity-news', {
        body: {
          keywords: ['mortgage rates', 'housing market', 'federal reserve'],
          promptId: prompt.id,
          minScore: 0.6,
          limit: 5,
          test: true
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setTestResult({
        success: true,
        articles: data.articles || [],
        execution_time: new Date().toISOString()
      });
      toast.success('Prompt test completed');
    },
    onError: (error) => {
      setTestResult({
        success: false,
        articles: [],
        error: error.message,
        execution_time: new Date().toISOString()
      });
      toast.error('Test failed: ' + error.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Test: {prompt.function_name}
          </DialogTitle>
          <DialogDescription>
            Run a test to see what content this prompt would discover
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline">{prompt.model}</Badge>
            <Button 
              onClick={() => {
                setTestResult(null);
                testPromptMutation.mutate();
              }}
              disabled={testPromptMutation.isPending}
            >
              {testPromptMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Testing...
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4 mr-2" />
                  Run Test
                </>
              )}
            </Button>
          </div>

          {testResult && (
            <div className="border rounded-lg p-4">
              <div className="flex items-center gap-2 mb-4">
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                )}
                <span className="font-medium">
                  {testResult.success ? 'Test Successful' : 'Test Failed'}
                </span>
                <Badge variant="secondary">
                  {testResult.articles.length} articles found
                </Badge>
              </div>

              {testResult.error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                  <p className="text-red-700 text-sm">{testResult.error}</p>
                </div>
              )}

              {testResult.success && testResult.articles.length > 0 && (
                <ScrollArea className="h-64">
                  <div className="space-y-3">
                    {testResult.articles.map((article, index) => (
                      <div key={index} className="border-l-2 border-blue-500 pl-3 pb-3">
                        <h5 className="font-medium">{article.title}</h5>
                        <p className="text-sm text-muted-foreground">{article.summary}</p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">{article.source}</Badge>
                          <Badge variant="secondary">
                            Score: {article.relevance_score?.toFixed(2)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
