import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Cluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  description?: string;
  keywords?: string[];
  priority_weight?: number;
}

interface Source {
  id: string;
  source_name: string;
  source_url: string;
  priority_tier: number;
  source_type?: string;
}

interface NewsSearchPromptTemplateProps {
  value: string;
  onChange: (value: string) => void;
  clusters: Cluster[];
  sources: Source[];
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
  const [isGenerating, setIsGenerating] = useState(false);
  const lastGenerationRef = useRef<string>('');
  
  // Auto-generate template when component mounts or key dependencies change
  useEffect(() => {
    if (!value || value.trim() === "") {
      handleGenerateTemplate();
    }
  }, []);
  
  // Only regenerate if there are significant changes (not just weight updates)
  useEffect(() => {
    if (value && isCustomizing) {
      const currentKey = JSON.stringify({
        themes: selectedThemes.sort(),
        recency: searchSettings?.recency_filter,
        domain: searchSettings?.domain_filter
      });
      
      // Only auto-regenerate if key settings changed, not just weights
      if (lastGenerationRef.current && lastGenerationRef.current !== currentKey) {
        const shouldRegenerate = window.confirm(
          "Theme or search settings have changed. Would you like to regenerate the prompt template?"
        );
        if (shouldRegenerate) {
          handleGenerateTemplate();
        }
      }
      lastGenerationRef.current = currentKey;
    }
  }, [selectedThemes, searchSettings?.recency_filter, searchSettings?.domain_filter]);
  
