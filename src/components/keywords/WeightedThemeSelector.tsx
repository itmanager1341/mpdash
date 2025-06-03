
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

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
  
  // Group clusters by primary theme and calculate aggregate weights
  const themeGroups = clusters.reduce((acc: Record<string, { clusters: Cluster[], avgWeight: number, totalKeywords: number }>, cluster) => {
    const theme = cluster.primary_theme;
    if (!acc[theme]) {
      acc[theme] = { clusters: [], avgWeight: 0, totalKeywords: 0 };
    }
    acc[theme].clusters.push(cluster);
    return acc;
  }, {});

  // Calculate aggregate metrics for each theme
  Object.keys(themeGroups).forEach(theme => {
    const group = themeGroups[theme];
    const weights = group.clusters.map(c => c.priority_weight || 50);
    const keywords = group.clusters.reduce((sum, c) => sum + (c.keywords?.length || 0), 0);
    
    group.avgWeight = weights.reduce((sum, w) => sum + w, 0) / weights.length;
    group.totalKeywords = keywords;
  });

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

  const toggleThemeExpansion = (theme: string) => {
    const newExpanded = new Set(expandedThemes);
    if (newExpanded.has(theme)) {
      newExpanded.delete(theme);
    } else {
      newExpanded.add(theme);
    }
    setExpandedThemes(newExpanded);
  };

  // Sort themes by average weight (descending)
  const sortedThemes = Object.entries(themeGroups).sort(([, a], [, b]) => b.avgWeight - a.avgWeight);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Theme Priority Selection</h3>
        <div className="text-xs text-muted-foreground">
          Weights drive keyword allocation and search emphasis
        </div>
      </div>

      <div className="space-y-3">
        {sortedThemes.map(([theme, group]) => {
          const isSelected = selectedPrimaryThemes.includes(theme);
          const isExpanded = expandedThemes.has(theme);
          
          return (
            <Card key={theme} className={`transition-all ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant={isSelected ? "default" : "secondary"}
                      className={`cursor-pointer ${getWeightColor(group.avgWeight)}`}
                      onClick={() => onPrimaryThemeSelect(theme)}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleThemeExpansion(theme)}
                    className="text-xs"
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </Button>
                </div>
              </CardHeader>
              
              {isExpanded && (
                <CardContent className="pt-0">
                  <Separator className="mb-3" />
                  <div className="space-y-3">
                    {group.clusters.map((cluster) => {
                      const isSubSelected = selectedSubThemes.includes(cluster.sub_theme);
                      const weight = cluster.priority_weight || 50;
                      
                      return (
                        <div key={cluster.id} className="space-y-2">
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
                              <span>{weight}</span>
                              <span>• {cluster.keywords?.length || 0} keywords</span>
                            </div>
                          </div>
                          
                          {!readOnly && onWeightChange && (
                            <div className="ml-4 space-y-1">
                              <Label className="text-xs">Adjust Priority Weight</Label>
                              <div className="flex items-center gap-2">
                                <Slider
                                  value={[weight]}
                                  onValueChange={([newWeight]) => onWeightChange(cluster.id, newWeight)}
                                  max={100}
                                  min={0}
                                  step={5}
                                  className="flex-1"
                                />
                                <span className="text-xs w-8 text-center">{weight}</span>
                              </div>
                            </div>
                          )}
                          
                          {cluster.keywords && cluster.keywords.length > 0 && (
                            <div className="ml-4 text-xs text-muted-foreground">
                              Keywords: {cluster.keywords.slice(0, 5).join(', ')}
                              {cluster.keywords.length > 5 && ` +${cluster.keywords.length - 5} more`}
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
      
      <div className="text-xs text-muted-foreground bg-blue-50 p-2 rounded">
        <strong>Weight Guide:</strong> High weights (70+) get more keywords and search emphasis. 
        Medium weights (40-69) get balanced allocation. Low weights (0-39) get minimal but still represented coverage.
      </div>
    </div>
  );
}
