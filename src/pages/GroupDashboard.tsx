import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Building2, TrendingUp, ShoppingCart, RefreshCw,
  Plus, Edit2, Trash2, Star, Power, PowerOff,
  AlertTriangle, CheckCircle2, Clock, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import {
  useRestaurantGroup,
  useGroupAnalytics,
  useGroupOrders,
  useSharedMenu,
  useBranchManagement,
  type BranchInfo,
  type BranchPayload,
  type LiveOrder,
  type SharedMenuItem,
} from '@/hooks/useRestaurantGroup';
import BranchSelector from '@/components/group/BranchSelector';
import BranchAdminInvite from '@/components/group/BranchAdminInvite';

// ─── helpers ───────────────────────────────────────────────
const fmt = (n: number) => `৳${n.toLocaleString('bn-BD')}`;
const fmtNum = (n: number) => n.toLocaleString('bn-BD');

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:    { label: 'অপেক্ষমান',   color: 'bg-warning/15 text-warning border-warning/30' },
  confirmed:  { label: 'নিশ্চিত',      color: 'bg-blue-500/15 text-blue-500 border-blue-500/30' },
  preparing:  { label: 'তৈরি হচ্ছে',  color: 'bg-orange-500/15 text-orange-500 border-orange-500/30' },
  ready:      { label: 'প্রস্তুত',     color: 'bg-primary/15 text-primary border-primary/30' },
  delivered:  { label: 'ডেলিভারি',    color: 'bg-success/15 text-success border-success/30' },
  cancelled:  { label: 'বাতিল',        color: 'bg-destructive/15 text-destructive border-destructive/30' },
};

const EMPTY_BRANCH: BranchPayload = {
  name: '',
  address: null,
  branch_code: '',
  phone: null,
  status: 'active',
};

const EMPTY_ITEM: Omit<SharedMenuItem, 'id' | 'created_at' | 'updated_at'> = {
  group_id: '',
  name: '',
  category: 'সাধারণ',
  description: null,
  price: 0,
  image_url: null,
  is_active: true,
};

// ─── sub-components ────────────────────────────────────────

function KpiCard({
  title, value, sub, icon: Icon, accent,
}: { title: string; value: string; sub?: string; icon: React.ElementType; accent?: string }) {
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${accent ?? 'bg-primary/10'}`}>
            <Icon className="w-5 h-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OrderCard({ order, branchFilter }: { order: LiveOrder; branchFilter: string | null }) {
  const statusInfo = ORDER_STATUS[order.status] ?? { label: order.status, color: 'bg-secondary text-secondary-foreground border-border' };
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-border/60 hover:bg-secondary/20 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {!branchFilter && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
              {order.restaurant_name}
            </Badge>
          )}
          {order.table_id && (
            <span className="text-xs text-muted-foreground">টেবিল #{order.table_id.slice(-4)}</span>
          )}
        </div>
        <p className="text-sm font-semibold mt-0.5">{fmt(order.total)}</p>
        {order.notes && <p className="text-xs text-muted-foreground truncate">{order.notes}</p>}
      </div>
      <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${statusInfo.color}`}>
        {statusInfo.label}
      </span>
    </div>
  );
}

// ─── main component ────────────────────────────────────────

