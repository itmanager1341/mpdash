
import DashboardLayout from "@/components/layout/DashboardLayout";

const ContentCalendar = () => {
  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Content Calendar</h1>
        <p className="text-muted-foreground">
          View and manage your content schedule across all channels
        </p>
      </div>

      <div className="rounded-md border border-dashed p-8 text-center">
        <h2 className="text-xl font-medium mb-2">Content Calendar</h2>
        <p className="text-muted-foreground mb-4">
          Calendar view of scheduled and published content
        </p>
      </div>
    </DashboardLayout>
  );
};

export default ContentCalendar;
