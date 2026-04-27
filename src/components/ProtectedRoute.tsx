import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { authDebug } from "@/lib/authDebug";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading, trialExpired, restaurantId } = useAuth();
  const location = useLocation();

  if (loading) {
    authDebug("ProtectedRoute", "Holding route while auth context is loading", {
      allowedRoles,
      path: location.pathname,
      restaurantId,
      role,
      userId: user?.id ?? null,
    });

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
    authDebug("ProtectedRoute", "Redirecting to /login because no authenticated user exists", {
      allowedRoles,
      path: location.pathname,
    });
    return <Navigate to="/login" replace />;
  }

  if (role === "admin" && !restaurantId) {
    authDebug("ProtectedRoute", "Redirecting admin to /admin-setup because restaurantId is missing", {
      allowedRoles,
      path: location.pathname,
      role,
      userId: user.id,
    });
    return <Navigate to="/admin-setup" replace />;
  }

  if (trialExpired && role === "admin") {
    authDebug("ProtectedRoute", "Redirecting admin to /trial-expired because trialExpired is true", {
      path: location.pathname,
      restaurantId,
      userId: user.id,
    });
    return <Navigate to="/trial-expired" replace />;
  }

  if (allowedRoles) {
    if (!role) {
      authDebug("ProtectedRoute", "Redirecting to /login because authenticated user has no resolved role", {
        allowedRoles,
        path: location.pathname,
        restaurantId,
        userId: user.id,
      });
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
      if (role === "group_owner") return <Navigate to="/group/setup" replace />;
      if (role === "waiter") return <Navigate to="/waiter" replace />;
      return <Navigate to="/admin" replace />;
    }
  }

  authDebug("ProtectedRoute", "Route access granted", {
    allowedRoles,
    path: location.pathname,
    restaurantId,
    role,
    userId: user.id,
  });

  return <>{children}</>;
};

export default ProtectedRoute;
