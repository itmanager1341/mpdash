
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Play, 
  TestTube, 
  Calendar, 
  CheckCircle2,
  Clock,
  Activity,
  Zap
} from "lucide-react";

interface PromptActivationPanelProps {
  prompt: {
    id: string;
    function_name: string;
    is_active: boolean;
    model: string;
  };
  onTest: () => void;
  onSchedule: () => void;
  onRunManual: () => void;
}

export default function PromptActivationPanel({ 
  prompt, 
  onTest, 
  onSchedule, 
  onRunManual 
}: PromptActivationPanelProps) {
  const [isActivating, setIsActivating] = useState(false);
  const queryClient = useQueryClient();

  const activatePromptMutation = useMutation({
    mutationFn: async () => {
      // First, deactivate all other news search prompts
      const { error: deactivateError } = await supabase
        .from('llm_prompts')
        .update({ is_active: false })
        .like('function_name', '%news%');
        
      if (deactivateError) throw deactivateError;

      // Then activate this prompt
      const { error: activateError } = await supabase
        .from('llm_prompts')
        .update({ is_active: true })
        .eq('id', prompt.id);
        
      if (activateError) throw activateError;

      // Update the scheduled job to use this prompt
      const { error: jobError } = await supabase
        .from('scheduled_job_settings')
        .update({ 
          parameters: {
            promptId: prompt.id,
            keywords: [],
            minScore: 0.6,
            limit: 10
          }
        })
        .eq('job_name', 'news_import');
        
      if (jobError) throw jobError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['news-search-prompts'] });
      queryClient.invalidateQueries({ queryKey: ['scheduled-job-settings'] });
      toast.success(`"${prompt.function_name}" is now the active news search prompt`);
    },
    onError: (error) => {
      toast.error('Failed to activate prompt: ' + error.message);
    }
  });

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      await activatePromptMutation.mutateAsync();
    } finally {
      setIsActivating(false);
    }
  };

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Prompt Saved Successfully
        </CardTitle>
        <CardDescription>
          What would you like to do with "{prompt.function_name}"?
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <Badge variant={prompt.is_active ? "default" : "secondary"}>
            {prompt.is_active ? "ACTIVE" : "INACTIVE"}
          </Badge>
          <Badge variant="outline">{prompt.model}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Button
            onClick={onTest}
            variant="outline"
            className="flex items-center gap-2"
          >
            <TestTube className="h-4 w-4" />
            Test Prompt
          </Button>

          <Button
            onClick={handleActivate}
            disabled={isActivating || prompt.is_active}
            className="flex items-center gap-2"
          >
            {isActivating ? (
              <>
                <Activity className="h-4 w-4 animate-spin" />
                Activating...
              </>
            ) : prompt.is_active ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Already Active
              </>
            ) : (
              <>
                <Zap className="h-4 w-4" />
                Activate & Schedule
              </>
            )}
          </Button>

          <Button
            onClick={onRunManual}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Play className="h-4 w-4" />
            Run Import Now
          </Button>

          <Button
            onClick={onSchedule}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Schedule Settings
          </Button>
        </div>

        {!prompt.is_active && (
          <div className="text-sm text-muted-foreground bg-amber-50 p-3 rounded-lg border border-amber-200">
            <strong>Next Steps:</strong> Activate this prompt to use it for automated news imports, 
            or test it first to see how it performs with current data.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
