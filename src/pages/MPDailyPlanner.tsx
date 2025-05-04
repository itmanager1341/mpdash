
import DashboardLayout from "@/components/layout/DashboardLayout";

const MPDailyPlanner = () => {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">MPDaily Planner</h1>
        <p className="text-muted-foreground">
          Plan and organize content for the daily email newsletter
        </p>
      </div>

      <div className="rounded-md border border-dashed p-8 text-center">
        <h2 className="text-xl font-medium mb-2">MPDaily Planner</h2>
        <p className="text-muted-foreground mb-4">
          Manage approved articles for the MPDaily email newsletter
        </p>
      </div>
    </DashboardLayout>
  );
};

export default MPDailyPlanner;
