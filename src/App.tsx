
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import MPDailyPlanner from "./pages/MPDailyPlanner";
import MagazinePlanner from "./pages/MagazinePlanner";
import ContentCalendar from "./pages/ContentCalendar";
import Performance from "./pages/Performance";
import AdminSettings from "./pages/AdminSettings";
import NotFound from "./pages/NotFound";
import { toast } from "sonner";

const queryClient = new QueryClient();

const App = () => {
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Ensure necessary tables are created
    const initializeDatabase = async () => {
      try {
        console.log("Initializing database tables...");
        
        // Initialize the database tables using edge function
        const { data, error } = await supabase.functions.invoke('create-api-keys-table', {});
        
        if (error) {
          console.error("Error initializing API keys table:", error);
          toast.error("Failed to initialize database tables. Some features may not work properly.");
        } else {
          console.log("API keys table initialization completed");
        }
        
        // Add more table initialization here as needed
        
        console.log("Database initialization completed");
      } catch (error) {
        console.error("Error initializing database:", error);
        toast.error("Error initializing database. Please try refreshing the page.");
      } finally {
        setIsInitializing(false);
      }
    };
    
    initializeDatabase();
  }, []);

  // Don't render the app until initialization is complete
  if (isInitializing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
          <div className="text-lg font-medium text-muted-foreground">Initializing application...</div>
        </div>
      </div>
    );
  }

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
