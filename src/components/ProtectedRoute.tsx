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
  const hasEnterprisePlan = restaurantPlan === ENTERPRISE_PLAN;

  const isEnterpriseRoute = ENTERPRISE_ONLY_PREFIXES.some((prefix) =>
    location.pathname.startsWith(prefix),
  );

  // ── group_owner OR admin with enterprise plan routing ─────────────────────
  // If an admin upgrades to High Smart Enterprise, they MUST use the enterprise dashboard.
  if ((role === "group_owner" || (role === "admin" && hasEnterprisePlan)) && !isAlwaysAllowed) {
    if (hasEnterprisePlan) {
      // Enterprise plan আছে → enterprise routes-এ থাকতে পারবে
      // admin routes-এ গেলে enterprise dashboard-এ redirect
      if (!isEnterpriseRoute && !location.pathname.startsWith("/admin-setup")) {
        authDebug("ProtectedRoute", "Enterprise plan user redirected to enterprise dashboard", {
          path: location.pathname,
          role,
        });
        return <Navigate to="/enterprise/dashboard" replace />;
      }
    } else if (role === "group_owner") {
      // group_owner কিন্তু Enterprise plan নেই → /enterprise routes blocked
      if (isEnterpriseRoute) {
        authDebug("ProtectedRoute", "group_owner without enterprise blocked from /enterprise", {
          restaurantPlan,
          path: location.pathname,
        });
        return restaurantId
          ? <Navigate to="/admin" replace />
          : <Navigate to="/upgrade" replace />;
      }
    }
  }

  // ── Admin — restaurant নেই এবং branch invite নয় → setup ──────────────────
  if (role === "admin" && !restaurantId && !isBranchInvite && !hasEnterprisePlan) {
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

    // If an admin has the enterprise plan, they are effectively a group_owner for route access
    const effectiveRole = role === "admin" && hasEnterprisePlan ? "group_owner" : role;

    if (!allowedRoles.includes(effectiveRole)) {
      authDebug("ProtectedRoute", "Redirecting — resolved role not allowed on this route", {
        allowedRoles,
        path: location.pathname,
        redirectedRole: role,
        effectiveRole,
        restaurantId,
        restaurantPlan,
        userId: user.id,
      });

      if (effectiveRole === "super_admin") return <Navigate to="/super-admin" replace />;
      if (effectiveRole === "group_owner") {
        return restaurantPlan === ENTERPRISE_PLAN
          ? <Navigate to="/enterprise/dashboard" replace />
          : restaurantId
            ? <Navigate to="/admin" replace />
            : <Navigate to="/upgrade" replace />;
      }
      if (effectiveRole === "waiter") return <Navigate to="/waiter" replace />;
      return <Navigate to="/admin" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
