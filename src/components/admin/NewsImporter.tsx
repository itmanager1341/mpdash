
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { insertExampleNewsItem, insertPerplexityNewsItem, PerplexityNewsItem, checkForDuplicateNews } from "@/utils/newsUtils";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function NewsImporter() {
  const [isLoading, setIsLoading] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [minPerplexityScore, setMinPerplexityScore] = useState(2.0);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);
  const [skipDuplicateCheck, setSkipDuplicateCheck] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const handleInsertExample = async () => {
    setIsLoading(true);
    try {
      await insertExampleNewsItem();
    } finally {
      setIsLoading(false);
    }
  };

  // Validate the news item before submission
  const validateNewsItem = (newsItem: PerplexityNewsItem): string[] => {
    const errors: string[] = [];
    
    if (!newsItem.headline || newsItem.headline.trim().length < 5) {
      errors.push("Headline is required and should be at least 5 characters");
    }
    
    if (!newsItem.url || !newsItem.url.includes(".")) {
      errors.push("Valid URL is required");
    }
    
    if (!newsItem.summary || newsItem.summary.trim().length < 20) {
      errors.push("Summary is required and should be at least 20 characters");
    }
    
    if (!newsItem.source || newsItem.source.trim().length < 2) {
      errors.push("Source is required");
    }
    
    if (typeof newsItem.perplexity_score !== 'number' || newsItem.perplexity_score < 0) {
      errors.push("Perplexity score should be a positive number");
    } else if (newsItem.perplexity_score < minPerplexityScore) {
      errors.push(`Perplexity score is below the minimum threshold of ${minPerplexityScore}`);
    }
    
    if (!Array.isArray(newsItem.matched_clusters)) {
      errors.push("Matched clusters should be an array");
    }
    
    return errors;
  };

  const handleImportJson = async () => {
    if (!jsonInput.trim()) {
      toast.error("Please enter JSON data");
      return;
    }

    setIsLoading(true);
    setValidationErrors([]);
    
    try {
      // Try to parse the JSON input
      let newsItem: PerplexityNewsItem;
      try {
        newsItem = JSON.parse(jsonInput);
      } catch (e) {
        toast.error("Invalid JSON format");
        setIsLoading(false);
        return;
      }

      // Validate the news item
      const errors = validateNewsItem(newsItem);
      if (errors.length > 0) {
        setValidationErrors(errors);
        toast.error("Validation failed. See errors below.");
        setIsLoading(false);
        return;
      }

      // Check for duplicates (unless skipped)
      if (!skipDuplicateCheck) {
        const isDuplicate = await checkForDuplicateNews(newsItem);
        if (isDuplicate) {
          toast.error("This news item already exists in the database");
          setIsLoading(false);
          return;
        }
      }

      // All validation passed, insert the news item
      const result = await insertPerplexityNewsItem(newsItem);
      if (result.success) {
        toast.success("News item successfully imported!");
        setJsonInput('');
        setValidationErrors([]);
      } else {
        toast.error(`Failed to import news item: ${result.error}`);
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

        <Collapsible
          open={showAdvancedOptions}
          onOpenChange={setShowAdvancedOptions}
          className="w-full"
        >
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="w-full">
              {showAdvancedOptions ? "Hide" : "Show"} Advanced Options
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="perplexity-score">Minimum Perplexity Score: {minPerplexityScore.toFixed(1)}</Label>
              </div>
              <Slider 
                id="perplexity-score"
                min={0} 
                max={5} 
                step={0.1} 
                value={[minPerplexityScore]}
                onValueChange={(values) => setMinPerplexityScore(values[0])}
              />
              <p className="text-xs text-muted-foreground">
                Higher values indicate more relevant news items (0-5 scale)
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="skip-duplicate" 
                checked={skipDuplicateCheck} 
                onCheckedChange={(checked) => setSkipDuplicateCheck(checked === true)}
              />
              <Label htmlFor="skip-duplicate">Skip duplicate checking</Label>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {validationErrors.length > 0 && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="font-medium text-red-800 mb-1">Validation errors:</p>
            <ul className="list-disc pl-5 text-sm text-red-700">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}
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
