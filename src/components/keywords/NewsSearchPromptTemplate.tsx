
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NewsSearchPromptTemplateProps {
  value: string;
  onChange: (value: string) => void;
  clusters: any[];
  sources: any[];
  searchSettings?: any;
  selectedThemes?: string[];
}

const NewsSearchPromptTemplate: React.FC<NewsSearchPromptTemplateProps> = ({
  value,
  onChange,
  clusters,
  sources,
  searchSettings,
  selectedThemes = []
}) => {
  const [isCustomizing, setIsCustomizing] = useState(false);
  
  // Auto-generate template when component mounts or dependencies change
  useEffect(() => {
    // Only auto-generate if there's no existing value or if we're starting fresh
    if (!value || value.trim() === "") {
      handleGenerateTemplate();
    }
  }, [sources, clusters, searchSettings, selectedThemes]);
  
  // Generate template prompt based on clusters and sources
  const handleGenerateTemplate = () => {
    const template = generateTemplate();
    onChange(template);
    setIsCustomizing(true);
  };
  
  // Helper function to convert recency filter to hours
  const getHoursFromRecency = (recency: string): string => {
    switch (recency) {
      case '30m': return "30 minutes";
      case 'hour': return "1 hour";
      case 'day': return "24 hours";
      case 'week': return "7 days";
      case 'month': return "30 days";
      case 'year': return "365 days";
      default: return "48 hours"; // Default value
    }
  };
  
  // Generate template prompt based on clusters and sources
  const generateTemplate = () => {
    // Group sources by tier
    const sourcesByTier = sources.reduce((acc, source) => {
      const tier = source.priority_tier || 4;
      if (!acc[tier]) acc[tier] = [];
      acc[tier].push(source);
      return acc;
    }, {});
    
    // Filter clusters by selected themes if provided
    const filteredClusters = selectedThemes && selectedThemes.length > 0
      ? clusters.filter(cluster => selectedThemes.includes(cluster.primary_theme))
      : clusters;
    
    // Group clusters by primary theme
    const clustersByTheme = filteredClusters.reduce((acc, cluster) => {
      const theme = cluster.primary_theme;
      if (!acc[theme]) acc[theme] = [];
      acc[theme].push(cluster);
      return acc;
    }, {});
    
    // Get time range from search settings or use default
    const timeRange = searchSettings?.recency_filter
      ? getHoursFromRecency(searchSettings.recency_filter)
      : "48 hours";
    
    // Build prompt template
    let template = `You are a senior editorial assistant for MortgagePoint, a leading news outlet covering mortgage lending, servicing, housing policy, regulation, and macroeconomic trends. Your task is to surface the most relevant and timely articles for our daily email briefing. Prioritize regulatory signals, data-driven insights, and impactful policy or market movements.

SEARCH & FILTER RULES:
1. Time Range:
Only include articles published within the last ${timeRange}.

2. Source Prioritization (in strict order):
`;

    // Add source tiers
    Object.keys(sourcesByTier).sort().forEach((tier, index) => {
      const tierName = index === 0 ? "Tier 1: Government & GSEs" :
                      index === 1 ? "Tier 2: Economic Organizations" :
                      index === 2 ? "Tier 3: National Media" :
                      "Tier 4: Trade Media";
                      
      const tierSources = sourcesByTier[tier];
      if (tierSources && tierSources.length > 0) {
        template += `\n${tierName}\n`;
        const siteQuery = tierSources.map(s => {
          try {
            return `site:${new URL(s.source_url).hostname.replace('www.', '')}`;
          } catch (e) {
            return `site:${s.source_url.replace('http://', '').replace('https://', '').replace('www.', '').split('/')[0]}`;
          }
        }).join(', ');
        template += `${siteQuery}\n`;
      }
    });

    template += `\n3. Topical Relevance (Must Match at Least One Cluster Below):\n\nCluster Keywords\n`;
    
    // Add clusters
    Object.keys(clustersByTheme).forEach(theme => {
      const themeClusters = clustersByTheme[theme];
      if (themeClusters && themeClusters.length > 0) {
        // Get keywords from all clusters with this theme
        const allKeywords = themeClusters.flatMap(c => c.keywords || []);
        const uniqueKeywords = Array.from(new Set(allKeywords));
        if (uniqueKeywords.length > 0) {
          template += `${theme} ${uniqueKeywords.slice(0, 5).join(', ')}\n`;
        }
      }
    });

    template += `
OUTPUT FORMAT PER ARTICLE:
Return at least 1 entry from each Tier with maximum of 10 entries in the following structure:

{
  "articles": [
    {
      "title": "Full headline of the article",
      "url": "Direct link to article",
      "cluster": "One of the predefined clusters",
      "summary": "A 1–2 sentence, click-optimized description designed for an email newsletter. Highlight urgency, reader value, or key data point.",
      "source": "GSE, Government, Economic Org, Media, or Competitor",
      "published": "ISO date format or human-readable recent time"
    }
  ]
}

EDITORIAL NOTES:
Prefer articles that provide data, regulatory direction, or industry impact. Support with key current economic indicators from FRED if applicable.

Avoid opinion/editorial unless from a government or economic authority.

Use natural, non-jargony language in summaries suitable for C-suite and mid-level mortgage professionals.`;

    return template;
  };
  
  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="prompt_template">Editorial Prompt Template</Label>
            <Button 
              onClick={handleGenerateTemplate}
              variant="secondary"
              size="sm"
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-3.5 w-3.5" /> 
              Regenerate Template
            </Button>
          </div>
          
          <Alert className="bg-blue-50">
            <Info className="h-4 w-4" />
            <AlertTitle>Auto-generated structured prompt</AlertTitle>
            <AlertDescription>
              This template incorporates your selected sources, clusters, and settings. You can edit it directly below.
            </AlertDescription>
          </Alert>
          
          <ScrollArea className="h-[400px] border rounded-md">
            <Textarea
              id="prompt_template"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[400px] font-mono text-sm border-0"
            />
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};

export default NewsSearchPromptTemplate;
