// AI Insights — Professional AI-powered menu & business intelligence (Claude-powered)
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, TrendingDown, Target,
  DollarSign, BarChart3, Lightbulb, AlertTriangle, RefreshCw,
  Clock, ShoppingBag, ChevronRight, Brain, Zap
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import FeatureGate from '@/components/FeatureGate';
import DashboardLayout from '@/components/DashboardLayout';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  available: boolean;
}

interface InsightData {
  topPerformers: string[];
  lowPerformers: string[];
  suggestions: string;
  pricingTips: string;
  marketingTips: string;
  categoryRevenue: { category: string; revenue: number; orders: number }[];
  hourlyPattern: { hour: string; orders: number }[];
  avgOrderValue: number;
  revenueGrowth: string | null;
  peakHour: string | null;
  totalRevenue30d: number;
  actionItems: string[];
}

const FALLBACK_AI = {
  suggestions: 'বেস্টসেলার আইটেমগুলো সবসময় স্টকে রাখুন এবং পিক আওয়ারে যথেষ্ট স্টাফ নিশ্চিত করুন।',
  pricingTips: 'গড় অর্ডার মূল্য বাড়াতে কম্বো অফার এবং Add-on items যোগ করুন।',
  marketingTips: 'নিয়মিত কাস্টমারদের জন্য loyalty discount চালু করুন।',
  actionItems: ['স্টক আউট আইটেম দ্রুত রিস্টক করুন', 'পিক আওয়ারে অতিরিক্ত স্টাফ রাখুন', 'কম বিক্রীত আইটেমের দাম পর্যালোচনা করুন'],
};

// Claude AI — routes via Supabase Edge Function (preferred) or direct API (fallback)
async function getClaudeInsights(salesData: any[], menuItems: MenuItem[]) {
  const topItems = menuItems.slice(0, 15).map(m => ({ name: m.name, price: m.price, category: m.category }));
  const recentOrders = salesData.slice(0, 40).map(o => ({
    total: o.total,
    items: (o.order_items || []).map((i: any) => i.name),
  }));

  const prompt = `তুমি একজন বিশেষজ্ঞ রেস্টুরেন্ট বিজনেস অ্যানালিস্ট। নিচের ডেটা বিশ্লেষণ করে বাংলায় পরামর্শ দাও।

মেনু আইটেম: ${JSON.stringify(topItems)}
সাম্প্রতিক অর্ডার (৩০ দিন): ${JSON.stringify(recentOrders)}

শুধুমাত্র এই JSON format এ উত্তর দাও (কোনো markdown নেই):
{
  "suggestions": "ব্যবসার উন্নতির জন্য ২-৩টি সুনির্দিষ্ট পরামর্শ",
  "pricingTips": "মূল্য নির্ধারণ বিষয়ক ১-২টি পরামর্শ",
  "marketingTips": "মার্কেটিং ও প্রমোশন বিষয়ক পরামর্শ",
  "actionItems": ["এখনই করণীয় ১", "এখনই করণীয় ২", "এখনই করণীয় ৩"]
}`;

  // 1) Try Supabase Edge Function (key stays server-side — safest)
  try {
    const { data: fnData, error: fnError } = await supabase.functions.invoke('ai-insights', {
      body: { prompt },
    });
    if (!fnError && fnData?.content) {
      const clean = fnData.content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(clean);
    }
  } catch (_) { /* edge fn not deployed */ }

  // 2) Direct browser call — requires VITE_ANTHROPIC_API_KEY in .env
  try {
    const apiKey = (import.meta as any).env?.VITE_ANTHROPIC_API_KEY as string | undefined;
    if (!apiKey) return FALLBACK_AI;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) return FALLBACK_AI;
    const data = await res.json();
    const text = data.content?.map((c: any) => c.text || '').join('') || '';
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
  } catch (_) {
    return FALLBACK_AI;
  }
}

