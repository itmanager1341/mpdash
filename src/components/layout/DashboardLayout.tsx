
import { ReactNode } from "react";
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarTrigger,
  SidebarInset
} from "@/components/ui/sidebar";
import { CalendarDays, LayoutDashboard, Mail, Settings, BookOpen, PieChart, FileText, Sparkles } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <Sidebar>
          <SidebarHeader className="flex items-center justify-between p-4">
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-[#0F52BA] p-1">
                <span className="text-lg font-bold text-white">MP</span>
              </div>
              <span className="font-bold text-xl">Editorial</span>
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Dashboard</SidebarGroupLabel>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Today's Briefing">
                    <a href="/">
                      <LayoutDashboard />
                      <span>Today's Briefing</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="MPDaily Planner">
                    <a href="/mpdaily-planner">
                      <Mail />
                      <span>MPDaily Planner</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Magazine Planner">
                    <a href="/magazine-planner">
                      <BookOpen />
                      <span>Magazine Planner</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Content Calendar">
                    <a href="/content-calendar">
                      <CalendarDays />
                      <span>Content Calendar</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Performance">
                    <a href="/performance">
                      <PieChart />
                      <span>Performance</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="LLM Management">
                    <a href="/llm-management">
                      <Sparkles />
                      <span>LLM Management</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Documentation">
                    <a href="/documentation">
                      <FileText />
                      <span>Documentation</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild tooltip="Settings">
                    <a href="/admin-settings">
                      <Settings />
                      <span>Admin Settings</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-4">
            <div className="text-xs text-sidebar-foreground/50">
              MP Editorial Dashboard v1.0
            </div>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="overflow-auto">
          <header className="border-b border-border bg-background py-4 px-6 flex items-center justify-between">
            <SidebarTrigger />
            <div className="ml-4 flex-1 text-lg font-semibold">MP Editorial Dashboard</div>
            <div>
              {/* Profile and other header elements will go here */}
            </div>
          </header>
          <main className="flex-1 p-6">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
