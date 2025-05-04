
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NewsImporter from "@/components/admin/NewsImporter";

export default function AdminSettings() {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Settings</h1>
        <p className="text-muted-foreground">Manage system settings, data imports, and user roles</p>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="import">Data Import</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="clusters">Keyword Clusters</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
        </TabsList>
        
        <TabsContent value="import" className="space-y-6">
          <NewsImporter />
        </TabsContent>
        
        <TabsContent value="sources">
          <div className="bg-muted/50 rounded-md p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Source Management</h3>
            <p className="text-muted-foreground">Configure and manage content sources here.</p>
          </div>
        </TabsContent>
        
        <TabsContent value="clusters">
          <div className="bg-muted/50 rounded-md p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">Keyword Cluster Management</h3>
            <p className="text-muted-foreground">Manage keyword clusters and categorization here.</p>
          </div>
        </TabsContent>
        
        <TabsContent value="users">
          <div className="bg-muted/50 rounded-md p-8 text-center">
            <h3 className="text-xl font-semibold mb-2">User Role Management</h3>
            <p className="text-muted-foreground">Configure user roles and permissions here.</p>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
