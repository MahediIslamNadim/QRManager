import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import StatCard from "@/components/StatCard";
import RestaurantBrandBanner from "@/components/RestaurantBrandBanner";
import { useRestaurantBranding } from "@/hooks/useRestaurantBranding";
import { ShoppingCart, DollarSign, Users, TrendingUp, Clock, Banknote, Smartphone, Star, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
const AdminDashboard = () => {
  const { user, restaurantId } = useAuth();
  const navigate = useNavigate();
  const branding = useRestaurantBranding(restaurantId);
  const { isHighSmart, logoUrl, restaurantName } = branding;

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-stats", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;

      // Bangladesh is UTC+6 — shift timestamps so date boundaries are correct
      const BD_OFFSET_MS = 6 * 60 * 60 * 1000;
      const toBDDate = (d: Date) =>
        new Date(d.getTime() + BD_OFFSET_MS).toISOString().split("T")[0];

      const nowDate = new Date();
      const prevDate = new Date(nowDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const today = toBDDate(nowDate);
      const yesterday = toBDDate(prevDate);

      const [ordersRes, tablesRes, ratingsRes, menuRes] = await Promise.all([
        supabase.from("orders")
          .select("id, total, status, created_at")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", `${yesterday}T00:00:00+06:00`)
          .lte("created_at", `${today}T23:59:59+06:00`),
        supabase.from("restaurant_tables").select("id, status").eq("restaurant_id", restaurantId),
        supabase.from("orders")
          .select("rating")
          .eq("restaurant_id", restaurantId)
          .not("rating", "is", null)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from("menu_items")
          .select("id, name, available")
          .eq("restaurant_id", restaurantId),
      ]);

      const orders = ordersRes.data || [];
      const tables = tablesRes.data || [];
      const ratingRows = ratingsRes.data || [];
      const menuItems = menuRes.data || [];
      const soldOutItems = menuItems.filter((m: any) => !m.available);
      const inStockItems = menuItems.filter((m: any) => m.available);
      const avgRating = ratingRows.length > 0
        ? Math.round((ratingRows.reduce((s, r) => s + (r.rating || 0), 0) / ratingRows.length) * 10) / 10
        : null;

      const utcToBDDate = (utc: string) => toBDDate(new Date(utc));
      const todayOrders = orders.filter(o => o.created_at && utcToBDDate(o.created_at) === today);
      const yesterdayOrders = orders.filter(o => o.created_at && utcToBDDate(o.created_at) === yesterday);

      const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);
      const yesterdayRevenue = yesterdayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0);

      const todayAvg = todayOrders.length > 0 ? Math.round(todayRevenue / todayOrders.length) : 0;
      const yesterdayAvg = yesterdayOrders.length > 0 ? Math.round(yesterdayRevenue / yesterdayOrders.length) : 0;

      const activeTables = tables.filter(t => t.status === "occupied").length;

      const calcChange = (today: number, yesterday: number) => {
        if (yesterday === 0) return today > 0 ? { text: "নতুন", up: true } : null;
        const pct = Math.round(((today - yesterday) / yesterday) * 100);
        if (pct === 0) return { text: "অপরিবর্তিত", up: true };
        return { text: `${pct > 0 ? "+" : ""}${pct}%`, up: pct >= 0 };
      };

      return {
        todayOrders: todayOrders.length,
        todayRevenue,
        activeTables,
        totalTables: tables.length,
        avgOrder: todayAvg,
        yesterdayOrders: yesterdayOrders.length,
        yesterdayRevenue,
        yesterdayAvg,
        orderChange: calcChange(todayOrders.length, yesterdayOrders.length),
        revenueChange: calcChange(todayRevenue, yesterdayRevenue),
        avgChange: calcChange(todayAvg, yesterdayAvg),
        avgRating,
        totalRatings: ratingRows.length,
        soldOutCount: soldOutItems.length,
        soldOutItems: soldOutItems.slice(0, 5),
        totalMenuItems: menuItems.length,
        inStockCount: inStockItems.length,
      };
    },
    enabled: !!restaurantId,
    refetchInterval: 60000,
  });

  const { data: recentOrders } = useQuery({
    queryKey: ["recent-orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("orders")
        .select("id, total, status, created_at, table_id, payment_status, payment_method, paid_to_staff_name, restaurant_tables(name)")
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
      <div className="space-y-5 sm:space-y-8 animate-fade-up">

        {/* ── Branding Banner (High Smart only) ── */}
        {isHighSmart && (
          <RestaurantBrandBanner
            logoUrl={logoUrl}
            restaurantName={restaurantName}
            brandPrimary={branding.brandPrimary}
            brandSecondary={branding.brandSecondary}
          />
        )}

        {/* Stats — 2x2 on mobile, 4 cols on lg */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="stat-card border-l-4 border-border animate-pulse">
                <div className="w-12 h-12 rounded-xl bg-muted mb-4" />
                <div className="h-3 bg-muted rounded w-2/3 mb-2" />
                <div className="h-8 bg-muted rounded w-1/2" />
              </div>
            ))
          ) : (
            <>
              <StatCard
                title="আজকের অর্ডার"
                value={stats?.todayOrders ?? 0}
                icon={ShoppingCart}
                colorScheme="primary"
                trend={stats?.orderChange?.text}
                trendUp={stats?.orderChange?.up}
              />
              <StatCard
                title="আজকের আয়"
                value={`৳${stats?.todayRevenue ?? 0}`}
                icon={DollarSign}
                colorScheme="success"
                trend={stats?.revenueChange?.text}
                trendUp={stats?.revenueChange?.up}
              />
              <StatCard
                title="অ্যাক্টিভ টেবিল"
                value={`${stats?.activeTables ?? 0}/${stats?.totalTables ?? 0}`}
                icon={Users}
                colorScheme="info"
              />
              <StatCard
                title="গড় অর্ডার"
                value={`৳${stats?.avgOrder ?? 0}`}
                icon={TrendingUp}
                colorScheme="rose"
                trend={stats?.avgChange?.text}
                trendUp={stats?.avgChange?.up}
              />
            </>
          )}
        </div>

        {/* Yesterday comparison row */}
        {stats && (
          <div className="grid grid-cols-3 gap-3">
            {(stats.yesterdayOrders > 0 || stats.yesterdayRevenue > 0) ? (
              [
                { label: "গতকাল অর্ডার", value: stats.yesterdayOrders, icon: ShoppingCart },
                { label: "গতকাল আয়", value: `৳${stats.yesterdayRevenue}`, icon: DollarSign },
                { label: "গতকাল গড়", value: `৳${stats.yesterdayAvg}`, icon: TrendingUp },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl bg-secondary/40 border border-border/40 px-4 py-3 flex items-center gap-3">
                  <item.icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{item.label}</p>
                    <p className="text-sm font-bold text-foreground">{item.value}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="col-span-3 rounded-2xl bg-secondary/40 border border-border/40 px-4 py-3 text-center">
                <p className="text-xs text-muted-foreground">গতকাল কোনো অর্ডার ছিল না</p>
              </div>
            )}
          </div>
        )}

        {/* Sold-out Alert Banner */}
        {stats && stats.soldOutCount > 0 && (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-destructive">
                    {stats.soldOutCount}টি আইটেম স্টক আউট!
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {stats.soldOutItems.map((i: any) => i.name).join(', ')}
                    {stats.soldOutCount > 5 ? ` এবং আরো...` : ''}
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" className="border-destructive/40 text-destructive hover:bg-destructive/10 text-xs h-7"
                onClick={() => navigate('/admin/menu')}>
                মেনু আপডেট করুন →
              </Button>
            </div>
          </div>
        )}

        {/* In-stock summary */}
        {stats && stats.totalMenuItems > 0 && stats.soldOutCount === 0 && (
          <div className="rounded-2xl border border-success/30 bg-success/5 px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
            <p className="text-sm text-success font-medium">
              সব {stats.totalMenuItems}টি মেনু আইটেম স্টকে আছে ✓
            </p>
          </div>
        )}

        {/* Rating summary row */}
        {stats?.avgRating != null && (
          <div className="rounded-2xl border border-warning/30 bg-warning/5 px-4 py-3 flex items-center gap-3">
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(s => (
                <Star key={s} className={`w-4 h-4 ${s <= Math.round(stats.avgRating!) ? "text-warning fill-warning" : "text-muted-foreground/30"}`} />
              ))}
            </div>
            <p className="text-sm font-semibold text-foreground">
              {stats.avgRating} / 5
            </p>
            <p className="text-xs text-muted-foreground">গড় রেটিং — গত ৩০ দিনে {stats.totalRatings}টি রিভিউ</p>
          </div>
        )}


        {/* ✅ Recent Orders — mobile friendly */}
        <Card>
          <CardHeader className="pb-3 sm:pb-6">
            <CardTitle className="font-display text-base sm:text-lg flex items-center gap-2">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
              সাম্প্রতিক অর্ডার
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 sm:space-y-3">
              {(!recentOrders || recentOrders.length === 0) && (
                <p className="text-center text-muted-foreground py-8 text-sm">কোনো অর্ডার নেই। কাস্টমার QR মেনু থেকে অর্ডার দিলে এখানে দেখাবে।</p>
              )}
              {recentOrders?.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between p-3 sm:p-4 rounded-xl bg-secondary/30 hover:bg-secondary/50 transition-colors gap-2">
                  {/* Left: icon + info */}
                  <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                      <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5 text-accent-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground text-xs sm:text-sm truncate">
                        #{order.id.slice(0, 6)} — {order.restaurant_tables?.name || "N/A"}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{timeAgo(order.created_at)}</p>
                        {order.paid_to_staff_name && (
                          <span className="text-[9px] sm:text-[10px] bg-secondary text-muted-foreground px-1.5 py-0.5 rounded-full hidden sm:flex items-center gap-1">
                            💰 {order.paid_to_staff_name}
                          </span>
                        )}
                        {order.payment_method && (
                          <span className="text-[9px] sm:text-[10px] bg-success/10 text-success px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                            {order.payment_method === "bkash"
                              ? <><Smartphone className="w-2 h-2" /> bKash</>
                              : <><Banknote className="w-2 h-2" /> Cash</>}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: amount + status */}
                  <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
                    <span className="font-semibold text-foreground text-xs sm:text-sm">৳{order.total}</span>
                    {order.payment_status === "paid" ? (
                      <span className="px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-success/10 text-success whitespace-nowrap">
                        ✅ পেইড
                      </span>
                    ) : (
                      <span className={`px-1.5 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap ${
                        order.status === "pending" ? "bg-warning/10 text-warning" :
                        order.status === "preparing" ? "bg-primary/10 text-primary" :
                        order.status === "served" ? "bg-success/10 text-success" :
                        "bg-muted text-muted-foreground"
                      }`}>
                        {order.status === "pending" ? "পেন্ডিং" :
                         order.status === "preparing" ? "প্রস্তুত" :
                         order.status === "served" ? "সার্ভ" : "সম্পন্ন"}
                      </span>
                    )}
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
