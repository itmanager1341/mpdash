
import { useState, useEffect, useCallback, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronRight } from "lucide-react";

interface Cluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  description?: string;
  keywords?: string[];
  priority_weight?: number;
}

interface WeightedThemeSelectorProps {
  clusters: Cluster[];
  selectedPrimaryThemes: string[];
  selectedSubThemes: string[];
  onPrimaryThemeSelect: (theme: string) => void;
  onSubThemeSelect: (theme: string) => void;
  onWeightChange?: (clusterId: string, weight: number) => void;
  readOnly?: boolean;
}

export default function WeightedThemeSelector({
  clusters,
  selectedPrimaryThemes,
  selectedSubThemes,
  onPrimaryThemeSelect,
  onSubThemeSelect,
  onWeightChange,
  readOnly = false
}: WeightedThemeSelectorProps) {
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  const [isUpdatingWeights, setIsUpdatingWeights] = useState(false);
  const [pendingWeightUpdates, setPendingWeightUpdates] = useState<Map<string, number>>(new Map());
  
  // Debounce weight updates to prevent excessive re-renders and database calls
  const debouncedWeightUpdate = useCallback(
    (clusterId: string, weight: number) => {
      setPendingWeightUpdates(prev => new Map(prev.set(clusterId, weight)));
      
      // Clear existing timeout and set a new one
      const timeoutId = setTimeout(() => {
        if (onWeightChange) {
          setIsUpdatingWeights(true);
          onWeightChange(clusterId, weight);
          setPendingWeightUpdates(prev => {
            const newMap = new Map(prev);
            newMap.delete(clusterId);
            return newMap;
          });
          setTimeout(() => setIsUpdatingWeights(false), 500);
        }
      }, 300);
      
      return () => clearTimeout(timeoutId);
    },
    [onWeightChange]
  );
  
  // Memoize theme groups to prevent unnecessary recalculations
  const themeGroups = useMemo(() => {
    return clusters.reduce((acc: Record<string, { clusters: Cluster[], avgWeight: number, totalKeywords: number }>, cluster) => {
      const theme = cluster.primary_theme;
      if (!acc[theme]) {
        acc[theme] = { clusters: [], avgWeight: 0, totalKeywords: 0 };
      }
      acc[theme].clusters.push(cluster);
      return acc;
    }, {});
  }, [clusters]);

  // Calculate aggregate metrics for each theme
  const sortedThemes = useMemo(() => {
    Object.keys(themeGroups).forEach(theme => {
      const group = themeGroups[theme];
      const weights = group.clusters.map(c => {
        // Use pending weight if available, otherwise use current weight
        const pendingWeight = pendingWeightUpdates.get(c.id);
        return pendingWeight !== undefined ? pendingWeight : (c.priority_weight || 50);
      });
      const keywords = group.clusters.reduce((sum, c) => sum + (c.keywords?.length || 0), 0);
      
      group.avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
      group.totalKeywords = keywords;
    });

    // Sort themes by average weight (descending)
    return Object.entries(themeGroups).sort(([, a], [, b]) => b.avgWeight - a.avgWeight);
  }, [themeGroups, pendingWeightUpdates]);

  const getWeightIcon = (weight: number) => {
    if (weight >= 70) return <TrendingUp className="h-3 w-3 text-green-600" />;
    if (weight >= 40) return <Minus className="h-3 w-3 text-yellow-600" />;
    return <TrendingDown className="h-3 w-3 text-red-600" />;
  };

  const getWeightColor = (weight: number) => {
    if (weight >= 70) return "bg-green-100 text-green-800 border-green-200";
    if (weight >= 40) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  const toggleThemeExpansion = (theme: string, event: React.MouseEvent) => {
    event.stopPropagation();
    event.preventDefault();
    
    const newExpanded = new Set(expandedThemes);
    if (newExpanded.has(theme)) {
      newExpanded.delete(theme);
    } else {
      newExpanded.add(theme);
    }
    setExpandedThemes(newExpanded);
  };

  const getCollapsedPreview = (theme: string, group: any) => {
    const selectedSubThemesInGroup = group.clusters.filter((cluster: Cluster) => 
      selectedSubThemes.includes(cluster.sub_theme)
    );
    
    const totalSubThemes = group.clusters.length;
    const selectedCount = selectedSubThemesInGroup.length;
    
    // Show first few sub-themes as preview with better formatting
    const previewSubThemes = group.clusters.slice(0, 4).map((cluster: Cluster) => cluster.sub_theme);
    const hasMore = totalSubThemes > 4;
    
    return (
      <div className="text-xs text-muted-foreground mt-2 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">Sub-themes:</span>
          <span>{previewSubThemes.join(', ')}{hasMore ? ` +${totalSubThemes - 4} more` : ''}</span>
        </div>
        <div className="flex items-center gap-3">
          {selectedCount > 0 && (
            <Badge variant="secondary" className="text-xs px-2 py-0.5">
              {selectedCount} of {totalSubThemes} selected
            </Badge>
          )}
          <span className="text-xs">
            Avg weight: {Math.round(group.avgWeight)} • {group.totalKeywords} keywords
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Theme Priority Selection</h3>
        <div className="flex items-center gap-2">
          {isUpdatingWeights && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <div className="animate-spin h-3 w-3 border border-current border-t-transparent rounded-full"></div>
              Updating weights...
            </div>
          )}
          <div className="text-xs text-muted-foreground">
            Weights drive keyword allocation and search emphasis
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {sortedThemes.map(([theme, group]) => {
          const isSelected = selectedPrimaryThemes.includes(theme);
          const isExpanded = expandedThemes.has(theme);
          
          return (
            <Card key={theme} className={`transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div 
                    className="flex-1 cursor-pointer" 
                    onClick={() => onPrimaryThemeSelect(theme)}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge 
                        variant={isSelected ? "default" : "secondary"}
                        className={`${getWeightColor(group.avgWeight)} cursor-pointer`}
                      >
                        <div className="flex items-center gap-1">
                          {getWeightIcon(group.avgWeight)}
                          {theme}
                          <span className="ml-1 text-xs">({Math.round(group.avgWeight)})</span>
                        </div>
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {group.totalKeywords} keywords • {group.clusters.length} clusters
                      </div>
                    </div>
                    {!isExpanded && getCollapsedPreview(theme, group)}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => toggleThemeExpansion(theme, e)}
                    className="text-xs ml-2 flex items-center gap-1 px-2 shrink-0"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronDown className="h-3 w-3" />
                        Collapse
                      </>
                    ) : (
                      <>
                        <ChevronRight className="h-3 w-3" />
                        Expand
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="pt-0 animate-accordion-down">
                  <Separator className="mb-3" />
                  <div className="space-y-3">
                    {group.clusters.map((cluster) => {
                      const isSubSelected = selectedSubThemes.includes(cluster.sub_theme);
                      const pendingWeight = pendingWeightUpdates.get(cluster.id);
                      const weight = pendingWeight !== undefined ? pendingWeight : (cluster.priority_weight || 50);
                      
                      return (
                        <div key={cluster.id} className="space-y-2 p-2 rounded-md bg-slate-50 hover:bg-slate-100 transition-colors">
                          <div className="flex items-center justify-between">
                            <Badge 
                              variant={isSubSelected ? "default" : "outline"}
                              className="cursor-pointer"
                              onClick={() => onSubThemeSelect(cluster.sub_theme)}
                            >
                              {cluster.sub_theme}
                            </Badge>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              {getWeightIcon(weight)}
                              <span className="font-mono">{weight}</span>
                              <span>• {cluster.keywords?.length || 0} keywords</span>
                              {pendingWeight !== undefined && (
                                <div className="animate-pulse h-2 w-2 bg-blue-500 rounded-full"></div>
                              )}
                            </div>
                          </div>
                          
                          {!readOnly && onWeightChange && (
                            <div className="ml-4 space-y-1">
                              <Label className="text-xs text-muted-foreground">Priority Weight</Label>
                              <div className="flex items-center gap-2">
                                <Slider
                                  value={[weight]}
                                  onValueChange={([newWeight]) => debouncedWeightUpdate(cluster.id, newWeight)}
                                  max={100}
                                  min={0}
                                  step={5}
                                  className="flex-1"
                                />
                                <span className="text-xs font-mono w-8 text-center">{weight}</span>
                              </div>
                            </div>
                          )}
                          
                          {cluster.keywords && cluster.keywords.length > 0 && (
                            <div className="ml-4 text-xs text-muted-foreground bg-white p-2 rounded border">
                              <span className="font-medium">Keywords: </span>
                              {cluster.keywords.slice(0, 8).join(', ')}
                              {cluster.keywords.length > 8 && (
                                <span className="text-blue-600"> +{cluster.keywords.length - 8} more</span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
      
      <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-md border border-blue-200">
        <div className="font-medium text-blue-900 mb-1">Weight Guide:</div>
        <div className="space-y-1">
          <div>• <strong>High weights (70+):</strong> Get more keywords and search emphasis</div>
          <div>• <strong>Medium weights (40-69):</strong> Balanced allocation and coverage</div>
          <div>• <strong>Low weights (0-39):</strong> Minimal but representative coverage</div>
        </div>
      </div>
    </div>
  );
}
