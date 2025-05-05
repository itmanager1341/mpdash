
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { testPrompt } from "@/utils/llmPromptsUtils";

interface PromptTesterProps {
  prompt: LlmPrompt;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function PromptTester({ prompt, open, onOpenChange }: PromptTesterProps) {
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<LlmTestResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resultView, setResultView] = useState("formatted");

  const handleTest = async () => {
    if (!testInput.trim()) {
      toast.error("Please provide test input data");
      return;
    }

    setIsLoading(true);
    try {
      let inputData: Record<string, any>;
      try {
        // Try parsing as JSON
        inputData = JSON.parse(testInput);
      } catch (e) {
        // If not valid JSON, use as plain text
        inputData = { text: testInput };
      }

      const testData: LlmTestInput = {
        prompt_id: prompt.id,
        function_name: prompt.function_name,
        prompt_text: prompt.prompt_text,
        model: prompt.model,
        input_data: inputData,
        include_clusters: prompt.include_clusters,
        include_tracking_summary: prompt.include_tracking_summary,
        include_sources_map: prompt.include_sources_map
      };

      const result = await testPrompt(testData);
      setTestResult(result);
    } catch (error) {
      console.error("Error testing prompt:", error);
      toast.error("Failed to test prompt");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Test Prompt: {prompt.function_name}</DialogTitle>
          <DialogDescription>
            Enter sample data and test how the prompt performs
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label htmlFor="test-input">Test Input</Label>
            <Textarea
              id="test-input"
              placeholder={`{\n  "title": "Sample Article Title",\n  "content": "Content to process..."\n}`}
              value={testInput}
              onChange={(e) => setTestInput(e.target.value)}
              className="font-mono text-sm min-h-[150px]"
            />
            <p className="text-xs text-muted-foreground">
              Enter JSON or plain text data to use for testing this prompt
            </p>
          </div>

          <Button onClick={handleTest} disabled={isLoading}>
            {isLoading ? "Processing..." : "Run Test"}
          </Button>

          {testResult && (
            <div className="border rounded-md p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Result</h3>
                <Tabs
                  value={resultView}
                  onValueChange={setResultView}
                >
                  <TabsList>
                    <TabsTrigger value="formatted">Formatted</TabsTrigger>
                    <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <TabsContent value="formatted" className="mt-0">
                <div className="bg-muted p-3 rounded-md max-h-[400px] overflow-auto">
                  <pre className="whitespace-pre-wrap">
                    {typeof testResult.output === 'object'
                      ? JSON.stringify(testResult.output, null, 2)
                      : testResult.output}
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="raw" className="mt-0">
                <div className="bg-muted p-3 rounded-md max-h-[400px] overflow-auto">
                  <pre className="text-xs font-mono whitespace-pre-wrap">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </div>
              </TabsContent>

              {testResult.timing && (
                <div className="mt-4 text-sm text-muted-foreground">
                  <p>Time: {testResult.timing.total_ms}ms</p>
                  {testResult.timing.prompt_tokens && (
                    <p>Prompt tokens: {testResult.timing.prompt_tokens}</p>
                  )}
                  {testResult.timing.completion_tokens && (
                    <p>Completion tokens: {testResult.timing.completion_tokens}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
