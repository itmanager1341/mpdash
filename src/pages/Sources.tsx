
import DashboardLayout from "@/components/layout/DashboardLayout";
import SourcesTable from "@/components/sources/SourcesTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Sources() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sources Management</h1>
          <p className="text-muted-foreground">
            Manage your news sources and their relationships to keyword clusters.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>News Sources</CardTitle>
            <CardDescription>
              Configure and manage all news sources used for content aggregation and editorial planning.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SourcesTable />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
