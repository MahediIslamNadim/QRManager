import { useNavigate } from "react-router-dom";
import {
  ArrowRight, Bell, Building2, DollarSign,
  Loader2, MenuSquare, Plus, ShoppingCart, Sparkles, Store,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useBootstrapEnterprise,
  useEnterpriseContext,
  useEnterpriseDashboardSummary,
  useEnterpriseNotices,
  useEnterpriseRestaurants,
} from "@/hooks/useEnterpriseAdmin";

const fmt = (v: number) => `৳${v.toLocaleString("en-BD")}`;

export default function EnterpriseDashboard() {
  const navigate = useNavigate();
  const { groupId, group, headOffice, loading, restaurantId } = useEnterpriseContext();
  const bootstrapMutation = useBootstrapEnterprise();
  const summaryQuery = useEnterpriseDashboardSummary(groupId);
  const restaurantsQuery = useEnterpriseRestaurants(groupId);
  const noticesQuery = useEnterpriseNotices(groupId);

  const summary = summaryQuery.data;
  const restaurants = restaurantsQuery.data ?? [];
  const notices = noticesQuery.data ?? [];

  // ── Group এখনো তৈরি হয়নি ────────────────────────────────────────────────
  if (!groupId && !loading) {
    return (
      <DashboardLayout role="group_owner" title="এন্টারপ্রাইজ ড্যাশবোর্ড">
        <div className="space-y-6">
          {/* Header banner */}
          <Card className="border-amber-400/30 bg-amber-500/5">
            <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-400/30 border">
                    🏢 Enterprise
                  </Badge>
                  <span className="text-sm text-muted-foreground">প্রথমবার সেটআপ প্রয়োজন</span>
                </div>
                <h2 className="text-2xl font-semibold">{headOffice?.name || "আপনার এন্টারপ্রাইজ"}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  সকল রেস্টুরেন্ট, মেনু, নোটিস এবং অ্যানালিটিক্স পরিচালনা করুন।
                </p>
              </div>
              <Button
                disabled={!restaurantId || bootstrapMutation.isPending}
                onClick={() => restaurantId && bootstrapMutation.mutate({ restaurantId, groupName: headOffice?.name || undefined })}
                className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
              >
                {bootstrapMutation.isPending
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> প্রস্তুত হচ্ছে...</>
                  : "সেটআপ সম্পন্ন করুন"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="py-16 text-center space-y-4">
              <Building2 className="mx-auto h-12 w-12 text-muted-foreground/20" />
              <p className="font-semibold text-lg">এন্টারপ্রাইজ গ্রুপ এখনো প্রস্তুত নয়</p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                রেস্টুরেন্ট, মেনু, অ্যানালিটিক্স এবং নোটিস পরিচালনা করতে উপরের বাটনে ক্লিক করে সেটআপ সম্পন্ন করুন।
              </p>
              <Button onClick={() => navigate("/enterprise/setup")} variant="outline">
                Setup পেজে যান
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  // ── Main dashboard ────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="group_owner" title="এন্টারপ্রাইজ ড্যাশবোর্ড">
      <div className="space-y-6">

        {/* ── Welcome banner ── */}
        <Card className="border-amber-400/30 bg-amber-500/5">
          <CardContent className="flex flex-col gap-3 p-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h2 className="text-lg font-bold">{headOffice?.name || "Head Office"}</h2>
                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-400/30 border text-[10px]">
                    🏢 Enterprise
                  </Badge>
                  {group?.name && (
                    <span className="text-xs text-muted-foreground">{group.name}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  সকল রেস্টুরেন্ট, মেনু, নোটিস ও অ্যানালিটিক্সের কেন্দ্রীয় নিয়ন্ত্রণ
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => navigate("/enterprise/restaurants/new")}
              className="bg-amber-500 hover:bg-amber-600 text-white gap-1.5 shrink-0"
            >
              <Plus className="h-4 w-4" />
              রেস্টুরেন্ট যোগ করুন
            </Button>
          </CardContent>
        </Card>

        {/* ── Summary stats ── */}
        <div className="grid gap-4 grid-cols-2 xl:grid-cols-4">
          <Card
            className="cursor-pointer hover:bg-secondary/20 transition-colors"
            onClick={() => navigate("/enterprise/restaurants")}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 flex-shrink-0">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">রেস্টুরেন্ট</p>
                <p className="text-2xl font-bold">{summary?.total_restaurants ?? 0}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {summary?.active_restaurants ?? 0}টি সক্রিয়
                </p>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-secondary/20 transition-colors"
            onClick={() => navigate("/enterprise/analytics")}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/10 flex-shrink-0">
                <DollarSign className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">আজকের আয়</p>
                <p className="text-2xl font-bold">{fmt(summary?.today_revenue ?? 0)}</p>
                <button
                  className="text-xs text-primary hover:underline cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); navigate("/enterprise/analytics"); }}
                >
                  বিস্তারিত →
                </button>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-secondary/20 transition-colors"
            onClick={() => navigate("/enterprise/restaurants")}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10 flex-shrink-0">
                <ShoppingCart className="h-5 w-5 text-blue-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">আজকের অর্ডার</p>
                <p className="text-2xl font-bold">{summary?.today_orders ?? 0}</p>
                <button
                  className="text-xs text-primary hover:underline cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); navigate("/enterprise/analytics"); }}
                >
                  বিস্তারিত →
                </button>
              </div>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:bg-secondary/20 transition-colors"
            onClick={() => navigate("/enterprise/notices")}
          >
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 flex-shrink-0">
                <Bell className="h-5 w-5 text-amber-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">মুলতুবি নোটিস</p>
                <p className="text-2xl font-bold">{summary?.pending_notices ?? 0}</p>
                <button
                  className="text-xs text-primary hover:underline cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); navigate("/enterprise/notices"); }}
                >
                  বিস্তারিত →
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── Main content grid ── */}
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">

          {/* Left: Restaurant performance */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">রেস্টুরেন্ট পারফরম্যান্স</CardTitle>
              <Button
                size="sm" variant="outline"
                onClick={() => navigate("/enterprise/restaurants")}
                className="gap-1.5 text-xs"
              >
                সকল রেস্টুরেন্ট <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {restaurantsQuery.isLoading ? (
                <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> লোড হচ্ছে...
                </div>
              ) : restaurants.length === 0 ? (
                <div className="py-8 text-center space-y-3">
                  <Store className="mx-auto h-10 w-10 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">কোনো রেস্টুরেন্ট নেই।</p>
                  <Button size="sm" onClick={() => navigate("/enterprise/restaurants/new")} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> প্রথম রেস্টুরেন্ট যোগ করুন
                  </Button>
                </div>
              ) : (
                restaurants.slice(0, 6).map((r) => (
                  <button
                    key={r.restaurant_id}
                    className="flex w-full items-center gap-3 rounded-2xl border border-border px-4 py-3 text-left transition hover:bg-secondary/30"
                    onClick={() => navigate(`/enterprise/restaurants/${r.restaurant_id}`)}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
                      <Store className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium text-sm">{r.name}</p>
                        {r.branch_code && (
                          <Badge variant="outline" className="text-[10px] flex-shrink-0">
                            {r.branch_code}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {r.today_orders}টি অর্ডার আজ • {fmt(r.today_revenue)}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))
              )}
            </CardContent>
          </Card>

          {/* Right column */}
          <div className="space-y-6">

            {/* Top selling snapshot */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">টপ সেলিং</CardTitle>
                <Button size="sm" variant="outline" onClick={() => navigate("/enterprise/top-selling")} className="text-xs gap-1.5">
                  বিস্তারিত <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {(summary?.top_snapshot ?? []).length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    এখনো বিক্রয় ডেটা নেই।
                  </div>
                ) : (
                  summary?.top_snapshot.slice(0, 5).map((item, i) => (
                    <div
                      key={`${item.restaurant_id}-${item.item_name}-${i}`}
                      className="rounded-xl border border-border p-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-sm">{item.item_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.restaurant_name}</p>
                        </div>
                        <div className="text-right text-sm flex-shrink-0">
                          <p className="font-semibold">{item.quantity}টি বিক্রি</p>
                          <p className="text-xs text-muted-foreground">{fmt(item.revenue)}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Recent notices */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">সাম্প্রতিক নোটিস</CardTitle>
                <Button size="sm" variant="outline" onClick={() => navigate("/enterprise/notices")} className="text-xs gap-1.5">
                  সব নোটিস <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {noticesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> লোড হচ্ছে...
                  </div>
                ) : notices.length === 0 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    কোনো নোটিস পাঠানো হয়নি।
                  </div>
                ) : (
                  notices.slice(0, 3).map((n) => (
                    <div key={n.id} className="rounded-xl border border-border p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{n.title}</p>
                        <Badge variant="outline" className="text-[10px] flex-shrink-0">
                          {n.target_count}টি রেস্টুরেন্ট
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-xs text-muted-foreground">{n.message}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Quick actions */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">দ্রুত অ্যাকশন</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-2">
                <Button
                  className="justify-between text-sm"
                  variant="outline"
                  onClick={() => navigate("/enterprise/restaurants/new")}
                >
                  রেস্টুরেন্ট যোগ করুন
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  className="justify-between text-sm"
                  variant="outline"
                  onClick={() => navigate("/enterprise/menus")}
                >
                  মেনু ম্যানেজমেন্ট
                  <MenuSquare className="h-4 w-4" />
                </Button>
                <Button
                  className="justify-between text-sm"
                  variant="outline"
                  onClick={() => navigate("/enterprise/analytics")}
                >
                  অ্যানালিটিক্স দেখুন
                  <Sparkles className="h-4 w-4" />
                </Button>
                <Button
                  className="justify-between text-sm"
                  variant="outline"
                  onClick={() => navigate("/enterprise/notices")}
                >
                  নোটিস পাঠান
                  <Bell className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
