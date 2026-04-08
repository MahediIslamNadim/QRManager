import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading, trialExpired, restaurantId } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Admin has no restaurant → force setup (super_admin exempt)
  if (role === "admin" && !restaurantId) {
    return <Navigate to="/admin-setup" replace />;
  }

  // Trial expired
  if (trialExpired && role === "admin") {
    return <Navigate to="/trial-expired" replace />;
  }

  if (allowedRoles) {
    // Authenticated but no role (e.g. fetchUserData ran before the signup RPC created
    // the role row). Without this guard, role=null short-circuits the old check and the
    // user renders a protected page they have no access to.
    if (!role) return <Navigate to="/login" replace />;
    if (!allowedRoles.includes(role)) {
      if (role === "super_admin") return <Navigate to="/super-admin" replace />;
      if (role === "waiter") return <Navigate to="/waiter" replace />;
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
