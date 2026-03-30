import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { printDailyReport } from "@/utils/printDailyReport";
import { BarChart3, TrendingUp, ShoppingCart, DollarSign, Printer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(28, 80%, 52%)", "hsl(38, 90%, 55%)", "hsl(142, 76%, 36%)", "hsl(0, 72%, 51%)", "hsl(220, 70%, 50%)"];

const AdminAnalytics = () => {
  const { restaurantId } = useAuth();

  const { data: restaurantName = "রেস্টুরেন্ট" } = useQuery({
    queryKey: ["restaurant-name-analytics", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return "রেস্টুরেন্ট";
      const { data } = await supabase.from("restaurants").select("name").eq("id", restaurantId).maybeSingle();
      return data?.name || "রেস্টুরেন্ট";
    },
    enabled: !!restaurantId,
  });

  const { data: stats } = useQuery({
    queryKey: ["analytics", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;

      const { data: orders } = await supabase
        .from("orders")
        .select("id, total, status, created_at, order_items(name, quantity, price)")
        .eq("restaurant_id", restaurantId)
        .limit(2000);

      const allOrders = orders || [];
      const allItems = allOrders.flatMap((o: any) => o.order_items || []);

      const totalRevenue = allOrders.reduce((s, o) => s + Number(o.total || 0), 0);
      const totalOrders = allOrders.length;
      const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

      // Daily data (last 7 days)
      const dailyData: { day: string; orders: number; revenue: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const dayOrders = allOrders.filter(o => o.created_at?.startsWith(dateStr));
        dailyData.push({
          day: d.toLocaleDateString("bn-BD", { weekday: "short" }),
          orders: dayOrders.length,
          revenue: dayOrders.reduce((s, o) => s + Number(o.total || 0), 0),
        });
      }

      // Category data from order items
      const categoryMap: Record<string, number> = {};
      allItems.forEach(item => {
        const name = item.name || "অন্যান্য";
        categoryMap[name] = (categoryMap[name] || 0) + item.quantity;
      });
      const topItems = Object.entries(categoryMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, value]) => ({ name, value }));

      // Status breakdown
      const statusMap: Record<string, number> = {};
      allOrders.forEach(o => {
        statusMap[o.status] = (statusMap[o.status] || 0) + 1;
      });

      return { totalRevenue, totalOrders, avgOrder, dailyData, topItems, statusMap };
    },
    enabled: !!restaurantId,
    refetchInterval: 300000,
  });

  const handlePrintReport = () => {
    if (!stats) return;
    printDailyReport({
      restaurantName,
      date: new Date().toISOString().split("T")[0],
      totalOrders: stats.totalOrders,
      totalRevenue: stats.totalRevenue,
      avgOrder: stats.avgOrder,
      topItems: stats.topItems,
      statusMap: stats.statusMap,
      dailyData: stats.dailyData,
    });
  };

  return (
    <DashboardLayout role="admin" title="অ্যানালিটিক্স">
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between gap-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-1">
            <StatCard title="মোট আয়" value={`৳${stats?.totalRevenue ?? 0}`} icon={DollarSign} />
            <StatCard title="মোট অর্ডার" value={stats?.totalOrders ?? 0} icon={ShoppingCart} />
            <StatCard title="গড় অর্ডার মূল্য" value={`৳${stats?.avgOrder ?? 0}`} icon={TrendingUp} />
          </div>
          <Button variant="outline" size="sm" onClick={handlePrintReport} disabled={!stats} className="flex-shrink-0 flex items-center gap-2">
            <Printer className="w-4 h-4" /> রিপোর্ট
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" /> সাপ্তাহিক অর্ডার
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.dailyData && stats.dailyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.dailyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Bar dataKey="orders" fill="hsl(28, 80%, 52%)" radius={[6, 6, 0, 0]} name="অর্ডার" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">পর্যাপ্ত ডেটা নেই</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="font-display text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" /> জনপ্রিয় আইটেম
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.topItems && stats.topItems.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie data={stats.topItems} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => `${name}: ${value}`}>
                      {stats.topItems.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-muted-foreground py-12">পর্যাপ্ত ডেটা নেই</p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">অর্ডার স্ট্যাটাস</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(stats?.statusMap || {}).map(([status, count]) => (
                <div key={status} className="p-4 rounded-xl bg-secondary/50 text-center">
                  <p className="text-2xl font-bold text-foreground">{count as number}</p>
                  <p className="text-sm text-muted-foreground capitalize">
                    {status === "pending" ? "পেন্ডিং" : status === "preparing" ? "প্রস্তুত হচ্ছে" : status === "served" ? "সার্ভড" : status === "completed" ? "সম্পন্ন" : status}
                  </p>
                </div>
              ))}
              {Object.keys(stats?.statusMap || {}).length === 0 && (
                <p className="col-span-full text-center text-muted-foreground py-4">কোনো অর্ডার ডেটা নেই</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminAnalytics;