export default function AIInsights() {
  const { restaurantId } = useAuth();
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [rawOrders, setRawOrders] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: menuData, error: menuErr } = await supabase
        .from('menu_items')
        .select('id, name, price, category, available')
        .eq('restaurant_id', restaurantId);
      if (menuErr) throw menuErr;
      const items = (menuData || []) as MenuItem[];
      setMenuItems(items);

      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: orders, error: ordersErr } = await supabase
        .from('orders')
        .select('id, total, status, created_at, order_items(name, quantity, price, menu_item_id)')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (ordersErr) throw ordersErr;
      const allOrders = orders || [];
      setRawOrders(allOrders);

      const allItems = allOrders.flatMap((o: any) => o.order_items || []);

      // Category revenue
      const catMap: Record<string, { revenue: number; orders: number }> = {};
      allOrders.forEach((o: any) => {
        (o.order_items || []).forEach((oi: any) => {
          const menuItem = items.find(m => m.id === oi.menu_item_id);
          const cat = menuItem?.category || 'অন্যান্য';
          if (!catMap[cat]) catMap[cat] = { revenue: 0, orders: 0 };
          catMap[cat].revenue += oi.price * oi.quantity;
          catMap[cat].orders += oi.quantity;
        });
      });
      const categoryRevenue = Object.entries(catMap)
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.revenue - a.revenue).slice(0, 6);

      // Hourly pattern
      const hourMap: Record<string, number> = {};
      allOrders.forEach((o: any) => {
        const h = new Date(o.created_at).getHours();
        hourMap[`${h}:00`] = (hourMap[`${h}:00`] || 0) + 1;
      });
      const hourlyPattern = Object.entries(hourMap)
        .map(([hour, orders]) => ({ hour, orders }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
      const peakHour = [...hourlyPattern].sort((a, b) => b.orders - a.orders)[0]?.hour || null;

      // Item frequency
      const itemFreq: Record<string, number> = {};
      allItems.forEach((oi: any) => {
        const id = oi.menu_item_id || oi.name;
        itemFreq[id] = (itemFreq[id] || 0) + oi.quantity;
      });
      const sortedItems = Object.entries(itemFreq).sort((a, b) => b[1] - a[1]);
      const topIds = sortedItems.slice(0, 5).map(([id]) => id);
      const lowIds = sortedItems.filter(([, c]) => c < 3).slice(0, 3).map(([id]) => id);

      // Revenue growth
      const now = Date.now();
      const thisWeekRev = allOrders.filter(o => new Date(o.created_at).getTime() > now - 7 * 86400000)
        .reduce((s: number, o: any) => s + Number(o.total), 0);
      const lastWeekRev = allOrders.filter(o => {
        const t = new Date(o.created_at).getTime();
        return t > now - 14 * 86400000 && t <= now - 7 * 86400000;
      }).reduce((s: number, o: any) => s + Number(o.total), 0);
      let revenueGrowth: string | null = null;
      if (lastWeekRev > 0) {
        const pct = Math.round(((thisWeekRev - lastWeekRev) / lastWeekRev) * 100);
        revenueGrowth = pct >= 0 ? `+${pct}%` : `${pct}%`;
      } else if (thisWeekRev > 0) revenueGrowth = 'নতুন';

      const totalRevenue30d = allOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
      const avgOrderValue = allOrders.length > 0 ? Math.round(totalRevenue30d / allOrders.length) : 0;

      const aiResult = await getClaudeInsights(allOrders.slice(0, 50), items);

      const localActionItems: string[] = [];
      if (topIds.length > 0) {
        const topName = items.find(m => m.id === topIds[0])?.name || topIds[0];
        localActionItems.push(`🏆 "${topName}" বেস্টসেলার — সবসময় স্টকে রাখুন`);
      }
      if (peakHour) localActionItems.push(`⏰ ${peakHour} পিক আওয়ার — এই সময়ে অতিরিক্ত স্টাফ দিন`);
      if (avgOrderValue > 0) localActionItems.push(`💰 গড় অর্ডার ৳${avgOrderValue} — combo offer দিয়ে বাড়ান`);

      setInsights({
        topPerformers: topIds,
        lowPerformers: lowIds,
        suggestions: aiResult.suggestions,
        pricingTips: aiResult.pricingTips,
        marketingTips: aiResult.marketingTips,
        categoryRevenue,
        hourlyPattern,
        avgOrderValue,
        revenueGrowth,
        peakHour,
        totalRevenue30d,
        actionItems: [...localActionItems, ...aiResult.actionItems].slice(0, 6),
      });
      setLastUpdated(new Date().toLocaleString('bn-BD'));
    } catch (err: any) {
      setError(err.message || 'বিশ্লেষণ লোড করতে সমস্যা হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  const getItemName = (id: string) => menuItems.find(m => m.id === id)?.name || id;
  const isGrowthPositive = insights?.revenueGrowth && !insights.revenueGrowth.startsWith('-');

  return (
    <DashboardLayout role="admin" title="AI ইনসাইটস">
      <FeatureGate feature="ai_recommendations">
        <div className="space-y-6 animate-fade-up">
          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-purple-500" />
                </div>
                AI মেনু ইনসাইটস
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Claude AI + রিয়েল ডেটা — গত ৩০ দিনের তথ্যের উপর ভিত্তি করে
              </p>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-purple-400" /> শেষ আপডেট: {lastUpdated}
                </p>
              )}
            </div>
            <Button onClick={loadInsights} disabled={loading} variant="hero" className="gap-2 bg-gradient-to-r from-purple-600 to-purple-500">
              {loading
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> বিশ্লেষণ হচ্ছে...</>
                : <><Brain className="w-4 h-4" /> {insights ? 'রিফ্রেশ করুন' : 'AI বিশ্লেষণ শুরু করুন'}</>}
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {!insights && !loading && !error && (
            <Card className="border-dashed border-purple-500/30">
              <CardContent className="py-16 text-center space-y-5">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center mx-auto">
                  <Brain className="w-10 h-10 text-purple-400" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-xl">Claude AI বিশ্লেষণ</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    গত ৩০ দিনের অর্ডার ডেটা বিশ্লেষণ করে মেনু অপ্টিমাইজেশন, মূল্য নির্ধারণ ও বিক্রয় বৃদ্ধির পরামর্শ দেবে।
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                  {['🏆 শীর্ষ আইটেম', '📊 ক্যাটাগরি রিপোর্ট', '⏰ পিক আওয়ার', '💡 AI পরামর্শ', '💰 মূল্য বিশ্লেষণ', '📈 বিক্রয় ট্রেন্ড'].map(t => (
                    <span key={t} className="bg-secondary px-3 py-1 rounded-full">{t}</span>
                  ))}
                </div>
                <Button onClick={loadInsights} className="bg-gradient-to-r from-purple-600 to-purple-500 text-white gap-2 px-8 py-3 rounded-xl text-sm font-semibold hover:opacity-90">
                  <Brain className="w-4 h-4" /> বিশ্লেষণ শুরু করুন
                </Button>
              </CardContent>
            </Card>
          )}

          {loading && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-secondary/40 animate-pulse" />)}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="h-64 rounded-2xl bg-secondary/40 animate-pulse" />
                <div className="h-64 rounded-2xl bg-secondary/40 animate-pulse" />
              </div>
            </div>
          )}

          {insights && !loading && (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-3">
                      <ShoppingBag className="w-5 h-5 text-purple-500" />
                      {insights.revenueGrowth && (
                        <Badge className={`text-xs border ${isGrowthPositive ? 'bg-success/15 text-success border-success/30' : 'bg-destructive/15 text-destructive border-destructive/30'}`}>
                          {isGrowthPositive ? <TrendingUp className="w-3 h-3 mr-1 inline" /> : <TrendingDown className="w-3 h-3 mr-1 inline" />}
                          {insights.revenueGrowth}
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold">{rawOrders.length}</p>
                    <p className="text-xs text-muted-foreground mt-1">মোট অর্ডার (৩০ দিন)</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
                  <CardContent className="p-5">
                    <DollarSign className="w-5 h-5 text-success mb-3" />
                    <p className="text-2xl font-bold">৳{insights.totalRevenue30d.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground mt-1">মোট রাজস্ব (৩০ দিন)</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                  <CardContent className="p-5">
                    <TrendingUp className="w-5 h-5 text-primary mb-3" />
                    <p className="text-2xl font-bold">৳{insights.avgOrderValue}</p>
                    <p className="text-xs text-muted-foreground mt-1">গড় অর্ডার মূল্য</p>
                  </CardContent>
                </Card>
                <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
                  <CardContent className="p-5">
                    <Clock className="w-5 h-5 text-warning mb-3" />
                    <p className="text-2xl font-bold">{insights.peakHour || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground mt-1">পিক আওয়ার</p>
                  </CardContent>
                </Card>
              </div>

              {/* Performers + AI Suggestions */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="w-7 h-7 rounded-lg bg-success/15 flex items-center justify-center">
                        <TrendingUp className="w-4 h-4 text-success" />
                      </div>
                      শীর্ষ বিক্রীত আইটেম
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {insights.topPerformers.length > 0 ? (
                      <ul className="space-y-2.5">
                        {insights.topPerformers.map((id, i) => (
                          <li key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 transition-colors">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              i === 0 ? 'bg-warning text-warning-foreground' :
                              i === 1 ? 'bg-secondary text-foreground' :
                              i === 2 ? 'bg-orange-600/20 text-orange-600' : 'bg-secondary/50 text-muted-foreground'
                            }`}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                            </span>
                            <span className="font-medium text-sm flex-1">{getItemName(id)}</span>
                            {i === 0 && <Badge variant="outline" className="text-[10px] border-success/40 text-success">বেস্টসেলার</Badge>}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">পর্যাপ্ত অর্ডার ডেটা নেই</p>
                    )}
                    {insights.lowPerformers.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-xs font-semibold text-warning mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> কম বিক্রীত আইটেম
                        </p>
                        {insights.lowPerformers.map((id, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground mb-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" />
                            {getItemName(id)}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-purple-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-purple-500" />
                      </div>
                      Claude AI পরামর্শ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {insights.suggestions && (
                      <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
                        <div className="flex items-start gap-2">
                          <Lightbulb className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-purple-500 mb-1">ব্যবসায়িক পরামর্শ</p>
                            <p className="text-sm leading-relaxed">{insights.suggestions}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {insights.pricingTips && (
                      <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                        <div className="flex items-start gap-2">
                          <DollarSign className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-primary mb-1">মূল্য পরামর্শ</p>
                            <p className="text-sm leading-relaxed">{insights.pricingTips}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {insights.marketingTips && (
                      <div className="p-4 rounded-xl bg-success/5 border border-success/20">
                        <div className="flex items-start gap-2">
                          <Zap className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-success mb-1">মার্কেটিং পরামর্শ</p>
                            <p className="text-sm leading-relaxed">{insights.marketingTips}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Category Revenue Chart */}
              {insights.categoryRevenue.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="w-5 h-5 text-primary" /> ক্যাটাগরি ভিত্তিক আয়
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={insights.categoryRevenue} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `৳${v}`} />
                        <Tooltip
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(v: any) => [`৳${v}`, 'আয়']}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Hourly Pattern */}
              {insights.hourlyPattern.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="w-5 h-5 text-warning" /> ঘণ্টাভিত্তিক অর্ডার প্যাটার্ন
                      {insights.peakHour && (
                        <Badge variant="outline" className="ml-auto text-xs border-warning/40 text-warning">
                          পিক: {insights.peakHour}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={insights.hourlyPattern}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(v: any) => [v, 'অর্ডার']}
                        />
                        <Bar dataKey="orders" fill="hsl(38, 90%, 55%)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* Action Items */}
              <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="w-5 h-5 text-purple-500" /> AI-সুপারিশকৃত পদক্ষেপ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {insights.actionItems.length > 0
                      ? insights.actionItems.map((tip, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-colors">
                            <ChevronRight className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm">{tip}</p>
                          </div>
                        ))
                      : <p className="text-sm text-muted-foreground text-center py-4">পর্যাপ্ত ডেটা সংগ্রহ হলে পদক্ষেপ দেখাবে</p>
                    }
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
