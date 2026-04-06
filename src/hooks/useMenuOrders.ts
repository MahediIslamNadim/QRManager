import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  total: number;
  status: string;
  created_at?: string;
  items: OrderItem[];
}

const ACTIVE_STATUSES = ["pending", "confirmed", "preparing", "ready"];

export const isNotificationOrder = (order: Order) =>
  order.total === 0 && order.items.length === 0;

interface UseMenuOrdersOptions {
  restaurantId: string | undefined;
  tableId: string | null;
  seatId: string | null;
  sessionToken: string | null;
  isDemo: boolean;
  tokenValid: boolean;
  tableChecked: boolean;
  onRatingRequest: (orderId: string) => void;
}

interface UseMenuOrdersResult {
  myOrders: Order[];
  setMyOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  ordersLoading: boolean;
  activeOrdersCount: number;
  submitOrder: (args: {
    restaurantId: string;
    tableId: string | null;
    seatId: string | null;
    sessionToken: string;
    cart: Array<{ id: string; quantity: number; name: string; price: number }>;
    specialNote: string;
  }) => Promise<{ orderId: string; confirmedTotal: number } | null>;
  callWaiter: (args: {
    restaurantId: string;
    tableId: string | null;
    seatId: string | null;
    sessionToken: string;
    tableName: string;
    seatNumber: number | null;
  }) => Promise<void>;
  requestBill: (args: {
    restaurantId: string;
    tableId: string | null;
    seatId: string | null;
    sessionToken: string;
    tableName: string;
    seatNumber: number | null;
  }) => Promise<void>;
}

/**
 * Manages order list state, realtime subscription, and customer order actions.
 * Extracted from CustomerMenu so that component is not responsible for data logic.
 */
