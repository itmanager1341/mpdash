
import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ScheduledJobsTable from "@/components/jobs/ScheduledJobsTable";
import JobExecutionLogsTable from "@/components/jobs/JobExecutionLogsTable";
import { Calendar, History } from "lucide-react";

export default function Jobs() {
  const [activeTab, setActiveTab] = useState("scheduled-jobs");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="border-b pb-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold">Jobs Management</h1>
            <p className="text-muted-foreground">
              Manage scheduled jobs and view execution history
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scheduled-jobs" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Scheduled Jobs
            </TabsTrigger>
            <TabsTrigger value="execution-logs" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Execution Logs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scheduled-jobs" className="space-y-6">
            <ScheduledJobsTable />
          </TabsContent>

          <TabsContent value="execution-logs" className="space-y-6">
            <JobExecutionLogsTable />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
