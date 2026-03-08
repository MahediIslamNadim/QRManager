import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import SuperAdminRestaurants from "./pages/SuperAdminRestaurants";
import AdminDashboard from "./pages/AdminDashboard";
import AdminMenu from "./pages/AdminMenu";
import AdminTables from "./pages/AdminTables";
import AdminOrders from "./pages/AdminOrders";
import WaiterDashboard from "./pages/WaiterDashboard";
import CustomerMenu from "./pages/CustomerMenu";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          
          {/* Super Admin */}
          <Route path="/super-admin" element={<SuperAdminDashboard />} />
          <Route path="/super-admin/restaurants" element={<SuperAdminRestaurants />} />
          
          {/* Admin */}
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/menu" element={<AdminMenu />} />
          <Route path="/admin/tables" element={<AdminTables />} />
          <Route path="/admin/orders" element={<AdminOrders />} />
          
          {/* Waiter */}
          <Route path="/waiter" element={<WaiterDashboard />} />
          
          {/* Customer - demo route must come before parameterized route */}
          <Route path="/menu/demo" element={<CustomerMenu />} />
          <Route path="/menu/:restaurantId" element={<CustomerMenu />} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
