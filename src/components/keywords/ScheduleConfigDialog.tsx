
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface ScheduleConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptName: string;
  currentSchedule?: {
    id: string;
    schedule: string;
    parameters: any;
    is_enabled: boolean;
  } | null;
  onSave: (config: {
    schedule: string;
    parameters: {
      promptId: string;
      minScore: number;
      limit: number;
      keywords?: string[];
    };
    is_enabled: boolean;
  }) => Promise<void>;
  promptId: string;
}

const SCHEDULE_PRESETS = [
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours", value: "0 */12 * * *" },
  { label: "Daily at 9 AM", value: "0 9 * * *" },
  { label: "Daily at 6 PM", value: "0 18 * * *" },
  { label: "Twice daily (9 AM & 6 PM)", value: "0 9,18 * * *" },
  { label: "Weekly on Monday at 9 AM", value: "0 9 * * 1" },
  { label: "Custom", value: "custom" }
];

export default function ScheduleConfigDialog({ 
  open, 
  onOpenChange, 
  promptName, 
  currentSchedule, 
  onSave, 
  promptId 
}: ScheduleConfigDialogProps) {
  const [selectedPreset, setSelectedPreset] = useState(
    currentSchedule ? "custom" : "0 */6 * * *"
  );
  const [customCron, setCustomCron] = useState(currentSchedule?.schedule || "0 */6 * * *");
  const [minScore, setMinScore] = useState(currentSchedule?.parameters?.minScore || 0.6);
  const [limit, setLimit] = useState(currentSchedule?.parameters?.limit || 10);
  const [keywords, setKeywords] = useState(
    currentSchedule?.parameters?.keywords ? currentSchedule.parameters.keywords.join(", ") : ""
  );
  const [isEnabled, setIsEnabled] = useState(currentSchedule?.is_enabled ?? true);
  const [isLoading, setIsLoading] = useState(false);

  const finalSchedule = selectedPreset === "custom" ? customCron : selectedPreset;

  const validateCron = (cronExpression: string): boolean => {
    const parts = cronExpression.trim().split(/\s+/);
    return parts.length === 5;
  };

  const getNextRunPreview = (cronExpression: string): string => {
    if (!validateCron(cronExpression)) return "Invalid cron expression";
    
    // Simple preview - in a real app you'd use a cron library
    const parts = cronExpression.split(" ");
    const minute = parts[0];
    const hour = parts[1];
    
    if (hour.includes("*/")) {
      const interval = hour.split("*/")[1];
      return `Every ${interval} hours`;
    }
    
    if (hour.includes(",")) {
      const hours = hour.split(",").join(", ");
      return `Daily at ${hours}:${minute.padStart(2, "0")}`;
    }
    
    if (hour !== "*") {
      return `Daily at ${hour}:${minute.padStart(2, "0")}`;
    }
    
    return "Every minute (testing only)";
  };

  const handleSave = async () => {
    if (!validateCron(finalSchedule)) {
      toast.error("Please enter a valid cron expression (5 parts separated by spaces)");
      return;
    }

    if (minScore < 0 || minScore > 1) {
      toast.error("Minimum score must be between 0 and 1");
      return;
    }

    if (limit < 1 || limit > 100) {
      toast.error("Limit must be between 1 and 100");
      return;
    }

    setIsLoading(true);
    try {
      const keywordsList = keywords.trim() 
        ? keywords.split(",").map(k => k.trim()).filter(k => k.length > 0)
        : undefined;

      await onSave({
        schedule: finalSchedule,
        parameters: {
          promptId,
          minScore,
          limit,
          ...(keywordsList && keywordsList.length > 0 ? { keywords: keywordsList } : {})
        },
        is_enabled: isEnabled
      });

      onOpenChange(false);
    } catch (error) {
      console.error("Error saving schedule:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {currentSchedule ? "Edit Schedule" : "Configure Schedule"}
          </DialogTitle>
          <DialogDescription>
            Set up automated scheduling for "{promptName}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Schedule Frequency</Label>
            <Select value={selectedPreset} onValueChange={setSelectedPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEDULE_PRESETS.map((preset) => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedPreset === "custom" && (
            <div className="space-y-2">
              <Label>Custom Cron Expression</Label>
              <Input
                value={customCron}
                onChange={(e) => setCustomCron(e.target.value)}
                placeholder="0 */6 * * *"
                className={!validateCron(customCron) ? "border-red-500" : ""}
              />
              <p className="text-xs text-muted-foreground">
                Format: minute hour day month weekday
              </p>
            </div>
          )}

          <div className="p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4" />
              <span className="font-medium">Next runs:</span>
              <Badge variant="outline">{getNextRunPreview(finalSchedule)}</Badge>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Min Score</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="1"
                value={minScore}
                onChange={(e) => setMinScore(parseFloat(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Max Results</Label>
              <Input
                type="number"
                min="1"
                max="100"
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Keywords (optional)</Label>
            <Textarea
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="mortgage rates, housing market, federal reserve"
              rows={2}
            />
            <p className="text-xs text-muted-foreground">
              Comma-separated list. Leave empty to use prompt defaults.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label>Enable Schedule</Label>
            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
          </div>

          {!validateCron(finalSchedule) && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              <span>Please enter a valid cron expression</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!validateCron(finalSchedule) || isLoading}
          >
            {isLoading ? "Saving..." : currentSchedule ? "Update Schedule" : "Create Schedule"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
