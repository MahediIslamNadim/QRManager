import { useEffect, useState, useRef, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Clock, CheckCircle, Plus, Minus, Edit, X, Volume2, VolumeX, Users, UserPlus, UserMinus, Banknote, Smartphone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const WaiterDashboard = () => {
  const { restaurantId, user } = useAuth();
  const queryClient = useQueryClient();
  const [editOrder, setEditOrder] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bkash">("cash");
  const prevOrderIdsRef = useRef<Set<string>>(new Set());
  const isFirstLoadRef = useRef(true);

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const ctx = new AudioContext();
      const playTone = (freq: number, start: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = "sine";
        gain.gain.setValueAtTime(0.3, ctx.currentTime + start);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + start + dur);
        osc.start(ctx.currentTime + start);
        osc.stop(ctx.currentTime + start + dur);
      };
      playTone(880, 0, 0.15);
      playTone(1100, 0.15, 0.15);
      playTone(1320, 0.3, 0.2);
    } catch {}
  }, [soundEnabled]);

  const { data: orders = [] } = useQuery({
    queryKey: ["waiter-orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("orders")
        .select("*, restaurant_tables(name), table_seats(seat_number), order_items(id, name, quantity, price, menu_item_id)")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "preparing", "served"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const { data: tables = [] } = useQuery({
    queryKey: ["waiter-tables", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("restaurant_tables")
        .select("id, name, seats, status, current_customers")
        .eq("restaurant_id", restaurantId)
        .order("name");
      return data || [];
    },
    enabled: !!restaurantId,
  });

  // Detect new orders and play sound
  useEffect(() => {
    if (!orders.length && isFirstLoadRef.current) return;
    const currentIds = new Set(orders.map((o: any) => o.id));
    if (isFirstLoadRef.current) {
      prevOrderIdsRef.current = currentIds;
      isFirstLoadRef.current = false;
      return;
    }
    const newOrders = orders.filter((o: any) => !prevOrderIdsRef.current.has(o.id) && o.status === "pending");
    if (newOrders.length > 0) {
      playNotificationSound();
      toast.success(`🔔 ${newOrders.length} টি নতুন অর্ডার এসেছে!`, { duration: 5000 });
    }
    prevOrderIdsRef.current = currentIds;
  }, [orders, playNotificationSound]);

  // Realtime
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel("waiter-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["waiter-orders"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, () => {
        queryClient.invalidateQueries({ queryKey: ["waiter-tables", restaurantId] });
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
      queryClient.invalidateQueries({ queryKey: ["waiter-orders"] });
      toast.success("স্ট্যাটাস আপডেট হয়েছে");
    },
  });

  // ✅ Payment mutation
  const paymentMutation = useMutation({
    mutationFn: async ({ orderId, method }: { orderId: string; method: string }) => {
      const staffName = user?.user_metadata?.full_name || user?.email || "Unknown";
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
      queryClient.invalidateQueries({ queryKey: ["waiter-orders"] });
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
      if (i === idx) {
        const nq = Math.max(0, item.quantity + delta);
        return { ...item, quantity: nq };
      }
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
      queryClient.invalidateQueries({ queryKey: ["waiter-orders"] });
      toast.success("অর্ডার আপডেট হয়েছে");
      setEditOrder(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pendingCount = orders.filter((o: any) => o.status === "pending").length;
  const preparingCount = orders.filter((o: any) => o.status === "preparing").length;
  const servedCount = orders.filter((o: any) => o.status === "served").length;

  const timeAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return "এইমাত্র";
    if (diff < 60) return `${diff} মিনিট আগে`;
    return `${Math.floor(diff / 60)} ঘন্টা আগে`;
  };

  const staffName = user?.user_metadata?.full_name || user?.email || "আপনি";

  return (
    <DashboardLayout role="waiter" title="ওয়েটার ড্যাশবোর্ড">
      <div className="space-y-6 animate-fade-up relative">
        <div className="grid grid-cols-4 gap-4">
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`absolute top-4 right-4 p-2 rounded-full transition-all ${soundEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
            title={soundEnabled ? "সাউন্ড বন্ধ করুন" : "সাউন্ড চালু করুন"}
          >
            {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          <div className="stat-card text-center">
            <ShoppingCart className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-display font-bold text-foreground">{orders.length}</p>
            <p className="text-xs text-muted-foreground">মোট অর্ডার</p>
          </div>
          <div className="stat-card text-center">
            <Clock className="w-6 h-6 text-warning mx-auto mb-2" />
            <p className="text-2xl font-display font-bold text-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">পেন্ডিং</p>
          </div>
          <div className="stat-card text-center">
            <CheckCircle className="w-6 h-6 text-info mx-auto mb-2" />
            <p className="text-2xl font-display font-bold text-foreground">{preparingCount}</p>
            <p className="text-xs text-muted-foreground">প্রস্তুত হচ্ছে</p>
          </div>
          <div className="stat-card text-center">
            <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" />
            <p className="text-2xl font-display font-bold text-foreground">{servedCount}</p>
            <p className="text-xs text-muted-foreground">সার্ভ করা</p>
          </div>
        </div>

        {/* Table Overview */}
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground mb-3 flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" /> টেবিল ওভারভিউ
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {tables.map((table: any) => {
              const hasCustomers = (table.current_customers || 0) > 0;
              return (
                <div key={table.id}
                  className={`rounded-xl border p-3 text-center transition-all ${hasCustomers ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/30"}`}>
                  <p className="font-display font-bold text-foreground text-sm">{table.name}</p>
                  <p className={`text-lg font-bold ${hasCustomers ? "text-primary" : "text-muted-foreground"}`}>
                    👤 {table.current_customers || 0}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{table.seats} সিট</p>
                  <div className="flex items-center justify-center gap-1 mt-1.5">
                    <button
                      onClick={() => {
                        const nc = Math.max(0, (table.current_customers || 0) - 1);
                        supabase.from("restaurant_tables").update({ current_customers: nc }).eq("id", table.id)
                          .then(() => queryClient.invalidateQueries({ queryKey: ["waiter-tables", restaurantId] }));
                      }}
                      className="w-6 h-6 rounded-md bg-card border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition-all"
                    ><UserMinus className="w-3 h-3 text-destructive" /></button>
                    <button
                      onClick={() => {
                        const nc = Math.min(table.seats, (table.current_customers || 0) + 1);
                        supabase.from("restaurant_tables").update({ current_customers: nc }).eq("id", table.id)
                          .then(() => queryClient.invalidateQueries({ queryKey: ["waiter-tables", restaurantId] }));
                      }}
                      className="w-6 h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-all"
                    ><UserPlus className="w-3 h-3" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Orders */}
        <div>
          <h2 className="text-lg font-display font-semibold text-foreground mb-4">অ্যাক্টিভ অর্ডার</h2>
          {orders.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">কোনো অ্যাক্টিভ অর্ডার নেই</p>
          ) : (
            <div className="space-y-4">
              {orders.map((order: any) => (
                <Card key={order.id} className="border-l-4 border-l-primary">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="font-display font-semibold text-foreground">#{order.id.slice(0, 6)}</h3>
                          <span className="text-sm font-body text-muted-foreground">• {order.restaurant_tables?.name || "N/A"}</span>
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
                        <div className="flex flex-wrap gap-1 mb-2">
                          {order.order_items?.map((item: any, i: number) => (
                            <span key={i} className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">
                              {item.name} x{item.quantity}
                            </span>
                          ))}
                        </div>
                        <div className="flex items-center gap-3 flex-wrap">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {timeAgo(order.created_at)}
                          </p>
                          <p className="text-sm font-bold text-foreground">৳{order.total || 0}</p>
                          {/* ✅ Paid to staff name — ছোট করে */}
                          {order.paid_to_staff_name && (
                            <p className="text-[10px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                              💰 {order.paid_to_staff_name}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 ml-3">
                        <Button size="sm" variant="outline" onClick={() => openEditOrder(order)}>
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        {order.status === "pending" && (
                          <Button size="sm" variant="hero" onClick={() => updateStatus.mutate({ id: order.id, status: "preparing" })}>
                            গ্রহণ করুন
                          </Button>
                        )}
                        {order.status === "preparing" && (
                          <Button size="sm" variant="default" onClick={() => updateStatus.mutate({ id: order.id, status: "served" })}>
                            সার্ভ করুন
                          </Button>
                        )}
                        {/* ✅ Bill button — served হলে দেখাবে */}
                        {order.status === "served" && order.payment_status !== "paid" && (
                          <Button size="sm" variant="hero"
                            className="bg-success hover:bg-success/90"
                            onClick={() => { setPaymentOrder(order); setPaymentMethod("cash"); }}>
                            <Banknote className="w-3.5 h-3.5" /> বিল নিন
                          </Button>
                        )}
                        {order.status === "served" && order.payment_status === "paid" && (
                          <Button size="sm" variant="hero"
                            className="bg-success hover:bg-success/90"
                            onClick={() => updateStatus.mutate({ id: order.id, status: "completed" })}>
                            <CheckCircle className="w-3.5 h-3.5" /> কমপ্লিট
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
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
                <span className="font-medium text-foreground">
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

            {/* Confirm button */}
            <Button
              variant="hero"
              className="w-full h-12 text-base"
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

export default WaiterDashboard;
