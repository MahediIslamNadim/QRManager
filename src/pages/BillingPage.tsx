// BillingPage.tsx - Billing history and subscription management
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
  CreditCard, Download, FileText, Calendar, 
  CheckCircle2, XCircle, Clock, Receipt,
  AlertTriangle, ExternalLink
} from 'lucide-react';
import { TIERS, formatPrice } from '@/constants/tiers';
import { format } from 'date-fns';

const BillingPage = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();

  // Fetch current subscription
  const { data: subscription, isLoading: subLoading } = useQuery({
    queryKey: ['subscription', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return null;
      const { data, error } = await supabase
        .from('restaurants')
        .select('tier, billing_cycle, subscription_status, subscription_start_date, subscription_end_date, next_billing_date')
        .eq('id', restaurantId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!restaurantId
  });

  // Fetch billing history
  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!restaurantId
  });

  // Cancel subscription mutation
  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error('No restaurant');
      
      const { error } = await supabase
        .from('restaurants')
        .update({
          subscription_status: 'cancelled',
          // Note: Access continues until end of billing period
        })
        .eq('id', restaurantId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription', restaurantId] });
      toast.success('Subscription cancelled. Access continues until end of billing period.');
    },
    onError: (err: any) => {
      toast.error(err.message);
    }
  });

  const handleCancelSubscription = () => {
    if (confirm('Are you sure you want to cancel your subscription? Your access will continue until the end of the current billing period.')) {
      cancelMutation.mutate();
    }
  };

  const getStatusBadge = (status: string) => {
    const config = {
      active: { label: 'Active', variant: 'success' as const, icon: CheckCircle2 },
      trial: { label: 'Trial', variant: 'default' as const, icon: Clock },
      expired: { label: 'Expired', variant: 'destructive' as const, icon: XCircle },
      cancelled: { label: 'Cancelled', variant: 'secondary' as const, icon: AlertTriangle },
    };
    return config[status as keyof typeof config] || config.trial;
  };

  const downloadInvoice = (invoice: any) => {
    // TODO: Generate PDF invoice
    toast.info('Invoice download coming soon!');
  };

  if (subLoading) {
    return (
      <DashboardLayout role="admin" title="Billing">
        <div className="text-center py-12">Loading...</div>
      </DashboardLayout>
    );
  }

  const statusBadge = getStatusBadge(subscription?.subscription_status || 'trial');
  const StatusIcon = statusBadge.icon;

  return (
    <DashboardLayout role="admin" title="Billing & Subscription">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Current Subscription Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Current Subscription</CardTitle>
              <Badge variant={statusBadge.variant} className="flex items-center gap-1">
                <StatusIcon className="w-3 h-3" />
                {statusBadge.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Details */}
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Current Plan</p>
                <p className="text-2xl font-bold">
                  {TIERS[subscription?.tier as keyof typeof TIERS]?.name_bn || 'Trial'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {subscription?.billing_cycle === 'monthly' ? 'Billed monthly' : 'Billed annually'}
                </p>
              </div>

              {subscription?.subscription_status === 'active' && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Amount</p>
                  <p className="text-2xl font-bold">
                    {formatPrice(
                      subscription.billing_cycle === 'monthly'
                        ? TIERS[subscription.tier as keyof typeof TIERS]?.price_monthly || 0
                        : TIERS[subscription.tier as keyof typeof TIERS]?.price_yearly || 0
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {subscription.billing_cycle === 'monthly' ? 'per month' : 'per year'}
                  </p>
                </div>
              )}
            </div>

            {/* Billing Dates */}
            {subscription?.subscription_status === 'active' && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subscription started:</span>
                  <span className="font-medium">
                   {subscription.subscription_start_date ? format(new Date(subscription.subscription_start_date), 'MMM dd, yyyy') : 'N/A'} 
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Next billing date:</span>
                  <span className="font-medium">
                    {subscription.next_billing_date ? format(new Date(subscription.next_billing_date), 'MMM dd, yyyy') : 'N/A'}                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Renewal amount:</span>
                  <span className="font-semibold">
                    {formatPrice(
                      subscription.billing_cycle === 'monthly'
                        ? TIERS[subscription.tier as keyof typeof TIERS]?.price_monthly || 0
                        : TIERS[subscription.tier as keyof typeof TIERS]?.price_yearly || 0
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={() => window.location.href = '/upgrade'}>
                Change Plan
              </Button>
              
              {subscription?.subscription_status === 'active' && (
                <Button
                  variant="destructive"
                  onClick={handleCancelSubscription}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Subscription'}
                </Button>
              )}
            </div>

            {subscription?.subscription_status === 'cancelled' && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div className="text-sm">
                    <p className="font-semibold text-warning">Subscription Cancelled</p>
                    <p className="text-muted-foreground mt-1">
                      Your subscription has been cancelled. You'll retain access until{' '}
                      <strong>{format(new Date(subscription.subscription_end_date), 'MMM dd, yyyy')}</strong>.
                      You can reactivate anytime before this date.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Method Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Payment Method
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                No payment method on file
              </p>
              <Button variant="outline" size="sm">
                Add Payment Method
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Billing History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5" />
              Billing History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <p className="text-center text-muted-foreground py-8">Loading invoices...</p>
            ) : invoices.length === 0 ? (
              <div className="text-center py-12">
                <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No billing history yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {invoices.map((invoice: any) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Receipt className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {TIERS[invoice.tier as keyof typeof TIERS]?.name_bn} - {' '}
                          {invoice.billing_cycle === 'monthly' ? 'Monthly' : 'Annual'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(invoice.created_at), 'MMM dd, yyyy')}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className="font-semibold">{formatPrice(invoice.amount)}</p>
                        <Badge variant={invoice.status === 'active' ? 'success' : 'secondary'} className="text-xs">
                          {invoice.status}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => downloadInvoice(invoice)}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Help Card */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-sm text-blue-900">Need Help?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-blue-800">
            <p>
              <strong>Questions about your bill?</strong> Contact our support team at{' '}
              <a href="mailto:billing@qrmanager.com" className="underline">
                billing@qrmanager.com
              </a>
            </p>
            <p>
              <strong>Want to upgrade?</strong>{' '}
              <a href="/upgrade" className="underline inline-flex items-center gap-1">
                View plans <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default BillingPage;
