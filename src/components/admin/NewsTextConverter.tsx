
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Separator } from "@/components/ui/separator";

export default function NewsTextConverter() {
  const [textInput, setTextInput] = useState('');
  const [jsonOutput, setJsonOutput] = useState('');

  const convertToJson = () => {
    try {
      // Parse the text input into key-value pairs
      const lines = textInput.split('\n').filter(line => line.trim() !== '');
      const resultObj: Record<string, any> = {};
      
      lines.forEach(line => {
        // Look for "key": "value" pattern
        const match = line.match(/"([^"]+)":\s*"([^"]+)"/);
        if (match) {
          const [, key, value] = match;
          
          // Map input keys to the expected PerplexityNewsItem format
          switch (key) {
            case 'title':
              resultObj.headline = value;
              break;
            case 'cluster':
              resultObj.matched_clusters = [value];
              break;
            case 'published':
              resultObj.timestamp = value;
              break;
            default:
              resultObj[key] = value;
          }
        }
      });
      
      // Add required fields with default values if missing
      if (!resultObj.perplexity_score) {
        resultObj.perplexity_score = 3.0;
      }
      
      if (!resultObj.is_competitor_covered) {
        resultObj.is_competitor_covered = false;
      }
      
      // Format as pretty JSON
      const formattedJson = JSON.stringify(resultObj, null, 2);
      setJsonOutput(formattedJson);
      toast.success("Text converted to JSON format");
    } catch (error) {
      console.error("Error converting to JSON:", error);
      toast.error("Failed to convert text to JSON format");
    }
  };

  const copyToClipboard = () => {
    if (jsonOutput) {
      navigator.clipboard.writeText(jsonOutput);
      toast.success("JSON copied to clipboard");
    }
  };

  return (
    <Card className="w-full mb-6">
      <CardHeader>
        <CardTitle>Text to JSON Converter</CardTitle>
        <CardDescription>
          Paste text in "key": "value" format to convert to JSON for the news importer
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-sm font-medium mb-2">Input Text</h3>
          <Textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder={'"title": "Example News Title",\n"url": "https://example.com",\n"cluster": "Example Cluster",\n"summary": "Example summary text",\n"source": "Example Source",\n"published": "2025-05-01"'}
            className="min-h-[150px]"
          />
        </div>
        
        <Button onClick={convertToJson} className="w-full">
          Convert to JSON
        </Button>
        
        {jsonOutput && (
          <>
            <Separator />
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">JSON Output</h3>
                <Button variant="outline" size="sm" onClick={copyToClipboard}>
                  Copy
                </Button>
              </div>
              <pre className="bg-muted p-4 rounded-md overflow-x-auto text-xs">
                {jsonOutput}
              </pre>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="text-xs text-muted-foreground">
        This tool maps your text input to the required JSON format for the news importer.
      </CardFooter>
    </Card>
  );
}
