
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, RefreshCw, Sparkles, ThumbsUp, ThumbsDown } from "lucide-react";

interface AISuggestionCardProps {
  type: "headline" | "cta" | "summary";
  suggestions: string[];
  onSelect: (suggestion: string) => void;
  onRefine: (suggestion: string) => void;
  onGenerateMore: () => void;
  isGenerating?: boolean;
}

export function AISuggestionCard({ 
  type, 
  suggestions, 
  onSelect, 
  onRefine, 
  onGenerateMore,
  isGenerating = false 
}: AISuggestionCardProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [ratings, setRatings] = useState<{ [key: number]: 'up' | 'down' | null }>({});

  const handleRate = (index: number, rating: 'up' | 'down') => {
    setRatings(prev => ({ ...prev, [index]: rating }));
  };

  const getTypeLabel = () => {
    switch (type) {
      case "headline": return "Headlines";
      case "cta": return "Call-to-Actions";
      case "summary": return "Summaries";
    }
  };

  const getTypeColor = () => {
    switch (type) {
      case "headline": return "bg-blue-50 border-blue-200";
      case "cta": return "bg-green-50 border-green-200";
      case "summary": return "bg-purple-50 border-purple-200";
    }
  };

  return (
    <Card className={`${getTypeColor()} transition-all duration-200`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          AI {getTypeLabel()}
          <Badge variant="outline" className="ml-auto">
            {suggestions.length} suggestions
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <div 
            key={index}
            className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
              selectedIndex === index 
                ? 'border-primary bg-primary/5 shadow-sm' 
                : 'border-muted bg-white hover:border-primary/50'
            }`}
            onClick={() => setSelectedIndex(selectedIndex === index ? null : index)}
          >
            <p className="text-sm mb-2">{suggestion}</p>
            
            <div className="flex items-center justify-between">
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRate(index, 'up');
                  }}
                >
                  <ThumbsUp className={`h-3 w-3 ${ratings[index] === 'up' ? 'fill-current text-green-600' : ''}`} />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRate(index, 'down');
                  }}
                >
                  <ThumbsDown className={`h-3 w-3 ${ratings[index] === 'down' ? 'fill-current text-red-600' : ''}`} />
                </Button>
              </div>
              
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRefine(suggestion);
                  }}
                >
                  Refine
                </Button>
                <Button
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(suggestion);
                  }}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Use
                </Button>
              </div>
            </div>
          </div>
        ))}
        
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={onGenerateMore}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate More
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
