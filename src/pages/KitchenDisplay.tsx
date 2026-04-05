import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrderActions } from "@/hooks/useOrderActions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChefHat, Clock, CheckCircle2, RefreshCw } from "lucide-react";

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
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const kitchenQueryKey = ["kitchen-orders", restaurantId];
  const { updateStatus } = useOrderActions([kitchenQueryKey]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [now, setNow] = useState(Date.now());

  // Tick every minute to update elapsed times
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
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-white/10 bg-[#16181f]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight">কিচেন ডিসপ্লে</h1>
            <p className="text-[11px] text-white/40">Kitchen Display System</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <span className="w-2 h-2 rounded-full bg-warning animate-pulse" />
            <span>{pending.length} নতুন</span>
            <span className="mx-1 text-white/20">·</span>
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span>{preparing.length} রান্না হচ্ছে</span>
          </div>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ["kitchen-orders", restaurantId] })}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="রিফ্রেশ"
          >
            <RefreshCw className="w-4 h-4 text-white/50" />
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
                    now={now}
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
                    now={now}
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
  now: number;
  primaryAction: { label: string; onClick: () => void; green?: boolean };
  disabled?: boolean;
}

const OrderCard = ({ order, colors, now: _now, primaryAction, disabled = false }: OrderCardProps) => {
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
