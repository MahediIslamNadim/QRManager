import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, MenuSquare, ShoppingCart, Store, Users, ChevronDown, ChevronUp } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useEnterpriseContext } from "@/hooks/useEnterpriseAdmin";

const formatCurrency = (value: number) => `৳${value.toLocaleString("en-BD")}`;

const STATUS_LABELS: Record<string, string> = {
  active: "সক্রিয়",
  inactive: "নিষ্ক্রিয়",
  active_paid: "সক্রিয় (Paid)",
  trial: "Trial",
  expired: "মেয়াদোত্তীর্ণ",
};

const ORDER_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:    { label: "অপেক্ষায়",   color: "bg-amber-500/10 text-amber-600" },
  confirmed:  { label: "নিশ্চিত",     color: "bg-blue-500/10 text-blue-500" },
  preparing:  { label: "তৈরি হচ্ছে",  color: "bg-purple-500/10 text-purple-500" },
  ready:      { label: "প্রস্তুত",    color: "bg-success/10 text-success" },
  delivered:  { label: "ডেলিভার",     color: "bg-success/10 text-success" },
  cancelled:  { label: "বাতিল",       color: "bg-destructive/10 text-destructive" },
  completed:  { label: "সম্পন্ন",     color: "bg-success/10 text-success" },
};

