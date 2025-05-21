
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  requiredRole?: "admin" | "editor" | "writer" | "viewer";
}

const ProtectedRoute = ({ requiredRole }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, isAdmin, isEditor, isWriter } = useAuth();
  const location = useLocation();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to auth page if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/auth" state={{ from: location }} replace />;
  }

  // Check role requirements if specified
  if (requiredRole) {
    let hasPermission = false;
    
    switch (requiredRole) {
      case "admin":
        hasPermission = isAdmin;
        break;
      case "editor":
        hasPermission = isEditor;
        break;
      case "writer":
        hasPermission = isWriter;
        break;
      case "viewer":
        hasPermission = true; // All authenticated users are at least viewers
        break;
    }
    
    if (!hasPermission) {
      return <Navigate to="/" replace />;
    }
  }

  // User is authenticated and has required role (if specified)
  return <Outlet />;
};

export default ProtectedRoute;
