import { Component, ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import { getPendingLoginRedirect, isAuthDebugEnabled } from "@/lib/authDebug";
import Index from "./pages/Index";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminRestaurants from "./pages/SuperAdminRestaurants";
import SuperAdminUsers from "./pages/SuperAdminUsers";
import SuperAdminAnalytics from "./pages/SuperAdminAnalytics";
import SuperAdminSettings from "./pages/SuperAdminSettings";
import SuperAdminPayments from "./pages/SuperAdminPayments";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMenu from "./pages/AdminMenu";
import AdminTables from "./pages/AdminTables";
import AdminOrders from "./pages/AdminOrders";
import AdminStaff from "./pages/AdminStaff";
import AdminAnalytics from "./pages/AdminAnalytics";
import AIAnalytics from "./pages/AIAnalytics";
import AdminSettings from "./pages/AdminSettings";
import AdminSetup from "./pages/AdminSetup";
import WaiterDashboard from "./pages/WaiterDashboard";
import WaiterSeats from "./pages/WaiterSeats";
import WaiterNotifications from "./pages/WaiterNotifications";
import CustomerMenu from "./pages/CustomerMenu";
import CustomerSeatSelect from "./pages/CustomerSeatSelect";
import TrialExpired from "./pages/TrialExpired";
import ShortCodeRedirect from "./pages/ShortCodeRedirect";
import Pricing from "./pages/Pricing";
import Features from "./pages/Features";
import Demo from "./pages/Demo";
import KitchenDisplay from "./pages/KitchenDisplay";
import UpgradePage from "./pages/UpgradePage";
import BillingPage from "./pages/BillingPage";
import AdminReports from "./pages/AdminReports";
import AdminFeedback from "./pages/AdminFeedback";
import AdminSupport from "./pages/AdminSupport";
import PaymentResultPage from "./pages/PaymentResultPage";

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("App Error Boundary caught:", error, {
      componentStack: info.componentStack,
      path: typeof window !== "undefined" ? window.location.pathname + window.location.search : null,
      pendingLoginRedirect: getPendingLoginRedirect(),
    });
  }

  render() {
    if (this.state.hasError) {
      const showDebugDetails = isAuthDebugEnabled();
      const pendingLoginRedirect = getPendingLoginRedirect();
      const currentPath = typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "unknown";

      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-background">
          <h1 className="text-2xl font-bold text-destructive">কিছু একটা ভুল হয়েছে</h1>
          <p className="text-sm text-muted-foreground max-w-md text-center">
            অপ্রত্যাশিত সমস্যা হয়েছে। পেজটি রিলোড করুন অথবা হোমে ফিরুন।
          </p>
          {showDebugDetails && this.state.error && (
            <div className="text-xs text-red-400 bg-red-950/30 border border-red-800 rounded-lg p-3 max-w-lg w-full overflow-auto space-y-3">
              <div>
                <div className="font-semibold mb-1">Current Route</div>
                <pre>{currentPath}</pre>
              </div>
              {pendingLoginRedirect && (
                <div>
                  <div className="font-semibold mb-1">Pending Login Redirect</div>
                  <pre>{JSON.stringify(pendingLoginRedirect, null, 2)}</pre>
                </div>
              )}
              <div>
                <div className="font-semibold mb-1">Exact Error</div>
                <pre>{this.state.error.message}{"\n"}{this.state.error.stack}</pre>
              </div>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm"
            >
              রিলোড করুন
            </button>
            <button
              onClick={() => { window.location.href = "/"; }}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm"
            >
              হোমে ফিরুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/admin-setup" element={<AdminSetup />} />
              <Route path="/pricing" element={<Pricing />} />
              <Route path="/features" element={<Features />} />
              <Route path="/demo" element={<Demo />} />

              <Route
                path="/super-admin"
                element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminDashboard /></ProtectedRoute>}
              />
              <Route
                path="/super-admin/restaurants"
                element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminRestaurants /></ProtectedRoute>}
              />
              <Route
                path="/super-admin/users"
                element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminUsers /></ProtectedRoute>}
              />
              <Route
                path="/super-admin/analytics"
                element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminAnalytics /></ProtectedRoute>}
              />
              <Route
                path="/super-admin/payments"
                element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminPayments /></ProtectedRoute>}
              />
              <Route
                path="/super-admin/settings"
                element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminSettings /></ProtectedRoute>}
              />
              <Route
                path="/admin"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminDashboard /></ProtectedRoute>}
              />
              <Route
                path="/admin/menu"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminMenu /></ProtectedRoute>}
              />
              <Route
                path="/admin/tables"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminTables /></ProtectedRoute>}
              />
              <Route
                path="/admin/orders"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminOrders /></ProtectedRoute>}
              />
              <Route
                path="/admin/staff"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminStaff /></ProtectedRoute>}
              />
              <Route
                path="/admin/analytics"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminAnalytics /></ProtectedRoute>}
              />
              <Route
                path="/admin/ai-insights"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AIAnalytics /></ProtectedRoute>}
              />
              <Route
                path="/admin/settings"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminSettings /></ProtectedRoute>}
              />
              <Route
                path="/admin/kitchen"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin", "waiter", "kitchen"]}><KitchenDisplay /></ProtectedRoute>}
              />
              <Route
                path="/admin/reports"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminReports /></ProtectedRoute>}
              />
              <Route
                path="/admin/feedback"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminFeedback /></ProtectedRoute>}
              />
              <Route
                path="/admin/support"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminSupport /></ProtectedRoute>}
              />
              <Route
                path="/upgrade"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><UpgradePage /></ProtectedRoute>}
              />
              <Route
                path="/billing"
                element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><BillingPage /></ProtectedRoute>}
              />
              <Route path="/payment/result" element={<PaymentResultPage />} />

              <Route
                path="/waiter"
                element={<ProtectedRoute allowedRoles={["waiter", "admin", "super_admin"]}><WaiterDashboard /></ProtectedRoute>}
              />
              <Route
                path="/waiter/seats"
                element={<ProtectedRoute allowedRoles={["waiter", "admin", "super_admin"]}><WaiterSeats /></ProtectedRoute>}
              />
              <Route
                path="/waiter/notifications"
                element={<ProtectedRoute allowedRoles={["waiter", "admin", "super_admin"]}><WaiterNotifications /></ProtectedRoute>}
              />

              <Route path="/trial-expired" element={<TrialExpired />} />
              <Route path="/r/:shortCode" element={<ShortCodeRedirect />} />
              <Route path="/menu/demo" element={<CustomerMenu />} />
              <Route path="/menu/:restaurantId/select-seat" element={<CustomerSeatSelect />} />
              <Route path="/menu/:restaurantId" element={<CustomerMenu />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
