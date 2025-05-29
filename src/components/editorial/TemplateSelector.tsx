
import { ArticleTemplate, ARTICLE_TEMPLATES } from "@/types/author";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { FileText, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface TemplateSelectorProps {
  selectedTemplate?: string;
  onTemplateChange: (template: string | undefined) => void;
  className?: string;
}

export function TemplateSelector({ selectedTemplate, onTemplateChange, className }: TemplateSelectorProps) {
  const template = ARTICLE_TEMPLATES.find(t => t.type === selectedTemplate);

  return (
    <div className={`space-y-2 ${className}`}>
      <Label className="flex items-center gap-2">
        <FileText className="h-4 w-4" />
        Article Template
      </Label>
      
      <Select 
        value={selectedTemplate || ""} 
        onValueChange={(value) => onTemplateChange(value || undefined)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select article template..." />
        </SelectTrigger>
        <SelectContent>
          {ARTICLE_TEMPLATES.map((template) => (
            <SelectItem key={template.type} value={template.type}>
              <div className="flex items-center justify-between w-full">
                <span>{template.name}</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 ml-2 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{template.description}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {template && (
        <div className="p-3 bg-muted rounded-md space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium">{template.name}</span>
            {template.requiresAttribution && (
              <Badge variant="outline" className="text-xs">
                Requires Attribution
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{template.description}</p>
          <div className="text-xs text-muted-foreground">
            Default byline: <code className="bg-background px-1 rounded">{template.defaultBylineFormat}</code>
          </div>
        </div>
      )}
    </div>
  );
}
