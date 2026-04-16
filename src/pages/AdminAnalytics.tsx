import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StatCard from "@/components/StatCard";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { printDailyReport } from "@/utils/printDailyReport";
import { exportOrdersCSV } from "@/utils/exportOrdersCSV";
import { BarChart3, TrendingUp, ShoppingCart, DollarSign, Printer, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const COLORS = ["hsl(28, 80%, 52%)", "hsl(38, 90%, 55%)", "hsl(142, 76%, 36%)", "hsl(0, 72%, 51%)", "hsl(220, 70%, 50%)"];

const AdminAnalytics = () => {
  const { restaurantId } = useAuth();

  // Date range for CSV export — default: last 30 days
  const today = new Date().toISOString().split("T")[0];
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(thirtyDaysAgo);
  const [toDate, setToDate] = useState(today);
  const [exporting, setExporting] = useState(false);

  const { data: restaurantName = "রেস্টুরেন্ট" } = useQuery({
    queryKey: ["restaurant-name-analytics", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return "রেস্টুরেন্ট";
      const { data } = await supabase.from("restaurants").select("name").eq("id", restaurantId).maybeSingle();
      return data?.name || "রেস্টুরেন্ট";
    },
    enabled: !!restaurantId,
  });

  const { data: stats, isFetching, refetch } = useQuery({
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

      // Daily data (last 7 days) — BD timezone UTC+6
      const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
      const toBDDate = (d: Date) => new Date(d.getTime() + BD_OFFSET_MS).toISOString().split("T")[0];
      const utcToBDDate = (utc: string) => toBDDate(new Date(utc));

      const dailyData: { day: string; orders: number; revenue: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = toBDDate(d);
        const dayOrders = allOrders.filter(o => o.created_at && utcToBDDate(o.created_at) === dateStr);
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
        categoryMap[name] = (categoryMap[name] || 0) + (Number(item.quantity) || 0);
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
  });

  const handleExportCSV = async () => {
    if (!restaurantId) return;
    setExporting(true);
    try {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, created_at, total, status, payment_status, payment_method, restaurant_tables(name), order_items(name, quantity)")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", `${fromDate}T00:00:00+06:00`)
        .lte("created_at", `${toDate}T23:59:59+06:00`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      const rows = (orders || []).map((o: any) => ({
        id: o.id,
        created_at: o.created_at,
        total: Number(o.total),
        status: o.status,
        payment_status: o.payment_status,
        payment_method: o.payment_method,
        table_name: o.restaurant_tables?.name || "—",
        items: (o.order_items || []).map((i: any) => `${i.name}×${i.quantity}`).join("; "),
      }));

      exportOrdersCSV(rows, `orders_${fromDate}_${toDate}.csv`);
      toast.success(`${rows.length}টি অর্ডার export হয়েছে`);
    } catch (err: any) {
      toast.error(err.message || "Export ব্যর্থ হয়েছে");
    } finally {
      setExporting(false);
    }
  };

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
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="flex items-center gap-2">
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">রিফ্রেশ</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrintReport} disabled={!stats} className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> রিপোর্ট
            </Button>
          </div>
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
                    <Pie data={stats.topItems} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, value }) => (name && value != null) ? `${name}: ${value}` : ""}>
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

        {/* CSV Export */}
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <Download className="w-5 h-5 text-primary" /> সেলস রিপোর্ট CSV Export
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">শুরুর তারিখ</p>
                <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-44" />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground font-medium">শেষের তারিখ</p>
                <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-44" />
              </div>
              <Button variant="hero" onClick={handleExportCSV} disabled={exporting} className="flex items-center gap-2 sm:mb-0">
                <Download className="w-4 h-4" />
                {exporting ? "Export হচ্ছে..." : "CSV ডাউনলোড"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              নির্বাচিত তারিখ সীমার সকল অর্ডার CSV ফাইলে export হবে। Excel-এ খুলুন।
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminAnalytics;
