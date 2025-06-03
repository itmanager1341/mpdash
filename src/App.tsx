
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import UnifiedEditorial from "./pages/UnifiedEditorial";
import EditorialWorkspace from "./pages/EditorialWorkspace";
import MPDailyPlanner from "./pages/MPDailyPlanner";
import MagazinePlanner from "./pages/MagazinePlanner";
import ContentCalendar from "./pages/ContentCalendar";
import Performance from "./pages/Performance";
import KeywordManagement from "./pages/KeywordManagement";
import EditorialDashboard from "./pages/EditorialDashboard";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/editorial" element={<UnifiedEditorial />} />
              <Route path="/editorial-workspace" element={<EditorialWorkspace />} />
              <Route path="/mpdaily-planner" element={<MPDailyPlanner />} />
              <Route path="/magazine-planner" element={<MagazinePlanner />} />
              <Route path="/content-calendar" element={<ContentCalendar />} />
              <Route path="/performance-dashboard" element={<Performance />} />
              <Route path="/keyword-management" element={<KeywordManagement />} />
              <Route path="/editorial-dashboard" element={<EditorialDashboard />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
