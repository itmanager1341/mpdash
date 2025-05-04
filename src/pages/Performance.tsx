
import DashboardLayout from "@/components/layout/DashboardLayout";

const Performance = () => {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Performance Dashboard</h1>
        <p className="text-muted-foreground">
          Track and analyze content performance metrics
        </p>
      </div>

      <div className="rounded-md border border-dashed p-8 text-center">
        <h2 className="text-xl font-medium mb-2">Performance Metrics</h2>
        <p className="text-muted-foreground mb-4">
          View analytics and performance data for your content
        </p>
      </div>
    </DashboardLayout>
  );
};

export default Performance;
