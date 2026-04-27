import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Loader2, Plus, Search, Store } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useEnterpriseContext, useEnterpriseRestaurants } from "@/hooks/useEnterpriseAdmin";

const fmt = (v: number) => `৳${v.toLocaleString("en-BD")}`;

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:      { label: "সক্রিয়",          color: "bg-success/10 text-success" },
  active_paid: { label: "সক্রিয় (Paid)",   color: "bg-success/10 text-success" },
  inactive:    { label: "নিষ্ক্রিয়",        color: "bg-muted text-muted-foreground" },
  trial:       { label: "ট্রায়াল",          color: "bg-blue-500/10 text-blue-500" },
};

export default function EnterpriseRestaurants() {
  const navigate = useNavigate();
  const { groupId } = useEnterpriseContext();
  const restaurantsQuery = useEnterpriseRestaurants(groupId);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = restaurantsQuery.data ?? [];
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.address || "").toLowerCase().includes(q) ||
        (r.branch_code || "").toLowerCase().includes(q),
    );
  }, [restaurantsQuery.data, search]);

  return (
    <DashboardLayout role="group_owner" title="সকল রেস্টুরেন্ট">
      <div className="space-y-6">

        {/* Search + Add */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10"
              placeholder="নাম, কোড বা ঠিকানা দিয়ে খুঁজুন..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button onClick={() => navigate("/enterprise/restaurants/new")} className="gap-2">
            <Plus className="h-4 w-4" />
            রেস্টুরেন্ট যোগ করুন
          </Button>
        </div>

        {/* List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">পরিচালিত রেস্টুরেন্ট তালিকা</CardTitle>
            <Badge variant="outline">{filtered.length}টি</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {restaurantsQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> লোড হচ্ছে...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center space-y-4">
                <Store className="mx-auto h-12 w-12 text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">
                  {search ? "এই সার্চে কোনো রেস্টুরেন্ট পাওয়া যায়নি।" : "এখনো কোনো রেস্টুরেন্ট নেই।"}
                </p>
                {!search && (
                  <Button size="sm" onClick={() => navigate("/enterprise/restaurants/new")} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> প্রথম রেস্টুরেন্ট যোগ করুন
                  </Button>
                )}
              </div>
            ) : (
              filtered.map((r) => {
                const statusCfg = STATUS_LABEL[r.status] ?? { label: r.status, color: "bg-muted text-muted-foreground" };
                return (
                  <button
                    key={r.restaurant_id}
                    className="flex w-full items-center gap-4 rounded-2xl border border-border px-4 py-4 text-left transition hover:bg-secondary/25"
                    onClick={() => navigate(`/enterprise/restaurants/${r.restaurant_id}`)}
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 flex-shrink-0">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{r.name}</p>
                        {r.branch_code && (
                          <Badge variant="outline" className="text-[10px]">{r.branch_code}</Badge>
                        )}
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="truncate text-sm text-muted-foreground">
                        {r.address || "ঠিকানা সেট করা নেই"}
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
                        <span>{r.today_orders}টি অর্ডার আজ</span>
                        <span>{fmt(r.today_revenue)} আজকের আয়</span>
                        <span>{r.menu_items_count}টি মেনু</span>
                        <span>{r.staff_count}জন স্টাফ</span>
                      </div>
                    </div>
                    <div className="hidden text-right text-sm md:block flex-shrink-0">
                      <p className="font-semibold">{fmt(r.total_revenue)}</p>
                      <p className="text-xs text-muted-foreground">{r.total_orders}টি মোট অর্ডার</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </button>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
