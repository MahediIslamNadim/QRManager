import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { authDebug } from "@/lib/authDebug";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading, trialExpired, restaurantId, restaurantPlan } = useAuth();
  const location = useLocation();

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

  const searchParams = new URLSearchParams(window.location.search);
  const isBranchInvite = !!searchParams.get("branch_restaurant_id");

  if (role === "admin" && !restaurantId && !isBranchInvite) {
    return <Navigate to="/admin-setup" replace />;
  }

  if (trialExpired && role === "admin") {
    return <Navigate to="/trial-expired" replace />;
  }

  // group_owner → enterprise setup/dashboard
  // Allow access to enterprise routes, admin/settings, upgrade/billing
  if (role === "group_owner") {
    const enterpriseAllowed = [
      "/enterprise/setup",
      "/enterprise/dashboard",
      "/group",   // /group/setup, /group/:groupId — সব group routes
      "/admin/settings",
      "/upgrade",
      "/billing",
      "/admin",   // allow to manage their own restaurant
      "/admin/menu",
      "/admin/tables",
      "/admin/orders",
      "/admin/staff",
      "/admin/analytics",
      "/admin/reports",
      "/admin/feedback",
      "/admin/support",
      "/admin/ai-insights",
      "/admin/kitchen",
    ];
    const isAllowed = enterpriseAllowed.some(p => location.pathname.startsWith(p));
    if (!isAllowed) {
      return <Navigate to="/enterprise/dashboard" replace />;
    }
  }

  if (allowedRoles) {
    if (!role) {
      return <Navigate to="/login" replace />;
    }

    if (!allowedRoles.includes(role)) {
      authDebug("ProtectedRoute", "Redirecting because resolved role is not allowed on this route", {
        allowedRoles,
        path: location.pathname,
        redirectedRole: role,
        restaurantId,
        userId: user.id,
      });

      if (role === "super_admin") return <Navigate to="/super-admin" replace />;
      if (role === "group_owner") return <Navigate to="/enterprise/dashboard" replace />;
      if (role === "waiter") return <Navigate to="/waiter" replace />;
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
