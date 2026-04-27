import { useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  CreditCard, FileText, CheckCircle2, XCircle,
  Clock, Receipt, AlertTriangle, ExternalLink, RefreshCw,
} from 'lucide-react';
import { TIERS } from '@/constants/tiers';

const BillingPage = () => {
  const { restaurantId, role } = useAuth();
  const queryClient = useQueryClient();
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Fetch current subscription from restaurants table (only columns that exist)
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data, error } = await supabase
        .from('restaurants')
        .select('tier, subscription_status, trial_end_date, trial_ends_at')
        .eq('id', restaurantId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId,
  });

  // Fetch payment history from payment_requests table (the table that actually exists)
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payment-requests', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('payment_requests')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error('No restaurant');
      const { error } = await supabase
        .from('restaurants')
        .update({ subscription_status: 'cancelled' })
        .eq('id', restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', restaurantId] });
      toast.success('সাবস্ক্রিপশন বাতিল হয়েছে। বিলিং পিরিয়ড শেষ হওয়া পর্যন্ত অ্যাক্সেস থাকবে।');
      setConfirmCancel(false);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const STATUS_CONFIG: Record<string, { label: string; className: string; icon: any }> = {
    active:    { label: 'সক্রিয়',      className: 'bg-success/15 text-success border border-success/30',             icon: CheckCircle2 },
    trial:     { label: 'ট্রায়াল',      className: 'bg-blue-500/15 text-blue-500 border border-blue-500/30',         icon: Clock },
    expired:   { label: 'মেয়াদ শেষ',   className: 'bg-destructive/15 text-destructive border border-destructive/30', icon: XCircle },
    cancelled: { label: 'বাতিল',        className: 'bg-secondary text-muted-foreground border border-border',         icon: AlertTriangle },
  };

  const PAYMENT_STATUS: Record<string, { label: string; className: string }> = {
    pending:  { label: 'অপেক্ষমান',    className: 'bg-warning/15 text-warning border border-warning/30' },
    approved: { label: 'অনুমোদিত',     className: 'bg-success/15 text-success border border-success/30' },
    rejected: { label: 'প্রত্যাখ্যাত', className: 'bg-destructive/15 text-destructive border border-destructive/30' },
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('bn-BD', { day: '2-digit', month: 'long', year: 'numeric' });
    } catch {
      return '—';
    }
  };

  const formatAmount = (amount: number) => `৳${Number(amount).toLocaleString('bn-BD')}`;

  const status = subscription?.subscription_status || 'trial';
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.trial;
  const StatusIcon = statusCfg.icon;
  const tierInfo = TIERS[subscription?.tier as keyof typeof TIERS];
  const trialEnd = subscription?.trial_end_date || subscription?.trial_ends_at;

  if (subLoading) {
    return (
      <DashboardLayout role={(role === 'group_owner' ? 'group_owner' : role === 'super_admin' ? 'super_admin' : 'admin') as any} title="প্ল্যান ও বিলিং">
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> লোড হচ্ছে...
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="admin" title="প্ল্যান ও বিলিং">
      <div className="max-w-4xl mx-auto space-y-6 animate-fade-up">

        {/* Current Subscription */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <CardTitle className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-primary" />
                </div>
                বর্তমান সাবস্ক্রিপশন
              </CardTitle>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.className}`}>
                <StatusIcon className="w-3.5 h-3.5" /> {statusCfg.label}
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-5">
              <div>
                <p className="text-xs text-muted-foreground mb-1">বর্তমান প্ল্যান</p>
                <p className="text-2xl font-bold">{tierInfo?.name_bn || subscription?.tier || 'ট্রায়াল'}</p>
                {tierInfo?.description && (
                  <p className="text-sm text-muted-foreground mt-1">{tierInfo.description}</p>
                )}
              </div>
              {status === 'trial' && trialEnd && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ট্রায়াল শেষ হবে</p>
                  <p className="text-lg font-semibold">{formatDate(trialEnd)}</p>
                </div>
              )}
            </div>

            {/* Trial warning */}
            {status === 'trial' && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-warning">ট্রায়াল পিরিয়ড চলছে</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    সব ফিচার ব্যবহার করতে পেইড প্ল্যানে আপগ্রেড করুন।
                  </p>
                </div>
              </div>
            )}

            {/* Cancelled warning */}
            {status === 'cancelled' && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/20">
                <XCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-destructive">সাবস্ক্রিপশন বাতিল</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    আপনার সাবস্ক্রিপশন বাতিল হয়েছে। যেকোনো সময় পুনরায় সক্রিয় করতে পারবেন।
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 flex-wrap pt-2">
              <Button variant="outline" onClick={() => window.location.href = '/upgrade'} className="gap-2">
                <ExternalLink className="w-4 h-4" /> প্ল্যান পরিবর্তন করুন
              </Button>
              {status === 'active' && !confirmCancel && (
                <Button variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmCancel(true)}>
                  সাবস্ক্রিপশন বাতিল করুন
                </Button>
              )}
              {confirmCancel && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/20 w-full">
                  <p className="text-sm flex-1">আপনি কি নিশ্চিত? বিলিং পিরিয়ড শেষ পর্যন্ত অ্যাক্সেস থাকবে।</p>
                  <Button size="sm" variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                    {cancelMutation.isPending ? 'বাতিল হচ্ছে...' : 'হ্যাঁ, বাতিল করুন'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmCancel(false)}>না</Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Payment History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-primary" /> পেমেন্ট ইতিহাস
            </CardTitle>
          </CardHeader>
          <CardContent>
            {paymentsLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> লোড হচ্ছে...
              </div>
            ) : payments.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <FileText className="w-12 h-12 mx-auto text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">এখনো কোনো পেমেন্ট নেই</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {payments.map((p: any) => {
                  const pStatus = PAYMENT_STATUS[p.status] || PAYMENT_STATUS.pending;
                  return (
                    <div key={p.id} className="flex items-center justify-between py-4 gap-4 flex-wrap">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Receipt className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">
                            {TIERS[p.plan as keyof typeof TIERS]?.name_bn || p.plan}
                            {p.billing_cycle ? ` · ${p.billing_cycle === 'monthly' ? 'মাসিক' : 'বার্ষিক'}` : ''}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.payment_method?.toUpperCase()} · {p.transaction_id} · {formatDate(p.created_at)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-bold`}>{formatAmount(p.amount)}</span>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${pStatus.className}`}>
                          {pStatus.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help */}
        <Card className="border-primary/10 bg-primary/3">
          <CardContent className="p-5 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            <div className="text-sm space-y-1">
              <p className="font-semibold">সাহায্য দরকার?</p>
              <p className="text-muted-foreground">
                বিলিং সম্পর্কে প্রশ্ন থাকলে সাপোর্ট টিকেট খুলুন অথবা{' '}
                <a href="mailto:support@nexcore.app" className="text-primary underline">support@nexcore.app</a>-এ যোগাযোগ করুন।
              </p>
            </div>
          </CardContent>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default BillingPage;
