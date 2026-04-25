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
  BarChart, Bar, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Building2, TrendingUp, ShoppingCart, Users, RefreshCw,
  Plus, Edit2, Trash2, Eye, EyeOff, ChevronRight, Star,
  AlertTriangle, CheckCircle2, Clock, ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  useRestaurantGroup,
  useGroupAnalytics,
  useGroupOrders,
  useSharedMenu,
  type BranchInfo,
  type LiveOrder,
  type SharedMenuItem,
} from '@/hooks/useRestaurantGroup';
import BranchSelector from '@/components/group/BranchSelector';

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
  if (branchFilter && order.restaurant_id !== branchFilter) return null;
  const st = ORDER_STATUS[order.status] ?? ORDER_STATUS.pending;
  const ago = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);

  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-secondary/30 transition-colors">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <ShoppingCart className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{fmt(order.total)}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${st.color}`}>
            {st.label}
          </span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
            {order.restaurant_name}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {ago === 0 ? 'এইমাত্র' : `${fmtNum(ago)} মিনিট আগে`}
          {order.notes ? ` · ${order.notes}` : ''}
        </p>
      </div>
    </div>
  );
}

// ─── main component ─────────────────────────────────────────

export default function GroupDashboard() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const [branchFilter, setBranchFilter] = useState<string | null>(null);
  const [menuDialog, setMenuDialog] = useState<'create' | 'edit' | null>(null);
  const [editingItem, setEditingItem] = useState<SharedMenuItem | null>(null);
  const [itemForm, setItemForm] = useState(EMPTY_ITEM);

  const { data: group, isLoading: groupLoading, refetch: refetchGroup } = useRestaurantGroup(groupId ?? null);
  const { data: analytics, isLoading: analyticsLoading } = useGroupAnalytics(groupId ?? null);

  const branchIds = useMemo(() => group?.branches.map((b) => b.id) ?? [], [group]);
  const { data: liveOrders = [], isLoading: ordersLoading } = useGroupOrders(groupId ?? null, branchIds);
  const {
    data: sharedMenu = [], isLoading: menuLoading,
    createItem, updateItem, deleteItem,
  } = useSharedMenu(groupId ?? null);

  // ── menu CRUD helpers ─────────────────────────────────
  const openCreate = () => {
    setItemForm({ ...EMPTY_ITEM, group_id: groupId ?? '' });
    setEditingItem(null);
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
    if (!itemForm.name.trim()) { toast.error('নাম দেওয়া আবশ্যক'); return; }
    try {
      if (menuDialog === 'create') {
        await createItem.mutateAsync(itemForm);
        toast.success('মেনু আইটেম যোগ হয়েছে');
      } else if (editingItem) {
        await updateItem.mutateAsync({ id: editingItem.id, ...itemForm });
        toast.success('মেনু আইটেম আপডেট হয়েছে');
      }
      setMenuDialog(null);
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteItem.mutateAsync(id);
      toast.success('মেনু আইটেম মুছে ফেলা হয়েছে');
    } catch (e: unknown) {
      toast.error((e as Error).message);
    }
  };

  // ── chart data ────────────────────────────────────────
  const barData = useMemo(
    () =>
      (analytics?.per_branch ?? []).map((b) => ({
        name: b.branch_code || b.name.slice(0, 10),
        রাজস্ব: b.revenue,
        অর্ডার: b.orders,
      })),
    [analytics],
  );

  const bestBranch = useMemo(
    () => analytics?.per_branch?.[0] ?? null,
    [analytics],
  );

  if (groupLoading) {
    return (
      <DashboardLayout role="group_owner" title="গ্রুপ ড্যাশবোর্ড">
        <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
          <RefreshCw className="w-4 h-4 animate-spin" /> লোড হচ্ছে...
        </div>
      </DashboardLayout>
    );
  }

  if (!group) {
    return (
      <DashboardLayout role="group_owner" title="গ্রুপ ড্যাশবোর্ড">
        <div className="py-20 text-center space-y-3">
          <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">গ্রুপ পাওয়া যায়নি</p>
          <Button variant="outline" onClick={() => navigate('/group/setup')}>
            নতুন গ্রুপ তৈরি করুন
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="group_owner" title={group.name}>
      <div className="space-y-6 animate-fade-up max-w-6xl">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">{group.name}</h1>
              <p className="text-xs text-muted-foreground">{fmtNum(group.branches.length)} টি শাখা</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <BranchSelector group={group} selectedBranchId={branchFilter} onSelect={setBranchFilter} />
            <Button size="sm" variant="outline" onClick={() => { refetchGroup(); }} className="gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${groupLoading ? 'animate-spin' : ''}`} />
              রিফ্রেশ
            </Button>
          </div>
        </div>

        <Tabs defaultValue="overview">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="overview">ওভারভিউ</TabsTrigger>
            <TabsTrigger value="orders">
              লাইভ অর্ডার
              {liveOrders.length > 0 && (
                <span className="ml-1.5 bg-destructive text-destructive-foreground text-[10px] rounded-full px-1.5 py-0.5">
                  {fmtNum(liveOrders.length)}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="analytics">অ্যানালিটিক্স</TabsTrigger>
            <TabsTrigger value="menu">শেয়ার্ড মেনু</TabsTrigger>
            <TabsTrigger value="branches">শাখাসমূহ</TabsTrigger>
          </TabsList>

          {/* ── TAB: Overview ─────────────────────────── */}
          <TabsContent value="overview" className="space-y-5 pt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                title="আজকের মোট রাজস্ব"
                value={analyticsLoading ? '...' : fmt(analytics?.total_revenue ?? 0)}
                sub="সকল শাখা মিলিয়ে"
                icon={TrendingUp}
                accent="bg-success/10"
              />
              <KpiCard
                title="মোট অ্যাক্টিভ অর্ডার"
                value={ordersLoading ? '...' : fmtNum(liveOrders.length)}
                sub="এই মুহূর্তে"
                icon={ShoppingCart}
              />
              <KpiCard
                title="সেরা শাখা (আজ)"
                value={bestBranch ? (bestBranch.branch_code || bestBranch.name.slice(0, 8)) : '—'}
                sub={bestBranch ? fmt(bestBranch.revenue) : ''}
                icon={Star}
                accent="bg-warning/10"
              />
              <KpiCard
                title="মোট শাখা"
                value={fmtNum(group.branches.length)}
                sub="নিবন্ধিত"
                icon={Building2}
              />
            </div>

            {/* Mini area chart */}
            {barData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">শাখাভিত্তিক রাজস্ব (আজ)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={barData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(v: number, n: string) => [n === 'রাজস্ব' ? fmt(v) : fmtNum(v), n]}
                        contentStyle={{ fontSize: 12 }}
                      />
                      <Bar dataKey="রাজস্ব" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Recent orders */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> সাম্প্রতিক অর্ডার
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {liveOrders.slice(0, 5).length === 0 ? (
                  <p className="text-center py-8 text-sm text-muted-foreground">কোনো অ্যাক্টিভ অর্ডার নেই</p>
                ) : (
                  <div className="divide-y divide-border/40">
                    {liveOrders.slice(0, 5).map((o) => (
                      <OrderCard key={o.id} order={o} branchFilter={null} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Live Orders ──────────────────────── */}
          <TabsContent value="orders" className="pt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-primary" />
                    লাইভ অর্ডার ফিড
                  </CardTitle>
                  <BranchSelector group={group} selectedBranchId={branchFilter} onSelect={setBranchFilter} />
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {ordersLoading ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">লোড হচ্ছে...</div>
                ) : liveOrders.length === 0 ? (
                  <div className="py-12 text-center space-y-2">
                    <ShoppingCart className="w-12 h-12 mx-auto text-muted-foreground/20" />
                    <p className="text-sm text-muted-foreground">কোনো অ্যাক্টিভ অর্ডার নেই</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {liveOrders
                      .filter((o) => !branchFilter || o.restaurant_id === branchFilter)
                      .map((o) => (
                        <OrderCard key={o.id} order={o} branchFilter={null} />
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── TAB: Analytics ─────────────────────────── */}
          <TabsContent value="analytics" className="space-y-5 pt-4">
            {analyticsLoading ? (
              <div className="py-12 text-center text-muted-foreground text-sm">লোড হচ্ছে...</div>
            ) : (
              <>
                {/* Bar chart: revenue per branch */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">শাখাভিত্তিক রাজস্ব তুলনা</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {barData.length === 0 ? (
                      <p className="text-center py-8 text-sm text-muted-foreground">ডেটা নেই</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={barData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip
                            formatter={(v: number, n: string) => [n === 'রাজস্ব' ? fmt(v) : fmtNum(v), n]}
                            contentStyle={{ fontSize: 12 }}
                          />
                          <Legend wrapperStyle={{ fontSize: 12 }} />
                          <Bar dataKey="রাজস্ব" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="অর্ডার" fill="hsl(var(--primary) / 0.35)" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Branch comparison table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">শাখা তুলনা সারণি</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border/60 text-xs text-muted-foreground">
                            <th className="text-left px-4 py-3 font-medium">শাখা</th>
                            <th className="text-right px-4 py-3 font-medium">রাজস্ব</th>
                            <th className="text-right px-4 py-3 font-medium">অর্ডার</th>
                            <th className="text-right px-4 py-3 font-medium">গড় অর্ডার</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/40">
                          {analytics?.per_branch.map((b) => (
                            <tr key={b.restaurant_id} className="hover:bg-secondary/20 transition-colors">
                              <td className="px-4 py-3 font-medium">
                                {b.name}
                                {b.branch_code && (
                                  <span className="ml-2 text-xs text-muted-foreground">({b.branch_code})</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmt(b.revenue)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmtNum(b.orders)}</td>
                              <td className="px-4 py-3 text-right tabular-nums">{fmt(b.avg_order_value)}</td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-border font-semibold bg-secondary/30">
                            <td className="px-4 py-3">মোট</td>
                            <td className="px-4 py-3 text-right tabular-nums">{fmt(analytics?.total_revenue ?? 0)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">{fmtNum(analytics?.total_orders ?? 0)}</td>
                            <td className="px-4 py-3 text-right tabular-nums">
                              {analytics?.total_orders
                                ? fmt((analytics.total_revenue) / analytics.total_orders)
                                : '—'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* ── TAB: Shared Menu ───────────────────────── */}
          <TabsContent value="menu" className="space-y-4 pt-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                শেয়ার্ড আইটেম সকল শাখায় একসাথে পুশ হয়
              </p>
              <Button size="sm" onClick={openCreate} className="gap-1.5">
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
              <Button size="sm" variant="outline" onClick={() => navigate('/group/setup')} className="gap-1.5">
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
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                          isActive
                            ? 'bg-success/10 text-success border-success/20'
                            : 'bg-secondary text-muted-foreground border-border'
                        }`}>
                          {isActive ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Clock className="w-2.5 h-2.5" />}
                          {isActive ? 'সক্রিয়' : 'নিষ্ক্রিয়'}
                        </span>
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

                      <Button
                        size="sm"
                        variant={branchFilter === branch.id ? "default" : "outline"}
                        className="w-full gap-1.5 text-xs"
                        onClick={() => setBranchFilter(branchFilter === branch.id ? null : branch.id)}
                      >
                        {branchFilter === branch.id ? "ফিল্টার সরান" : "এই শাখা ফিল্টার করুন"}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {group.branches.length === 0 && (
              <div className="py-12 text-center space-y-3">
                <Building2 className="w-12 h-12 mx-auto text-muted-foreground/20" />
                <p className="text-sm text-muted-foreground">কোনো শাখা নেই</p>
                <Button size="sm" onClick={() => navigate('/group/setup')} className="gap-1.5">
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

      </div>
    </DashboardLayout>
  );
}
