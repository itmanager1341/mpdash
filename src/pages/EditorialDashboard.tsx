
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Settings, 
  Zap, 
  Activity, 
  Database,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles
} from "lucide-react";
import SmartPromptEditor from "@/components/editorial/SmartPromptEditor";
import SourceManagement from "@/components/editorial/SourceManagement";
import ScheduleMonitor from "@/components/editorial/ScheduleMonitor";
import ContentIntelligence from "@/components/editorial/ContentIntelligence";

export default function EditorialDashboard() {
  const [activeTab, setActiveTab] = useState("sources");
  const location = useLocation();
  const navigate = useNavigate();
  
  // Parse URL query parameter for tab selection
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    if (tabParam && ['sources', 'prompts', 'schedule', 'intelligence'].includes(tabParam)) {
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
        <h1 className="text-3xl font-bold mb-2">Editorial Dashboard</h1>
        <p className="text-muted-foreground">
          Unified control center for news sources, AI prompts, and content optimization
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="sources" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Sources
          </TabsTrigger>
          <TabsTrigger value="prompts" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Smart Prompts
          </TabsTrigger>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Schedule & Monitor
          </TabsTrigger>
          <TabsTrigger value="intelligence" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Content Intelligence
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sources" className="space-y-6 mt-6">
          <SourceManagement />
        </TabsContent>

        <TabsContent value="prompts" className="space-y-6 mt-6">
          <SmartPromptEditor />
        </TabsContent>

        <TabsContent value="schedule" className="space-y-6 mt-6">
          <ScheduleMonitor />
        </TabsContent>
        
        <TabsContent value="intelligence" className="space-y-6 mt-6">
          <ContentIntelligence />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
