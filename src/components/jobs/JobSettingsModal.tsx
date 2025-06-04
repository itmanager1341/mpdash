
import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, TestTube, Clock, Settings2 } from "lucide-react";

interface ScheduledJob {
  id: string;
  job_name: string;
  schedule: string;
  is_enabled: boolean;
  last_run: string | null;
  parameters: any;
  created_at: string;
  updated_at: string;
}

interface JobSettingsModalProps {
  job: ScheduledJob | null;
  isOpen: boolean;
  onClose: () => void;
  isCreating?: boolean;
}

const JobSettingsModal = ({ job, isOpen, onClose, isCreating = false }: JobSettingsModalProps) => {
  const [formData, setFormData] = useState({
    job_name: "",
    schedule: "0 */12 * * *",
    is_enabled: true,
    parameters: "{}"
  });
  const [parametersError, setParametersError] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  
  const queryClient = useQueryClient();

  useEffect(() => {
    if (job) {
      setFormData({
        job_name: job.job_name,
        schedule: job.schedule,
        is_enabled: job.is_enabled,
        parameters: JSON.stringify(job.parameters || {}, null, 2)
      });
    } else if (isCreating) {
      setFormData({
        job_name: "",
        schedule: "0 */12 * * *",
        is_enabled: true,
        parameters: JSON.stringify({
          minScore: 0.6,
          limit: 20,
          keywords: ["mortgage rates", "housing market", "federal reserve"]
        }, null, 2)
      });
    }
    setParametersError("");
  }, [job, isCreating, isOpen]);

  const validateParameters = (paramString: string) => {
    try {
      JSON.parse(paramString);
      setParametersError("");
      return true;
    } catch (e) {
      setParametersError("Invalid JSON format");
      return false;
    }
  };

  const saveJobMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      if (!validateParameters(data.parameters)) {
        throw new Error("Invalid parameters JSON");
      }

      const parameters = JSON.parse(data.parameters);
      
      if (isCreating) {
        const { error } = await supabase
          .from("scheduled_job_settings")
          .insert([{
            job_name: data.job_name,
            schedule: data.schedule,
            is_enabled: data.is_enabled,
            parameters
          }]);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("scheduled_job_settings")
          .update({
            schedule: data.schedule,
            is_enabled: data.is_enabled,
            parameters,
            updated_at: new Date().toISOString()
          })
          .eq("id", job!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      toast.success(isCreating ? "Job created successfully" : "Job updated successfully");
      onClose();
    },
    onError: (error: any) => {
      console.error("Error saving job:", error);
      toast.error("Failed to save job: " + error.message);
    },
  });

  const testJobMutation = useMutation({
    mutationFn: async () => {
      if (!validateParameters(formData.parameters)) {
        throw new Error("Invalid parameters JSON");
      }

      const { data, error } = await supabase.functions.invoke('run-news-import', {
        body: { 
          manual: true, 
          jobName: formData.job_name,
          limit: 5 // Test with smaller limit
        }
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Test successful: ${data.message || 'Job executed successfully'}`);
      setIsTesting(false);
    },
    onError: (error: any) => {
      console.error("Error testing job:", error);
      toast.error("Test failed: " + error.message);
      setIsTesting(false);
    },
  });

  const handleParametersChange = (value: string) => {
    setFormData({ ...formData, parameters: value });
    validateParameters(value);
  };

  const handleTest = () => {
    if (!job && isCreating) {
      toast.error("Please save the job first before testing");
      return;
    }
    setIsTesting(true);
    testJobMutation.mutate();
  };

  const getScheduleDescription = (cron: string) => {
    const descriptions: Record<string, string> = {
      "0 */12 * * *": "Every 12 hours",
      "0 8 * * *": "Daily at 8:00 AM",
      "0 0 * * 1": "Weekly on Monday at midnight",
      "0 * * * *": "Every hour",
      "*/15 * * * *": "Every 15 minutes",
      "0 0 * * *": "Daily at midnight"
    };
    return descriptions[cron] || "Custom schedule";
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            {isCreating ? "Create New Job" : `Edit Job: ${job?.job_name}`}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Job Name */}
          <div className="space-y-2">
            <Label htmlFor="job_name">Job Name</Label>
            <Input
              id="job_name"
              value={formData.job_name}
              onChange={(e) => setFormData({ ...formData, job_name: e.target.value })}
              placeholder="e.g., daily-news-import"
              disabled={!isCreating}
            />
            {!isCreating && (
              <p className="text-xs text-muted-foreground">Job name cannot be changed after creation</p>
            )}
          </div>

          {/* Schedule */}
          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule</Label>
            <div className="space-y-2">
              <Select 
                value={formData.schedule} 
                onValueChange={(value) => setFormData({ ...formData, schedule: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0 */12 * * *">Every 12 hours</SelectItem>
                  <SelectItem value="0 8 * * *">Daily at 8:00 AM</SelectItem>
                  <SelectItem value="0 0 * * *">Daily at midnight</SelectItem>
                  <SelectItem value="0 0 * * 1">Weekly on Monday</SelectItem>
                  <SelectItem value="0 * * * *">Every hour</SelectItem>
                  <SelectItem value="*/15 * * * *">Every 15 minutes</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={formData.schedule}
                onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                placeholder="Custom cron expression"
                className="font-mono text-sm"
              />
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {getScheduleDescription(formData.schedule)}
                </span>
              </div>
            </div>
          </div>

          {/* Parameters */}
          <div className="space-y-2">
            <Label htmlFor="parameters">Parameters (JSON)</Label>
            <Textarea
              id="parameters"
              value={formData.parameters}
              onChange={(e) => handleParametersChange(e.target.value)}
              placeholder='{"key": "value"}'
              className="font-mono text-sm min-h-[200px]"
            />
            {parametersError && (
              <p className="text-sm text-destructive">{parametersError}</p>
            )}
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Common parameters for news import jobs:</p>
              <div className="pl-4 space-y-1">
                <p>• <code>minScore</code>: Minimum relevance score (0.0-1.0)</p>
                <p>• <code>limit</code>: Maximum number of articles to fetch</p>
                <p>• <code>keywords</code>: Array of search keywords</p>
                <p>• <code>promptId</code>: Specific prompt to use (optional)</p>
              </div>
            </div>
          </div>

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <Label htmlFor="enabled">Job Enabled</Label>
              <p className="text-sm text-muted-foreground">
                When enabled, this job will run on the specified schedule
              </p>
            </div>
            <Switch
              id="enabled"
              checked={formData.is_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, is_enabled: checked })}
            />
          </div>

          {/* Job Status (for existing jobs) */}
          {job && !isCreating && (
            <div className="space-y-2">
              <Label>Job Status</Label>
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={job.is_enabled ? "default" : "secondary"}>
                    {job.is_enabled ? "Enabled" : "Disabled"}
                  </Badge>
                </div>
                {job.last_run && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">Last run:</span>
                    <span>{new Date(job.last_run).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between pt-4 border-t">
            <div>
              {job && !isCreating && (
                <Button
                  variant="outline"
                  onClick={handleTest}
                  disabled={isTesting || testJobMutation.isPending}
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  {isTesting ? "Testing..." : "Test Job"}
                </Button>
              )}
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button 
                onClick={() => saveJobMutation.mutate(formData)}
                disabled={saveJobMutation.isPending || !!parametersError || !formData.job_name.trim()}
              >
                <Save className="h-4 w-4 mr-2" />
                {saveJobMutation.isPending ? "Saving..." : (isCreating ? "Create Job" : "Save Changes")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default JobSettingsModal;
