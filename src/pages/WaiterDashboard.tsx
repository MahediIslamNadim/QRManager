import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Clock, CheckCircle, Plus, Minus, Edit, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const WaiterDashboard = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [editOrder, setEditOrder] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);

  const { data: orders = [] } = useQuery({
    queryKey: ["waiter-orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("orders")
        .select("*, restaurant_tables(name), order_items(id, name, quantity, price, menu_item_id)")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "preparing"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!restaurantId,
  });

  // Realtime
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel("waiter-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["waiter-orders"] });
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

      // Delete removed items
      for (const item of toDelete) {
        await supabase.from("order_items").delete().eq("id", item.id);
      }
      // Update quantities
      for (const item of toUpdate) {
        await supabase.from("order_items").update({ quantity: item.quantity }).eq("id", item.id);
      }
      // Recalculate total
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

  const timeAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return "এইমাত্র";
    if (diff < 60) return `${diff} মিনিট আগে`;
    return `${Math.floor(diff / 60)} ঘন্টা আগে`;
  };

  return (
    <DashboardLayout role="waiter" title="ওয়েটার ড্যাশবোর্ড">
      <div className="space-y-6 animate-fade-up">
        <div className="grid grid-cols-3 gap-4">
          <div className="stat-card text-center">
            <ShoppingCart className="w-6 h-6 text-primary mx-auto mb-2" />
            <p className="text-2xl font-display font-bold text-foreground">{orders.length}</p>
            <p className="text-xs text-muted-foreground">অ্যাক্টিভ অর্ডার</p>
          </div>
          <div className="stat-card text-center">
            <Clock className="w-6 h-6 text-warning mx-auto mb-2" />
            <p className="text-2xl font-display font-bold text-foreground">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">পেন্ডিং</p>
          </div>
          <div className="stat-card text-center">
            <CheckCircle className="w-6 h-6 text-success mx-auto mb-2" />
            <p className="text-2xl font-display font-bold text-foreground">{preparingCount}</p>
            <p className="text-xs text-muted-foreground">প্রস্তুত হচ্ছে</p>
          </div>
        </div>

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
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-display font-semibold text-foreground">#{order.id.slice(0, 6)}</h3>
                          <span className="text-sm font-body text-muted-foreground">• {order.restaurant_tables?.name || "N/A"}</span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-2">
                          {order.order_items?.map((item: any, i: number) => (
                            <span key={i} className="text-xs px-2 py-1 rounded bg-secondary text-secondary-foreground">
                              {item.name} x{item.quantity}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> {timeAgo(order.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
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
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

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
