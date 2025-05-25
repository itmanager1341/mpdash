
import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
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
import KeywordManagement from "@/pages/KeywordManagement";
import EditorialDashboard from "@/pages/EditorialDashboard";
import EditorialWorkspace from "@/pages/EditorialWorkspace";
import NotFound from "@/pages/NotFound";
import Auth from "@/pages/Auth";
import Profile from "@/pages/Profile";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Create a client
const queryClient = new QueryClient();

function App() {
  React.useEffect(() => {
    // Check database tables on app startup
    const checkDatabaseTables = async () => {
      try {
        // Try to use RPC function first
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
        <Routes>
          <Route path="/auth" element={<Auth />} />
          
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Index />} />
            <Route path="/content-calendar" element={<ContentCalendar />} />
            <Route path="/mpdaily-planner" element={<MPDailyPlanner />} />
            <Route path="/magazine-planner" element={<MagazinePlanner />} />
            <Route path="/performance" element={<Performance />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/documentation" element={<Documentation />} />
            <Route path="/llm-management" element={<LlmManagement />} />
            <Route path="/keyword-management" element={<KeywordManagement />} />
            <Route path="/editorial-dashboard" element={<EditorialDashboard />} />
            <Route path="/editorial-workspace" element={<EditorialWorkspace />} />
          </Route>
          
          <Route element={<ProtectedRoute requiredRole="admin" />}>
            <Route path="/admin-settings" element={<AdminSettings />} />
          </Route>
          
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
