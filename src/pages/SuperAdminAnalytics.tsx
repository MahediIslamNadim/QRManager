import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import StatCard from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, Store, Users, ShoppingCart, DollarSign } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const SuperAdminAnalytics = () => {
  const { data: stats } = useQuery({
    queryKey: ["super-analytics"],
    queryFn: async () => {
      const [{ data: restaurants }, { data: orders }, { data: profiles }] = await Promise.all([
        supabase.from("restaurants").select("id, name, status"),
        supabase.from("orders").select("id, total, restaurant_id, created_at, status"),
        supabase.from("profiles").select("id"),
      ]);

      const allOrders = orders || [];
      const totalRevenue = allOrders.reduce((s, o) => s + Number(o.total || 0), 0);

      // Revenue per restaurant
      const restRevenue: Record<string, { name: string; revenue: number; orders: number }> = {};
      (restaurants || []).forEach(r => {
        restRevenue[r.id] = { name: r.name, revenue: 0, orders: 0 };
      });
      allOrders.forEach(o => {
        if (restRevenue[o.restaurant_id]) {
          restRevenue[o.restaurant_id].revenue += Number(o.total || 0);
          restRevenue[o.restaurant_id].orders += 1;
        }
      });

      return {
        totalRestaurants: (restaurants || []).length,
        totalUsers: (profiles || []).length,
        totalOrders: allOrders.length,
        totalRevenue,
        restaurantData: Object.values(restRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 10),
      };
    },
  });

  return (
    <DashboardLayout role="super_admin" title="অ্যানালিটিক্স">
      <div className="space-y-6 animate-fade-up">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <StatCard title="মোট রেস্টুরেন্ট" value={stats?.totalRestaurants ?? 0} icon={Store} />
          <StatCard title="মোট ব্যবহারকারী" value={stats?.totalUsers ?? 0} icon={Users} />
          <StatCard title="মোট অর্ডার" value={stats?.totalOrders ?? 0} icon={ShoppingCart} />
          <StatCard title="মোট আয়" value={`৳${stats?.totalRevenue ?? 0}`} icon={DollarSign} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> রেস্টুরেন্ট অনুযায়ী আয়
            </CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.restaurantData && stats.restaurantData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={stats.restaurantData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                  <Bar dataKey="revenue" fill="hsl(28, 80%, 52%)" radius={[6, 6, 0, 0]} name="আয় (৳)" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-12">পর্যাপ্ত ডেটা নেই</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminAnalytics;
