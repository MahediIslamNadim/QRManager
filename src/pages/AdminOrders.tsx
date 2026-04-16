import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Clock, CheckCircle, ChefHat, Edit, Plus, Minus, X, Banknote, Smartphone, Printer, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrderActions } from "@/hooks/useOrderActions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { printReceipt } from "@/utils/printReceipt";

const statusFilters = ["সব", "পেন্ডিং", "প্রস্তুত হচ্ছে", "সার্ভ করা হয়েছে", "সম্পন্ন"];
const statusMap: Record<string, string> = {
  "সব": "all", "পেন্ডিং": "pending", "প্রস্তুত হচ্ছে": "preparing", "সার্ভ করা হয়েছে": "served", "সম্পন্ন": "completed"
};

const PAGE_SIZE = 25;
const QUERY_KEY_PREFIX = "admin-orders";

const AdminOrders = () => {
  const { restaurantId, user } = useAuth();
  const queryClient = useQueryClient();
  const { updateStatus, completePayment, saveOrderEdit } = useOrderActions([[QUERY_KEY_PREFIX]]);

  const [filter, setFilter] = useState("সব");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [editOrder, setEditOrder] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bkash">("cash");

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset to page 1 when filter or search changes
  useEffect(() => { setPage(1); }, [filter, search]);

  const statusFilter = statusMap[filter];

  const { data: restaurantData } = useQuery({
    queryKey: ["restaurant-name", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data } = await supabase.from("restaurants").select("name").eq("id", restaurantId).maybeSingle();
      return data;
    },
    enabled: !!restaurantId,
  });
  const restaurantName = restaurantData?.name || "রেস্টুরেন্ট";

  const { data, isLoading } = useQuery({
    queryKey: [QUERY_KEY_PREFIX, restaurantId, statusFilter, page, search],
    queryFn: async () => {
      if (!restaurantId) return { orders: [], count: 0 };
      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let q = supabase
        .from("orders")
        .select(
          "*, restaurant_tables(name), table_seats(seat_number), order_items(id, name, quantity, price, menu_item_id)",
          { count: "exact" }
        )
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (statusFilter !== "all") q = q.eq("status", statusFilter);

      if (search) {
        const { data: matchingTables } = await supabase
          .from("restaurant_tables")
          .select("id")
          .eq("restaurant_id", restaurantId)
          .ilike("name", `%${search}%`);

        const tableIds = matchingTables?.map(t => t.id) ?? [];
        if (tableIds.length > 0) {
          q = q.in("table_id", tableIds);
        } else {
          return { orders: [], count: 0 };
        }
      }

      const { data: rows, error, count } = await q;
      if (error) throw error;
      return { orders: rows || [], count: count ?? 0 };
    },
    enabled: !!restaurantId,
    placeholderData: (prev) => prev,
  });

  const orders: any[] = data?.orders ?? [];
  const totalCount = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Realtime — partial key invalidation covers all page/filter variants
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`admin-orders-realtime-${restaurantId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "orders",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEY_PREFIX, restaurantId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, queryClient]);

  const openEditOrder = (order: any) => {
    setEditOrder(order);
    setEditItems((order.order_items || []).map((i: any) => ({ ...i })));
  };

  const updateItemQty = (idx: number, delta: number) => {
    setEditItems(prev => prev.map((item, i) => {
      if (i === idx) return { ...item, quantity: Math.max(0, item.quantity + delta) };
      return item;
    }));
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case "pending": return <Clock className="w-4 h-4" />;
      case "preparing": return <ChefHat className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case "pending": return "bg-warning/10 text-warning";
      case "preparing": return "bg-primary/10 text-primary";
      case "served": return "bg-success/10 text-success";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (s: string) => {
    const map: Record<string, string> = {
      pending: "পেন্ডিং", preparing: "প্রস্তুত হচ্ছে",
      served: "সার্ভ করা হয়েছে", completed: "সম্পন্ন", cancelled: "বাতিল"
    };
    return map[s] || s;
  };

  const nextStatus = (s: string) => {
    const flow: Record<string, string> = { pending: "preparing", preparing: "served" };
    return flow[s];
  };

  const timeAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return "এইমাত্র";
    if (diff < 60) return `${diff} মিনিট আগে`;
    return `${Math.floor(diff / 60)} ঘন্টা আগে`;
  };

  const staffName = user?.user_metadata?.full_name || user?.email || "Admin";

  return (
    <DashboardLayout role="admin" title="অর্ডার ম্যানেজমেন্ট">
      <div className="space-y-4 animate-fade-up">

        {/* Filters + Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex flex-wrap gap-2">
            {statusFilters.map((s) => (
              <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>{s}</Button>
            ))}
          </div>
          <div className="relative sm:ml-auto sm:w-56">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="টেবিল নাম খুঁজুন..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        {/* Count indicator */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {isLoading ? "লোড হচ্ছে..." : `মোট ${totalCount} টি অর্ডার`}
            {totalPages > 1 && ` · পেজ ${page}/${totalPages}`}
          </span>
        </div>

        {!isLoading && orders.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">কোনো অর্ডার নেই</p>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
                        <ShoppingCart className="w-6 h-6 text-accent-foreground" />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-1 flex-wrap">
                          <h3 className="font-display font-semibold text-foreground text-lg">#{order.id.slice(0, 6)}</h3>
                          <span className="text-sm text-muted-foreground">{order.restaurant_tables?.name || "N/A"}</span>
                          {order.table_seats?.seat_number && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              সিট {order.table_seats.seat_number}
                            </span>
                          )}
                          {order.payment_status === "paid" && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success font-medium flex items-center gap-1">
                              ✅ পেইড • {order.payment_method === "bkash" ? "bKash" : "Cash"}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {order.order_items?.map((item: any, i: number) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground">
                              {item.name} x{item.quantity}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-xs text-muted-foreground">{timeAgo(order.created_at)}</p>
                          {order.paid_to_staff_name && (
                            <span className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full flex items-center gap-1">
                              💰 {order.paid_to_staff_name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                      <span className="text-xl font-bold text-foreground">৳{order.total}</span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusStyle(order.status)}`}>
                        {getStatusIcon(order.status)} {getStatusLabel(order.status)}
                      </span>
                      <div className="flex gap-2">
                        {(order.status === "pending" || order.status === "preparing") && (
                          <Button size="sm" variant="outline" onClick={() => openEditOrder(order)}>
                            <Edit className="w-3.5 h-3.5 mr-1" /> এডিট
                          </Button>
                        )}
                        {nextStatus(order.status) && (
                          <Button size="sm" variant="hero"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus(order.status)!, restaurantId: restaurantId! })}>
                            {nextStatus(order.status) === "preparing" ? "গ্রহণ করুন" : "সার্ভ করুন"}
                          </Button>
                        )}
                        {order.status === "served" && order.payment_status !== "paid" && (
                          <Button size="sm" variant="hero"
                            className="bg-success hover:bg-success/90"
                            onClick={() => { setPaymentOrder(order); setPaymentMethod("cash"); }}>
                            <Banknote className="w-3.5 h-3.5 mr-1" /> বিল নিন
                          </Button>
                        )}
                        {order.status === "served" && order.payment_status === "paid" && (
                          <Button size="sm" variant="hero"
                            className="bg-success hover:bg-success/90"
                            disabled={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({ id: order.id, status: "completed", restaurantId: restaurantId! })}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> সম্পন্ন করুন
                          </Button>
                        )}
                        {(order.status === "completed" || order.payment_status === "paid") && (
                          <Button size="sm" variant="outline"
                            onClick={() => printReceipt(order, restaurantName)}>
                            <Printer className="w-3.5 h-3.5 mr-1" /> রসিদ
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1 || isLoading}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>

            {/* Page number buttons — show up to 5 around current */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce<(number | "…")[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-muted-foreground text-sm">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === page ? "default" : "outline"}
                    size="sm"
                    className="w-9"
                    onClick={() => setPage(p as number)}
                    disabled={isLoading}
                  >
                    {p}
                  </Button>
                )
              )}

            <Button
              variant="outline" size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages || isLoading}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      <Dialog open={!!paymentOrder} onOpenChange={() => setPaymentOrder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">💰 বিল পরিশোধ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">অর্ডার</span>
                <span className="font-medium text-foreground">#{paymentOrder?.id?.slice(0, 6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">টেবিল</span>
                <span className="font-medium text-foreground">{paymentOrder?.restaurant_tables?.name || "N/A"}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">আইটেম</span>
                <span className="font-medium text-foreground text-right max-w-[180px]">
                  {paymentOrder?.order_items?.map((i: any) => `${i.name} x${i.quantity}`).join(", ")}
                </span>
              </div>
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-bold text-foreground">মোট</span>
                <span className="font-bold text-xl text-primary">৳{paymentOrder?.total || 0}</span>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-foreground mb-2">পেমেন্ট পদ্ধতি:</p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setPaymentMethod("cash")}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === "cash" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}>
                  <Banknote className={`w-6 h-6 ${paymentMethod === "cash" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${paymentMethod === "cash" ? "text-primary" : "text-muted-foreground"}`}>ক্যাশ</span>
                </button>
                <button
                  onClick={() => setPaymentMethod("bkash")}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === "bkash" ? "border-pink-500 bg-pink-500/10" : "border-border bg-secondary/30"}`}>
                  <Smartphone className={`w-6 h-6 ${paymentMethod === "bkash" ? "text-pink-500" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${paymentMethod === "bkash" ? "text-pink-500" : "text-muted-foreground"}`}>bKash</span>
                </button>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">পেমেন্ট গ্রহণকারী:</p>
              <p className="text-sm font-bold text-foreground">👤 {staffName}</p>
            </div>

            <Button variant="hero" className="w-full h-12 text-base"
              onClick={() => completePayment.mutate({
                orderId: paymentOrder.id,
                method: paymentMethod,
                staffId: user?.id ?? "",
                staffName: user?.user_metadata?.full_name || user?.email || "Admin",
                restaurantId: restaurantId!,
              }, {
                onSuccess: () => {
                  const order = orders.find((o: any) => o.id === paymentOrder.id);
                  if (order) printReceipt({ ...order, payment_status: "paid", payment_method: paymentMethod, paid_to_staff_name: user?.user_metadata?.full_name || user?.email || "Admin" }, restaurantName);
                  setPaymentOrder(null);
                },
              })}
              disabled={completePayment.isPending}>
              {completePayment.isPending ? "প্রসেস হচ্ছে..." : `✅ ${paymentMethod === "bkash" ? "bKash" : "ক্যাশ"} পেমেন্ট কনফার্ম করুন`}
            </Button>
            <Button variant="outline" className="w-full" onClick={() => printReceipt(paymentOrder, restaurantName)}>
              <Printer className="w-4 h-4 mr-2" /> রসিদ প্রিন্ট করুন (পেমেন্টের আগে)
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={!!editOrder} onOpenChange={() => setEditOrder(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">অর্ডার এডিট — #{editOrder?.id?.slice(0, 6)}</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {editItems.map((item, idx) => (
              <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border border-border/30 ${item.quantity === 0 ? "opacity-40 bg-destructive/5" : "bg-secondary/50"}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">৳{item.price}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={() => updateItemQty(idx, -1)} className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition-all">
                    {item.quantity <= 1 ? <X className="w-3.5 h-3.5 text-destructive" /> : <Minus className="w-3.5 h-3.5" />}
                  </button>
                  <span className="w-8 text-center font-bold text-sm text-foreground">{item.quantity}</span>
                  <button onClick={() => updateItemQty(idx, 1)} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-all">
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <span className="text-sm font-bold text-foreground w-16 text-right">৳{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-3 flex justify-between items-center">
            <span className="font-bold text-foreground">মোট: ৳{editItems.filter(i => i.quantity > 0).reduce((s, i) => s + i.price * i.quantity, 0)}</span>
            <Button variant="hero" onClick={() => saveOrderEdit.mutate(
              { orderId: editOrder.id, restaurantId: restaurantId!, items: editItems },
              { onSuccess: () => setEditOrder(null) }
            )} disabled={saveOrderEdit.isPending}>
              {saveOrderEdit.isPending ? "সেভ হচ্ছে..." : "সেভ করুন"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminOrders;
