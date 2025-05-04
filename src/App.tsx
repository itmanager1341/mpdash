
import { useEffect } from "react";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import Index from "@/pages/Index";
import ContentCalendar from "@/pages/ContentCalendar";
import MPDailyPlanner from "@/pages/MPDailyPlanner";
import MagazinePlanner from "@/pages/MagazinePlanner";
import Performance from "@/pages/Performance";
import AdminSettings from "@/pages/AdminSettings";
import NotFound from "@/pages/NotFound";
import { supabase } from "@/integrations/supabase/client";

// Create a client
const queryClient = new QueryClient();

// Initialize router
const router = createBrowserRouter([
  { path: "/", element: <Index /> },
  { path: "/content-calendar", element: <ContentCalendar /> },
  { path: "/mpdaily-planner", element: <MPDailyPlanner /> },
  { path: "/magazine-planner", element: <MagazinePlanner /> },
  { path: "/performance", element: <Performance /> },
  { path: "/admin-settings", element: <AdminSettings /> },
  { path: "*", element: <NotFound /> }
]);

function App() {
  useEffect(() => {
    // Initialize database tables
    const initializeDatabase = async () => {
      console.info("Initializing database tables...");
      try {
        // Call edge function to create API keys table and helper function
        await supabase.functions.invoke('create-api-keys-function', {});
      } catch (error) {
        console.error("Error initializing API keys table:", error);
      }
      console.info("Database initialization completed");
    };
    
    // Run initialization on startup
    initializeDatabase();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
