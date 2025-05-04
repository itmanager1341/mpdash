
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { insertExampleNewsItem, insertPerplexityNewsItem, PerplexityNewsItem } from "@/utils/newsUtils";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

export default function NewsImporter() {
  const [isLoading, setIsLoading] = useState(false);
  const [jsonInput, setJsonInput] = useState('');

  const handleInsertExample = async () => {
    setIsLoading(true);
    try {
      await insertExampleNewsItem();
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportJson = async () => {
    if (!jsonInput.trim()) {
      toast.error("Please enter JSON data");
      return;
    }

    setIsLoading(true);
    try {
      // Try to parse the JSON input
      let newsItem: PerplexityNewsItem;
      try {
        newsItem = JSON.parse(jsonInput);
      } catch (e) {
        toast.error("Invalid JSON format");
        return;
      }

      // Validate required fields
      if (!newsItem.headline || !newsItem.url) {
        toast.error("Missing required fields (headline, url)");
        return;
      }

      const result = await insertPerplexityNewsItem(newsItem);
      if (result.success) {
        toast.success("News item successfully imported!");
        setJsonInput('');
      } else {
        toast.error("Failed to import news item");
      }
    } catch (error) {
      console.error("Error importing news:", error);
      toast.error("An error occurred while importing");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Import News</CardTitle>
        <CardDescription>
          Import news data from Perplexity or other sources to populate the editorial dashboard.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Textarea
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder='Paste JSON news data here...'
            className="min-h-32"
          />
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button 
          onClick={handleImportJson} 
          disabled={isLoading || !jsonInput.trim()}
        >
          {isLoading ? "Importing..." : "Import JSON"}
        </Button>
        <Button 
          variant="outline" 
          onClick={handleInsertExample} 
          disabled={isLoading}
        >
          Insert Example Data
        </Button>
      </CardFooter>
    </Card>
  );
}