export default function EnterpriseRestaurantDetails() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const { groupId } = useEnterpriseContext();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [statusDialogTarget, setStatusDialogTarget] = useState<"active" | "inactive" | null>(null);
  const [form, setForm] = useState({ name: "", address: "", phone: "", status: "active" });
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const detailsQuery = useQuery({
    queryKey: ["enterprise-restaurant-details", groupId, restaurantId],
    queryFn: async () => {
      if (!groupId || !restaurantId) return null;

      const [restaurantRes, menuRes, staffRes, orderRes, todayOrderRes] = await Promise.all([
        supabase
          .from("restaurants")
          .select("id, name, address, phone, status, branch_code, created_at, is_branch")
          .eq("id", restaurantId)
          .eq("group_id", groupId)
          .maybeSingle(),
        supabase
          .from("menu_items")
          .select("id, name, price, category, available, shared_menu_item_id")
          .eq("restaurant_id", restaurantId)
          .order("category")
          .order("name")
          .limit(12),
        supabase
          .from("staff_restaurants")
          .select("id", { count: "exact", head: true })
          .eq("restaurant_id", restaurantId),
        supabase
          .from("orders")
          .select("id, total, status, created_at, notes, table_number, order_items(id, quantity, unit_price, menu_item_id, menu_items(name, category))")
          .eq("restaurant_id", restaurantId)
          .order("created_at", { ascending: false })
          .limit(15),
        supabase
          .from("orders")
          .select("id, total")
          .eq("restaurant_id", restaurantId)
          .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);

      if (restaurantRes.error) throw restaurantRes.error;
      if (!restaurantRes.data) return null;
      if (menuRes.error) throw menuRes.error;
      if (staffRes.error) throw staffRes.error;
      if (orderRes.error) throw orderRes.error;
      if (todayOrderRes.error) throw todayOrderRes.error;

      const todayOrders = todayOrderRes.data ?? [];
      const recentOrders = orderRes.data ?? [];

      return {
        restaurant: restaurantRes.data,
        menuItems: menuRes.data ?? [],
        staffCount: staffRes.count ?? 0,
        recentOrders,
        todayOrdersCount: todayOrders.length,
        todayRevenue: todayOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
        totalRevenue: recentOrders.reduce((sum, o) => sum + Number(o.total || 0), 0),
      };
    },
    enabled: !!groupId && !!restaurantId,
  });

  const details = detailsQuery.data;

  const sharedItemsCount = useMemo(() => {
    return (details?.menuItems ?? []).filter((item: any) => !!item.shared_menu_item_id).length;
  }, [details?.menuItems]);

  const updateRestaurantMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId || !groupId) throw new Error("রেস্টুরেন্ট পাওয়া যাচ্ছে না।");
      const { error } = await supabase
        .from("restaurants")
        .update({
          name: form.name.trim(),
          address: form.address.trim() || null,
          phone: form.phone.trim() || null,
          status: form.status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", restaurantId)
        .eq("group_id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("রেস্টুরেন্ট আপডেট হয়েছে।");
      queryClient.invalidateQueries({ queryKey: ["enterprise-restaurant-details", groupId, restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["enterprise-restaurants", groupId] });
      setEditOpen(false);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "আপডেট করা যায়নি।"),
  });

  const statusMutation = useMutation({
    mutationFn: async (nextStatus: "active" | "inactive") => {
      if (!restaurantId || !groupId) throw new Error("রেস্টুরেন্ট পাওয়া যাচ্ছে না।");
      const { error } = await supabase
        .from("restaurants")
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq("id", restaurantId)
        .eq("group_id", groupId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("রেস্টুরেন্টের অবস্থা পরিবর্তন হয়েছে।");
      queryClient.invalidateQueries({ queryKey: ["enterprise-restaurant-details", groupId, restaurantId] });
      queryClient.invalidateQueries({ queryKey: ["enterprise-restaurants", groupId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "অবস্থা পরিবর্তন করা যায়নি।"),
  });

  const currentStatus = details?.restaurant.status || "active";
  const nextStatus: "active" | "inactive" = currentStatus === "inactive" ? "active" : "inactive";

  return (
    <DashboardLayout role="group_owner" title="রেস্টুরেন্ট বিস্তারিত">
      {/* Status change confirm dialog */}
      <AlertDialog open={!!statusDialogTarget} onOpenChange={(open) => !open && setStatusDialogTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {statusDialogTarget === "inactive" ? "রেস্টুরেন্ট নিষ্ক্রিয় করবেন?" : "রেস্টুরেন্ট সক্রিয় করবেন?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {statusDialogTarget === "inactive"
                ? "রেস্টুরেন্ট নিষ্ক্রিয় হলে গ্রাহকরা মেনু দেখতে পাবেন না।"
                : "রেস্টুরেন্ট আবার সক্রিয় হবে এবং গ্রাহকরা মেনু দেখতে পাবেন।"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (statusDialogTarget) statusMutation.mutate(statusDialogTarget);
                setStatusDialogTarget(null);
              }}
            >
              নিশ্চিত করুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        <Button variant="outline" size="sm" onClick={() => navigate("/enterprise/restaurants")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          সকল রেস্টুরেন্টে ফিরুন
        </Button>

        {detailsQuery.isLoading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              লোড হচ্ছে...
            </CardContent>
          </Card>
        ) : !details ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Store className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
              <p className="font-medium">রেস্টুরেন্ট পাওয়া যায়নি।</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Header card */}
            <Card className="border-primary/20">
              <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    {details.restaurant.branch_code && (
                      <Badge variant="outline">{details.restaurant.branch_code}</Badge>
                    )}
                    <Badge variant="outline">
                      {STATUS_LABELS[details.restaurant.status] || details.restaurant.status}
                    </Badge>
                    {details.restaurant.is_branch === false && (
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-400/30 border text-[10px]">
                        Head Office
                      </Badge>
                    )}
                  </div>
                  <h2 className="text-2xl font-semibold">{details.restaurant.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {details.restaurant.address || "ঠিকানা সেট করা নেই"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {details.restaurant.phone || "ফোন সেট করা নেই"}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setForm({
                        name: details.restaurant.name || "",
                        address: details.restaurant.address || "",
                        phone: details.restaurant.phone || "",
                        status: details.restaurant.status || "active",
                      });
                      setEditOpen(true);
                    }}
                  >
                    সম্পাদনা করুন
                  </Button>
                  <Button
                    variant="outline"
                    disabled={statusMutation.isPending}
                    onClick={() => setStatusDialogTarget(nextStatus)}
                  >
                    {currentStatus === "inactive" ? "সক্রিয় করুন" : "নিষ্ক্রিয় করুন"}
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/enterprise/menus")}>
                    মেনু পরিচালনা
                  </Button>
                  <Button variant="outline" onClick={() => navigate(`/enterprise/analytics?restaurant=${restaurantId}`)}>
                    অ্যানালিটিক্স
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10">
                    <ShoppingCart className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">আজকের অর্ডার</p>
                    <p className="text-2xl font-semibold">{details.todayOrdersCount}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-success/10">
                    <Store className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">আজকের আয়</p>
                    <p className="text-2xl font-semibold">{formatCurrency(details.todayRevenue)}</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-500/10">
                    <MenuSquare className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">মেনু আইটেম</p>
                    <p className="text-2xl font-semibold">{details.menuItems.length}</p>
                    <p className="text-xs text-muted-foreground">{sharedItemsCount}টি shared</p>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="flex items-center gap-4 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10">
                    <Users className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">স্টাফ সংখ্যা</p>
                    <p className="text-2xl font-semibold">{details.staffCount}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Menu preview + Recent orders */}
            <div className="grid gap-6 xl:grid-cols-2">
              {/* Menu preview */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">মেনু প্রিভিউ</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {details.menuItems.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">কোনো মেনু আইটেম নেই।</div>
                  ) : (
                    details.menuItems.map((item: any) => (
                      <div key={item.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-medium">{item.name}</p>
                            <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                            {item.shared_menu_item_id && (
                              <Badge variant="outline" className="text-[10px]">Shared</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {item.available ? "পাওয়া যাচ্ছে" : "লুকানো"}
                          </p>
                        </div>
                        <p className="text-sm font-semibold flex-shrink-0">{formatCurrency(Number(item.price || 0))}</p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Recent orders — with expandable item breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">সাম্প্রতিক অর্ডার</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {details.recentOrders.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">কোনো সাম্প্রতিক অর্ডার নেই।</div>
                  ) : (
                    details.recentOrders.map((order: any) => {
                      const statusCfg = ORDER_STATUS_LABELS[order.status] ?? { label: order.status, color: "bg-muted text-muted-foreground" };
                      const isExpanded = expandedOrderId === order.id;
                      const items: any[] = Array.isArray(order.order_items) ? order.order_items : [];

                      return (
                        <div key={order.id} className="rounded-xl border border-border overflow-hidden">
                          {/* Order header row */}
                          <button
                            className="w-full flex items-center justify-between gap-3 p-3 text-left hover:bg-secondary/20 transition-colors"
                            onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-sm">
                                  অর্ডার #{order.id.slice(0, 8)}
                                </p>
                                {order.table_number && (
                                  <Badge variant="outline" className="text-[10px]">
                                    টেবিল {order.table_number}
                                  </Badge>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusCfg.color}`}>
                                  {statusCfg.label}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {new Date(order.created_at).toLocaleString("bn-BD")}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <p className="font-semibold text-sm">{formatCurrency(Number(order.total || 0))}</p>
                              {items.length > 0 && (
                                isExpanded
                                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </button>

                          {/* Expanded item breakdown */}
                          {isExpanded && items.length > 0 && (
                            <div className="border-t border-border bg-secondary/10 px-3 py-2 space-y-1.5">
                              <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">অর্ডার আইটেম</p>
                              {items.map((oi: any, idx: number) => (
                                <div key={oi.id ?? idx} className="flex items-center justify-between gap-2 text-sm">
                                  <div className="min-w-0 flex-1">
                                    <span className="font-medium truncate">
                                      {oi.menu_items?.name || "অজানা আইটেম"}
                                    </span>
                                    {oi.menu_items?.category && (
                                      <span className="ml-1.5 text-xs text-muted-foreground">
                                        ({oi.menu_items.category})
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3 flex-shrink-0">
                                    <span className="text-xs text-muted-foreground">×{oi.quantity}</span>
                                    <span className="text-sm font-medium">
                                      {formatCurrency(Number(oi.unit_price || 0) * Number(oi.quantity || 1))}
                                    </span>
                                  </div>
                                </div>
                              ))}
                              {order.notes && (
                                <p className="mt-2 text-xs text-muted-foreground border-t border-border pt-2">
                                  নোট: {order.notes}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Edit Dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>রেস্টুরেন্ট সম্পাদনা করুন</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>নাম</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  maxLength={200}
                />
              </div>
              <div className="space-y-2">
                <Label>ঠিকানা</Label>
                <Input
                  value={form.address}
                  onChange={(e) => setForm((c) => ({ ...c, address: e.target.value }))}
                  maxLength={500}
                />
              </div>
              <div className="space-y-2">
                <Label>ফোন</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
                  maxLength={20}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditOpen(false)}>বাতিল</Button>
              <Button onClick={() => updateRestaurantMutation.mutate()} disabled={updateRestaurantMutation.isPending}>
                {updateRestaurantMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> সেভ হচ্ছে...</>
                ) : "সেভ করুন"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
