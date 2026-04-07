import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface SaveEditArgs {
  orderId: string;
  restaurantId: string;
  items: OrderItem[];
}

interface CompletePaymentArgs {
  orderId: string;
  method: "cash" | "bkash";
  staffId: string;
  staffName: string;
  restaurantId: string;
}

/**
 * useOrderActions — shared order business logic
 *
 * Consolidates three mutations that were duplicated across
 * AdminOrders, WaiterDashboard, and KitchenDisplay:
 *   - updateStatus   : advance an order through the status machine
 *   - completePayment: mark an order paid + completed with staff audit fields
 *   - saveOrderEdit  : diff item quantities, delete zeroes, recalc total
 *
 * @param invalidateKeys  One or more query cache keys to invalidate on success.
 *                        Each caller passes its own key so their list refreshes.
 */
export function useOrderActions(invalidateKeys: string[][]) {
  const queryClient = useQueryClient();

  const invalidateAll = () =>
    invalidateKeys.forEach(key => queryClient.invalidateQueries({ queryKey: key }));

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, restaurantId }: { id: string; status: string; restaurantId: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", id)
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("স্ট্যাটাস আপডেট হয়েছে");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const completePayment = useMutation({
    mutationFn: async ({ orderId, method, staffId, staffName, restaurantId }: CompletePaymentArgs) => {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "completed",
          payment_status: "paid",
          payment_method: method,
          paid_to_staff_id: staffId,
          paid_to_staff_name: staffName,
          paid_at: new Date().toISOString(),
        })
        .eq("id", orderId)
        .eq("restaurant_id", restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("✅ পেমেন্ট সম্পন্ন!");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveOrderEdit = useMutation({
    mutationFn: async ({ orderId, restaurantId, items }: SaveEditArgs) => {
      // Single atomic RPC: deletes zeroed items, updates quantities, recalculates total.
      // Replaces the previous three-step sequential approach which could leave partial writes.
      const { error } = await (supabase.rpc as any)("save_order_edit", {
        p_order_id: orderId,
        p_restaurant_id: restaurantId,
        p_items: items.map(i => ({ id: i.id, quantity: i.quantity })),
      });
      if (error) throw new Error(`অর্ডার আপডেট সমস্যা: ${error.message}`);
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("অর্ডার আপডেট হয়েছে");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { updateStatus, completePayment, saveOrderEdit };
}
