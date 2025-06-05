
import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Save, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";

interface Cluster {
  id: string;
  primary_theme: string;
  sub_theme: string;
  description?: string;
  keywords?: string[];
  professions?: string[];
  priority_weight?: number;
}

interface ClusterWeightEditorProps {
  clusters: Cluster[];
  selectedPrimaryThemes: string[];
  selectedSubThemes: string[];
  promptWeights: Record<string, number>;
  onPrimaryThemeSelect: (theme: string) => void;
  onSubThemeSelect: (theme: string) => void;
  onWeightChange: (subTheme: string, weight: number) => void;
  onNormalizeWeights: () => void;
}

export default function ClusterWeightEditor({
  clusters,
  selectedPrimaryThemes,
  selectedSubThemes,
  promptWeights,
  onPrimaryThemeSelect,
  onSubThemeSelect,
  onWeightChange,
  onNormalizeWeights
}: ClusterWeightEditorProps) {
  const [editingWeight, setEditingWeight] = useState<string | null>(null);
  const [tempWeight, setTempWeight] = useState<number>(0);
  const selectAllCheckboxRef = useRef<HTMLButtonElement>(null);

  // Filter clusters to show only selected primary themes
  const filteredClusters = clusters.filter(cluster =>
    selectedPrimaryThemes.length === 0 || selectedPrimaryThemes.includes(cluster.primary_theme)
  );

  // Calculate total weight for selected sub-themes
  const totalWeight = selectedSubThemes.reduce((sum, subTheme) => {
    return sum + (promptWeights[subTheme] || 0);
  }, 0);

  const isWeightValid = Math.abs(totalWeight - 100) < 0.1;

  // Check if all filtered clusters are selected
  const allFilteredSelected = filteredClusters.length > 0 && 
    filteredClusters.every(cluster => selectedSubThemes.includes(cluster.sub_theme));
  
  // Check if some (but not all) filtered clusters are selected
  const someFilteredSelected = filteredClusters.some(cluster => selectedSubThemes.includes(cluster.sub_theme)) && 
    !allFilteredSelected;

  // Update indeterminate state using ref - find the actual input element
  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      // Find the input element within the checkbox button
      const inputElement = selectAllCheckboxRef.current.querySelector('input[type="checkbox"]') as HTMLInputElement;
      if (inputElement) {
        inputElement.indeterminate = someFilteredSelected;
      }
    }
  }, [someFilteredSelected]);

  // Select All functionality - fixed logic
  const handleSelectAll = () => {
    console.log('Select All clicked. Current state:', {
      filteredClusters: filteredClusters.length,
      allFilteredSelected,
      someFilteredSelected,
      selectedSubThemes: selectedSubThemes.length
    });
    
    const allFilteredSubThemes = filteredClusters.map(c => c.sub_theme);
    
    if (allFilteredSelected) {
      // Deselect all filtered clusters
      console.log('Deselecting all filtered clusters');
      allFilteredSubThemes.forEach(subTheme => {
        if (selectedSubThemes.includes(subTheme)) {
          onSubThemeSelect(subTheme);
        }
      });
    } else {
      // Select all filtered clusters
      console.log('Selecting all filtered clusters');
      allFilteredSubThemes.forEach(subTheme => {
        if (!selectedSubThemes.includes(subTheme)) {
          onSubThemeSelect(subTheme);
        }
      });
    }
  };

  const handleEditWeight = (subTheme: string, currentWeight: number) => {
    setEditingWeight(subTheme);
    setTempWeight(currentWeight || 0);
  };

  const handleSaveWeight = (subTheme: string) => {
    onWeightChange(subTheme, tempWeight);
    setEditingWeight(null);
  };

  const handleCancelWeight = () => {
    setEditingWeight(null);
    setTempWeight(0);
  };

  // Get unique primary themes for selection
  const primaryThemes = Array.from(new Set(clusters.map(c => c.primary_theme)));

  return (
    <div className="space-y-4">
      {/* Primary Theme Selection */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium">Select Primary Themes</h4>
        <div className="flex flex-wrap gap-2">
          {primaryThemes.map(theme => (
            <div key={theme} className="flex items-center space-x-2">
              <Checkbox
                id={`primary-${theme}`}
                checked={selectedPrimaryThemes.includes(theme)}
                onCheckedChange={() => onPrimaryThemeSelect(theme)}
              />
              <label htmlFor={`primary-${theme}`} className="text-sm cursor-pointer">
                {theme}
              </label>
            </div>
          ))}
        </div>
      </div>

      {filteredClusters.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          Select primary themes above to see available clusters
        </div>
      ) : (
        <>
          {/* Weight Status Alert */}
          <div className="flex items-center justify-between bg-muted/50 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <span className="font-medium">Total Weight:</span>
              <Badge variant={isWeightValid ? "default" : "destructive"} className="text-sm">
                {totalWeight.toFixed(1)}%
              </Badge>
              {!isWeightValid && (
                <div className="flex items-center gap-2 text-amber-600">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm">Weights should total 100%</span>
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                ({selectedSubThemes.length} of {filteredClusters.length} clusters selected)
              </div>
            </div>
            {selectedSubThemes.length > 0 && (
              <Button 
                onClick={onNormalizeWeights}
                variant="outline"
                size="sm"
              >
                Normalize to 100%
              </Button>
            )}
          </div>

          {/* Clusters Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        ref={selectAllCheckboxRef}
                        checked={allFilteredSelected}
                        onCheckedChange={handleSelectAll}
                      />
                      <span className="text-xs">All</span>
                    </div>
                  </TableHead>
                  <TableHead>Primary Theme</TableHead>
                  <TableHead>Sub-theme</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Professions</TableHead>
                  <TableHead>Keywords</TableHead>
                  <TableHead>Weight %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClusters.map((cluster) => {
                  const isSelected = selectedSubThemes.includes(cluster.sub_theme);
                  const currentWeight = promptWeights[cluster.sub_theme] || cluster.priority_weight || 0;
                  
                  return (
                    <TableRow key={cluster.id} className={isSelected ? "bg-blue-50" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {
                            console.log('Individual checkbox clicked:', cluster.sub_theme, 'currently selected:', isSelected);
                            onSubThemeSelect(cluster.sub_theme);
                          }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {cluster.primary_theme}
                      </TableCell>
                      <TableCell>{cluster.sub_theme}</TableCell>
                      <TableCell className="max-w-xs">
                        {cluster.description ? (
                          <div className="truncate" title={cluster.description}>
                            {cluster.description}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">No description</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {cluster.professions?.slice(0, 3).map((profession, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {profession}
                            </Badge>
                          ))}
                          {(cluster.professions?.length || 0) > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(cluster.professions?.length || 0) - 3} more
                            </Badge>
                          )}
                          {(!cluster.professions || cluster.professions.length === 0) && (
                            <span className="text-muted-foreground italic text-xs">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-md">
                          {cluster.keywords?.slice(0, 5).map((keyword, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {keyword}
                            </Badge>
                          ))}
                          {(cluster.keywords?.length || 0) > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{(cluster.keywords?.length || 0) - 5} more
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {isSelected && editingWeight === cluster.sub_theme ? (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={tempWeight}
                              onChange={(e) => setTempWeight(Number(e.target.value))}
                              className="w-20"
                            />
                            <span className="text-sm text-muted-foreground">%</span>
                            <Button
                              size="sm"
                              onClick={() => handleSaveWeight(cluster.sub_theme)}
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelWeight}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {isSelected ? (
                              <Badge 
                                variant="outline"
                                className="cursor-pointer hover:bg-muted"
                                onClick={() => handleEditWeight(cluster.sub_theme, currentWeight)}
                              >
                                {currentWeight.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                {currentWeight.toFixed(1)}%
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
