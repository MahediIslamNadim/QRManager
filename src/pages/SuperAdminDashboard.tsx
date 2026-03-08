import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import { Store, Users, DollarSign, TrendingUp, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const SuperAdminDashboard = () => {
  const { data: stats } = useQuery({
    queryKey: ["super-dashboard-stats"],
    queryFn: async () => {
      const [{ data: restaurants }, { data: orders }, { data: profiles }] = await Promise.all([
        supabase.from("restaurants").select("id, name, status, created_at"),
        supabase.from("orders").select("id, total, status, restaurant_id, created_at"),
        supabase.from("profiles").select("id, full_name, email, created_at"),
      ]);

      const allOrders = orders || [];
      const totalRevenue = allOrders.reduce((s, o) => s + Number(o.total || 0), 0);
      const activeOrders = allOrders.filter(o => o.status === "pending" || o.status === "preparing").length;

      // Recent restaurants with order counts
      const restOrderCount: Record<string, number> = {};
      allOrders.forEach(o => {
        restOrderCount[o.restaurant_id] = (restOrderCount[o.restaurant_id] || 0) + 1;
      });

      const recentRestaurants = (restaurants || [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5)
        .map(r => ({ ...r, orderCount: restOrderCount[r.id] || 0 }));

      // Recent users
      const recentUsers = (profiles || [])
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 5);

      return {
        totalRestaurants: (restaurants || []).length,
        totalUsers: (profiles || []).length,
        totalRevenue,
        activeOrders,
        recentRestaurants,
        recentUsers,
      };
    },
  });

  const timeAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return "এইমাত্র";
    if (diff < 60) return `${diff} মিনিট আগে`;
    if (diff < 1440) return `${Math.floor(diff / 60)} ঘন্টা আগে`;
    return `${Math.floor(diff / 1440)} দিন আগে`;
  };

  return (
    <DashboardLayout role="super_admin" title="সুপার অ্যাডমিন ড্যাশবোর্ড">
      <div className="space-y-8 animate-fade-up">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="মোট রেস্টুরেন্ট" value={stats?.totalRestaurants ?? 0} icon={Store} colorScheme="primary" />
          <StatCard title="মোট ব্যবহারকারী" value={stats?.totalUsers ?? 0} icon={Users} colorScheme="info" />
          <StatCard title="মোট আয়" value={`৳${stats?.totalRevenue ?? 0}`} icon={DollarSign} colorScheme="success" />
          <StatCard title="অ্যাক্টিভ অর্ডার" value={stats?.activeOrders ?? 0} icon={TrendingUp} colorScheme="rose" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" /> সাম্প্রতিক রেস্টুরেন্ট
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(!stats?.recentRestaurants || stats.recentRestaurants.length === 0) && (
                  <p className="text-center text-muted-foreground py-6">কোনো রেস্টুরেন্ট নেই</p>
                )}
                {stats?.recentRestaurants?.map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div>
                      <p className="font-medium text-foreground">{r.name}</p>
                      <p className="text-sm text-muted-foreground">{r.orderCount} অর্ডার</p>
                    </div>
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      r.status === "active" ? "bg-success/10 text-success" : "bg-warning/10 text-warning"
                    }`}>
                      {r.status === "active" ? "সক্রিয়" : "পেন্ডিং"}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" /> সাম্প্রতিক ব্যবহারকারী
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(!stats?.recentUsers || stats.recentUsers.length === 0) && (
                  <p className="text-center text-muted-foreground py-6">কোনো ব্যবহারকারী নেই</p>
                )}
                {stats?.recentUsers?.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold">
                        {(u.full_name || u.email || "?")[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{u.full_name || "N/A"}</p>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{timeAgo(u.created_at)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminDashboard;
