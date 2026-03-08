import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Clock, CheckCircle, ChefHat } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const statusFilters = ["সব", "পেন্ডিং", "প্রস্তুত হচ্ছে", "সার্ভ করা হয়েছে", "সম্পন্ন"];
const statusMap: Record<string, string> = {
  "সব": "all", "পেন্ডিং": "pending", "প্রস্তুত হচ্ছে": "preparing", "সার্ভ করা হয়েছে": "served", "সম্পন্ন": "completed"
};

const AdminOrders = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState("সব");

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("orders")
        .select("*, restaurant_tables(name), order_items(name, quantity, price)")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!restaurantId,
    refetchInterval: 5000,
  });

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
    const map: Record<string, string> = { pending: "পেন্ডিং", preparing: "প্রস্তুত হচ্ছে", served: "সার্ভ করা হয়েছে", completed: "সম্পন্ন", cancelled: "বাতিল" };
    return map[s] || s;
  };

  const nextStatus = (s: string) => {
    const flow: Record<string, string> = { pending: "preparing", preparing: "served", served: "completed" };
    return flow[s];
  };

  const timeAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
    if (diff < 1) return "এইমাত্র";
    if (diff < 60) return `${diff} মিনিট আগে`;
    return `${Math.floor(diff / 60)} ঘন্টা আগে`;
  };

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
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-display font-semibold text-foreground text-lg">#{order.id.slice(0, 6)}</h3>
                          <span className="text-sm text-muted-foreground">{order.restaurant_tables?.name || "N/A"}</span>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-2">
                          {order.order_items?.map((item: any, i: number) => (
                            <span key={i} className="text-xs px-2 py-1 rounded-md bg-secondary text-secondary-foreground">
                              {item.name} x{item.quantity}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{timeAgo(order.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 sm:flex-col sm:items-end">
                      <span className="text-xl font-bold text-foreground">৳{order.total}</span>
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${getStatusStyle(order.status)}`}>
                        {getStatusIcon(order.status)} {getStatusLabel(order.status)}
                      </span>
                      {nextStatus(order.status) && (
                        <Button size="sm" variant="hero" onClick={() => updateStatus.mutate({ id: order.id, status: nextStatus(order.status)! })}>
                          {nextStatus(order.status) === "preparing" ? "গ্রহণ করুন" : nextStatus(order.status) === "served" ? "সার্ভ করুন" : "সম্পন্ন করুন"}
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
    </DashboardLayout>
  );
};

export default AdminOrders;