export function useMenuOrders({
  restaurantId,
  tableId,
  seatId,
  isDemo,
  tokenValid,
  tableChecked,
  onRatingRequest,
}: UseMenuOrdersOptions): UseMenuOrdersResult {
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const fetchOrderItems = useCallback(async (orderId: string): Promise<OrderItem[]> => {
    const { data } = await supabase
      .from("order_items")
      .select("id, name, price, quantity")
      .eq("order_id", orderId);
    return (data as OrderItem[]) || [];
  }, []);

  const fetchExistingOrders = useCallback(async () => {
    if (isDemo || !tableId || !restaurantId) return;
    setOrdersLoading(true);
    try {
      let query = supabase
        .from("orders")
        .select("id, total, status, created_at")
        .eq("restaurant_id", restaurantId)
        .eq("table_id", tableId)
        .in("status", ACTIVE_STATUSES)
        .gt("total", 0)
        .order("created_at", { ascending: false })
        .limit(10);

      if (seatId) query = query.eq("seat_id", seatId);

      const { data: ordersData, error } = await query;
      if (error || !ordersData) return;

      const orderIds = ordersData.map(o => o.id);
      const { data: itemsData } = await supabase
        .from("order_items")
        .select("id, name, price, quantity, order_id")
        .in("order_id", orderIds);

      setMyOrders(
        ordersData.map(order => ({
          ...order,
          items: (itemsData || []).filter((i: any) => i.order_id === order.id) as OrderItem[],
        })),
      );
    } catch {
      // silently fail — non-critical
    } finally {
      setOrdersLoading(false);
    }
  }, [isDemo, tableId, restaurantId, seatId]);

  // Initial load
  useEffect(() => {
    if (tableChecked && tokenValid) {
      fetchExistingOrders();
    }
  }, [tableChecked, tokenValid, fetchExistingOrders]);

  // Realtime subscription
  useEffect(() => {
    if (!tableId || !restaurantId || isDemo) return;

    const statusMessages: Record<string, string> = {
      confirmed: "✅ রান্নাঘর অর্ডার accept করেছে!",
      preparing: "🍳 আপনার খাবার রান্না হচ্ছে...",
      ready: "🛎️ খাবার ready! ওয়েটার আসছে।",
      delivered: "🎉 খাবার পৌঁছে গেছে! ধন্যবাদ।",
      cancelled: "❌ দুঃখিত, অর্ডারটি বাতিল হয়েছে।",
    };

    const channel = supabase
      .channel(`orders-realtime-${tableId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "orders",
        filter: `table_id=eq.${tableId}`,
      }, async (payload) => {
        const newOrder = payload.new as any;
        if (!ACTIVE_STATUSES.includes(newOrder.status)) return;
        if (newOrder.total === 0) return;
        if (seatId && newOrder.seat_id && newOrder.seat_id !== seatId) return;
        const items = await fetchOrderItems(newOrder.id);
        setMyOrders(prev => {
          if (prev.find(o => o.id === newOrder.id)) return prev;
          return [{ ...newOrder, items }, ...prev];
        });
      })
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "orders",
        filter: `table_id=eq.${tableId}`,
      }, async (payload) => {
        const updated = payload.new as any;
        if (updated.total === 0) return;
        if (seatId && updated.seat_id && updated.seat_id !== seatId) return;

        setMyOrders(prev => {
          const exists = prev.find(o => o.id === updated.id);
          if (exists) {
            return prev.map(o => o.id === updated.id ? { ...o, status: updated.status } : o);
          } else if (ACTIVE_STATUSES.includes(updated.status)) {
            fetchOrderItems(updated.id).then(items => {
              setMyOrders(p => {
                if (p.find(o => o.id === updated.id)) return p;
                return [{ ...updated, items }, ...p];
              });
            });
            return prev;
          }
          return prev;
        });

        if (statusMessages[updated.status]) {
          toast(statusMessages[updated.status], { duration: 5000 });
        }

        if (["served", "completed"].includes(updated.status)) {
          const ratedKey = `rated_${updated.id}`;
          if (!localStorage.getItem(ratedKey)) {
            setTimeout(() => onRatingRequest(updated.id), 1500);
          }
          setTimeout(() => {
            setMyOrders(prev => prev.filter(o => o.id !== updated.id));
          }, 60000);
        }

        if (["delivered", "cancelled"].includes(updated.status)) {
          setTimeout(() => {
            setMyOrders(prev => prev.filter(o => o.id !== updated.id));
          }, 30000);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [tableId, restaurantId, isDemo, seatId, fetchOrderItems, onRatingRequest]);

  const activeOrdersCount = myOrders.filter(
    o => ACTIVE_STATUSES.includes(o.status) && !isNotificationOrder(o),
  ).length;

  const submitOrder: UseMenuOrdersResult["submitOrder"] = async ({
    restaurantId: rId, tableId: tId, seatId: sId, sessionToken, cart, specialNote,
  }) => {
    const { data: result, error: orderErr } = await supabase.rpc(
      "insert_order_with_token" as any,
      {
        p_restaurant_id: rId,
        p_table_id: tId ?? null,
        p_seat_id: sId ?? null,
        p_notes: specialNote.trim() || null,
        p_token: sessionToken,
        p_items: cart.map(c => ({ menu_item_id: c.id, quantity: c.quantity })),
      } as any,
    );
    if (orderErr) throw orderErr;

    const orderId = (result as any)?.order_id as string;
    const confirmedTotal = (result as any)?.computed_total as number;

    const localItems: OrderItem[] = cart.map(c => ({
      id: c.id, name: c.name, price: c.price, quantity: c.quantity,
    }));
    setMyOrders(prev => [{
      id: orderId, total: confirmedTotal, status: "pending",
      created_at: new Date().toISOString(), items: localItems,
    }, ...prev]);

    return { orderId, confirmedTotal };
  };

  const callWaiter: UseMenuOrdersResult["callWaiter"] = async ({
    restaurantId: rId, tableId: tId, seatId: sId, sessionToken, tableName, seatNumber,
  }) => {
    const { error } = await supabase.rpc("create_service_request" as any, {
      p_restaurant_id: rId,
      p_table_id: tId ?? null,
      p_seat_id: sId ?? null,
      p_notes: `🔔 ওয়েটার ডাকা হয়েছে — টেবিল ${tableName}${seatNumber ? `, সিট ${seatNumber}` : ""}`,
      p_token: sessionToken,
      p_type: "waiter_call",
    } as any);
    if (error) throw error;
  };

  const requestBill: UseMenuOrdersResult["requestBill"] = async ({
    restaurantId: rId, tableId: tId, seatId: sId, sessionToken, tableName, seatNumber,
  }) => {
    const { error } = await supabase.rpc("create_service_request" as any, {
      p_restaurant_id: rId,
      p_table_id: tId ?? null,
      p_seat_id: sId ?? null,
      p_notes: `🧾 বিল চাই — টেবিল ${tableName}${seatNumber ? `, সিট ${seatNumber}` : ""}`,
      p_token: sessionToken,
      p_type: "bill_request",
    } as any);
    if (error) throw error;
  };

  return {
    myOrders,
    setMyOrders,
    ordersLoading,
    activeOrdersCount,
    submitOrder,
    callWaiter,
    requestBill,
  };
}
