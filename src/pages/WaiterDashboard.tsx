import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Clock, CheckCircle, UserCheck, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const WaiterDashboard = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ["waiter-orders", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("orders")
        .select("*, restaurant_tables(name), order_items(name, quantity)")
        .eq("restaurant_id", restaurantId)
        .in("status", ["pending", "preparing"])
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!restaurantId,
    refetchInterval: 3000,
  });

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
                      <div className="flex gap-2">
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
    </DashboardLayout>
  );
};

export default WaiterDashboard;
