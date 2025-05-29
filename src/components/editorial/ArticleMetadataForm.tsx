
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { AuthorSelector } from "./AuthorSelector";
import { TemplateSelector } from "./TemplateSelector";
import { ARTICLE_TEMPLATES } from "@/types/author";

interface ArticleMetadataFormProps {
  authorId?: string;
  templateType?: string;
  sourceAttribution?: string;
  contentComplexityScore?: number;
  bylineText?: string;
  onMetadataChange: (metadata: {
    authorId?: string;
    templateType?: string;
    sourceAttribution?: string;
    contentComplexityScore?: number;
    bylineText?: string;
  }) => void;
  className?: string;
}

export function ArticleMetadataForm({
  authorId,
  templateType,
  sourceAttribution,
  contentComplexityScore = 1,
  bylineText,
  onMetadataChange,
  className
}: ArticleMetadataFormProps) {
  const [localMetadata, setLocalMetadata] = useState({
    authorId,
    templateType,
    sourceAttribution: sourceAttribution || '',
    contentComplexityScore,
    bylineText: bylineText || ''
  });

  const template = ARTICLE_TEMPLATES.find(t => t.type === localMetadata.templateType);

  // Auto-generate byline when author or template changes
  useEffect(() => {
    if (localMetadata.authorId && localMetadata.templateType && template) {
      // This would ideally fetch the author name, but for now we'll use a placeholder
      const generatedByline = template.defaultBylineFormat.replace('{author_name}', 'Author Name');
      setLocalMetadata(prev => ({
        ...prev,
        bylineText: generatedByline
      }));
    }
  }, [localMetadata.authorId, localMetadata.templateType, template]);

  // Propagate changes up to parent
  useEffect(() => {
    onMetadataChange(localMetadata);
  }, [localMetadata, onMetadataChange]);

  const handleFieldChange = (field: string, value: any) => {
    setLocalMetadata(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className={`space-y-6 ${className}`}>
      <AuthorSelector
        selectedAuthorId={localMetadata.authorId}
        onAuthorChange={(authorId) => handleFieldChange('authorId', authorId)}
      />

      <TemplateSelector
        selectedTemplate={localMetadata.templateType}
        onTemplateChange={(templateType) => handleFieldChange('templateType', templateType)}
      />

      {template?.requiresAttribution && (
        <div className="space-y-2">
          <Label htmlFor="sourceAttribution">Source Attribution</Label>
          <Textarea
            id="sourceAttribution"
            value={localMetadata.sourceAttribution}
            onChange={(e) => handleFieldChange('sourceAttribution', e.target.value)}
            placeholder="Original source attribution (e.g., 'Originally published in...' or 'Based on reporting from...')"
            rows={2}
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="bylineText">Byline Text</Label>
        <Input
          id="bylineText"
          value={localMetadata.bylineText}
          onChange={(e) => handleFieldChange('bylineText', e.target.value)}
          placeholder="Custom byline text"
        />
        <p className="text-xs text-muted-foreground">
          This will appear in the published article. Leave empty to use template default.
        </p>
      </div>

      <div className="space-y-3">
        <Label>Content Complexity Score: {localMetadata.contentComplexityScore}</Label>
        <Slider
          value={[localMetadata.contentComplexityScore]}
          onValueChange={(value) => handleFieldChange('contentComplexityScore', value[0])}
          max={10}
          min={1}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Simple (1)</span>
          <span>Complex (10)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Rate the complexity of this content for reader difficulty and editorial effort required.
        </p>
      </div>
    </div>
  );
}
