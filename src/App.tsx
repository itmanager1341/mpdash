
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import MPDailyPlanner from "./pages/MPDailyPlanner";
import MagazinePlanner from "./pages/MagazinePlanner";
import ContentCalendar from "./pages/ContentCalendar";
import Performance from "./pages/Performance";
import AdminSettings from "./pages/AdminSettings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    // Ensure necessary tables are created
    const initializeDatabase = async () => {
      try {
        await supabase.functions.invoke('create-api-keys-table', {});
        console.log("Database initialization completed");
      } catch (error) {
        console.error("Error initializing database:", error);
      }
    };
    
    initializeDatabase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/mpdaily-planner" element={<MPDailyPlanner />} />
            <Route path="/magazine-planner" element={<MagazinePlanner />} />
            <Route path="/content-calendar" element={<ContentCalendar />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/admin" element={<AdminSettings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
