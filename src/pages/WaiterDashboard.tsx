import { useEffect, useState, useRef, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShoppingCart, Clock, CheckCircle, Plus, Minus, Edit, X,
  Volume2, VolumeX, Users, UserPlus, UserMinus, Banknote,
  Smartphone, User, Mail, Phone, KeyRound, Save, Bell
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useOrderActions } from "@/hooks/useOrderActions";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ✅ FIX Bug 1 + Bug 5: Waiter call / bill request চেনার helper
// total=0 এবং notes এ "🔔" বা "🧾" থাকলে notification order
const isNotificationOrder = (order: any) =>
  order.total === 0 &&
  order.notes &&
  (order.notes.includes("🔔") || order.notes.includes("🧾"));

const WaiterDashboard = () => {
  const { restaurantId, user } = useAuth();
  const queryClient = useQueryClient();
  const waiterQueryKey = ["waiter-orders", restaurantId];
  const { updateStatus, completePayment, saveOrderEdit } = useOrderActions([waiterQueryKey]);
  const [editOrder, setEditOrder] = useState<any>(null);
  const [editItems, setEditItems] = useState<any[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [paymentOrder, setPaymentOrder] = useState<any>(null);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bkash">("cash");
  const [activeTab, setActiveTab] = useState<"orders" | "tables" | "profile">("orders");
  const [handlingRequestId, setHandlingRequestId] = useState<string | null>(null);

  // Profile state
  const [profileName, setProfileName] = useState(user?.user_metadata?.full_name || "");
  const [profilePhone, setProfilePhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

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
    } catch (err) {
      console.warn("Notification sound failed:", err);
      toast.error("নোটিফিকেশন সাউন্ড চালু করা যায়নি। Browser permission দেখুন।");
    }
  }, [soundEnabled]);

  // Fetch profile
  useEffect(() => {
    if (!user) return;
    Promise.resolve(supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle())
      .then(({ data }) => {
        if (data) {
          setProfileName(data.full_name || "");
          setProfilePhone(data.phone || "");
        }
      }).catch(console.error);
  }, [user]);

  const { data: orders = [] } = useQuery({
    queryKey: ["waiter-orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("orders")
        .select("*, restaurant_tables(name), table_seats(seat_number), order_items(id, name, quantity, price, menu_item_id)")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "preparing", "served"])
        // ✅ FIX Bug 1: ৳0 order (waiter call/bill) বাদ দাও
        .gt("total", 0)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!restaurantId,
    refetchInterval: 15000,
  });

  // ✅ FIX Bug 1: Notification orders আলাদা query
  const { data: notifOrders = [] } = useQuery({
    queryKey: ["waiter-service-requests", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("service_requests")
        .select("id, note, request_type, status, created_at, restaurant_tables(name), table_seats(seat_number)")
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!restaurantId,
    refetchInterval: 10000,
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

  // ✅ FIX Bug 5: real order (total>0) এর জন্যই notification
  useEffect(() => {
    if (!orders.length && isFirstLoadRef.current) return;
    const currentIds = new Set(orders.map((o: any) => o.id));
    if (isFirstLoadRef.current) {
      prevOrderIdsRef.current = currentIds;
      isFirstLoadRef.current = false;
      return;
    }
    const newOrders = orders.filter(
      (o: any) => !prevOrderIdsRef.current.has(o.id) && o.status === "pending"
    );
    if (newOrders.length > 0) {
      playNotificationSound();
      toast.success(`🔔 ${newOrders.length} টি নতুন অর্ডার!`, { duration: 5000 });
    }
    prevOrderIdsRef.current = currentIds;
  }, [orders, playNotificationSound]);

  // ✅ FIX Bug 3: restaurant_id filter যোগ করো realtime channel এ
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`waiter-realtime-${restaurantId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "orders",
        filter: `restaurant_id=eq.${restaurantId}`, // ← multi-tenant fix
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["waiter-orders", restaurantId] });
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "service_requests",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["waiter-service-requests", restaurantId] });
      })
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "restaurant_tables",
        filter: `restaurant_id=eq.${restaurantId}`, // ← multi-tenant fix
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["waiter-tables", restaurantId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, queryClient]);

  const openEditOrder = (order: any) => {
    setEditOrder(order);
    setEditItems((order.order_items || []).map((i: any) => ({ ...i })));
  };

  const updateItemQty = (idx: number, delta: number) => {
    setEditItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item
    ));
  };

  const handleServiceRequest = async (requestId: string) => {
    if (!restaurantId || !user?.id) return;
    setHandlingRequestId(requestId);
    try {
      const { error } = await supabase
        .from("service_requests")
        .update({
          status: "handled",
          handled_at: new Date().toISOString(),
          handled_by: user.id,
        })
        .eq("id", requestId)
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["waiter-service-requests", restaurantId] });
      toast.success("Service request handled");
    } catch (err: any) {
      toast.error(err.message || "Service request update failed");
    } finally {
      setHandlingRequestId(null);
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles").update({
        full_name: profileName,
        phone: profilePhone,
      }).eq("id", user.id);
      if (error) throw error;
      toast.success("প্রোফাইল আপডেট হয়েছে ✅");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("পাসওয়ার্ড পরিবর্তন হয়েছে ✅");
      setNewPassword("");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setChangingPassword(false);
    }
  };

  // ✅ FIX Bug 4: Table update with error handling
  const updateTableCustomers = async (tableId: string, newCount: number) => {
    try {
      const { error } = await supabase
        .from("restaurant_tables")
        .update({ current_customers: newCount })
        .eq("id", tableId)
        .eq("restaurant_id", restaurantId!);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["waiter-tables", restaurantId] });
    } catch (err: any) {
      toast.error("আপডেট ব্যর্থ হয়েছে: " + err.message);
    }
  };

  const pendingCount = orders.filter((o: any) => o.status === "pending").length;
  const preparingCount = orders.filter((o: any) => o.status === "preparing").length;
  const servedCount = orders.filter((o: any) => o.status === "served").length;

  const timeAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return "এইমাত্র";
    if (diff < 60) return `${diff} মিনিট আগে`;
    return `${Math.floor(diff / 60)} ঘন্টা আগে`;
  };

  const staffName = profileName || user?.email || "আপনি";
  const staffInitial = staffName.charAt(0).toUpperCase();

  return (
    <DashboardLayout role="waiter" title="ওয়েটার ড্যাশবোর্ড">
      <div className="space-y-5 animate-fade-up">

        {/* ── Header ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab("profile")}
              className="w-10 h-10 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold text-lg shadow-lg shadow-primary/20 hover:scale-105 transition-all"
            >
              {staffInitial}
            </button>
            <div>
              <p className="font-semibold text-foreground text-sm">{staffName}</p>
              <p className="text-xs text-muted-foreground">ওয়েটার</p>
            </div>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2.5 rounded-xl transition-all ${soundEnabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* ✅ FIX Bug 1: Notification Orders (waiter call / bill) আলাদা banner */}
        {notifOrders.length > 0 && (
          <div className="space-y-2">
            {notifOrders.map((n: any) => (
              <div key={n.id} className="flex items-center gap-3 p-3 rounded-xl bg-warning/10 border border-warning/30 animate-fade-in">
                <Bell className="w-4 h-4 text-warning flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{n.note}</p>
                  <p className="text-xs text-warning/90 capitalize">{n.request_type?.replace("_", " ")}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                </div>
                <button
                  onClick={() => handleServiceRequest(n.id)}
                  disabled={handlingRequestId === n.id}
                  className="text-xs px-2.5 py-1 rounded-lg bg-warning/20 text-warning font-semibold hover:bg-warning/30 transition-colors flex-shrink-0 disabled:opacity-50"
                >
                  ✓ Done
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab Navigation ── */}
        <div className="flex gap-1 p-1 bg-secondary/50 rounded-xl">
          {[
            { key: "orders", label: `অর্ডার${pendingCount > 0 ? ` (${pendingCount})` : ""}`, icon: ShoppingCart },
            { key: "tables", label: "টেবিল", icon: Users },
            { key: "profile", label: "প্রোফাইল", icon: User },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === key
                  ? "gradient-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: ShoppingCart, color: "text-primary",  value: orders.length, label: "মোট অর্ডার" },
            { icon: Clock,        color: "text-warning",  value: pendingCount,  label: "পেন্ডিং" },
            { icon: CheckCircle,  color: "text-info",     value: preparingCount, label: "প্রস্তুত হচ্ছে" },
            { icon: CheckCircle,  color: "text-success",  value: servedCount,   label: "সার্ভ করা" },
          ].map(({ icon: Icon, color, value, label }) => (
            <div key={label} className="stat-card text-center p-3 sm:p-4">
              <Icon className={`w-5 h-5 ${color} mx-auto mb-1.5`} />
              <p className="text-xl sm:text-2xl font-display font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Orders Tab ── */}
        {activeTab === "orders" && (
          <div>
            <h2 className="text-base sm:text-lg font-display font-semibold text-foreground mb-3">অ্যাক্টিভ অর্ডার</h2>
            {orders.length === 0 ? (
              <div className="text-center py-12 bg-secondary/20 rounded-2xl border border-border/30">
                <ShoppingCart className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">কোনো অ্যাক্টিভ অর্ডার নেই</p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order: any) => (
                  <Card key={order.id} className={`border-l-4 ${
                    order.status === "pending"   ? "border-l-destructive" :
                    order.status === "preparing" ? "border-l-warning" : "border-l-success"
                  }`}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            order.status === "pending"   ? "bg-destructive/10 text-destructive" :
                            order.status === "preparing" ? "bg-warning/10 text-warning" : "bg-success/10 text-success"
                          }`}>
                            {order.status === "pending" ? "⏳ পেন্ডিং" : order.status === "preparing" ? "👨‍🍳 প্রস্তুত হচ্ছে" : "✅ সার্ভ করা"}
                          </span>
                          <h3 className="font-display font-semibold text-foreground text-sm">#{order.id.slice(0, 6)}</h3>
                          <span className="text-xs text-muted-foreground">• {order.restaurant_tables?.name || "N/A"}</span>
                          {order.table_seats?.seat_number && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                              সিট {order.table_seats.seat_number}
                            </span>
                          )}
                          {order.payment_status === "paid" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">
                              💰 {order.payment_method === "bkash" ? "bKash" : "Cash"}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 flex-shrink-0">
                          <Clock className="w-2.5 h-2.5" /> {timeAgo(order.created_at)}
                        </p>
                      </div>

                      {order.notes && (
                        <div className="mb-2 px-2 py-1 rounded-lg bg-warning/10 border border-warning/20 text-xs text-warning">
                          📝 {order.notes}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1 mb-3">
                        {order.order_items?.map((item: any, i: number) => (
                          <span key={i} className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border/30">
                            {item.name} ×{item.quantity}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <p className="text-sm font-bold text-foreground">৳{order.total || 0}</p>
                        <div className="flex gap-1.5 flex-wrap">
                          <Button size="sm" variant="outline" className="h-7 sm:h-8 px-2 sm:px-3 text-xs" onClick={() => openEditOrder(order)}>
                            <Edit className="w-3 h-3" /><span className="hidden sm:inline ml-1">এডিট</span>
                          </Button>
                          {order.status === "pending" && (
                            <Button size="sm" variant="hero" className="h-7 sm:h-8 px-2 sm:px-3 text-xs"
                              onClick={() => updateStatus.mutate({ id: order.id, status: "preparing", restaurantId: restaurantId! })}>
                              গ্রহণ
                            </Button>
                          )}
                          {order.status === "preparing" && (
                            <Button size="sm" variant="default" className="h-7 sm:h-8 px-2 sm:px-3 text-xs"
                              onClick={() => updateStatus.mutate({ id: order.id, status: "served", restaurantId: restaurantId! })}>
                              সার্ভ
                            </Button>
                          )}
                          {/* ✅ FIX Bug 2: served + unpaid → বিল button */}
                          {order.status === "served" && order.payment_status !== "paid" && (
                            <Button size="sm" className="h-7 sm:h-8 px-2 sm:px-3 text-xs bg-success hover:bg-success/90 text-white"
                              onClick={() => { setPaymentOrder(order); setPaymentMethod("cash"); }}>
                              <Banknote className="w-3 h-3" /><span className="ml-1">বিল</span>
                            </Button>
                          )}
                          {/* ✅ FIX Bug 2: served + paid → paymentMutation এই completed করেছে, এখানে কিছু দরকার নেই */}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Tables Tab ── */}
        {activeTab === "tables" && (
          <div>
            <h2 className="text-base sm:text-lg font-display font-semibold text-foreground mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" /> টেবিল ওভারভিউ
            </h2>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
              {tables.map((table: any) => {
                const hasCustomers = (table.current_customers || 0) > 0;
                return (
                  <div key={table.id}
                    className={`rounded-xl border p-2 sm:p-3 text-center transition-all ${
                      hasCustomers ? "border-primary/40 bg-primary/5" : "border-border/40 bg-secondary/30"
                    }`}>
                    <p className="font-display font-bold text-foreground text-xs sm:text-sm">{table.name}</p>
                    <p className={`text-base sm:text-lg font-bold leading-tight ${hasCustomers ? "text-primary" : "text-muted-foreground"}`}>
                      👤 {table.current_customers || 0}
                    </p>
                    <p className="text-[9px] sm:text-[10px] text-muted-foreground">{table.seats} সিট</p>
                    {/* ✅ FIX Bug 4: error handling যোগ করা হলো */}
                    <div className="flex items-center justify-center gap-1 mt-1.5">
                      <button
                        onClick={() => updateTableCustomers(
                          table.id,
                          Math.max(0, (table.current_customers || 0) - 1)
                        )}
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-card border border-border flex items-center justify-center hover:bg-accent active:scale-90 transition-all"
                      ><UserMinus className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-destructive" /></button>
                      <button
                        onClick={() => updateTableCustomers(
                          table.id,
                          Math.min(table.seats, (table.current_customers || 0) + 1)
                        )}
                        className="w-5 h-5 sm:w-6 sm:h-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center active:scale-90 transition-all"
                      ><UserPlus className="w-2.5 h-2.5 sm:w-3 sm:h-3" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Profile Tab ── */}
        {activeTab === "profile" && (
          <div className="space-y-4 max-w-md">
            <h2 className="text-base sm:text-lg font-display font-semibold text-foreground">আমার প্রোফাইল</h2>
            <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-2xl border border-border/30">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-lg shadow-primary/20">
                {staffInitial}
              </div>
              <div>
                <p className="font-bold text-foreground text-lg">{profileName || "নাম নেই"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold mt-1 inline-block">ওয়েটার</span>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border/30 overflow-hidden">
              <div className="p-4 border-b border-border/20">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> ব্যক্তিগত তথ্য
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">পুরো নাম</Label>
                  <Input value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="আপনার নাম" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">ইমেইল</Label>
                  <div className="flex items-center gap-2 h-9 px-3 rounded-md bg-secondary/50 border border-border/50">
                    <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{user?.email}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">ফোন নম্বর</Label>
                  <Input value={profilePhone} onChange={e => setProfilePhone(e.target.value)} placeholder="+880 1XXX XXXXXX" className="h-9 text-sm" />
                </div>
                <Button variant="hero" className="w-full h-9 text-sm" onClick={saveProfile} disabled={savingProfile}>
                  <Save className="w-3.5 h-3.5" />
                  {savingProfile ? "সেভ হচ্ছে..." : "প্রোফাইল সেভ করুন"}
                </Button>
              </div>
            </div>
            <div className="bg-card rounded-2xl border border-border/30 overflow-hidden">
              <div className="p-4 border-b border-border/20">
                <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" /> পাসওয়ার্ড পরিবর্তন
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">নতুন পাসওয়ার্ড</Label>
                  <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="ন্যূনতম ৬ অক্ষর" className="h-9 text-sm" />
                </div>
                <Button variant="outline" className="w-full h-9 text-sm" onClick={changePassword} disabled={changingPassword || !newPassword}>
                  <KeyRound className="w-3.5 h-3.5" />
                  {changingPassword ? "পরিবর্তন হচ্ছে..." : "পাসওয়ার্ড পরিবর্তন করুন"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Payment Dialog ── */}
      <Dialog open={!!paymentOrder} onOpenChange={() => setPaymentOrder(null)}>
        <DialogContent className="max-w-sm mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="font-display">💰 বিল পরিশোধ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-secondary/50 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">অর্ডার</span>
                <span className="font-medium">#{paymentOrder?.id?.slice(0, 6)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">টেবিল</span>
                <span className="font-medium">{paymentOrder?.restaurant_tables?.name || "N/A"}</span>
              </div>
              <div className="flex justify-between text-sm gap-4">
                <span className="text-muted-foreground flex-shrink-0">আইটেম</span>
                <span className="font-medium text-right text-xs">
                  {paymentOrder?.order_items?.map((i: any) => `${i.name} x${i.quantity}`).join(", ")}
                </span>
              </div>
              {paymentOrder?.notes && (
                <div className="text-xs text-warning border-t border-border pt-2">
                  📝 {paymentOrder.notes}
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between">
                <span className="font-bold">মোট</span>
                <span className="font-bold text-xl text-primary">৳{paymentOrder?.total || 0}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setPaymentMethod("cash")}
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === "cash" ? "border-primary bg-primary/10" : "border-border bg-secondary/30"}`}>
                <Banknote className={`w-6 h-6 ${paymentMethod === "cash" ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${paymentMethod === "cash" ? "text-primary" : "text-muted-foreground"}`}>ক্যাশ</span>
              </button>
              <button onClick={() => setPaymentMethod("bkash")}
                className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === "bkash" ? "border-pink-500 bg-pink-500/10" : "border-border bg-secondary/30"}`}>
                <Smartphone className={`w-6 h-6 ${paymentMethod === "bkash" ? "text-pink-500" : "text-muted-foreground"}`} />
                <span className={`text-sm font-medium ${paymentMethod === "bkash" ? "text-pink-500" : "text-muted-foreground"}`}>bKash</span>
              </button>
            </div>
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
              <p className="text-xs text-muted-foreground">পেমেন্ট গ্রহণকারী</p>
              <p className="text-sm font-bold">👤 {staffName}</p>
            </div>
            <Button variant="hero" className="w-full h-11"
              onClick={() => completePayment.mutate({
                orderId: paymentOrder.id,
                method: paymentMethod,
                staffId: user?.id ?? "",
                staffName: profileName || user?.email || "Unknown",
                restaurantId: restaurantId!,
              }, { onSuccess: () => setPaymentOrder(null) })}
              disabled={completePayment.isPending}>
              {completePayment.isPending ? "প্রসেস হচ্ছে..." : `✅ ${paymentMethod === "bkash" ? "bKash" : "ক্যাশ"} কনফার্ম`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Edit Order Dialog ── */}
      <Dialog open={!!editOrder} onOpenChange={() => setEditOrder(null)}>
        <DialogContent className="mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-sm sm:text-base">অর্ডার এডিট — #{editOrder?.id?.slice(0, 6)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {editItems.map((item, idx) => (
              <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border border-border/30 ${item.quantity === 0 ? "opacity-40 bg-destructive/5" : "bg-secondary/50"}`}>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-xs sm:text-sm truncate">{item.name}</p>
                  <p className="text-[10px] text-muted-foreground">৳{item.price}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => updateItemQty(idx, -1)} className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center hover:bg-accent active:scale-90">
                    {item.quantity <= 1 ? <X className="w-3 h-3 text-destructive" /> : <Minus className="w-3 h-3" />}
                  </button>
                  <span className="w-6 text-center font-bold text-xs text-foreground">{item.quantity}</span>
                  <button onClick={() => updateItemQty(idx, 1)} className="w-7 h-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center active:scale-90">
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-xs font-bold text-foreground w-14 text-right">৳{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-3 flex justify-between items-center">
            <span className="font-bold text-sm">মোট: ৳{editItems.filter(i => i.quantity > 0).reduce((s, i) => s + i.price * i.quantity, 0)}</span>
            <Button variant="hero" size="sm" onClick={() => saveOrderEdit.mutate(
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

export default WaiterDashboard;
