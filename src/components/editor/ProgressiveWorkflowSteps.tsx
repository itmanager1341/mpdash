
import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ProgressiveWorkflowStepsProps {
  currentStep: "content" | "enhancement" | "preview" | "publish";
  completedSteps: string[];
  onStepClick: (step: "content" | "enhancement" | "preview" | "publish") => void;
}

export function ProgressiveWorkflowSteps({ currentStep, completedSteps, onStepClick }: ProgressiveWorkflowStepsProps) {
  const steps = [
    { id: "content", label: "Content Creation", description: "Create basic content structure" },
    { id: "enhancement", label: "AI Enhancement", description: "Optimize with AI suggestions" },
    { id: "preview", label: "Preview & Review", description: "Review final appearance" },
    { id: "publish", label: "Ready to Publish", description: "Finalize and save" }
  ] as const;

  const getStepStatus = (stepId: string) => {
    if (completedSteps.includes(stepId)) return "completed";
    if (stepId === currentStep) return "current";
    return "pending";
  };

  const getStepIcon = (stepId: string) => {
    const status = getStepStatus(stepId);
    if (status === "completed") {
      return <CheckCircle2 className="h-5 w-5 text-green-600" />;
    }
    if (status === "current") {
      return <Circle className="h-5 w-5 text-primary fill-current" />;
    }
    return <Circle className="h-5 w-5 text-muted-foreground" />;
  };

  const getStepColor = (stepId: string) => {
    const status = getStepStatus(stepId);
    if (status === "completed") return "text-green-600";
    if (status === "current") return "text-primary";
    return "text-muted-foreground";
  };

  return (
    <div className="flex items-center justify-between mb-6 p-4 bg-muted/20 rounded-lg">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <button
            onClick={() => onStepClick(step.id)}
            className={`flex items-center gap-3 p-2 rounded-lg transition-colors hover:bg-white/50 ${
              step.id === currentStep ? 'bg-white shadow-sm' : ''
            }`}
          >
            {getStepIcon(step.id)}
            <div className="text-left">
              <div className={`font-medium text-sm ${getStepColor(step.id)}`}>
                {step.label}
              </div>
              <div className="text-xs text-muted-foreground">
                {step.description}
              </div>
            </div>
          </button>
          
          {index < steps.length - 1 && (
            <ArrowRight className="h-4 w-4 text-muted-foreground mx-2" />
          )}
        </div>
      ))}
    </div>
  );
}
