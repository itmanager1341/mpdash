
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  Settings, 
  Database,
  Clock,
  Sparkles
} from "lucide-react";
import SmartPromptEditor from "@/components/editorial/SmartPromptEditor";
import SourceManagement from "@/components/editorial/SourceManagement";
import ScheduleMonitor from "@/components/editorial/ScheduleMonitor";

export default function EditorialDashboard() {
  const [activeTab, setActiveTab] = useState("prompts");
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['prompts', 'sources', 'schedule'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [location.search]);
  
  const handleTabChange = (value: string) => {
    setActiveTab(value);
    const url = new URL(window.location.href);
    url.searchParams.set('tab', value);
    navigate(`?${url.searchParams.toString()}`, { replace: true });
  };

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Editorial Settings</h1>
        <p className="text-muted-foreground">
          Configure AI prompts, content sources, and automation
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="prompts" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            AI Prompts
          </TabsTrigger>
          <TabsTrigger value="sources" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Content Sources
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Automation
          </TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="space-y-6 mt-6">
          <SmartPromptEditor />
        </TabsContent>

        <TabsContent value="sources" className="space-y-6 mt-6">
          <SourceManagement />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6 mt-6">
          <ScheduleMonitor />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