  // Generate template prompt based on clusters and sources
  const handleGenerateTemplate = () => {
    setIsGenerating(true);
    try {
      const template = generateTemplate();
      onChange(template);
      setIsCustomizing(true);
      
      // Update the generation key to current settings
      lastGenerationRef.current = JSON.stringify({
        themes: selectedThemes.sort(),
        recency: searchSettings?.recency_filter,
        domain: searchSettings?.domain_filter
      });
    } finally {
      setTimeout(() => setIsGenerating(false), 300);
    }
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
    // Ensure we have valid arrays to work with
    const validSources: Source[] = Array.isArray(sources) ? sources : [];
    const validClusters: Cluster[] = Array.isArray(clusters) ? clusters : [];
    
    // Filter priority sources (tier 1-2 only) and exclude competitors
    const prioritySources = validSources.filter(s => 
      s.priority_tier <= 2 && 
      (!s.source_type || !s.source_type.toLowerCase().includes('competitor'))
    );
    
    // Get competitor sources for exclusion
    const competitorSources = validSources.filter(s => 
      s.source_type && s.source_type.toLowerCase().includes('competitor')
    );
    
    // Filter clusters by selected themes or use top weighted themes
    let filteredClusters: Cluster[] = [];
    if (selectedThemes && selectedThemes.length > 0) {
      filteredClusters = validClusters.filter(cluster => 
        selectedThemes.includes(cluster.primary_theme)
      );
    } else {
      // Sort by priority weight and get top themes
      const sortedClusters = validClusters.sort((a, b) => (b.priority_weight || 50) - (a.priority_weight || 50));
      const uniqueThemes = Array.from(new Set(sortedClusters.map(c => c.primary_theme))).slice(0, 5);
      filteredClusters = validClusters.filter(cluster => 
        uniqueThemes.includes(cluster.primary_theme)
      );
    }
    
    // Calculate total weight for proportional allocation
    const totalWeight = filteredClusters.reduce((sum, cluster) => sum + (cluster.priority_weight || 50), 0);
    
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

    template += `3. WEIGHTED Content Focus Areas & Keywords:\n\n`;
    
    // Group clusters by primary theme with weights and keywords
    const clustersByTheme = filteredClusters.reduce((acc: Record<string, Cluster[]>, cluster) => {
      const theme = cluster.primary_theme || "General";
      if (!acc[theme]) acc[theme] = [];
      acc[theme].push(cluster);
      return acc;
    }, {});
    
    // Sort themes by aggregate weight
    const sortedThemeEntries = Object.entries(clustersByTheme).sort(([, a], [, b]) => {
      const weightA = (a as Cluster[]).reduce((sum, cluster) => sum + (cluster.priority_weight || 50), 0) / (a as Cluster[]).length;
      const weightB = (b as Cluster[]).reduce((sum, cluster) => sum + (cluster.priority_weight || 50), 0) / (b as Cluster[]).length;
      return weightB - weightA;
    });
    
    sortedThemeEntries.forEach(([theme, themeClusters]: [string, Cluster[]]) => {
      // Calculate theme aggregate weight
      const themeWeight = themeClusters.reduce((sum, cluster) => sum + (cluster.priority_weight || 50), 0) / themeClusters.length;
      const weightPercentage = totalWeight > 0 ? Math.round((themeWeight / totalWeight) * 100 * themeClusters.length) : 0;
      
      // Add weight emphasis
      let emphasis = "";
      if (themeWeight >= 70) emphasis = " [HIGH PRIORITY - Focus heavily on this area]";
      else if (themeWeight >= 40) emphasis = " [MEDIUM PRIORITY - Balanced coverage]";
      else emphasis = " [LOW PRIORITY - Minimal but representative coverage]";
      
      template += `${theme} (Priority Weight: ${Math.round(themeWeight)}, Search Allocation: ${weightPercentage}%)${emphasis}:\n`;
      
      // Collect all keywords and sub-themes for this primary theme
      const allKeywords: string[] = [];
      const subThemes: string[] = [];
      
      themeClusters.forEach(cluster => {
        if (cluster.sub_theme && !subThemes.includes(cluster.sub_theme)) {
          subThemes.push(cluster.sub_theme);
        }
        // Safely handle keywords array with weight-based allocation
        if (cluster.keywords && Array.isArray(cluster.keywords)) {
          const clusterWeight = cluster.priority_weight || 50;
          const keywordAllocation = Math.max(3, Math.round((clusterWeight / 100) * 12)); // 3-12 keywords based on weight
          allKeywords.push(...cluster.keywords.slice(0, keywordAllocation));
        }
      });
      
      // Add sub-themes
      if (subThemes.length > 0) {
        template += `  Sub-areas: ${subThemes.join(', ')}\n`;
      }
      
      // Add unique keywords with weight-based selection
      if (allKeywords.length > 0) {
        const uniqueKeywords = Array.from(new Set(allKeywords));
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

DYNAMIC SCORING CRITERIA (Based on Content Weights):
`;

    // Calculate dynamic scoring based on cluster weights
    const highWeightThemes = sortedThemeEntries.filter(([, clusters]) => {
      const avgWeight = (clusters as Cluster[]).reduce((sum, c) => sum + (c.priority_weight || 50), 0) / (clusters as Cluster[]).length;
      return avgWeight >= 70;
    }).map(([theme]) => theme);

    const mediumWeightThemes = sortedThemeEntries.filter(([, clusters]) => {
      const avgWeight = (clusters as Cluster[]).reduce((sum, c) => sum + (c.priority_weight || 50), 0) / (clusters as Cluster[]).length;
      return avgWeight >= 40 && avgWeight < 70;
    }).map(([theme]) => theme);

    if (highWeightThemes.length > 0) {
      template += `- High Priority Topics (${highWeightThemes.join(', ')}): 40%\n`;
      template += `- Regulatory/policy implications: 25%\n`;
      template += `- Market trends and data: 20%\n`;
      template += `- Technology and innovation: 10%\n`;
      template += `- General competitive landscape: 5%\n`;
    } else {
      // Fallback to balanced scoring
      template += `- Direct impact on mortgage business operations: 30%\n`;
      template += `- Regulatory/policy implications: 25%\n`;
      template += `- Market trends and data: 20%\n`;
      template += `- Technology and innovation: 15%\n`;
      template += `- Competitive landscape changes: 10%\n`;
    }

    template += `
WEIGHT-BASED SEARCH STRATEGY:
• Give higher relevance scores to articles matching high-priority themes (70+ weight)
• Ensure balanced representation across all selected themes
• Adjust keyword density in search queries based on cluster weights
• Prioritize sources that frequently cover high-weight topic areas

OUTPUT FORMAT:
Return 5-10 articles in this JSON structure:

{
  "articles": [
    {
      "title": "Full headline of the article",
      "url": "Direct link to article", 
      "focus_area": "One of the weighted themes above",
      "summary": "1-2 sentence summary highlighting business impact and urgency",
      "source": "Source name and tier",
      "relevance_score": 85,
      "cluster_weight": 75,
      "justification": "Brief explanation of score, weight consideration, and business relevance"
    }
  ]
}

Search for articles matching these weighted criteria and provide relevance scores (0-100) with cluster weight consideration and justification.`;

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
              disabled={isGenerating}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} /> 
              {isGenerating ? 'Generating...' : 'Regenerate Template'}
            </Button>
          </div>
          
          <Alert className="bg-blue-50">
            <Info className="h-4 w-4" />
            <AlertTitle>Intelligent News Search Prompt</AlertTitle>
            <AlertDescription>
              This template uses your priority sources, keywords, and themes for targeted news discovery.
              {!readOnly && " You can edit it directly or regenerate from your current settings."}
              {isCustomizing && " Weight adjustments won't automatically regenerate the template."}
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
