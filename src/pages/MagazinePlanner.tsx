
import DashboardLayout from "@/components/layout/DashboardLayout";

const MagazinePlanner = () => {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Magazine Planner</h1>
        <p className="text-muted-foreground">
          Plan and organize content for the monthly magazine
        </p>
      </div>

      <div className="rounded-md border border-dashed p-8 text-center">
        <h2 className="text-xl font-medium mb-2">Magazine Planner</h2>
        <p className="text-muted-foreground mb-4">
          Manage articles and features for the monthly magazine
        </p>
      </div>
    </DashboardLayout>
  );
};

export default MagazinePlanner;
