import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { authDebug } from "@/lib/authDebug";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

// Enterprise plan — শুধু এই plan-এ /enterprise routes accessible
const ENTERPRISE_PLAN = "high_smart_enterprise";

// group_owner কিন্তু enterprise plan নেই → এই prefixes-এ যেতে পারবে না
const ENTERPRISE_ONLY_PREFIXES = ["/enterprise"];

// যেসব route সবসময় accessible (billing, upgrade, setup)
const ALWAYS_ALLOWED = ["/billing", "/upgrade", "/admin-setup"];

const ProtectedRoute = ({ children, allowedRoles }: ProtectedRouteProps) => {
  const { user, role, loading, trialExpired, restaurantId, restaurantPlan } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const searchParams = new URLSearchParams(window.location.search);
  const isBranchInvite = Boolean(searchParams.get("branch_restaurant_id"));
  const isAlwaysAllowed = ALWAYS_ALLOWED.some((p) => location.pathname.startsWith(p));

  // ── group_owner routing ────────────────────────────────────────────────────
  if (role === "group_owner" && !isAlwaysAllowed) {
    const hasEnterprisePlan = restaurantPlan === ENTERPRISE_PLAN;
    const isEnterpriseRoute = ENTERPRISE_ONLY_PREFIXES.some((prefix) =>
      location.pathname.startsWith(prefix),
    );

    if (hasEnterprisePlan) {
      // Enterprise plan আছে → enterprise routes-এ থাকতে পারবে
      // admin routes-এ গেলে enterprise dashboard-এ redirect
      if (!isEnterpriseRoute && !location.pathname.startsWith("/admin")) {
        authDebug("ProtectedRoute", "group_owner+enterprise redirected to enterprise dashboard", {
          path: location.pathname,
        });
        return <Navigate to="/enterprise/dashboard" replace />;
      }
    } else {
      // Enterprise plan নেই → /enterprise routes blocked → /admin-এ
      if (isEnterpriseRoute) {
        authDebug("ProtectedRoute", "group_owner without enterprise blocked from /enterprise", {
          restaurantPlan,
          path: location.pathname,
        });
        // restaurant আছে কিনা check করে সঠিক জায়গায় পাঠাও
        return restaurantId
          ? <Navigate to="/admin" replace />
          : <Navigate to="/upgrade" replace />;
      }
    }
  }

  // ── Admin — restaurant নেই এবং branch invite নয় → setup ──────────────────
  if (role === "admin" && !restaurantId && !isBranchInvite) {
    return <Navigate to="/admin-setup" replace />;
  }

  // ── Trial শেষ → expired page ───────────────────────────────────────────────
  if (trialExpired && role === "admin") {
    return <Navigate to="/trial-expired" replace />;
  }

  // ── Role-based access check ────────────────────────────────────────────────
  if (allowedRoles) {
    if (!role) {
      return <Navigate to="/login" replace />;
    }

    if (!allowedRoles.includes(role)) {
      authDebug("ProtectedRoute", "Redirecting — resolved role not allowed on this route", {
        allowedRoles,
        path: location.pathname,
        redirectedRole: role,
        restaurantId,
        restaurantPlan,
        userId: user.id,
      });

      if (role === "super_admin") return <Navigate to="/super-admin" replace />;
      if (role === "group_owner") {
        return restaurantPlan === ENTERPRISE_PLAN
          ? <Navigate to="/enterprise/dashboard" replace />
          : restaurantId
            ? <Navigate to="/admin" replace />
            : <Navigate to="/upgrade" replace />;
      }
      if (role === "waiter") return <Navigate to="/waiter" replace />;
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
