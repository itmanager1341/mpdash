
import { useEffect } from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/contexts/AuthContext";
import Index from "@/pages/Index";
import ContentCalendar from "@/pages/ContentCalendar";
import MPDailyPlanner from "@/pages/MPDailyPlanner";
import MagazinePlanner from "@/pages/MagazinePlanner";
import Performance from "@/pages/Performance";
import AdminSettings from "@/pages/AdminSettings";
import Documentation from "@/pages/Documentation";
import LlmManagement from "@/pages/LlmManagement";
import NotFound from "@/pages/NotFound";
import Auth from "@/pages/Auth";
import Profile from "@/pages/Profile";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Create a client
const queryClient = new QueryClient();

// Initialize router with auth protection
const router = createBrowserRouter([
  {
    path: "/auth",
    element: <Auth />
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <Index /> },
      { path: "/content-calendar", element: <ContentCalendar /> },
      { path: "/mpdaily-planner", element: <MPDailyPlanner /> },
      { path: "/magazine-planner", element: <MagazinePlanner /> },
      { path: "/performance", element: <Performance /> },
      { path: "/profile", element: <Profile /> },
      { path: "/documentation", element: <Documentation /> },
      { path: "/llm-management", element: <LlmManagement /> },
    ]
  },
  {
    element: <ProtectedRoute requiredRole="admin" />,
    children: [
      { path: "/admin-settings", element: <AdminSettings /> },
    ]
  },
  { path: "*", element: <NotFound /> }
]);

function App() {
  useEffect(() => {
    // Check database tables on app startup
    const checkDatabaseTables = async () => {
      try {
        // Get the list of API keys to verify the table exists and is accessible
        const { data, error } = await supabase.functions.invoke('api-keys', {
          body: { operation: 'list' }
        });
        
        if (error) {
          console.error("Error checking database tables:", error);
          toast.error("Error connecting to database", { 
            description: "Some features may not be available. Please check your connection."
          });
          return;
        }
        
        console.info("Database connection verified successfully");
        
        // Preload the API keys into the query client cache
        queryClient.setQueryData(['apiKeys'], data?.keys || []);
      } catch (error) {
        console.error("Exception during database check:", error);
        toast.error("Error initializing application", { 
          description: "An unexpected error occurred. Some features may not work correctly."
        });
      }
    };
    
    // Run verification on startup
    checkDatabaseTables();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
