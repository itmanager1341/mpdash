
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PromptsTab from "@/components/llm/PromptsTab";

export default function LlmManagement() {
  const [activeTab, setActiveTab] = useState("prompts");
  
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">LLM Management</h1>
        <p className="text-muted-foreground">Manage language models, prompts, and configurations for editorial AI</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 grid grid-cols-4 sm:w-[600px]">
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="usage">Usage & Analytics</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="prompts" className="space-y-6">
          <PromptsTab />
        </TabsContent>
        
        <TabsContent value="models" className="space-y-6">
          <div className="bg-muted/50 rounded-md p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Model Management</h3>
            <p className="text-muted-foreground">Configure LLM models and their parameters (Coming soon)</p>
          </div>
        </TabsContent>
        
        <TabsContent value="usage" className="space-y-6">
          <div className="bg-muted/50 rounded-md p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Usage & Analytics</h3>
            <p className="text-muted-foreground">Track token usage, costs, and performance metrics (Coming soon)</p>
          </div>
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-6">
          <div className="bg-muted/50 rounded-md p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">LLM Settings</h3>
            <p className="text-muted-foreground">Configure global LLM settings and defaults (Coming soon)</p>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
