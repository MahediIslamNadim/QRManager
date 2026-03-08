import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import { ShoppingCart, DollarSign, Users, TrendingUp, Clock, Crown, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getPlanLimits, formatLimit } from "@/lib/planLimits";

const AdminDashboard = () => {
  const { user, restaurantId, restaurantPlan } = useAuth();
  const navigate = useNavigate();
  const limits = getPlanLimits(restaurantPlan);

  const { data: stats } = useQuery({
    queryKey: ["admin-stats", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const today = new Date().toISOString().split("T")[0];

      const [ordersRes, tablesRes] = await Promise.all([
        supabase.from("orders").select("id, total, status, created_at").eq("restaurant_id", restaurantId),
        supabase.from("restaurant_tables").select("id, status").eq("restaurant_id", restaurantId),
      ]);

      const orders = ordersRes.data || [];
      const tables = tablesRes.data || [];
      const todayOrders = orders.filter(o => o.created_at?.startsWith(today));
      const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const activeTables = tables.filter(t => t.status === "occupied").length;

      return {
        todayOrders: todayOrders.length,
        todayRevenue,
        activeTables,
        totalTables: tables.length,
        avgOrder: todayOrders.length > 0 ? Math.round(todayRevenue / todayOrders.length) : 0,
      };
    },
    enabled: !!restaurantId,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["recent-orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("orders")
        .select("id, total, status, created_at, table_id, restaurant_tables(name)")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const timeAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return "এইমাত্র";
    if (diff < 60) return `${diff} মিনিট আগে`;
    return `${Math.floor(diff / 60)} ঘন্টা আগে`;
  };

  return (
    <DashboardLayout role="admin" title="অ্যাডমিন ড্যাশবোর্ড">
      <div className="space-y-8 animate-fade-up">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="আজকের অর্ডার" value={stats?.todayOrders ?? 0} icon={ShoppingCart} />
          <StatCard title="আজকের আয়" value={`৳${stats?.todayRevenue ?? 0}`} icon={DollarSign} />
          <StatCard title="অ্যাক্টিভ টেবিল" value={`${stats?.activeTables ?? 0}/${stats?.totalTables ?? 0}`} icon={Users} />
          <StatCard title="গড় অর্ডার মূল্য" value={`৳${stats?.avgOrder ?? 0}`} icon={TrendingUp} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              সাম্প্রতিক অর্ডার
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(!recentOrders || recentOrders.length === 0) && (
                <p className="text-center text-muted-foreground py-8">কোনো অর্ডার নেই। কাস্টমার QR মেনু থেকে অর্ডার দিলে এখানে দেখাবে।</p>
              )}
              {recentOrders?.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
                      <ShoppingCart className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        #{order.id.slice(0, 6)} — {order.restaurant_tables?.name || "N/A"}
                      </p>
                      <p className="text-sm text-muted-foreground">{timeAgo(order.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-foreground">৳{order.total}</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.status === "pending" ? "bg-warning/10 text-warning" :
                      order.status === "preparing" ? "bg-primary/10 text-primary" :
                      order.status === "served" ? "bg-success/10 text-success" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {order.status === "pending" ? "পেন্ডিং" : order.status === "preparing" ? "প্রস্তুত হচ্ছে" : order.status === "served" ? "সার্ভ করা হয়েছে" : "সম্পন্ন"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
