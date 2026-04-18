// Advanced Analytics — Gemini AI powered (High Smart only)
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp, TrendingDown, Target, DollarSign, BarChart3,
  Lightbulb, AlertTriangle, RefreshCw, Clock, ShoppingBag,
  ChevronRight, Brain, Zap, Sparkles, CalendarDays, Star,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import FeatureGate from '@/components/FeatureGate';
import DashboardLayout from '@/components/DashboardLayout';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Area, AreaChart, Legend,
  ComposedChart, ReferenceLine,
} from 'recharts';
import { GoogleGenerativeAI } from '@google/generative-ai';

// ── Gemini client ──────────────────────────────────────────────────────────
const genAI = new GoogleGenerativeAI(import.meta.env.VITE_GEMINI_API_KEY || '');

async function getGeminiAdvancedInsights(payload: {
  orders: any[];
  menuItems: any[];
  categoryRevenue: any[];
  weeklyTrend: any[];
  dayOfWeek: any[];
  avgOrderValue: number;
  totalRevenue: number;
  revenueGrowth: string | null;
}) {
  const FALLBACK = {
    suggestions: 'বেস্টসেলার আইটেমগুলো সবসময় স্টকে রাখুন এবং পিক আওয়ারে যথেষ্ট স্টাফ নিশ্চিত করুন।',
    pricingTips: 'গড় অর্ডার মূল্য বাড়াতে কম্বো অফার ও Add-on items যোগ করুন।',
    marketingTips: 'নিয়মিত কাস্টমারদের জন্য loyalty discount চালু করুন।',
    forecastTip: 'পর্যাপ্ত ডেটা সংগ্রহ হলে ফোরকাস্ট পাওয়া যাবে।',
    menuOptimization: 'কম বিক্রীত আইটেমের দাম পর্যালোচনা করুন এবং জনপ্রিয় আইটেম promote করুন।',
    predictiveForecast: 'পর্যাপ্ত ডেটা সংগ্রহ হলে বিস্তারিত পূর্বাভাস পাওয়া যাবে। নিয়মিত অর্ডার ডেটা সংগ্রহ অব্যাহত রাখুন।',
    actionItems: [
      'স্টক আউট আইটেম দ্রুত রিস্টক করুন',
      'পিক আওয়ারে অতিরিক্ত স্টাফ রাখুন',
      'কম বিক্রীত আইটেমের দাম পর্যালোচনা করুন',
    ],
  };

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
    const prompt = `তুমি একজন বিশেষজ্ঞ রেস্টুরেন্ট বিজনেস অ্যানালিস্ট। নিচের ডেটা গভীরভাবে বিশ্লেষণ করে বাংলায় পরামর্শ দাও।

মোট রাজস্ব (৩০ দিন): ৳${payload.totalRevenue}
গড় অর্ডার মূল্য: ৳${payload.avgOrderValue}
রাজস্ব প্রবৃদ্ধি: ${payload.revenueGrowth || 'অপর্যাপ্ত ডেটা'}

সাপ্তাহিক ট্রেন্ড: ${JSON.stringify(payload.weeklyTrend)}
বারের বিক্রয়: ${JSON.stringify(payload.dayOfWeek)}
ক্যাটাগরি আয়: ${JSON.stringify(payload.categoryRevenue.slice(0, 6))}
শীর্ষ মেনু আইটেম: ${JSON.stringify(payload.menuItems.slice(0, 10).map(m => ({ name: m.name, price: m.price, category: m.category })))}
সাম্প্রতিক অর্ডার (নমুনা): ${JSON.stringify(payload.orders.slice(0, 30).map(o => ({ total: o.total, items: (o.order_items || []).map((i: any) => i.name) })))}

শুধুমাত্র এই JSON format এ উত্তর দাও (কোনো markdown নেই, কোনো backtick নেই):
{
  "suggestions": "ব্যবসার উন্নতির জন্য ২-৩টি সুনির্দিষ্ট পরামর্শ",
  "pricingTips": "মূল্য নির্ধারণ বিষয়ক পরামর্শ",
  "marketingTips": "মার্কেটিং ও প্রমোশন বিষয়ক পরামর্শ",
  "forecastTip": "আগামী সপ্তাহে কী হতে পারে তার পূর্বাভাস",
  "menuOptimization": "মেনু অপ্টিমাইজেশনের জন্য সুনির্দিষ্ট পরামর্শ",
  "predictiveForecast": "ট্রেন্ড বিশ্লেষণ করে আগামী ২ সপ্তাহের বিস্তারিত পূর্বাভাস — কোন দিন ব্যস্ত হবে, কোন আইটেমের চাহিদা বাড়বে, রাজস্ব কেমন হতে পারে",
  "actionItems": ["এখনই করণীয় ১", "এখনই করণীয় ২", "এখনই করণীয় ৩", "এখনই করণীয় ৪"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return FALLBACK;
  }
}

// ── Types ──────────────────────────────────────────────────────────────────
interface InsightData {
  topPerformers: { id: string; count: number }[];
  lowPerformers: string[];
  categoryRevenue: { category: string; revenue: number; orders: number }[];
  hourlyPattern: { hour: string; orders: number }[];
  weeklyTrend: { week: string; revenue: number; orders: number }[];
  dayOfWeek: { day: string; orders: number; revenue: number }[];
  menuScores: { name: string; score: number; trend: 'up' | 'down' | 'stable' }[];
  forecastRevenue: { week: string; actual?: number; predicted: number; isFuture?: boolean }[];
  demandForecast: { name: string; predictedOrders: number; trend: 'up' | 'down' | 'stable'; changePercent: number }[];
  avgOrderValue: number;
  revenueGrowth: string | null;
  peakHour: string | null;
  totalRevenue30d: number;
  totalOrders: number;
  suggestions: string;
  pricingTips: string;
  marketingTips: string;
  forecastTip: string;
  menuOptimization: string;
  predictiveForecast: string;
  actionItems: string[];
}

const DAY_NAMES = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহ', 'শুক্র', 'শনি'];

function linearRegression(ys: number[]) {
  const n = ys.length;
  if (n < 2) return { slope: 0, intercept: ys[0] || 0 };
  const xs = ys.map((_, i) => i);
  const sumX = xs.reduce((a, b) => a + b, 0);
  const sumY = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * ys[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

function buildForecastRevenue(weeklyTrend: { week: string; revenue: number }[]) {
  if (weeklyTrend.length === 0) return [];
  const ys = weeklyTrend.map(w => w.revenue);
  const { slope, intercept } = linearRegression(ys);
  const predict = (x: number) => Math.max(0, Math.round(intercept + slope * x));
  const result: { week: string; actual?: number; predicted: number; isFuture?: boolean }[] = weeklyTrend.map((w, i) => ({
    week: w.week,
    actual: w.revenue,
    predicted: predict(i),
  }));
  result.push({ week: 'আগামী সপ্তাহ', predicted: predict(weeklyTrend.length), isFuture: true });
  result.push({ week: '২ সপ্তাহ পর', predicted: predict(weeklyTrend.length + 1), isFuture: true });
  return result;
}

export default function AIInsights() {
  const { restaurantId } = useAuth();
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [loading, setLoading] = useState(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInsights = async () => {
    setLoading(true);
    setError(null);
    try {
      // ── Fetch menu items ──
      const { data: menuData } = await supabase
        .from('menu_items')
        .select('id, name, price, category, available')
        .eq('restaurant_id', restaurantId);
      const items = menuData || [];
      setMenuItems(items);

      // ── Fetch 30 days orders ──
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total, status, created_at, order_items(name, quantity, price, menu_item_id)')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      const allOrders = orders || [];

      // ── Category revenue ──
      const catMap: Record<string, { revenue: number; orders: number }> = {};
      allOrders.forEach((o: any) => {
        (o.order_items || []).forEach((oi: any) => {
          const cat = items.find(m => m.id === oi.menu_item_id)?.category || 'অন্যান্য';
          if (!catMap[cat]) catMap[cat] = { revenue: 0, orders: 0 };
          catMap[cat].revenue += oi.price * oi.quantity;
          catMap[cat].orders += oi.quantity;
        });
      });
      const categoryRevenue = Object.entries(catMap)
        .map(([category, v]) => ({ category, ...v }))
        .sort((a, b) => b.revenue - a.revenue).slice(0, 6);

      // ── Hourly pattern ──
      const hourMap: Record<string, number> = {};
      allOrders.forEach((o: any) => {
        const h = new Date(o.created_at).getHours();
        hourMap[`${h}:00`] = (hourMap[`${h}:00`] || 0) + 1;
      });
      const hourlyPattern = Object.entries(hourMap)
        .map(([hour, orders]) => ({ hour, orders }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour));
      const peakHour = [...hourlyPattern].sort((a, b) => b.orders - a.orders)[0]?.hour || null;

      // ── Weekly trend (last 4 weeks) ──
      const weeklyMap: Record<string, { revenue: number; orders: number }> = {};
      allOrders.forEach((o: any) => {
        const d = new Date(o.created_at);
        const daysAgo = Math.floor((Date.now() - d.getTime()) / 86400000);
        const weekNum = Math.floor(daysAgo / 7);
        if (weekNum > 3) return;
        const label = weekNum === 0 ? 'এই সপ্তাহ' : weekNum === 1 ? 'গত সপ্তাহ' : `${weekNum + 1} সপ্তাহ আগে`;
        if (!weeklyMap[label]) weeklyMap[label] = { revenue: 0, orders: 0 };
        weeklyMap[label].revenue += Number(o.total);
        weeklyMap[label].orders += 1;
      });
      const weeklyTrend = [
        '৩ সপ্তাহ আগে', '৪ সপ্তাহ আগে'.replace('৪', '৩').replace('৩ সপ্তাহ আগে', '৩ সপ্তাহ আগে'),
        '২ সপ্তাহ আগে', 'গত সপ্তাহ', 'এই সপ্তাহ',
      ]
        .filter(w => weeklyMap[w])
        .map(week => ({ week, ...weeklyMap[week] }));

      // ── Day of week ──
      const dayMap: Record<number, { orders: number; revenue: number }> = {};
      allOrders.forEach((o: any) => {
        const d = new Date(o.created_at).getDay();
        if (!dayMap[d]) dayMap[d] = { orders: 0, revenue: 0 };
        dayMap[d].orders += 1;
        dayMap[d].revenue += Number(o.total);
      });
      const dayOfWeek = DAY_NAMES.map((day, i) => ({
        day,
        orders: dayMap[i]?.orders || 0,
        revenue: dayMap[i]?.revenue || 0,
      }));

      // ── Item frequency + scores ──
      const itemFreq: Record<string, number> = {};
      allOrders.forEach((o: any) => {
        (o.order_items || []).forEach((oi: any) => {
          const id = oi.menu_item_id;
          if (id) itemFreq[id] = (itemFreq[id] || 0) + oi.quantity;
        });
      });
      const sortedItems = Object.entries(itemFreq).sort((a, b) => b[1] - a[1]);
      const topPerformers = sortedItems.slice(0, 5).map(([id, count]) => ({ id, count }));
      const lowPerformers = sortedItems.filter(([, c]) => c < 3).slice(0, 3).map(([id]) => id);

      const maxCount = sortedItems[0]?.[1] || 1;
      const menuScores = items.slice(0, 8).map(m => {
        const cnt = itemFreq[m.id] || 0;
        const score = Math.round((cnt / maxCount) * 5 * 10) / 10;
        return {
          name: m.name,
          score: Math.max(score, 0.1),
          trend: cnt > (maxCount * 0.4) ? 'up' as const : cnt < 2 ? 'down' as const : 'stable' as const,
        };
      }).sort((a, b) => b.score - a.score).slice(0, 6);

      // ── Revenue stats ──
      const totalRevenue30d = allOrders.reduce((s: number, o: any) => s + Number(o.total), 0);
      const avgOrderValue = allOrders.length > 0 ? Math.round(totalRevenue30d / allOrders.length) : 0;
      const now = Date.now();
      const thisW = allOrders.filter(o => new Date(o.created_at).getTime() > now - 7 * 86400000)
        .reduce((s: number, o: any) => s + Number(o.total), 0);
      const lastW = allOrders.filter(o => {
        const t = new Date(o.created_at).getTime();
        return t > now - 14 * 86400000 && t <= now - 7 * 86400000;
      }).reduce((s: number, o: any) => s + Number(o.total), 0);
      const revenueGrowth = lastW > 0
        ? `${((thisW - lastW) / lastW * 100) >= 0 ? '+' : ''}${Math.round((thisW - lastW) / lastW * 100)}%`
        : thisW > 0 ? 'নতুন' : null;

      // ── Predictive: revenue forecast ──
      const forecastRevenue = buildForecastRevenue(weeklyTrend);

      // ── Predictive: demand forecast per item (recent 2w vs prior 2w) ──
      const recentCutoff = now - 14 * 86400000;
      const recentFreq: Record<string, number> = {};
      const olderFreq: Record<string, number> = {};
      allOrders.forEach((o: any) => {
        const isRecent = new Date(o.created_at).getTime() > recentCutoff;
        (o.order_items || []).forEach((oi: any) => {
          const id = oi.menu_item_id;
          if (!id) return;
          if (isRecent) recentFreq[id] = (recentFreq[id] || 0) + oi.quantity;
          else olderFreq[id] = (olderFreq[id] || 0) + oi.quantity;
        });
      });
      const demandForecast = Object.entries(recentFreq)
        .map(([id, recent]) => {
          const older = olderFreq[id] || 0;
          const changePercent = older > 0 ? Math.round(((recent - older) / older) * 100) : recent > 0 ? 100 : 0;
          const predictedOrders = Math.round(recent * 1.1);
          const trend: 'up' | 'down' | 'stable' = changePercent > 10 ? 'up' : changePercent < -10 ? 'down' : 'stable';
          return { name: items.find(m => m.id === id)?.name || id, predictedOrders, trend, changePercent };
        })
        .sort((a, b) => b.predictedOrders - a.predictedOrders)
        .slice(0, 6);

      // ── Gemini AI ──
      const aiResult = await getGeminiAdvancedInsights({
        orders: allOrders,
        menuItems: items,
        categoryRevenue,
        weeklyTrend,
        dayOfWeek,
        avgOrderValue,
        totalRevenue: totalRevenue30d,
        revenueGrowth,
      });

      setInsights({
        topPerformers, lowPerformers, categoryRevenue,
        hourlyPattern, weeklyTrend, dayOfWeek, menuScores,
        forecastRevenue, demandForecast,
        avgOrderValue, revenueGrowth, peakHour,
        totalRevenue30d, totalOrders: allOrders.length,
        ...aiResult,
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
    <DashboardLayout role="admin" title="অ্যাডভান্সড অ্যানালিটিক্স">
      <FeatureGate feature="ai_recommendations">
        <div className="space-y-6 animate-fade-up">

          {/* Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-purple-500" />
                </div>
                অ্যাডভান্সড অ্যানালিটিক্স
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Gemini AI + রিয়েল ডেটা — গত ৩০ দিনের গভীর বিশ্লেষণ
              </p>
              {lastUpdated && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Zap className="w-3 h-3 text-purple-400" /> শেষ আপডেট: {lastUpdated}
                </p>
              )}
            </div>
            <Button onClick={loadInsights} disabled={loading} variant="hero"
              className="gap-2 bg-gradient-to-r from-purple-600 to-purple-500">
              {loading
                ? <><RefreshCw className="w-4 h-4 animate-spin" /> বিশ্লেষণ হচ্ছে...</>
                : <><Sparkles className="w-4 h-4" /> {insights ? 'রিফ্রেশ করুন' : 'Gemini বিশ্লেষণ শুরু করুন'}</>}
            </Button>
          </div>

          {error && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Empty state */}
          {!insights && !loading && !error && (
            <Card className="border-dashed border-purple-500/30">
              <CardContent className="py-16 text-center space-y-5">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center mx-auto">
                  <Sparkles className="w-10 h-10 text-purple-400" />
                </div>
                <div>
                  <p className="font-bold text-foreground text-xl">Gemini AI অ্যাডভান্সড অ্যানালিটিক্স</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                    গত ৩০ দিনের অর্ডার ডেটা বিশ্লেষণ করে সাপ্তাহিক ট্রেন্ড, ফোরকাস্ট,
                    মেনু অপ্টিমাইজেশন এবং বিস্তারিত AI পরামর্শ দেবে।
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                  {['📈 সাপ্তাহিক ট্রেন্ড', '📅 বারের বিক্রয়', '🏆 মেনু স্কোর', '🔮 ফোরকাস্ট', '💡 AI পরামর্শ', '⏰ পিক আওয়ার'].map(t => (
                    <span key={t} className="bg-secondary px-3 py-1 rounded-full">{t}</span>
                  ))}
                </div>
                <Button onClick={loadInsights}
                  className="bg-gradient-to-r from-purple-600 to-purple-500 text-white gap-2 px-8 py-3 rounded-xl text-sm font-semibold hover:opacity-90">
                  <Sparkles className="w-4 h-4" /> বিশ্লেষণ শুরু করুন
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Skeleton */}
          {loading && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1,2,3,4].map(i => <div key={i} className="h-28 rounded-2xl bg-secondary/40 animate-pulse" />)}
              </div>
              {[1,2,3].map(i => <div key={i} className="h-64 rounded-2xl bg-secondary/40 animate-pulse" />)}
            </div>
          )}

          {insights && !loading && (
            <>
              {/* ── KPI Row ── */}
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
                    <p className="text-2xl font-bold">{insights.totalOrders}</p>
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

              {/* ── Weekly Revenue Trend ── */}
              {insights.weeklyTrend.length > 1 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="w-5 h-5 text-success" /> সাপ্তাহিক রাজস্ব ট্রেন্ড
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={insights.weeklyTrend}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `৳${v}`} />
                        <Tooltip
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(v: any, name: string) => [name === 'revenue' ? `৳${v}` : v, name === 'revenue' ? 'রাজস্ব' : 'অর্ডার']}
                        />
                        <Legend formatter={v => v === 'revenue' ? 'রাজস্ব' : 'অর্ডার'} />
                        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} />
                        <Line type="monotone" dataKey="orders" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 4 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* ── Predictive Analytics ── */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 pb-1">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base">প্রেডিক্টিভ অ্যানালিটিক্স</h3>
                    <p className="text-xs text-muted-foreground">Linear Regression + Gemini AI পূর্বাভাস</p>
                  </div>
                  <Badge className="ml-auto text-xs bg-blue-500/15 text-blue-500 border-blue-500/30 border">
                    AI Forecast
                  </Badge>
                </div>

                {/* Revenue Forecast Chart */}
                {insights.forecastRevenue.length > 1 && (
                  <Card className="border-blue-500/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <TrendingUp className="w-5 h-5 text-blue-500" /> রাজস্ব পূর্বাভাস (আগামী ২ সপ্তাহ)
                        <Badge variant="outline" className="ml-auto text-xs border-blue-500/30 text-blue-400">
                          রিগ্রেশন মডেল
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={260}>
                        <ComposedChart data={insights.forecastRevenue} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                          <defs>
                            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.7} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `৳${v}`} />
                          <Tooltip
                            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                            formatter={(v: any, name: string) => [`৳${v}`, name === 'actual' ? 'প্রকৃত রাজস্ব' : 'পূর্বাভাস']}
                          />
                          <Legend formatter={v => v === 'actual' ? 'প্রকৃত রাজস্ব' : 'পূর্বাভাস (মডেল)'} />
                          <ReferenceLine
                            x={insights.forecastRevenue.find(d => d.isFuture)?.week}
                            stroke="#3b82f6"
                            strokeDasharray="4 2"
                            label={{ value: 'পূর্বাভাস →', fill: '#3b82f6', fontSize: 11 }}
                          />
                          <Bar dataKey="actual" fill="url(#actualGrad)" radius={[5, 5, 0, 0]} name="actual" />
                          <Line
                            type="monotone"
                            dataKey="predicted"
                            stroke="#3b82f6"
                            strokeWidth={2.5}
                            strokeDasharray="7 3"
                            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                            activeDot={{ r: 6 }}
                            name="predicted"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                      <p className="text-xs text-muted-foreground text-center mt-2">
                        নীল ড্যাশ লাইন = মডেল পূর্বাভাস • ব্লু বার = প্রকৃত রাজস্ব
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Demand Forecast + Gemini Predictive */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="border-blue-500/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <ShoppingBag className="w-5 h-5 text-blue-500" /> আইটেম চাহিদা পূর্বাভাস
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {insights.demandForecast.length > 0 ? insights.demandForecast.map((item, i) => (
                        <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/50 transition-colors">
                          <span className="text-xs font-bold text-muted-foreground w-4 flex-shrink-0">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">পূর্বাভাস: ~{item.predictedOrders} অর্ডার</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {item.trend === 'up' && (
                              <Badge className="text-xs bg-success/15 text-success border-success/30 border gap-1">
                                <TrendingUp className="w-3 h-3" /> +{item.changePercent}%
                              </Badge>
                            )}
                            {item.trend === 'down' && (
                              <Badge className="text-xs bg-destructive/15 text-destructive border-destructive/30 border gap-1">
                                <TrendingDown className="w-3 h-3" /> {item.changePercent}%
                              </Badge>
                            )}
                            {item.trend === 'stable' && (
                              <Badge variant="outline" className="text-xs text-muted-foreground">
                                স্থিতিশীল
                              </Badge>
                            )}
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground text-center py-8">পর্যাপ্ত অর্ডার ডেটা নেই</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                          <Brain className="w-4 h-4 text-blue-500" />
                        </div>
                        Gemini প্রেডিক্টিভ ইনসাইট
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {insights.predictiveForecast ? (
                        <div className="p-4 rounded-xl bg-blue-500/8 border border-blue-500/20">
                          <div className="flex items-start gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-base">🔮</span>
                            </div>
                            <div>
                              <p className="text-xs font-semibold text-blue-400 mb-2">আগামী ২ সপ্তাহের পূর্বাভাস</p>
                              <p className="text-sm leading-relaxed">{insights.predictiveForecast}</p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">পূর্বাভাস লোড হচ্ছে...</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* ── Day of Week + Hourly ── */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="w-5 h-5 text-primary" /> বারভিত্তিক বিক্রয়
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={insights.dayOfWeek}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(v: any) => [v, 'অর্ডার']}
                        />
                        <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="w-5 h-5 text-warning" /> ঘণ্টাভিত্তিক প্যাটার্ন
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
              </div>

              {/* ── Menu Score + Top Performers ── */}
              <div className="grid gap-6 md:grid-cols-2">
                {/* Menu performance scores */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Star className="w-5 h-5 text-warning" /> মেনু পারফরম্যান্স স্কোর
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {insights.menuScores.length > 0 ? insights.menuScores.map((item, i) => (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium truncate">{item.name}</span>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              {item.trend === 'up' && <TrendingUp className="w-3.5 h-3.5 text-success" />}
                              {item.trend === 'down' && <TrendingDown className="w-3.5 h-3.5 text-destructive" />}
                              <span className="text-xs font-bold text-muted-foreground">{item.score}/5</span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${item.score >= 4 ? 'bg-success' : item.score >= 2.5 ? 'bg-primary' : 'bg-warning'}`}
                              style={{ width: `${(item.score / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    )) : <p className="text-sm text-muted-foreground text-center py-6">পর্যাপ্ত অর্ডার ডেটা নেই</p>}
                  </CardContent>
                </Card>

                {/* Top + Low Performers */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="w-5 h-5 text-success" /> শীর্ষ ও দুর্বল আইটেম
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {insights.topPerformers.length > 0 ? (
                      <ul className="space-y-2">
                        {insights.topPerformers.map(({ id, count }, i) => (
                          <li key={i} className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50 transition-colors">
                            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                              i === 0 ? 'bg-warning text-warning-foreground' :
                              i === 1 ? 'bg-secondary text-foreground' :
                              'bg-secondary/50 text-muted-foreground'
                            }`}>
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                            </span>
                            <span className="font-medium text-sm flex-1">{getItemName(id)}</span>
                            <span className="text-xs text-muted-foreground">{count} বিক্রি</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="text-sm text-muted-foreground text-center py-4">পর্যাপ্ত ডেটা নেই</p>}
                    {insights.lowPerformers.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-border/50">
                        <p className="text-xs font-semibold text-warning mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> কম বিক্রীত
                        </p>
                        {insights.lowPerformers.map((id, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-warning flex-shrink-0" />
                            {getItemName(id)}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── Category Revenue ── */}
              {insights.categoryRevenue.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="w-5 h-5 text-primary" /> ক্যাটাগরি ভিত্তিক আয়
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={260}>
                      <BarChart data={insights.categoryRevenue} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={v => `৳${v}`} />
                        <Tooltip
                          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
                          formatter={(v: any, name: string) => [name === 'revenue' ? `৳${v}` : v, name === 'revenue' ? 'আয়' : 'অর্ডার']}
                        />
                        <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="revenue" />
                        <Bar dataKey="orders" fill="hsl(var(--success))" radius={[6, 6, 0, 0]} name="orders" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}

              {/* ── Gemini AI Insights ── */}
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="border-purple-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                        <Brain className="w-4 h-4 text-purple-500" />
                      </div>
                      Gemini AI পরামর্শ
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { key: 'suggestions', icon: <Lightbulb className="w-4 h-4 text-purple-500" />, label: 'ব্যবসায়িক পরামর্শ', color: 'bg-purple-500/5 border-purple-500/20' },
                      { key: 'pricingTips', icon: <DollarSign className="w-4 h-4 text-primary" />, label: 'মূল্য পরামর্শ', color: 'bg-primary/5 border-primary/20' },
                      { key: 'marketingTips', icon: <Zap className="w-4 h-4 text-success" />, label: 'মার্কেটিং পরামর্শ', color: 'bg-success/5 border-success/20' },
                    ].map(({ key, icon, label, color }) => (
                      (insights as any)[key] && (
                        <div key={key} className={`p-3 rounded-xl border ${color}`}>
                          <div className="flex items-start gap-2">
                            <span className="flex-shrink-0 mt-0.5">{icon}</span>
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">{label}</p>
                              <p className="text-sm leading-relaxed">{(insights as any)[key]}</p>
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                  </CardContent>
                </Card>

                <Card className="border-blue-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-blue-500" />
                      </div>
                      ফোরকাস্ট ও অপ্টিমাইজেশন
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {insights.forecastTip && (
                      <div className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                        <div className="flex items-start gap-2">
                          <TrendingUp className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-blue-500 mb-1">🔮 আগামী সপ্তাহের পূর্বাভাস</p>
                            <p className="text-sm leading-relaxed">{insights.forecastTip}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {insights.menuOptimization && (
                      <div className="p-3 rounded-xl bg-warning/5 border border-warning/20">
                        <div className="flex items-start gap-2">
                          <Star className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-warning mb-1">মেনু অপ্টিমাইজেশন</p>
                            <p className="text-sm leading-relaxed">{insights.menuOptimization}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* ── Action Items ── */}
              <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Target className="w-5 h-5 text-purple-500" /> Gemini-সুপারিশকৃত পদক্ষেপ
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {insights.actionItems.length > 0
                      ? insights.actionItems.map((tip, i) => (
                          <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 hover:bg-secondary/60 transition-colors">
                            <ChevronRight className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm">{tip}</p>
                          </div>
                        ))
                      : <p className="text-sm text-muted-foreground text-center py-4 col-span-2">পর্যাপ্ত ডেটা সংগ্রহ হলে পদক্ষেপ দেখাবে</p>
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
