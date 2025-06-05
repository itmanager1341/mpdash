import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, RefreshCw, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Cluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  description?: string;
  keywords?: string[];
  professions?: string[];
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
  includeSourcesMap?: boolean;
}

const NewsSearchPromptTemplate: React.FC<NewsSearchPromptTemplateProps> = ({
  value,
  onChange,
  clusters,
  sources,
  searchSettings = { recency_filter: 'day', domain_filter: 'auto' },
  selectedThemes = [],
  readOnly = false,
  includeSourcesMap = false
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
  
  // Only regenerate if there are significant changes
  useEffect(() => {
    if (value && isCustomizing) {
      const currentKey = JSON.stringify({
        themes: selectedThemes.sort(),
        recency: searchSettings?.recency_filter,
        domain: searchSettings?.domain_filter,
        includeSourcesMap
      });
      
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
  }, [selectedThemes, searchSettings?.recency_filter, searchSettings?.domain_filter, includeSourcesMap]);
  
  // Generate template prompt based on clusters and sources
  const handleGenerateTemplate = () => {
    setIsGenerating(true);
    try {
      const template = generateTemplate();
      onChange(template);
      setIsCustomizing(true);
      
      lastGenerationRef.current = JSON.stringify({
        themes: selectedThemes.sort(),
        recency: searchSettings?.recency_filter,
        domain: searchSettings?.domain_filter,
        includeSourcesMap
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
    
    // Filter clusters by selected themes or use all clusters
    let filteredClusters: Cluster[] = [];
    if (selectedThemes && selectedThemes.length > 0) {
      filteredClusters = validClusters.filter(cluster => 
        selectedThemes.includes(cluster.primary_theme)
      );
    } else {
      filteredClusters = validClusters;
    }
    
    // Sort clusters by priority weight (highest first)
    filteredClusters.sort((a, b) => (b.priority_weight || 0) - (a.priority_weight || 0));
    
    const timeRange = searchSettings?.recency_filter
      ? getHoursFromRecency(searchSettings.recency_filter)
      : "24 hours";
    
    let template = `You are a senior editorial assistant for MortgagePoint, the premier industry publication for mortgage lending professionals. Your role is to identify the most strategically valuable content for our daily briefing, focusing on business-critical intelligence that impacts mortgage industry operations.

SEARCH PARAMETERS & FILTERS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⏰ TIME SCOPE: Articles published within the last ${timeRange}
`;

    // Conditionally include priority source strategy only if includeSourcesMap is true
    if (includeSourcesMap) {
      template += `
🎯 PRIORITY SOURCE STRATEGY:
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
        template += `Search these authoritative sources first:\n${sourceQueries.join(' OR ')}\n`;
      }
    }

    template += `
📊 CONTENT FOCUS AREAS (Weighted by Editorial Priority):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    
    // Group clusters by primary theme with weights
    const clustersByTheme = filteredClusters.reduce((acc: Record<string, Cluster[]>, cluster) => {
      const theme = cluster.primary_theme || "General";
      if (!acc[theme]) acc[theme] = [];
      acc[theme].push(cluster);
      return acc;
    }, {});
    
    // Calculate theme totals and sort by aggregate weight
    const sortedThemeEntries = Object.entries(clustersByTheme)
      .map(([theme, themeClusters]) => {
        const totalWeight = themeClusters.reduce((sum, cluster) => sum + (cluster.priority_weight || 0), 0);
        return [theme, themeClusters, totalWeight] as [string, Cluster[], number];
      })
      .sort(([, , a], [, , b]) => b - a);
    
    sortedThemeEntries.forEach(([theme, themeClusters, themeWeight]: [string, Cluster[], number]) => {
      // Add priority level indicator
      let priorityIndicator = "";
      if (themeWeight >= 25) priorityIndicator = "🔥 CRITICAL PRIORITY";
      else if (themeWeight >= 15) priorityIndicator = "⚡ HIGH PRIORITY";
      else if (themeWeight >= 8) priorityIndicator = "📈 MEDIUM PRIORITY";
      else priorityIndicator = "📋 STANDARD COVERAGE";
      
      template += `${priorityIndicator} | ${theme.toUpperCase()} (${themeWeight.toFixed(1)}% weight)\n`;
      template += `${"=".repeat(60)}\n`;
      
      // Sort sub-themes by weight within this theme
      const sortedSubThemes = themeClusters.sort((a, b) => (b.priority_weight || 0) - (a.priority_weight || 0));
      
      sortedSubThemes.forEach(cluster => {
        const weight = cluster.priority_weight || 0;
        const urgencyLevel = weight >= 15 ? "🚨 URGENT" : weight >= 8 ? "⏰ IMPORTANT" : "📝 MONITOR";
        
        template += `\n${urgencyLevel} ${cluster.sub_theme} (${weight.toFixed(1)}%)\n`;
        
        if (cluster.description) {
          template += `   Context: ${cluster.description}\n`;
        }
        
        if (cluster.professions && cluster.professions.length > 0) {
          template += `   Target Audience: ${cluster.professions.join(', ')}\n`;
        }
        
        if (cluster.keywords && cluster.keywords.length > 0) {
          // Show more keywords for higher weighted clusters
          const keywordLimit = weight >= 15 ? 15 : weight >= 8 ? 10 : 6;
          const displayKeywords = cluster.keywords.slice(0, keywordLimit);
          template += `   Search Terms: ${displayKeywords.join(', ')}\n`;
        }
        template += `\n`;
      });
      
      template += `\n`;
    });

    // Add competitor exclusion if any exist (only if includeSourcesMap is true)
    if (includeSourcesMap && competitorSources.length > 0) {
      template += `🚫 EXCLUDE COMPETITOR COVERAGE:\n`;
      template += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      competitorSources.forEach(s => {
        template += `• Avoid content from ${s.source_name}\n`;
      });
      template += '\n';
    }

    template += `🎯 STRATEGIC SEARCH REQUIREMENTS:\n`;
    template += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    template += `✓ BUSINESS IMPACT FOCUS: Regulatory changes, market disruptions, policy shifts\n`;
    template += `✓ PRIMARY SOURCE PRIORITY: Government agencies, Federal Reserve, industry leaders\n`;
    template += `✓ EXECUTIVE INTELLIGENCE: C-suite moves, strategic acquisitions, market analysis\n`;
    template += `✓ OPERATIONAL RELEVANCE: Technology adoption, process improvements, compliance updates\n`;
    template += `✓ COMPETITIVE ADVANTAGE: Market opportunities, emerging trends, best practices\n\n`;

    template += `❌ CONTENT EXCLUSIONS:\n`;
    template += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    template += `× Consumer-focused homebuying advice and tips\n`;
    template += `× Basic mortgage education content\n`;
    template += `× Generic real estate market reports without industry context\n`;
    template += `× Promotional content or advertorials\n\n`;

    template += `🏆 DYNAMIC RELEVANCE SCORING (Weight-Based Algorithm):\n`;
    template += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    // Calculate dynamic scoring based on cluster weights
    const highWeightThemes = sortedThemeEntries.filter(([, , weight]) => weight >= 20).map(([theme]) => theme);
    const mediumWeightThemes = sortedThemeEntries.filter(([, , weight]) => weight >= 10 && weight < 20).map(([theme]) => theme);

    if (highWeightThemes.length > 0) {
      template += `• Critical Topics (${highWeightThemes.join(', ')}): 35% weight\n`;
      template += `• Regulatory/Policy Impact: 25% weight\n`;
      template += `• Market Intelligence & Data: 20% weight\n`;
      template += `• Technology & Innovation: 12% weight\n`;
      template += `• Industry Leadership & Strategy: 8% weight\n\n`;
    } else {
      template += `• Direct Business Operations Impact: 30% weight\n`;
      template += `• Regulatory/Policy Implications: 25% weight\n`;
      template += `• Market Trends & Economic Data: 20% weight\n`;
      template += `• Technology & Process Innovation: 15% weight\n`;
      template += `• Competitive Landscape Changes: 10% weight\n\n`;
    }

    template += `🧠 AI SEARCH STRATEGY & BEST PRACTICES:\n`;
    template += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    template += `1. WEIGHTED SEARCH APPROACH:\n`;
    template += `   → Prioritize high-weight themes (15%+ clusters) in initial search queries\n`;
    template += `   → Use cluster-specific keywords with boolean operators for precision\n`;
    template += `   → Cross-reference multiple clusters for comprehensive coverage\n\n`;
    
    template += `2. QUALITY ASSESSMENT FRAMEWORK:\n`;
    template += `   → SOURCE CREDIBILITY: Government > Industry Associations > Major Publishers\n`;
    template += `   → CONTENT FRESHNESS: Breaking news > Recent analysis > Historical context\n`;
    template += `   → BUSINESS RELEVANCE: Operations impact > Market trends > General interest\n`;
    template += `   → AUDIENCE SPECIFICITY: C-suite insights > Department leaders > General workforce\n\n`;

    template += `3. INTELLIGENT FILTERING:\n`;
    template += `   → Match article keywords against cluster professions for audience relevance\n`;
    template += `   → Evaluate content depth and analytical substance over surface coverage\n`;
    template += `   → Prioritize forward-looking analysis over historical summaries\n`;
    template += `   → Favor actionable insights over informational content\n\n`;

    template += `📋 REQUIRED OUTPUT FORMAT:\n`;
    template += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    template += `Return 5-10 articles in this structured JSON format:\n\n`;

    template += `{
  "search_metadata": {
    "total_articles_found": 47,
    "high_priority_matches": 12,
    "search_time_ms": 3400,
    "coverage_gaps": ["Economic Data Analysis", "International Markets"]
  },
  "articles": [
    {
      "title": "Complete article headline exactly as published",
      "url": "Direct article URL",
      "source": "Source name and credibility tier",
      "published_date": "2024-01-XX",
      "focus_area": "Matching cluster theme/sub-theme",
      "cluster_weight": 18.5,
      "relevance_score": 92,
      "business_impact": "HIGH|MEDIUM|LOW",
      "audience_match": ["Loan Officers", "Risk Managers"],
      "summary": "2-3 sentence summary emphasizing business implications and urgency for mortgage professionals",
      "key_insights": [
        "Specific actionable insight #1",
        "Regulatory implication #2",
        "Market opportunity #3"
      ],
      "competitive_intelligence": "How this affects industry positioning or provides strategic advantage",
      "score_justification": "Detailed explanation of relevance score considering cluster weight, source authority, and business impact"
    }
  ]
}`;

    template += `\n\n🔍 SEARCH EXECUTION INSTRUCTIONS:\n`;
    template += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    template += `1. Begin with highest-weighted clusters (${filteredClusters.slice(0, 3).map(c => c.sub_theme).join(', ')})\n`;
    template += `2. Use cluster keywords in targeted search queries with appropriate boolean logic\n`;
    template += `3. Apply source priority filtering to ensure authoritative content\n`;
    template += `4. Cross-validate findings against multiple themes for comprehensive coverage\n`;
    template += `5. Prioritize recent, breaking news while maintaining quality standards\n`;
    template += `6. Include cluster weight and audience data in your relevance calculations\n`;
    template += `7. Provide actionable intelligence that mortgage professionals can immediately apply\n\n`;

    template += `Execute this search strategy now, focusing on the weighted priorities above.`;

    return template;
  };

  // Calculate summary statistics for selected themes
  const selectedClusters = clusters.filter(cluster => 
    selectedThemes.length === 0 || selectedThemes.includes(cluster.primary_theme)
  );
  
  const totalWeight = selectedClusters.reduce((sum, cluster) => sum + (cluster.priority_weight || 0), 0);
  const themeStats = selectedClusters.reduce((acc: Record<string, number>, cluster) => {
    const theme = cluster.primary_theme;
    acc[theme] = (acc[theme] || 0) + (cluster.priority_weight || 0);
    return acc;
  }, {});
  
  const topThemes = Object.entries(themeStats)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4);
  
  return (
    <Card className="mt-4">
      <CardContent className="pt-6">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Label htmlFor="prompt_template">AI News Discovery Prompt</Label>
            <Button 
              onClick={handleGenerateTemplate}
              variant="secondary"
              size="sm"
              className="flex items-center gap-1"
              disabled={isGenerating}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} /> 
              {isGenerating ? 'Generating...' : 'Regenerate Prompt'}
            </Button>
          </div>
          
          {/* Theme Weight Summary */}
          {selectedClusters.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-900">Content Focus Distribution</span>
                <Badge variant="outline" className="text-blue-700 border-blue-300">
                  {totalWeight.toFixed(1)}% total weight
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {topThemes.map(([theme, weight]) => (
                  <Badge 
                    key={theme} 
                    variant={weight >= 20 ? "default" : weight >= 10 ? "secondary" : "outline"}
                    className="text-xs"
                  >
                    {theme}: {weight.toFixed(1)}%
                  </Badge>
                ))}
                {Object.keys(themeStats).length > 4 && (
                  <Badge variant="outline" className="text-xs">
                    +{Object.keys(themeStats).length - 4} more themes
                  </Badge>
                )}
              </div>
            </div>
          )}
          
          <Alert className="bg-green-50 border-green-200">
            <Info className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-900">Intelligent Content Discovery</AlertTitle>
            <AlertDescription className="text-green-800">
              This advanced prompt leverages your cluster weights and editorial priorities for targeted news discovery.
              {!readOnly && " Edit directly or regenerate to reflect current cluster weights."}
              {isCustomizing && " Manual edits will be preserved during regeneration."}
            </AlertDescription>
          </Alert>
          
          <ScrollArea className="h-[500px] border rounded-md">
            <Textarea
              id="prompt_template"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[500px] font-mono text-sm border-0 resize-none"
              readOnly={readOnly}
              placeholder="Generating intelligent prompt template..."
            />
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
};

export default NewsSearchPromptTemplate;
