import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Clock, CheckCircle, ChefHat, Edit, Plus, Minus, X, Banknote, Smartphone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const statusFilters = ["সব", "পেন্ডিং", "প্রস্তুত হচ্ছে", "সার্ভ করা হয়েছে", "সম্পন্ন"];
const statusMap: Record<string, string> = {
  "সব": "all", "পেন্ডিং": "pending", "প্রস্তুত হচ্ছে": "preparing", "সার্ভ করা হয়েছে": "served", "সম্পন্ন": "completed"
};

const AdminOrders = () => {
  const { restaurantId, user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("সব");
  const [editOrder, setEditOrder] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bkash">("cash");

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("orders")
        .select("*, restaurant_tables(name), table_seats(seat_number), order_items(id, name, quantity, price, menu_item_id)")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!restaurantId,
  });

  // Realtime
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, queryClient]);

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("orders").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("স্ট্যাটাস আপডেট হয়েছে");
    },
  });

  // ✅ Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async ({ orderId, method }: { orderId: string; method: string }) => {
      const staffName = user?.user_metadata?.full_name || user?.email || "Admin";
      const { error } = await supabase.from("orders").update({
        status: "completed",
        payment_status: "paid",
        payment_method: method,
        paid_to_staff_id: user?.id,
        paid_to_staff_name: staffName,
        paid_at: new Date().toISOString(),
      }).eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("✅ পেমেন্ট সম্পন্ন হয়েছে!");
      setPaymentOrder(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

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

  const saveEditMutation = useMutation({
    mutationFn: async () => {
      if (!editOrder) return;
      const toDelete = editItems.filter(i => i.quantity === 0);
      const toUpdate = editItems.filter(i => i.quantity > 0);
      for (const item of toDelete) {
        await supabase.from("order_items").delete().eq("id", item.id);
      }
      for (const item of toUpdate) {
        await supabase.from("order_items").update({ quantity: item.quantity }).eq("id", item.id);
      }
      const newTotal = toUpdate.reduce((s, i) => s + i.price * i.quantity, 0);
      await supabase.from("orders").update({ total: newTotal }).eq("id", editOrder.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      toast.success("অর্ডার আপডেট হয়েছে");
      setEditOrder(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = filter === "সব" ? orders : orders.filter((o: any) => o.status === statusMap[filter]);

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
      <div className="space-y-6 animate-fade-up">
        <div className="flex flex-wrap gap-2">
          {statusFilters.map((s) => (
            <Button key={s} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>{s}</Button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">কোনো অর্ডার নেই</p>
        ) : (
          <div className="space-y-4">
            {filtered.map((order: any) => (
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
                          {/* ✅ Payment badge */}
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
                          {/* ✅ Paid to staff — ছোট করে */}
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
                            onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus(order.status)! })}>
                            {nextStatus(order.status) === "preparing" ? "গ্রহণ করুন" : "সার্ভ করুন"}
                          </Button>
                        )}
                        {/* ✅ Bill button — served হলে */}
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
                            onClick={() => updateStatus.mutate({ id: order.id, status: "completed" })}>
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> সম্পন্ন করুন
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
      </div>

      {/* ✅ Payment Dialog */}
      <Dialog open={!!paymentOrder} onOpenChange={() => setPaymentOrder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">💰 বিল পরিশোধ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Order summary */}
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

            {/* Payment method */}
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

            {/* Staff info */}
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">পেমেন্ট গ্রহণকারী:</p>
              <p className="text-sm font-bold text-foreground">👤 {staffName}</p>
            </div>

            {/* Confirm */}
            <Button variant="hero" className="w-full h-12 text-base"
              onClick={() => paymentMutation.mutate({ orderId: paymentOrder.id, method: paymentMethod })}
              disabled={paymentMutation.isPending}>
              {paymentMutation.isPending ? "প্রসেস হচ্ছে..." : `✅ ${paymentMethod === "bkash" ? "bKash" : "ক্যাশ"} পেমেন্ট কনফার্ম করুন`}
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
            <Button variant="hero" onClick={() => saveEditMutation.mutate()} disabled={saveEditMutation.isPending}>
              {saveEditMutation.isPending ? "সেভ হচ্ছে..." : "সেভ করুন"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AdminOrders;
