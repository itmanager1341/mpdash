
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
  readOnly?: boolean;
}

const NewsSearchPromptTemplate: React.FC<NewsSearchPromptTemplateProps> = ({
  value,
  onChange,
  clusters,
  sources,
  searchSettings = { recency_filter: 'day', domain_filter: 'auto' },
  selectedThemes = [],
  readOnly = false
}) => {
  const [isCustomizing, setIsCustomizing] = useState(false);
  
  // Auto-generate template when component mounts or dependencies change
  useEffect(() => {
    if (!value || value.trim() === "") {
      handleGenerateTemplate();
    }
  }, []);
  
  // Generate template prompt based on clusters and sources
  const handleGenerateTemplate = () => {
    const template = generateTemplate();
    onChange(template);
    setIsCustomizing(true);
  };
  
  const getHoursFromRecency = (recency: string): string => {
    switch (recency) {
      case '30m': return "30 minutes";
      case 'hour': return "1 hour";
      case 'day': return "24 hours";
      case '48h': return "48 hours";
      case 'week': return "7 days";
      case 'month': return "30 days";
      case 'year': return "365 days";
      default: return "24 hours";
    }
  };
  
  const generateTemplate = () => {
    // Filter priority sources (tier 1-2 only) and exclude competitors
    const prioritySources = sources.filter(s => 
      s.priority_tier <= 2 && 
      !s.source_type?.toLowerCase().includes('competitor')
    );
    
    // Get competitor sources for exclusion
    const competitorSources = sources.filter(s => 
      s.source_type?.toLowerCase().includes('competitor')
    );
    
    // Filter clusters by selected themes or use top themes
    let filteredClusters = [];
    if (selectedThemes && selectedThemes.length > 0) {
      filteredClusters = clusters.filter(cluster => 
        selectedThemes.includes(cluster.primary_theme)
      );
    } else {
      // Get unique primary themes, limit to top 5
      const uniqueThemes = Array.from(new Set(clusters.map(c => c.primary_theme))).slice(0, 5);
      filteredClusters = clusters.filter(cluster => 
        uniqueThemes.includes(cluster.primary_theme)
      );
    }
    
    const timeRange = searchSettings?.recency_filter
      ? getHoursFromRecency(searchSettings.recency_filter)
      : "24 hours";
    
    let template = `You are a senior editorial assistant for MortgagePoint, a leading news outlet covering mortgage lending, servicing, housing policy, regulation, and macroeconomic trends. Your task is to surface the most relevant and timely articles for our daily email briefing.

SEARCH & FILTER RULES:
1. Time Range: Only include articles published within the last ${timeRange}.

2. Priority Sources (search these first):
`;

    // Add priority sources with proper grouping
    if (prioritySources.length > 0) {
      const sourceQueries = prioritySources.map(s => {
        try {
          return `site:${new URL(s.source_url).hostname.replace('www.', '')}`;
        } catch (e) {
          return `site:${s.source_url.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0]}`;
        }
      });
      template += sourceQueries.join(' OR ') + '\n\n';
    }

    template += `3. Content Focus Areas & Keywords:\n\n`;
    
    // Group clusters by primary theme with keywords and sub-themes
    const clustersByTheme = filteredClusters.reduce((acc: Record<string, any[]>, cluster) => {
      const theme = cluster.primary_theme || "General";
      if (!acc[theme]) acc[theme] = [];
      acc[theme].push(cluster);
      return acc;
    }, {});
    
    Object.entries(clustersByTheme).forEach(([theme, themeClusters]) => {
      template += `${theme}:\n`;
      
      // Collect all keywords and sub-themes for this primary theme
      const allKeywords: string[] = [];
      const subThemes: string[] = [];
      
      themeClusters.forEach(cluster => {
        if (cluster.sub_theme && !subThemes.includes(cluster.sub_theme)) {
          subThemes.push(cluster.sub_theme);
        }
        if (cluster.keywords && Array.isArray(cluster.keywords)) {
          allKeywords.push(...cluster.keywords);
        }
      });
      
      // Add sub-themes
      if (subThemes.length > 0) {
        template += `  Sub-areas: ${subThemes.join(', ')}\n`;
      }
      
      // Add unique keywords (limit to most relevant)
      if (allKeywords.length > 0) {
        const uniqueKeywords = Array.from(new Set(allKeywords)).slice(0, 8);
        template += `  Keywords: ${uniqueKeywords.join(', ')}\n`;
      }
      
      template += '\n';
    });

    // Add competitor exclusion if any exist
    if (competitorSources.length > 0) {
      template += `4. Exclude Competitor Coverage:\n`;
      competitorSources.forEach(s => {
        template += `• Avoid ${s.source_name}\n`;
      });
      template += '\n';
    }

    template += `SEARCH REQUIREMENTS:
• Focus on BUSINESS IMPACT - regulatory changes, market shifts, technology disruptions
• Prioritize PRIMARY SOURCES - government agencies, Fed announcements, industry leaders  
• Exclude consumer-focused content and basic homebuying advice
• Look for competitive intelligence and market opportunities

SCORING CRITERIA:
- Direct impact on mortgage business operations (30%)
- Regulatory/policy implications (25%)
- Market trends and data (20%)
- Technology and innovation (15%)
- Competitive landscape changes (10%)

OUTPUT FORMAT:
Return 5-10 articles in this JSON structure:

{
  "articles": [
    {
      "title": "Full headline of the article",
      "url": "Direct link to article", 
      "focus_area": "One of the primary themes above",
      "summary": "1-2 sentence summary highlighting business impact and urgency",
      "source": "Source name and tier",
      "relevance_score": 85,
      "justification": "Brief explanation of score and business relevance"
    }
  ]
}

Search for articles matching these criteria and provide relevance scores (0-100) with justification.`;

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
            <AlertTitle>Intelligent News Search Prompt</AlertTitle>
            <AlertDescription>
              This template uses your priority sources, keywords, and themes for targeted news discovery.
              {!readOnly && " You can edit it directly or regenerate from your current settings."}
            </AlertDescription>
          </Alert>
          
          <ScrollArea className="h-[400px] border rounded-md">
            <Textarea
              id="prompt_template"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[400px] font-mono text-sm border-0"
              readOnly={readOnly}
            />
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};

export default NewsSearchPromptTemplate;
