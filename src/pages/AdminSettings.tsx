
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import NewsImporter from "@/components/admin/NewsImporter";
import NewsTextConverter from "@/components/admin/NewsTextConverter";
import ApiKeysManager from "@/components/admin/ApiKeysManager";
import { Button } from "@/components/ui/button";
import { FileText, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AdminSettings() {
  const navigate = useNavigate();

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Admin Settings</h1>
        <p className="text-muted-foreground">Manage system settings, data imports, and user roles</p>
      </div>

      <Tabs defaultValue="import" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="import">Data Import</TabsTrigger>
          <TabsTrigger value="api">API & AI</TabsTrigger>
          <TabsTrigger value="sources">Sources</TabsTrigger>
          <TabsTrigger value="clusters">Keyword Clusters</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="docs">Documentation</TabsTrigger>
        </TabsList>
        
        <TabsContent value="import" className="space-y-6">
          <NewsTextConverter />
          <NewsImporter />
        </TabsContent>
        
        <TabsContent value="api" className="space-y-6">
          <ApiKeysManager />
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

        <TabsContent value="docs">
          <div className="bg-muted/50 rounded-md p-8">
            <h3 className="text-xl font-semibold mb-2">Documentation Management</h3>
            <p className="text-muted-foreground mb-6">Manage system documentation and user guides.</p>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <Button 
                onClick={() => navigate('/documentation')}
                className="flex items-center"
              >
                <FileText className="mr-2 h-4 w-4" />
                View Documentation Portal
              </Button>
              
              <Button 
                variant="outline"
                onClick={() => {
                  // In a real implementation, this would open the knowledge settings
                  navigate('/admin-settings');
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                Manage Knowledge Settings
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
