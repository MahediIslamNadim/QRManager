import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CreditCard, CheckCircle, XCircle, Clock, Loader2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface PaymentRequest {
  id: string;
  restaurant_id: string;
  user_id: string;
  plan: string;
  billing_cycle?: string;
  amount: number;
  payment_method: string;
  transaction_id: string;
  phone_number: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  restaurant_name?: string;
}

const SuperAdminPayments = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["all-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_requests" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const restIds = [...new Set((data || []).map((p: any) => p.restaurant_id))];
      const { data: restaurants } = await supabase
        .from("restaurants")
        .select("id, name")
        .in("id", restIds);
      
      const restMap = new Map((restaurants || []).map(r => [r.id, r.name]));
      return (data || []).map((p: any) => ({
        ...p,
        restaurant_name: restMap.get(p.restaurant_id) || "অজানা",
      })) as PaymentRequest[];
    },
  });

  const filtered = payments.filter(p =>
    p.transaction_id.toLowerCase().includes(search.toLowerCase()) ||
    (p.restaurant_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (p.phone_number || "").includes(search)
  );

  const approveMutation = useMutation({
    mutationFn: async ({ paymentId, restaurantId, plan, userId }: { paymentId: string; restaurantId: string; plan: string; userId: string }) => {
      const { error: payError } = await supabase
        .from("payment_requests" as any)
        .update({ status: "approved", admin_notes: adminNotes || null, updated_at: new Date().toISOString() } as any)
        .eq("id", paymentId);
      if (payError) throw payError;

      const { error: restError } = await supabase
        .from("restaurants")
        .update({ status: "active_paid", plan, updated_at: new Date().toISOString() })
        .eq("id", restaurantId);
      if (restError) throw restError;

      await supabase.from("notifications" as any).insert({
        user_id: userId,
        title: "পেমেন্ট অনুমোদিত ✅",
        message: `আপনার ${plan} প্ল্যানের পেমেন্ট অনুমোদিত হয়েছে। আপনার রেস্টুরেন্ট এখন সক্রিয়!`,
        type: "success",
      } as any);
    },
    onSuccess: () => {
      toast.success("পেমেন্ট অনুমোদিত এবং রেস্টুরেন্ট সক্রিয় করা হয়েছে!");
      setDialogOpen(false);
      setSelectedPayment(null);
      setAdminNotes("");
      queryClient.invalidateQueries({ queryKey: ["all-payments"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ paymentId, userId }: { paymentId: string; userId: string }) => {
      const { error } = await supabase
        .from("payment_requests" as any)
        .update({ status: "rejected", admin_notes: adminNotes || null, updated_at: new Date().toISOString() } as any)
        .eq("id", paymentId);
      if (error) throw error;

      await supabase.from("notifications" as any).insert({
        user_id: userId,
        title: "পেমেন্ট প্রত্যাখ্যাত ❌",
        message: `আপনার পেমেন্ট প্রত্যাখ্যাত হয়েছে।${adminNotes ? ` কারণ: ${adminNotes}` : " বিস্তারিত জানতে যোগাযোগ করুন।"}`,
        type: "error",
      } as any);
    },
    onSuccess: () => {
      toast.success("পেমেন্ট প্রত্যাখ্যান করা হয়েছে");
      setDialogOpen(false);
      setSelectedPayment(null);
      setAdminNotes("");
      queryClient.invalidateQueries({ queryKey: ["all-payments"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openReview = (p: PaymentRequest) => {
    setSelectedPayment(p);
    setAdminNotes(p.admin_notes || "");
    setDialogOpen(true);
  };

  const pendingCount = payments.filter(p => p.status === "pending").length;

  const getBillingLabel = (cycle?: string) => cycle === "yearly" ? "বার্ষিক" : "মাসিক";

  return (
    <DashboardLayout role="super_admin" title="পেমেন্ট ম্যানেজমেন্ট">
      <div className="space-y-6 animate-fade-up">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Transaction ID বা রেস্টুরেন্ট খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary/50" />
            </div>
            {pendingCount > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium bg-warning/10 text-warning">
                {pendingCount} পেন্ডিং
              </span>
            )}
          </div>
        </div>

        {isLoading && <p className="text-center text-muted-foreground py-8">লোড হচ্ছে...</p>}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm">রেস্টুরেন্ট</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm">প্ল্যান</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm hidden sm:table-cell">মাধ্যম</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm hidden md:table-cell">Transaction ID</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm">টাকা</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm">স্ট্যাটাস</th>
                    <th className="text-right p-4 font-medium text-muted-foreground text-sm">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && !isLoading && (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">কোনো পেমেন্ট রিকোয়েস্ট নেই</td></tr>
                  )}
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                            <CreditCard className="w-5 h-5 text-accent-foreground" />
                          </div>
                          <div>
                            <span className="font-medium text-foreground block">{p.restaurant_name}</span>
                            {p.phone_number && <span className="text-xs text-muted-foreground">{p.phone_number}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">{p.plan}</span>
                          <span className="text-xs text-muted-foreground ml-1">{getBillingLabel(p.billing_cycle)}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground capitalize hidden sm:table-cell">{p.payment_method}</td>
                      <td className="p-4 font-mono text-sm text-foreground hidden md:table-cell">{p.transaction_id}</td>
                      <td className="p-4 font-medium text-foreground">৳{p.amount}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
                          p.status === "approved" ? "bg-success/10 text-success" :
                          p.status === "rejected" ? "bg-destructive/10 text-destructive" :
                          "bg-warning/10 text-warning"
                        }`}>
                          {p.status === "approved" ? <><CheckCircle className="w-3 h-3" /> অনুমোদিত</> :
                           p.status === "rejected" ? <><XCircle className="w-3 h-3" /> প্রত্যাখ্যাত</> :
                           <><Clock className="w-3 h-3" /> পেন্ডিং</>}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <Button variant="outline" size="sm" onClick={() => openReview(p)}>রিভিউ</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) setSelectedPayment(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-display">পেমেন্ট রিভিউ</DialogTitle></DialogHeader>
          {selectedPayment && (
            <div className="space-y-4 pt-2">
              <div className="bg-accent/50 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">রেস্টুরেন্ট:</span><span className="font-medium text-foreground">{selectedPayment.restaurant_name}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">প্ল্যান:</span><span className="font-medium text-foreground capitalize">{selectedPayment.plan} ({getBillingLabel(selectedPayment.billing_cycle)})</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">টাকা:</span><span className="font-bold text-primary">৳{selectedPayment.amount}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">মাধ্যম:</span><span className="font-medium text-foreground capitalize">{selectedPayment.payment_method}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Transaction ID:</span><span className="font-mono text-foreground">{selectedPayment.transaction_id}</span></div>
                {selectedPayment.phone_number && <div className="flex justify-between"><span className="text-muted-foreground">ফোন:</span><span className="text-foreground">{selectedPayment.phone_number}</span></div>}
                <div className="flex justify-between"><span className="text-muted-foreground">তারিখ:</span><span className="text-foreground">{new Date(selectedPayment.created_at).toLocaleString("bn-BD")}</span></div>
              </div>

              <div className="space-y-2">
                <Label>অ্যাডমিন নোট (ঐচ্ছিক)</Label>
                <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="নোট লিখুন..." rows={2} />
              </div>

              {selectedPayment.status === "pending" ? (
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="hero"
                    onClick={() => approveMutation.mutate({
                      paymentId: selectedPayment.id,
                      restaurantId: selectedPayment.restaurant_id,
                      plan: selectedPayment.plan,
                      userId: selectedPayment.user_id,
                    })}
                    disabled={approveMutation.isPending}
                  >
                    {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                    অনুমোদন করুন
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => rejectMutation.mutate({ paymentId: selectedPayment.id, userId: selectedPayment.user_id })}
                    disabled={rejectMutation.isPending}
                  >
                    {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                    প্রত্যাখ্যান
                  </Button>
                </div>
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  এই পেমেন্ট ইতিমধ্যে {selectedPayment.status === "approved" ? "অনুমোদিত" : "প্রত্যাখ্যাত"} হয়েছে।
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SuperAdminPayments;
