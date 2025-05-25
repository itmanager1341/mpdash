
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, RefreshCw, Check } from "lucide-react";

interface InlineAISuggestionsProps {
  type: "headline" | "summary" | "cta";
  currentValue: string;
  suggestions: string[];
  onApply: (suggestion: string) => void;
  onGenerate: () => void;
  isGenerating?: boolean;
}

export function InlineAISuggestions({
  type,
  currentValue,
  suggestions,
  onApply,
  onGenerate,
  isGenerating = false
}: InlineAISuggestionsProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (suggestions.length === 0) {
    return (
      <div className="mt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onGenerate}
          disabled={isGenerating || !currentValue.trim()}
          className="h-7 px-2 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50"
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-3 w-3 mr-1" />
              Get AI suggestions
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-xs">
          <Sparkles className="h-3 w-3 mr-1" />
          AI Suggestions
        </Badge>
        <Button
          variant="ghost"
          size="sm"
          onClick={onGenerate}
          disabled={isGenerating}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className={`h-3 w-3 ${isGenerating ? 'animate-spin' : ''}`} />
        </Button>
      </div>
      
      <div className="space-y-1">
        {suggestions.slice(0, 3).map((suggestion, index) => (
          <div
            key={index}
            className={`p-2 rounded-md border text-xs cursor-pointer transition-colors ${
              selectedIndex === index
                ? 'border-blue-300 bg-blue-50'
                : 'border-gray-200 bg-white hover:border-blue-200 hover:bg-blue-25'
            }`}
            onClick={() => setSelectedIndex(selectedIndex === index ? null : index)}
          >
            <div className="flex items-start justify-between gap-2">
              <p className="flex-1">{suggestion}</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onApply(suggestion);
                }}
                className="h-6 w-6 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
              >
                <Check className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
