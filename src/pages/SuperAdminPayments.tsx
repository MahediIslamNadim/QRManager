import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { CreditCard, CheckCircle, XCircle, Clock, Loader2, Search, Edit, Trash2, MoreHorizontal, RefreshCw, Eye } from "lucide-react";
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

// Invoke the process-payment edge function and throw on any error
const invokePayment = async (body: Record<string, unknown>) => {
  const { data, error } = await supabase.functions.invoke("process-payment", { body });
  if (error) throw new Error(error.message || "Function error");
  if (data?.error) throw new Error(data.error);
  return data;
};

const SuperAdminPayments = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<PaymentRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState("");
  const [editPlan, setEditPlan] = useState<"basic" | "premium" | "enterprise">("basic");
  const [editAmount, setEditAmount] = useState(0);
  const [editStatus, setEditStatus] = useState<"pending" | "approved" | "rejected">("pending");
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
        .from("restaurants").select("id, name").in("id", restIds);

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

  const closeDialog = () => { setDialogOpen(false); setSelectedPayment(null); setAdminNotes(""); };

  const approveMutation = useMutation({
    mutationFn: ({ paymentId, plan, billingCycle }: {
      paymentId: string; plan: string; billingCycle?: string;
    }) => invokePayment({ action: "approve", payment_id: paymentId, plan, billing_cycle: billingCycle, admin_notes: adminNotes || null }),
    onSuccess: () => { toast.success("✅ পেমেন্ট অনুমোদিত! রেস্টুরেন্ট সক্রিয় করা হয়েছে।"); closeDialog(); queryClient.invalidateQueries({ queryKey: ["all-payments"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ paymentId }: { paymentId: string }) =>
      invokePayment({ action: "reject", payment_id: paymentId, admin_notes: adminNotes || null }),
    onSuccess: () => { toast.success("পেমেন্ট প্রত্যাখ্যান করা হয়েছে"); closeDialog(); queryClient.invalidateQueries({ queryKey: ["all-payments"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  const updatePaymentMutation = useMutation({
    mutationFn: () => {
      if (!selectedPayment) return Promise.resolve();
      return invokePayment({ action: "update", payment_id: selectedPayment.id, plan: editPlan, amount: editAmount, status: editStatus, admin_notes: adminNotes || null });
    },
    onSuccess: () => { toast.success("পেমেন্ট আপডেট হয়েছে"); closeDialog(); queryClient.invalidateQueries({ queryKey: ["all-payments"] }); },
    onError: (err: any) => toast.error(err.message || "আপডেট করতে সমস্যা হয়েছে"),
  });

  const deletePaymentMutation = useMutation({
    mutationFn: (paymentId: string) => invokePayment({ action: "delete", payment_id: paymentId }),
    onSuccess: () => { toast.success("পেমেন্ট রিকোয়েস্ট মুছে ফেলা হয়েছে"); if (dialogOpen) closeDialog(); queryClient.invalidateQueries({ queryKey: ["all-payments"] }); },
    onError: (err: any) => toast.error(err.message || "ডিলিট করতে সমস্যা হয়েছে"),
  });

  const reopenMutation = useMutation({
    mutationFn: (paymentId: string) => invokePayment({ action: "reopen", payment_id: paymentId }),
    onSuccess: () => { toast.success("পেমেন্ট আবার পেন্ডিং করা হয়েছে"); queryClient.invalidateQueries({ queryKey: ["all-payments"] }); },
    onError: (err: any) => toast.error(err.message),
  });

  const openReview = (p: PaymentRequest) => {
    setSelectedPayment(p);
    setAdminNotes(p.admin_notes || "");
    setEditPlan((p.plan as "basic" | "premium" | "enterprise") || "basic");
    setEditAmount(Number(p.amount) || 0);
    setEditStatus((p.status as "pending" | "approved" | "rejected") || "pending");
    setDialogOpen(true);
  };

  const pendingCount = payments.filter(p => p.status === "pending").length;
  const getBillingLabel = (cycle?: string) => cycle === "yearly" ? "বার্ষিক" : "মাসিক";

  return (
    <DashboardLayout role="super_admin" title="পেমেন্ট ম্যানেজমেন্ট">
      <div className="space-y-6 animate-fade-up">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Transaction ID বা রেস্টুরেন্ট..." value={search}
                onChange={e => setSearch(e.target.value)} className="pl-10 bg-secondary/50 h-9 text-sm" />
            </div>
            {pendingCount > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-warning/10 text-warning border border-warning/20 whitespace-nowrap">
                🔔 {pendingCount} পেন্ডিং
              </span>
            )}
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "মোট", value: payments.length, color: "text-primary", bg: "bg-primary/10" },
            { label: "পেন্ডিং", value: pendingCount, color: "text-warning", bg: "bg-warning/10" },
            { label: "অনুমোদিত", value: payments.filter(p => p.status === "approved").length, color: "text-success", bg: "bg-success/10" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="stat-card text-center p-3">
              <p className={`text-xl font-display font-bold ${color}`}>{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {isLoading && (
          <div className="text-center py-10">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">লোড হচ্ছে...</p>
          </div>
        )}

        {/* ── Table ── */}
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
                    <tr><td colSpan={7} className="p-10 text-center text-muted-foreground">কোনো পেমেন্ট রিকোয়েস্ট নেই</td></tr>
                  )}
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <CreditCard className="w-4 h-4 text-primary" />
                          </div>
                          <div>
                            <span className="font-medium text-foreground text-sm block">{p.restaurant_name}</span>
                            {p.phone_number && <span className="text-xs text-muted-foreground">{p.phone_number}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">{p.plan}</span>
                        <span className="text-xs text-muted-foreground ml-1">{getBillingLabel(p.billing_cycle)}</span>
                      </td>
                      <td className="p-4 text-muted-foreground text-sm capitalize hidden sm:table-cell">{p.payment_method}</td>
                      <td className="p-4 font-mono text-sm text-foreground hidden md:table-cell">{p.transaction_id}</td>
                      <td className="p-4 font-medium text-foreground text-sm">৳{p.amount}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
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
                        <div className="flex items-center justify-end gap-1.5">
                          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => openReview(p)}>
                            <Eye className="w-3 h-3 mr-1" /> রিভিউ
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-7 w-7">
                                <MoreHorizontal className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                              <DropdownMenuItem onClick={() => openReview(p)}>
                                <Edit className="w-4 h-4 mr-2" /> এডিট
                              </DropdownMenuItem>
                              {p.status !== "pending" && (
                                <DropdownMenuItem onClick={() => reopenMutation.mutate(p.id)}>
                                  <RefreshCw className="w-4 h-4 mr-2" /> পেন্ডিং করুন
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <button className="w-full text-left px-2 py-1.5 text-sm rounded-sm hover:bg-accent inline-flex items-center text-destructive">
                                    <Trash2 className="w-4 h-4 mr-2" /> মুছুন
                                  </button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>পেমেন্ট রিকোয়েস্ট ডিলিট করবেন?</AlertDialogTitle>
                                    <AlertDialogDescription>Transaction ID: {p.transaction_id}</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>বাতিল</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deletePaymentMutation.mutate(p.id)}>ডিলিট</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Review Dialog ── */}
      <Dialog open={dialogOpen} onOpenChange={v => { setDialogOpen(v); if (!v) setSelectedPayment(null); }}>
        <DialogContent className="max-w-md mx-4 sm:mx-auto">
          <DialogHeader><DialogTitle className="font-display">পেমেন্ট রিভিউ</DialogTitle></DialogHeader>
          {selectedPayment && (
            <div className="space-y-4 pt-2">
              {/* Info */}
              <div className="bg-secondary/50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">রেস্টুরেন্ট</span>
                  <span className="font-medium text-foreground">{selectedPayment.restaurant_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">মাধ্যম</span>
                  <span className="font-medium text-foreground capitalize">{selectedPayment.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction ID</span>
                  <span className="font-mono text-foreground">{selectedPayment.transaction_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">বিলিং</span>
                  <span className="text-foreground">{getBillingLabel(selectedPayment.billing_cycle)}</span>
                </div>
                {selectedPayment.phone_number && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ফোন</span>
                    <span className="text-foreground">{selectedPayment.phone_number}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-muted-foreground">তারিখ</span>
                  <span className="text-foreground">{new Date(selectedPayment.created_at).toLocaleDateString("bn-BD")}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">প্ল্যান</Label>
                  <Select value={editPlan} onValueChange={v => setEditPlan(v as any)}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="premium">Premium</SelectItem>
                      <SelectItem value="enterprise">Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">টাকা (৳)</Label>
                  <Input type="number" value={editAmount} onChange={e => setEditAmount(Number(e.target.value))} className="h-9 text-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">স্ট্যাটাস</Label>
                <Select value={editStatus} onValueChange={v => setEditStatus(v as any)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">⏳ পেন্ডিং</SelectItem>
                    <SelectItem value="approved">✅ অনুমোদিত</SelectItem>
                    <SelectItem value="rejected">❌ প্রত্যাখ্যাত</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">অ্যাডমিন নোট</Label>
                <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)}
                  placeholder="নোট লিখুন..." rows={2} className="text-sm resize-none" />
              </div>

              {/* Quick approve/reject for pending */}
              {selectedPayment.status === "pending" && (
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="hero" className="h-10"
                    onClick={() => approveMutation.mutate({
                      paymentId: selectedPayment.id,
                      plan: editPlan,
                      billingCycle: selectedPayment.billing_cycle,
                    })}
                    disabled={approveMutation.isPending}>
                    {approveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    <span className="ml-1">অনুমোদন</span>
                  </Button>
                  <Button variant="destructive" className="h-10"
                    onClick={() => rejectMutation.mutate({ paymentId: selectedPayment.id })}
                    disabled={rejectMutation.isPending}>
                    {rejectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                    <span className="ml-1">প্রত্যাখ্যান</span>
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 h-9 text-sm"
                  onClick={() => updatePaymentMutation.mutate()}
                  disabled={updatePaymentMutation.isPending}>
                  {updatePaymentMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Edit className="w-3.5 h-3.5" />}
                  <span className="ml-1">আপডেট সেভ</span>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="icon" className="h-9 w-9">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>ডিলিট করবেন?</AlertDialogTitle>
                      <AlertDialogDescription>এই পেমেন্ট রিকোয়েস্ট স্থায়ীভাবে মুছে যাবে।</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>বাতিল</AlertDialogCancel>
                      <AlertDialogAction onClick={() => deletePaymentMutation.mutate(selectedPayment.id)}>ডিলিট</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SuperAdminPayments;
