
import { useEffect, useState } from "react";
import { FileText, Edit, Search } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import DocumentViewer from "@/components/documentation/DocumentViewer";
import DocumentEditor from "@/components/documentation/DocumentEditor";

// Define knowledge file types
type KnowledgeFile = {
  id: string;
  title: string;
  filePath: string;
  category: "core" | "domain" | "technical" | "user";
  description: string;
};

const knowledgeFiles: KnowledgeFile[] = [
  {
    id: "app",
    title: "Application Overview",
    filePath: "app.knowledge.md",
    category: "core",
    description: "Overall application structure, features, and architecture"
  },
  {
    id: "api-management",
    title: "API Management",
    filePath: "api-management.knowledge.md",
    category: "core",
    description: "API key management system, supported services, and usage patterns"
  },
  {
    id: "news-workflow",
    title: "News Workflow",
    filePath: "news-workflow.knowledge.md",
    category: "core",
    description: "News importing, approval, and generation processes"
  },
  {
    id: "mortgage-industry",
    title: "Mortgage Industry",
    filePath: "mortgage-industry.knowledge.md",
    category: "domain",
    description: "Key terms, concepts, and trends in the mortgage industry"
  },
  {
    id: "editorial-workflow",
    title: "Editorial Workflow",
    filePath: "editorial-workflow.knowledge.md",
    category: "domain",
    description: "Editorial workflows, content types, and publication standards"
  },
  {
    id: "supabase-integration",
    title: "Supabase Integration",
    filePath: "supabase-integration.knowledge.md",
    category: "technical",
    description: "Database schema, edge functions, and API usage patterns"
  },
  {
    id: "ai-integration",
    title: "AI Integration",
    filePath: "ai-integration.knowledge.md",
    category: "technical",
    description: "How we use OpenAI and Perplexity APIs, prompt patterns, and best practices"
  },
  {
    id: "admin-guide",
    title: "Administrator Guide",
    filePath: "admin-guide.knowledge.md",
    category: "user",
    description: "How to configure and administer the system"
  },
  {
    id: "editor-guide",
    title: "Editor Guide",
    filePath: "editor-guide.knowledge.md",
    category: "user",
    description: "How editors should use the different features of the platform"
  }
];

export default function Documentation() {
  const [selectedFile, setSelectedFile] = useState<KnowledgeFile | null>(null);
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [searchQuery, setSearchQuery] = useState("");
  const [currentCategory, setCurrentCategory] = useState<"all" | "core" | "domain" | "technical" | "user">("all");

  // Fetch document content
  const { data: documentContent, isLoading } = useQuery({
    queryKey: ["documentContent", selectedFile?.filePath],
    queryFn: async () => {
      if (!selectedFile) return "";
      try {
        // In a real implementation, this would fetch from your storage
        // For now, let's pretend we're fetching content
        const response = await fetch(`/${selectedFile.filePath}`);
        if (!response.ok) {
          throw new Error("Failed to fetch document");
        }
        return await response.text();
      } catch (error) {
        console.error("Error fetching document:", error);
        toast.error("Failed to load document");
        return "";
      }
    },
    enabled: !!selectedFile,
  });

  // Filter files based on search and category
  const filteredFiles = knowledgeFiles.filter(file => {
    const matchesSearch = searchQuery === "" || 
      file.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      file.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = currentCategory === "all" || file.category === currentCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Select first file on initial load if none selected
  useEffect(() => {
    if (!selectedFile && filteredFiles.length > 0) {
      setSelectedFile(filteredFiles[0]);
    }
  }, [filteredFiles, selectedFile]);

  // Handle document save
  const handleSaveDocument = async (content: string) => {
    if (!selectedFile) return;
    
    try {
      // In a real implementation, this would save to your storage
      toast.success("Document saved successfully");
      setMode("view");
    } catch (error) {
      console.error("Error saving document:", error);
      toast.error("Failed to save document");
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto p-4">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">Documentation & Guides</h1>
            {selectedFile && mode === "view" && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setMode("edit")}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit Document
              </Button>
            )}
            {selectedFile && mode === "edit" && (
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setMode("view")}
              >
                <FileText className="mr-2 h-4 w-4" />
                View Document
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Left sidebar with document list */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-2">
                <CardTitle>Knowledge Base</CardTitle>
                <CardDescription>Documentation and guides</CardDescription>
                <div className="relative mt-2">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search documents..."
                    className="pl-8"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="pb-2">
                <Tabs defaultValue="all" onValueChange={(value) => setCurrentCategory(value as any)}>
                  <TabsList className="w-full">
                    <TabsTrigger value="all">All</TabsTrigger>
                    <TabsTrigger value="core">Core</TabsTrigger>
                    <TabsTrigger value="domain">Domain</TabsTrigger>
                    <TabsTrigger value="technical">Technical</TabsTrigger>
                    <TabsTrigger value="user">User</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
              
              <ScrollArea className="h-[60vh]">
                <div className="px-4 py-2">
                  {filteredFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No documents found
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {filteredFiles.map((file) => (
                        <div key={file.id}>
                          <Button
                            variant={selectedFile?.id === file.id ? "secondary" : "ghost"}
                            className="w-full justify-start text-left"
                            onClick={() => {
                              setSelectedFile(file);
                              setMode("view"); // Reset to view mode when changing files
                            }}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            <span className="truncate">{file.title}</span>
                          </Button>
                          <Separator className="my-1" />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </Card>

            {/* Right content area */}
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>{selectedFile?.title || "Select a document"}</CardTitle>
                <CardDescription>{selectedFile?.description || ""}</CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex justify-center p-8">
                    <p>Loading document...</p>
                  </div>
                ) : selectedFile ? (
                  mode === "view" ? (
                    <ScrollArea className="h-[60vh] pr-4">
                      <DocumentViewer content={documentContent || ""} />
                    </ScrollArea>
                  ) : (
                    <DocumentEditor 
                      initialContent={documentContent || ""} 
                      onSave={handleSaveDocument} 
                      onCancel={() => setMode("view")}
                    />
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center">
                    <FileText className="h-16 w-16 text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">Select a document to view</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Choose a document from the sidebar to view its contents
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
