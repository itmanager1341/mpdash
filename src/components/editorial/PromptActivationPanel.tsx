
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
  CheckCircle2,
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
  onRunManual: () => void;
}

export default function PromptActivationPanel({ 
  prompt, 
  onTest, 
  onRunManual 
}: PromptActivationPanelProps) {
  const [isActivating, setIsActivating] = useState(false);
  const queryClient = useQueryClient();

  const activatePromptMutation = useMutation({
    mutationFn: async () => {
      // Deactivate all other news search prompts
      const { error: deactivateError } = await supabase
        .from('llm_prompts')
        .update({ is_active: false })
        .like('function_name', '%news%');
        
      if (deactivateError) throw deactivateError;

      // Activate this prompt
      const { error: activateError } = await supabase
        .from('llm_prompts')
        .update({ is_active: true })
        .eq('id', prompt.id);
        
      if (activateError) throw activateError;

      // Update scheduled job settings
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
      toast.success(`"${prompt.function_name}" activated successfully`);
    },
    onError: (error) => {
      toast.error('Activation failed: ' + error.message);
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
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />
          Prompt Saved
        </CardTitle>
        <CardDescription>
          Configure "{prompt.function_name}" for content discovery
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant={prompt.is_active ? "default" : "secondary"}>
            {prompt.is_active ? "ACTIVE" : "INACTIVE"}
          </Badge>
          <Badge variant="outline">{prompt.model}</Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Button onClick={onTest} variant="outline" size="sm">
            <TestTube className="h-4 w-4 mr-2" />
            Test
          </Button>

          <Button
            onClick={handleActivate}
            disabled={isActivating || prompt.is_active}
            size="sm"
          >
            {isActivating ? (
              <>
                <Activity className="h-4 w-4 animate-spin mr-2" />
                Activating...
              </>
            ) : prompt.is_active ? (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Active
              </>
            ) : (
              <>
                <Zap className="h-4 w-4 mr-2" />
                Activate
              </>
            )}
          </Button>

          <Button onClick={onRunManual} variant="secondary" size="sm">
            <Play className="h-4 w-4 mr-2" />
            Run Now
          </Button>
        </div>

        {!prompt.is_active && (
          <div className="text-sm bg-amber-50 p-3 rounded border border-amber-200">
            <strong>Next:</strong> Activate to enable automated content discovery
          </div>
        )}
      </CardContent>
    </Card>
  );
}
