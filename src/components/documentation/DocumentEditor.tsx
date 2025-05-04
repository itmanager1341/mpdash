
import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, X, Eye, Edit2 } from "lucide-react";
import DocumentViewer from "./DocumentViewer";

interface DocumentEditorProps {
  initialContent: string;
  initialTitle?: string;
  onSave: (content: string, title: string) => void;
  onCancel: () => void;
}

const DocumentEditor: React.FC<DocumentEditorProps> = ({
  initialContent,
  initialTitle = "",
  onSave,
  onCancel,
}) => {
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState(initialTitle);
  const [activeTab, setActiveTab] = useState<"edit" | "preview">("edit");

  const handleSave = () => {
    onSave(content, title);
  };

  return (
    <div className="flex flex-col space-y-4">
      <div className="space-y-4 mb-2">
        <div className="space-y-2">
          <Label htmlFor="title">Document Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter document title"
            className="w-full"
          />
        </div>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "edit" | "preview")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="edit">
              <Edit2 className="h-4 w-4 mr-2" />
              Edit
            </TabsTrigger>
            <TabsTrigger value="preview">
              <Eye className="h-4 w-4 mr-2" />
              Preview
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="edit" className="mt-4">
            <ScrollArea className="h-[60vh] border rounded-md">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="min-h-[60vh] font-mono text-sm resize-none border-0"
                placeholder="Enter markdown content here..."
              />
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="preview" className="mt-4">
            <ScrollArea className="h-[60vh] border p-4 rounded-md">
              <DocumentViewer 
                content={content} 
                title={title}
              />
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>
      
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