export default function GroupDashboard() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { role, restaurantPlan } = useAuth();

  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [menuDialog, setMenuDialog] = useState<'create' | 'edit' | null>(null);
  const [editingItem, setEditingItem] = useState<SharedMenuItem | null>(null);
  const [itemForm, setItemForm] = useState<Omit<SharedMenuItem, 'id' | 'created_at' | 'updated_at'>>(EMPTY_ITEM);
  const [branchDialog, setBranchDialog] = useState<'create' | 'edit' | null>(null);
  const [editingBranch, setEditingBranch] = useState<BranchInfo | null>(null);
  const [branchForm, setBranchForm] = useState<BranchPayload>(EMPTY_BRANCH);

  const { data: group, isLoading: groupLoading } = useRestaurantGroup(groupId ?? null);
  const { data: analytics, isLoading: analyticsLoading } = useGroupAnalytics(groupId ?? null);
  const branchIds = useMemo(() => group?.branches.map(b => b.id) ?? [], [group]);
  const { data: liveOrders = [], isLoading: ordersLoading } = useGroupOrders(groupId ?? null, branchIds);
  const {
    data: sharedMenu = [],
    isLoading: menuLoading,
    createItem,
    updateItem,
    deleteItem,
  } = useSharedMenu(groupId ?? null);
  const { createBranch, updateBranch, setBranchStatus } = useBranchManagement(groupId ?? null);

  const activeBranches = group?.branches.filter((branch) => branch.status === 'active') ?? [];
  const canAddBranch =
    role === 'super_admin' ||
    role === 'group_owner' ||
    restaurantPlan === 'high_smart_enterprise' ||
    activeBranches.length < 5;

  const filteredOrders = useMemo(
    () => branchFilter ? liveOrders.filter(o => o.restaurant_id === branchFilter) : liveOrders,
    [liveOrders, branchFilter]
  );

  const openCreate = () => {
    setEditingItem(null);
    setItemForm({ ...EMPTY_ITEM, group_id: groupId ?? '' });
    setMenuDialog('create');
  };

  const openEdit = (item: SharedMenuItem) => {
    setEditingItem(item);
    setItemForm({
      group_id: item.group_id,
      name: item.name,
      category: item.category,
      description: item.description,
      price: item.price,
      image_url: item.image_url,
      is_active: item.is_active,
    });
    setMenuDialog('edit');
  };

  const handleMenuSave = async () => {
    try {
      if (menuDialog === 'create') {
        await createItem.mutateAsync(itemForm);
        toast.success('আইটেম যোগ হয়েছে');
      } else if (menuDialog === 'edit' && editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, ...itemForm });
        toast.success('আইটেম আপডেট হয়েছে');
      }
      setMenuDialog(null);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('এই আইটেম মুছে ফেলবেন?')) return;
    try {
      await deleteItem.mutateAsync(id);
      toast.success('মুছে ফেলা হয়েছে');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  const openBranchCreate = () => {
    if (!canAddBranch) {
      toast.error('Branch limit reached for this plan.');
      return;
    }
    const nextNumber = String((group?.branches.length ?? 0) + 1).padStart(2, '0');
    setEditingBranch(null);
    setBranchForm({ ...EMPTY_BRANCH, branch_code: `BR-${nextNumber}` });
    setBranchDialog('create');
  };

  const openBranchEdit = (branch: BranchInfo) => {
    setEditingBranch(branch);
    setBranchForm({
      name: branch.name,
      address: branch.address,
      branch_code: branch.branch_code,
      phone: branch.phone,
      status: branch.status || 'active',
    });
    setBranchDialog('edit');
  };

  const handleBranchSave = async () => {
    const payload: BranchPayload = {
      name: branchForm.name.trim(),
      address: branchForm.address?.trim() || null,
      branch_code: branchForm.branch_code?.trim() || null,
      phone: branchForm.phone?.trim() || null,
      status: branchForm.status || 'active',
    };

    if (!payload.name || payload.name.length < 2) {
      toast.error('Branch name is required.');
      return;
    }

    try {
      if (branchDialog === 'create') {
        await createBranch.mutateAsync({ ...payload, owner_id: null });
        toast.success('Branch added.');
      } else if (branchDialog === 'edit' && editingBranch) {
        await updateBranch.mutateAsync({ id: editingBranch.id, ...payload });
        toast.success('Branch updated.');
      }
      setBranchDialog(null);
      setEditingBranch(null);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  const handleBranchStatusToggle = async (branch: BranchInfo) => {
    const nextStatus = branch.status === 'active' ? 'inactive' : 'active';
    if (
      nextStatus === 'inactive' &&
      !window.confirm('Deactivate this branch? Old orders and reports will stay preserved.')
    ) {
      return;
    }

    try {
      await setBranchStatus.mutateAsync({ id: branch.id, status: nextStatus });
      if (branchFilter === branch.id && nextStatus !== 'active') setBranchFilter(null);
      toast.success(nextStatus === 'active' ? 'Branch reactivated.' : 'Branch deactivated.');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  if (groupLoading) {
    return (
      <DashboardLayout role="group_owner" title="গ্রুপ ড্যাশবোর্ড">
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!group) {
    return (
      <DashboardLayout role="group_owner" title="গ্রুপ ড্যাশবোর্ড">
        <div className="py-16 text-center space-y-3">
          <AlertTriangle className="w-10 h-10 mx-auto text-warning" />
          <p className="text-sm text-muted-foreground">গ্রুপ পাওয়া যায়নি</p>
          <Button size="sm" onClick={() => navigate('/group/setup')}>গ্রুপ সেটআপ করুন</Button>
        </div>
      </DashboardLayout>
    );
  }

  const totalRevenue = analytics?.total_revenue ?? 0;
  const totalOrders  = analytics?.total_orders  ?? 0;
  const liveCount    = liveOrders.length;

  return (
    <DashboardLayout role="group_owner" title={group.name}>
      <div className="space-y-6 animate-fade-up">

        {/* ── Branch selector ───────────────────────── */}
        <BranchSelector
          group={group}
          selectedBranchId={branchFilter}
          onSelect={setBranchFilter}
        />

        {/* ── KPI row ───────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="মোট রাজস্ব (আজ)" value={fmt(totalRevenue)}
            icon={TrendingUp} accent="bg-success/10" />
          <KpiCard title="মোট অর্ডার" value={fmtNum(totalOrders)}
            icon={ShoppingCart} accent="bg-primary/10" />
          <KpiCard title="লাইভ অর্ডার" value={fmtNum(liveCount)}
            sub="এখন চলছে" icon={Star} accent="bg-warning/10" />
          <KpiCard title="শাখার সংখ্যা" value={fmtNum(group.branches.length)}
            icon={Building2} accent="bg-blue-500/10" />
        </div>

        {/* ── Tabs ──────────────────────────────────── */}
        <Tabs defaultValue="overview">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="overview">ওভারভিউ</TabsTrigger>
            <TabsTrigger value="orders">
              লাইভ অর্ডার
              {liveCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold">
                  {liveCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="menu">শেয়ার্ড মেনু</TabsTrigger>
            <TabsTrigger value="branches">শাখাসমূহ</TabsTrigger>
          </TabsList>

          {/* ── TAB: Overview ─────────────────────────── */}
          <TabsContent value="overview" className="space-y-6 pt-4">
            {analyticsLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> লোড হচ্ছে...
              </div>
            ) : analytics && analytics.per_branch.length > 0 ? (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-success" /> শাখাভিত্তিক রাজস্ব
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={analytics.per_branch} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" fontSize={12} stroke="hsl(var(--muted-foreground))" />
                        <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `৳${v}`} />
                        <Tooltip
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(v: number) => [`৳${v.toLocaleString()}`, 'রাজস্ব']}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div className="grid gap-3">
                  {analytics.per_branch.map(b => (
                    <div key={b.restaurant_id} className="flex items-center gap-3 p-3 rounded-xl border border-border/60 hover:bg-secondary/20 transition-colors">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Building2 className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{b.name}</p>
                        <p className="text-xs text-muted-foreground">{fmtNum(b.orders)} অর্ডার · গড় {fmt(b.avg_order_value)}</p>
                      </div>
                      <p className="text-sm font-bold shrink-0">{fmt(b.revenue)}</p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-sm text-muted-foreground">
                আজ কোনো অর্ডার নেই
              </div>
            )}
          </TabsContent>

          {/* ── TAB: Live Orders ──────────────────────── */}
          <TabsContent value="orders" className="space-y-4 pt-4">
            {branchFilter && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs gap-1">
                  ফিল্টার: {group.branches.find(b => b.id === branchFilter)?.name}
                </Badge>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setBranchFilter(null)}>
                  সরান ✕
                </Button>
              </div>
            )}

            {ordersLoading ? (
              <div className="flex items-center justify-center py-10 text-muted-foreground gap-2 text-sm">
                <RefreshCw className="w-4 h-4 animate-spin" /> লোড হচ্ছে...
              </div>
            ) : filteredOrders.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                কোনো লাইভ অর্ডার নেই
              </div>
            ) : (
              <div className="space-y-2">
                {filteredOrders.map(order => (
                  <OrderCard key={order.id} order={order} branchFilter={branchFilter} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── TAB: Shared Menu ──────────────────────── */}
          <TabsContent value="menu" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">শেয়ার্ড মেনু</p>
                <p className="text-xs text-muted-foreground">সব শাখায় দেখানো হবে</p>
              </div>
              <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5">
                <Plus className="w-4 h-4" /> নতুন আইটেম
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {menuLoading ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">লোড হচ্ছে...</div>
                ) : sharedMenu.length === 0 ? (
                  <div className="py-12 text-center space-y-3">
                    <p className="text-sm text-muted-foreground">কোনো শেয়ার্ড মেনু নেই</p>
                    <Button size="sm" variant="outline" onClick={openCreate} className="gap-1.5">
                      <Plus className="w-4 h-4" /> প্রথম আইটেম যোগ করুন
                    </Button>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {sharedMenu.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{item.name}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">{item.category}</Badge>
                            {!item.is_active && (
                              <Badge className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive border-destructive/20">
                                নিষ্ক্রিয়
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmt(item.price)}
                            {item.description ? ` · ${item.description.slice(0, 50)}` : ''}
                          </p>
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openEdit(item)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost"
                            className="w-8 h-8 text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDelete(item.id)}
                            disabled={deleteItem.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Branches ──────────────────────────── */}
          <TabsContent value="branches" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{fmtNum(group.branches.length)} টি শাখা</p>
              <Button size="sm" variant="outline" onClick={openBranchCreate} disabled={!canAddBranch} className="gap-1.5">
                <Plus className="w-4 h-4" /> শাখা যোগ করুন
              </Button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              {group.branches.map((branch: BranchInfo) => {
                const branchAnalytics = analytics?.per_branch.find((b) => b.restaurant_id === branch.id);
                const isActive = branch.status === 'active';
                return (
                  <Card key={branch.id} className="relative hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{branch.name}</p>
                            {branch.branch_code && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{branch.branch_code}</Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{branch.address ?? 'ঠিকানা নেই'}</p>
                          {branch.phone && <p className="text-xs text-muted-foreground mt-0.5">{branch.phone}</p>}
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          isActive
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-secondary text-muted-foreground border-border'
                        }`}>
                          {isActive ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                          {isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                        </span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button size="icon" variant="ghost" className="w-8 h-8" onClick={() => openBranchEdit(branch)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="w-8 h-8 text-muted-foreground hover:text-foreground"
                            onClick={() => handleBranchStatusToggle(branch)}
                            disabled={setBranchStatus.isPending}
                          >
                            {isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </div>

                      {branchAnalytics && (
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          <div className="text-center p-2 rounded-lg bg-secondary/40">
                            <p className="text-sm font-bold">{fmt(branchAnalytics.revenue)}</p>
                            <p className="text-[10px] text-muted-foreground">আজকের রাজস্ব</p>
                          </div>
                          <div className="text-center p-2 rounded-lg bg-secondary/40">
                            <p className="text-sm font-bold">{fmtNum(branchAnalytics.orders)}</p>
                            <p className="text-[10px] text-muted-foreground">অর্ডার</p>
                          </div>
                        </div>
                      )}

                      {/* Filter button */}
                      <Button
                        size="sm"
                        variant={branchFilter === branch.id ? "default" : "outline"}
                        className="w-full gap-1.5 text-xs"
                        onClick={() => setBranchFilter(branchFilter === branch.id ? null : branch.id)}
                      >
                        {branchFilter === branch.id ? "ফিল্টার সরান" : "এই শাখা ফিল্টার করুন"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>

                      {/* Admin invite button */}
                      {isActive && (
                        <BranchAdminInvite
                          restaurantId={branch.id}
                          restaurantName={branch.name}
                          groupId={groupId ?? ''}
                        />
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {group.branches.length === 0 && (
              <div className="py-12 text-center space-y-3">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">কোনো শাখা নেই</p>
                <Button size="sm" onClick={openBranchCreate} disabled={!canAddBranch} className="gap-1.5">
                  <Plus className="w-4 h-4" /> প্রথম শাখা যোগ করুন
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* ── Shared Menu Dialog ─────────────────────── */}
        <Dialog open={menuDialog !== null} onOpenChange={() => setMenuDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {menuDialog === 'create' ? 'নতুন শেয়ার্ড মেনু আইটেম' : 'আইটেম সম্পাদনা'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>নাম *</Label>
                <Input
                  value={itemForm.name}
                  onChange={(e) => setItemForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="আইটেমের নাম"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>ক্যাটাগরি</Label>
                  <Input
                    value={itemForm.category}
                    onChange={(e) => setItemForm((p) => ({ ...p, category: e.target.value }))}
                    placeholder="যেমন: বিরিয়ানি"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>মূল্য (৳)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={itemForm.price}
                    onChange={(e) => setItemForm((p) => ({ ...p, price: Number(e.target.value) }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>বিবরণ</Label>
                <Textarea
                  rows={2}
                  value={itemForm.description ?? ''}
                  onChange={(e) => setItemForm((p) => ({ ...p, description: e.target.value || null }))}
                  placeholder="ঐচ্ছিক বিবরণ..."
                  className="resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={itemForm.is_active}
                  onCheckedChange={(v) => setItemForm((p) => ({ ...p, is_active: v }))}
                />
                <Label>সক্রিয়</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMenuDialog(null)}>বাতিল</Button>
              <Button
                onClick={handleMenuSave}
                disabled={createItem.isPending || updateItem.isPending}
              >
                {createItem.isPending || updateItem.isPending ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Branch Dialog */}
        <Dialog open={branchDialog !== null} onOpenChange={() => setBranchDialog(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{branchDialog === 'create' ? 'Add Branch' : 'Edit Branch'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Branch name *</Label>
                <Input
                  value={branchForm.name}
                  onChange={(e) => setBranchForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="Branch name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Branch code</Label>
                  <Input
                    value={branchForm.branch_code ?? ''}
                    onChange={(e) => setBranchForm((p) => ({ ...p, branch_code: e.target.value || null }))}
                    placeholder="BR-01"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Phone</Label>
                  <Input
                    value={branchForm.phone ?? ''}
                    onChange={(e) => setBranchForm((p) => ({ ...p, phone: e.target.value || null }))}
                    placeholder="+880..."
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Address</Label>
                <Textarea
                  rows={2}
                  value={branchForm.address ?? ''}
                  onChange={(e) => setBranchForm((p) => ({ ...p, address: e.target.value || null }))}
                  placeholder="Branch address"
                  className="resize-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={branchForm.status === 'active'}
                  onCheckedChange={(v) => setBranchForm((p) => ({ ...p, status: v ? 'active' : 'inactive' }))}
                />
                <Label>Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBranchDialog(null)}>Cancel</Button>
              <Button
                onClick={handleBranchSave}
                disabled={createBranch.isPending || updateBranch.isPending}
              >
                {createBranch.isPending || updateBranch.isPending ? 'Saving...' : 'Save Branch'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </DashboardLayout>
  );
}
