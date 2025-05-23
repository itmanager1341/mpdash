
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import NewsImporter from "@/components/admin/NewsImporter";
import ScheduledImportSettings from "@/components/admin/ScheduledImportSettings";
import JobExecutionHistory from "@/components/admin/JobExecutionHistory";
import CronStatusChecker from "@/components/admin/CronStatusChecker";
import ApiKeysManager from "@/components/admin/ApiKeysManager";
import UserManagement from "@/components/admin/UserManagement";

const Admin = () => {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage system settings, imports, and configurations
        </p>
      </div>

      <Tabs defaultValue="news-import" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="news-import">News Import</TabsTrigger>
          <TabsTrigger value="scheduled-tasks">Scheduled Tasks</TabsTrigger>
          <TabsTrigger value="jobs-monitor">Jobs Monitor</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>

        <TabsContent value="news-import" className="space-y-6">
          <NewsImporter />
        </TabsContent>

        <TabsContent value="scheduled-tasks" className="space-y-6">
          <ScheduledImportSettings />
        </TabsContent>

        <TabsContent value="jobs-monitor" className="space-y-6">
          <CronStatusChecker />
          <JobExecutionHistory />
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-6">
          <ApiKeysManager />
        </TabsContent>

        <TabsContent value="users" className="space-y-6">
          <UserManagement />
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
};

export default Admin;
