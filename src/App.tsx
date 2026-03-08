import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/Login";
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
import AdminSettings from "./pages/AdminSettings";
import WaiterDashboard from "./pages/WaiterDashboard";
import CustomerMenu from "./pages/CustomerMenu";
import TrialExpired from "./pages/TrialExpired";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            
            {/* Super Admin */}
            <Route path="/super-admin" element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminDashboard /></ProtectedRoute>} />
            <Route path="/super-admin/restaurants" element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminRestaurants /></ProtectedRoute>} />
            <Route path="/super-admin/users" element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminUsers /></ProtectedRoute>} />
            <Route path="/super-admin/analytics" element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminAnalytics /></ProtectedRoute>} />
            <Route path="/super-admin/payments" element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminPayments /></ProtectedRoute>} />
            <Route path="/super-admin/settings" element={<ProtectedRoute allowedRoles={["super_admin"]}><SuperAdminSettings /></ProtectedRoute>} />
            
            {/* Admin */}
            <Route path="/admin" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/menu" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminMenu /></ProtectedRoute>} />
            <Route path="/admin/tables" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminTables /></ProtectedRoute>} />
            <Route path="/admin/orders" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminOrders /></ProtectedRoute>} />
            <Route path="/admin/staff" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminStaff /></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminAnalytics /></ProtectedRoute>} />
            <Route path="/admin/settings" element={<ProtectedRoute allowedRoles={["admin", "super_admin"]}><AdminSettings /></ProtectedRoute>} />
            
            {/* Waiter */}
            <Route path="/waiter" element={<ProtectedRoute allowedRoles={["waiter", "admin", "super_admin"]}><WaiterDashboard /></ProtectedRoute>} />
            
            {/* Trial Expired */}
            <Route path="/trial-expired" element={<TrialExpired />} />
            
            {/* Customer */}
            <Route path="/menu/demo" element={<CustomerMenu />} />
            <Route path="/menu/:restaurantId" element={<CustomerMenu />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
