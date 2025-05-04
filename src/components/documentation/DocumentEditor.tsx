
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Save, X } from "lucide-react";

interface DocumentEditorProps {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  initialContent,
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);

  const handleSave = () => {
    onSave(content);
  };

  return (
    <div className="flex flex-col space-y-4">
      <ScrollArea className="h-[55vh]">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[55vh] font-mono text-sm resize-none"
          placeholder="Enter markdown content here..."
        />
      </ScrollArea>
      
      <div className="flex justify-end space-x-2">
        <Button variant="outline" onClick={onCancel}>
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Changes
        </Button>
      </div>
    </div>
  );
};

export default DocumentEditor;
