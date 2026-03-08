import { useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Plus, Edit, Users, Trash2, ShoppingCart } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const AdminTables = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [form, setForm] = useState({ name: "", seats: "4" });
  const [showQR, setShowQR] = useState<string | null>(null);
  const [selectedTable, setSelectedTable] = useState<any>(null);

  const { data: tables = [] } = useQuery({
    queryKey: ["tables", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("restaurant_tables")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("name");
      return data || [];
    },
    enabled: !!restaurantId,
  });

  // Fetch active orders per table
  const { data: tableOrders = {} } = useQuery({
    queryKey: ["table-orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return {};
      const { data } = await supabase
        .from("orders")
        .select("id, table_id, total, status, created_at, order_items(name, quantity, price)")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "preparing", "served"])
        .order("created_at", { ascending: false });
      const map: Record<string, any[]> = {};
      (data || []).forEach((o: any) => {
        if (o.table_id) {
          if (!map[o.table_id]) map[o.table_id] = [];
          map[o.table_id].push(o);
        }
      });
      return map;
    },
    enabled: !!restaurantId,
  });

  // Realtime subscriptions
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel("admin-tables-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["table-orders", restaurantId] });
        queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "restaurant_tables" }, () => {
        queryClient.invalidateQueries({ queryKey: ["tables", restaurantId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, queryClient]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("No restaurant");
      const payload = { restaurant_id: restaurantId, name: form.name, seats: Number(form.seats) };
      if (editingTable) {
        const { error } = await supabase.from("restaurant_tables").update(payload).eq("id", editingTable.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("restaurant_tables").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success(editingTable ? "টেবিল আপডেট হয়েছে" : "টেবিল যোগ হয়েছে");
      setShowForm(false);
      setEditingTable(null);
      setForm({ name: "", seats: "4" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restaurant_tables").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tables"] });
      toast.success("টেবিল মুছে ফেলা হয়েছে");
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("restaurant_tables").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tables"] }),
  });

  const menuUrl = (tableId: string) => `${window.location.origin}/menu/${restaurantId}?table=${tableId}`;

  const getTableColor = (table: any) => {
    const orders = tableOrders[table.id];
    if (orders && orders.length > 0) {
      const hasPending = orders.some((o: any) => o.status === "pending");
      const hasPreparing = orders.some((o: any) => o.status === "preparing");
      if (hasPending) return { border: "border-destructive/50", bar: "bg-destructive", bg: "bg-destructive/10", label: "নতুন অর্ডার", dot: "bg-destructive" };
      if (hasPreparing) return { border: "border-warning/50", bar: "bg-warning", bg: "bg-warning/10", label: "প্রস্তুত হচ্ছে", dot: "bg-warning" };
      return { border: "border-primary/50", bar: "gradient-primary", bg: "bg-primary/10", label: "সার্ভ হচ্ছে", dot: "bg-primary" };
    }
    if (table.status === "occupied") return { border: "border-primary/30", bar: "gradient-primary", bg: "bg-primary/10", label: "ব্যস্ত", dot: "bg-primary" };
    if (table.status === "reserved") return { border: "border-warning/30", bar: "bg-warning", bg: "bg-warning/10", label: "রিজার্ভড", dot: "bg-warning" };
    return { border: "border-success/30", bar: "bg-success", bg: "bg-success/10", label: "ফাঁকা", dot: "bg-success" };
  };

  return (
    <DashboardLayout role="admin" title="টেবিল ও QR কোড ম্যানেজমেন্ট">
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-success" /><span className="text-sm text-muted-foreground">ফাঁকা</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-destructive" /><span className="text-sm text-muted-foreground">নতুন অর্ডার</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-warning" /><span className="text-sm text-muted-foreground">প্রস্তুত হচ্ছে</span></div>
            <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-primary" /><span className="text-sm text-muted-foreground">সার্ভ/ব্যস্ত</span></div>
          </div>
          <Button variant="hero" onClick={() => { setForm({ name: "", seats: "4" }); setEditingTable(null); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> টেবিল যোগ করুন
          </Button>
        </div>

        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">{editingTable ? "টেবিল সম্পাদনা" : "নতুন টেবিল"}</DialogTitle></DialogHeader>
            <form onSubmit={e => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div><Label>টেবিল নাম</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="T-1" required /></div>
              <div><Label>সিট সংখ্যা</Label><Input type="number" value={form.seats} onChange={e => setForm(f => ({ ...f, seats: e.target.value }))} required /></div>
              <Button type="submit" variant="hero" className="w-full" disabled={saveMutation.isPending}>সেভ করুন</Button>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={!!showQR} onOpenChange={() => setShowQR(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display">QR কোড লিংক</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">এই লিংকটি QR কোড হিসেবে প্রিন্ট করুন:</p>
              <code className="block p-3 bg-secondary rounded-lg text-xs break-all">{showQR}</code>
              <Button variant="hero" className="w-full" onClick={() => { navigator.clipboard.writeText(showQR!); toast.success("কপি করা হয়েছে!"); }}>লিংক কপি করুন</Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Table Order Detail Dialog */}
        <Dialog open={!!selectedTable} onOpenChange={() => setSelectedTable(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle className="font-display">টেবিল {selectedTable?.name} — অর্ডার</DialogTitle></DialogHeader>
            {selectedTable && (
              <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                {(tableOrders[selectedTable.id] || []).length === 0 ? (
                  <p className="text-center text-muted-foreground py-6">কোনো অ্যাক্টিভ অর্ডার নেই</p>
                ) : (
                  (tableOrders[selectedTable.id] || []).map((order: any) => (
                    <div key={order.id} className="p-3 rounded-xl bg-secondary/50 border border-border/30">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-foreground text-sm">#{order.id.slice(0, 6)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          order.status === "pending" ? "bg-destructive/10 text-destructive" :
                          order.status === "preparing" ? "bg-warning/10 text-warning" :
                          "bg-success/10 text-success"
                        }`}>{order.status === "pending" ? "পেন্ডিং" : order.status === "preparing" ? "প্রস্তুত হচ্ছে" : "সার্ভ"}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {order.order_items?.map((item: any, i: number) => (
                          <span key={i} className="text-xs px-2 py-1 rounded bg-accent text-accent-foreground">
                            {item.name} x{item.quantity}
                          </span>
                        ))}
                      </div>
                      <p className="text-sm font-bold text-foreground mt-2">৳{order.total}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {tables.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">কোনো টেবিল নেই। "টেবিল যোগ করুন" বাটনে ক্লিক করুন।</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {tables.map((table: any) => {
              const color = getTableColor(table);
              const orders = tableOrders[table.id] || [];
              const orderCount = orders.length;
              const totalAmount = orders.reduce((s: number, o: any) => s + Number(o.total || 0), 0);
              return (
                <Card
                  key={table.id}
                  className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg cursor-pointer ${color.border}`}
                  onClick={() => orderCount > 0 && setSelectedTable(table)}
                >
                  <div className={`absolute top-0 left-0 right-0 h-1.5 ${color.bar}`} />
                  {/* Pulsing dot for new orders */}
                  {orders.some((o: any) => o.status === "pending") && (
                    <div className="absolute top-3 right-3 w-3 h-3 rounded-full bg-destructive animate-ping" />
                  )}
                  <CardContent className="p-6 text-center">
                    <div className={`w-16 h-16 rounded-2xl mx-auto mb-3 flex items-center justify-center ${color.bg}`}>
                      <span className="text-2xl font-display font-bold text-foreground">{table.name}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                      <div className={`w-2 h-2 rounded-full ${color.dot}`} />
                      <span className="text-xs font-medium text-muted-foreground">{color.label}</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                      <Users className="w-3.5 h-3.5" /><span>{table.seats} সিট</span>
                    </div>
                    {orderCount > 0 && (
                      <div className="flex items-center justify-center gap-1 text-xs text-primary font-medium mb-2">
                        <ShoppingCart className="w-3 h-3" /> {orderCount} অর্ডার • ৳{totalAmount}
                      </div>
                    )}
                    <select
                      value={table.status}
                      onChange={e => { e.stopPropagation(); toggleStatus.mutate({ id: table.id, status: e.target.value }); }}
                      onClick={e => e.stopPropagation()}
                      className="w-full mb-3 h-8 rounded border border-border bg-background text-xs px-2"
                    >
                      <option value="available">ফাঁকা</option>
                      <option value="occupied">ব্যস্ত</option>
                      <option value="reserved">রিজার্ভড</option>
                    </select>
                    <div className="flex gap-2 justify-center" onClick={e => e.stopPropagation()}>
                      <Button variant="outline" size="sm" onClick={() => setShowQR(menuUrl(table.id))}><QrCode className="w-3 h-3" /> QR</Button>
                      <Button variant="ghost" size="sm" onClick={() => { setForm({ name: table.name, seats: String(table.seats) }); setEditingTable(table); setShowForm(true); }}><Edit className="w-3 h-3" /></Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteMutation.mutate(table.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminTables;
