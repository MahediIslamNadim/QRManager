import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrderActions } from "@/hooks/useOrderActions";
import { useRestaurantBranding } from "@/hooks/useRestaurantBranding";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChefHat, Clock, RefreshCw, User, LogOut, Save, KeyRound, X, Phone, Mail } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface KitchenOrder {
  id: string;
  status: string;
  created_at: string;
  restaurant_tables: { name: string } | null;
  order_items: OrderItem[];
}

const statusLabel: Record<string, string> = {
  pending: "নতুন",
  preparing: "রান্না হচ্ছে",
};

const statusColor: Record<string, { bg: string; border: string; badge: string; badgeText: string }> = {
  pending: {
    bg: "bg-warning/10",
    border: "border-warning/60",
    badge: "bg-warning text-warning-foreground",
    badgeText: "text-warning-foreground",
  },
  preparing: {
    bg: "bg-primary/10",
    border: "border-primary/60",
    badge: "bg-primary text-primary-foreground",
    badgeText: "text-primary-foreground",
  },
};

function timeAgo(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diff < 1) return "এইমাত্র";
  if (diff < 60) return `${diff} মিনিট আগে`;
  return `${Math.floor(diff / 60)} ঘন্টা আগে`;
}

function elapsed(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  return diff;
}

const KitchenDisplay = () => {
  const { restaurantId, user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const kitchenQueryKey = ["kitchen-orders", restaurantId];
  const branding = useRestaurantBranding(restaurantId);
  const { logoUrl, restaurantName, isHighSmart } = branding;
  const { updateStatus } = useOrderActions([kitchenQueryKey]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [, setNow] = useState(Date.now());
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // Profile panel state
  const [showProfile, setShowProfile] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Load profile
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfileName(data.full_name || "");
          setProfilePhone((data as any).phone || "");
        }
      });
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase.from("profiles")
        .update({ full_name: profileName, phone: profilePhone })
        .eq("id", user.id);
      if (error) throw error;
      toast.success("প্রোফাইল সেভ হয়েছে ✅");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে");
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

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  const staffName = profileName || user?.email || "কিচেন স্টাফ";
  const staffInitial = staffName.charAt(0).toUpperCase();

  // Auto refresh every 10 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: kitchenQueryKey });
      setLastUpdate(new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, queryClient]);

  // Tick every minute to re-render elapsed times
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(t);
  }, []);

  const { data: orders = [], isLoading } = useQuery<KitchenOrder[]>({
    queryKey: ["kitchen-orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, created_at, restaurant_tables(name), order_items(name, quantity, price)")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "preparing"])
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as KitchenOrder[];
    },
    enabled: !!restaurantId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!restaurantId) return;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    const ch = supabase
      .channel(`kitchen-display-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurantId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["kitchen-orders", restaurantId] });
        }
      )
      .subscribe();
    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [restaurantId, queryClient]);

  const markPreparing = (orderId: string) =>
    updateStatus.mutate({ id: orderId, status: "preparing", restaurantId: restaurantId! });

  const markServed = (orderId: string) =>
    updateStatus.mutate({ id: orderId, status: "served", restaurantId: restaurantId! });

  const pending = orders.filter(o => o.status === "pending");
  const preparing = orders.filter(o => o.status === "preparing");

  return (
    <div className="min-h-screen bg-[#0f1117] text-white flex flex-col">

      {/* ── Profile Slide-out Panel ── */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowProfile(false)} />
          {/* Panel */}
          <div className="relative ml-auto w-full max-w-sm bg-[#16181f] border-l border-white/10 flex flex-col h-full shadow-2xl animate-slide-in-right">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-500/20 flex items-center justify-center text-orange-400 font-bold text-lg">
                  {staffInitial}
                </div>
                <div>
                  <p className="font-semibold text-white text-sm">{staffName}</p>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 font-semibold">কিচেন</span>
                </div>
              </div>
              <button onClick={() => setShowProfile(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                <X className="w-4 h-4 text-white/50" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Email display */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/5 border border-white/10">
                <Mail className="w-4 h-4 text-white/30" />
                <span className="text-sm text-white/50">{user?.email}</span>
              </div>

              {/* Edit name */}
              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase tracking-wider">পুরো নাম</label>
                <input
                  value={profileName}
                  onChange={e => setProfileName(e.target.value)}
                  placeholder="আপনার নাম"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              {/* Edit phone */}
              <div className="space-y-2">
                <label className="text-xs text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3 h-3" /> ফোন নম্বর
                </label>
                <input
                  value={profilePhone}
                  onChange={e => setProfilePhone(e.target.value)}
                  placeholder="+880 1XXX XXXXXX"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <button
                onClick={saveProfile}
                disabled={savingProfile}
                className="w-full py-2.5 rounded-xl bg-orange-500 hover:bg-orange-500/90 text-white font-semibold text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="w-4 h-4" />
                {savingProfile ? "সেভ হচ্ছে..." : "প্রোফাইল সেভ করুন"}
              </button>

              {/* Divider */}
              <div className="border-t border-white/10 pt-1">
                <p className="text-xs text-white/30 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3" /> পাসওয়ার্ড পরিবর্তন
                </p>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="নতুন পাসওয়ার্ড (ন্যূনতম ৬ অক্ষর)"
                  className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/20 focus:outline-none focus:border-orange-500/50 mb-2"
                />
                <button
                  onClick={changePassword}
                  disabled={changingPassword || !newPassword}
                  className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  <KeyRound className="w-4 h-4" />
                  {changingPassword ? "পরিবর্তন হচ্ছে..." : "পাসওয়ার্ড পরিবর্তন করুন"}
                </button>
              </div>
            </div>

            {/* Logout */}
            <div className="p-5 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-semibold text-sm transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                অ্যাকাউন্ট পরিবর্তন / লগআউট
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#16181f]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center overflow-hidden flex-shrink-0">
            {isHighSmart && logoUrl
              ? <img src={logoUrl} alt={restaurantName} className="w-full h-full object-contain p-1" />
              : <ChefHat className="w-5 h-5 text-primary" />
            }
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">
              {isHighSmart && restaurantName ? restaurantName : "কিচেন ডিসপ্লে"}
            </h1>
            <p className="text-[11px] text-white/40">Kitchen Display System</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <div className="text-xs text-white/40 hidden sm:block">
              শেষ আপডেট: {lastUpdate}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                autoRefresh
                  ? 'bg-success/20 text-success border border-success/30'
                  : 'bg-white/10 text-white/50 border border-white/10'
              }`}
            >
              {autoRefresh ? '✓ অটো' : 'অটো বন্ধ'}
            </button>
            <div className="hidden sm:flex items-center gap-2 text-sm text-white/60">
              <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
              <span>{pending.length} নতুন</span>
              <span className="mx-1 text-white/20">·</span>
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span>{preparing.length} রান্না হচ্ছে</span>
            </div>
          </div>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: kitchenQueryKey });
              setLastUpdate(new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
              toast.success('রিফ্রেশ করা হয়েছে!');
            }}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <RefreshCw className="w-4 h-4 text-white/50" />
          </button>
          {/* Profile button */}
          <button
            onClick={() => setShowProfile(true)}
            className="w-9 h-9 rounded-xl bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 flex items-center justify-center text-orange-400 font-bold text-sm transition-all"
            title="প্রোফাইল / অ্যাকাউন্ট"
          >
            {staffInitial}
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 p-4 sm:p-6 overflow-auto">
        {isLoading && (
          <div className="flex items-center justify-center h-64 text-white/40">লোড হচ্ছে...</div>
        )}

        {!isLoading && orders.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <ChefHat className="w-16 h-16 text-white/10" />
            <p className="text-white/30 text-lg">কোনো অর্ডার নেই</p>
            <p className="text-white/20 text-sm">নতুন অর্ডার আসলে এখানে দেখাবে</p>
          </div>
        )}

        {/* Two column layout: pending | preparing */}
        {orders.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 items-start">

            {/* Pending column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full bg-warning" />
                <h2 className="font-bold text-warning text-base">নতুন অর্ডার ({pending.length})</h2>
              </div>
              <div className="space-y-3">
                {pending.length === 0 && (
                  <div className="rounded-2xl border border-white/10 p-6 text-center text-white/30 text-sm">
                    কোনো নতুন অর্ডার নেই
                  </div>
                )}
                {pending.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    colors={statusColor.pending}
                    primaryAction={{ label: "রান্না শুরু করুন →", onClick: () => markPreparing(order.id) }}
                    disabled={updateStatus.isPending}
                  />
                ))}
              </div>
            </div>

            {/* Preparing column */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full bg-primary" />
                <h2 className="font-bold text-primary text-base">রান্না হচ্ছে ({preparing.length})</h2>
              </div>
              <div className="space-y-3">
                {preparing.length === 0 && (
                  <div className="rounded-2xl border border-white/10 p-6 text-center text-white/30 text-sm">
                    রান্না চলছে না এখন
                  </div>
                )}
                {preparing.map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    colors={statusColor.preparing}
                    primaryAction={{ label: "✓ সার্ভ করুন", onClick: () => markServed(order.id), green: true }}
                    disabled={updateStatus.isPending}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

interface OrderCardProps {
  order: KitchenOrder;
  colors: typeof statusColor.pending;
  primaryAction: { label: string; onClick: () => void; green?: boolean };
  disabled?: boolean;
}

const OrderCard = ({ order, colors, primaryAction, disabled = false }: OrderCardProps) => {
  const mins = elapsed(order.created_at);
  const urgent = mins >= 10;

  return (
    <div className={`rounded-2xl border-2 ${colors.border} ${colors.bg} p-4 flex flex-col gap-3`}>
      {/* Top row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-display font-black text-white text-xl">
            #{order.id.slice(0, 5).toUpperCase()}
          </span>
          <span className="text-sm font-semibold text-white/60 bg-white/10 px-2 py-0.5 rounded-lg">
            {order.restaurant_tables?.name || "N/A"}
          </span>
        </div>
        <div className={`flex items-center gap-1 text-sm font-semibold ${urgent ? "text-red-400 animate-pulse" : "text-white/50"}`}>
          <Clock className="w-4 h-4" />
          {mins < 1 ? "এইমাত্র" : `${mins} মিনিট`}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-1.5">
        {(order.order_items || []).map((item, idx) => (
          <div key={idx} className="flex items-center justify-between">
            <span className="text-white font-medium text-sm">{item.name}</span>
            <span className="text-white/70 font-bold text-base bg-white/10 px-2.5 py-0.5 rounded-lg">
              ×{item.quantity}
            </span>
          </div>
        ))}
        {(!order.order_items || order.order_items.length === 0) && (
          <p className="text-white/30 text-sm">কোনো আইটেম নেই</p>
        )}
      </div>

      {/* Action button */}
      <button
        onClick={primaryAction.onClick}
        disabled={disabled}
        className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 ${
          primaryAction.green
            ? "bg-success hover:bg-success/90 text-white"
            : "bg-warning hover:bg-warning/90 text-warning-foreground"
        }`}
      >
        {primaryAction.label}
      </button>
    </div>
  );
};

export default KitchenDisplay;
