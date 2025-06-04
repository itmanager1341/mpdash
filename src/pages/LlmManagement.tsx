
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import PromptsTab from "@/components/llm/PromptsTab";
import ModelsTab from "@/components/llm/ModelsTab";
import UsageAnalyticsTab from "@/components/llm/UsageAnalyticsTab";
import ApiKeysManager from "@/components/admin/ApiKeysManager";

export default function LlmManagement() {
  const [activeTab, setActiveTab] = useState("models");
  const location = useLocation();
  const navigate = useNavigate();
  
  // Parse URL query parameter for tab selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['models', 'prompts', 'api-keys', 'usage'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);
  
  // Update URL when tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    navigate(`?${url.searchParams.toString()}`, { replace: true });
  };
  
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">LLM & API Management</h1>
        <p className="text-muted-foreground">Centralized management of AI models, prompts, and API keys</p>
      </div>
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="mb-6 grid grid-cols-4 sm:w-[600px]">
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="usage">Analytics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="models" className="space-y-6">
          <ModelsTab />
        </TabsContent>
        
        <TabsContent value="prompts" className="space-y-6">
          <PromptsTab />
        </TabsContent>
        
        <TabsContent value="api-keys" className="space-y-6">
          <ApiKeysManager />
        </TabsContent>
        
        <TabsContent value="usage" className="space-y-6">
          <UsageAnalyticsTab />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
