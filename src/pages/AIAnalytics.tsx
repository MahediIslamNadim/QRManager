import { useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import FeatureGate from "@/components/FeatureGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarDays,
  Clock,
  DollarSign,
  Lightbulb,
  Loader2,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

type AIInsights = {
  suggestions: string;
  pricingTips: string;
  marketingTips: string;
  forecastTip: string;
  menuOptimization: string;
  predictiveForecast: string;
  actionItems: string[];
};

type Trend = "up" | "down" | "stable";

type AIAnalyticsData = {
  totalRevenue30d: number;
  totalOrders: number;
  avgOrderValue: number;
  revenueGrowth: string | null;
  peakHour: string | null;
  completionRate: number;
  dataConfidence: number;
  categoryRevenue: { category: string; revenue: number; orders: number }[];
  hourlyPattern: { hour: string; orders: number }[];
  dayOfWeek: { day: string; orders: number; revenue: number }[];
  weeklyTrend: { week: string; revenue: number; orders: number }[];
  forecastRevenue: { week: string; actual?: number; predicted: number; isFuture?: boolean }[];
  topPerformers: { id: string; name: string; quantity: number; revenue: number }[];
  lowPerformers: { id: string; name: string; quantity: number }[];
  menuScores: { id: string; name: string; score: number; quantity: number; trend: Trend }[];
  demandForecast: { id: string; name: string; predictedOrders: number; changePercent: number; trend: Trend }[];
  orderStatus: { status: string; count: number }[];
};

type AIAnalyticsResponse = {
  insights?: Partial<AIInsights>;
  analytics?: Partial<AIAnalyticsData>;
  source?: "gemini" | "fallback";
};

const fallbackInsights: AIInsights = {
  suggestions: "Top selling item stock ready rakun, peak hour-e staff plan korun, and slow item-e offer test korun.",
  pricingTips: "Average order value barate combo, add-on, and family bundle test korun.",
  marketingTips: "Repeat customer der jonno weekly lunch/dinner offer and QR campaign chalate paren.",
  forecastTip: "Recent trend follow kore next week-er busy day and high demand item agey plan korun.",
  menuOptimization: "Low selling item review korun and top item menu-te more visible position-e rakun.",
  predictiveForecast: "Order data barle forecast aro accurate hobe. Current trend diye next 1-2 week inventory plan korun.",
  actionItems: [
    "Top selling items stock check korun",
    "Peak hour staffing plan update korun",
    "Low selling items-er price/promotion review korun",
    "Combo offer A/B test korun",
  ],
};

const fallbackAnalytics: AIAnalyticsData = {
  totalRevenue30d: 0,
  totalOrders: 0,
  avgOrderValue: 0,
  revenueGrowth: null,
  peakHour: null,
  completionRate: 0,
  dataConfidence: 35,
  categoryRevenue: [],
  hourlyPattern: [],
  dayOfWeek: [],
  weeklyTrend: [],
  forecastRevenue: [],
  topPerformers: [],
  lowPerformers: [],
  menuScores: [],
  demandForecast: [],
  orderStatus: [],
};

const formatCurrency = (value: number) => `৳${Math.round(value || 0).toLocaleString("bn-BD")}`;

const chartTooltip = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  color: "hsl(var(--foreground))",
};

const trendIcon = (trend: Trend) => {
  if (trend === "up") return <TrendingUp className="h-3.5 w-3.5 text-success" />;
  if (trend === "down") return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Target className="h-3.5 w-3.5 text-muted-foreground" />;
};

export default function AIAnalytics() {
  const { restaurantId } = useAuth();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [analytics, setAnalytics] = useState<AIAnalyticsData | null>(null);
  const [source, setSource] = useState<"gemini" | "fallback" | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadInsights = async () => {
    if (!restaurantId) {
      toast.error("Restaurant context found hoy nai");
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke<AIAnalyticsResponse>("ai-analytics", {
        body: { restaurant_id: restaurantId },
      });

      if (error) throw error;

      setInsights({
        ...fallbackInsights,
        ...(data?.insights || {}),
        actionItems: data?.insights?.actionItems?.length ? data.insights.actionItems : fallbackInsights.actionItems,
      });
      setAnalytics({
        ...fallbackAnalytics,
        ...(data?.analytics || {}),
      });
      setSource(data?.source || "fallback");
      setLastUpdated(new Date().toLocaleString("bn-BD"));
    } catch (error: any) {
      setInsights(fallbackInsights);
      setAnalytics(fallbackAnalytics);
      setSource("fallback");
      toast.warning(error?.message || "AI analytics fallback loaded");
    } finally {
      setLoading(false);
    }
  };

  const ready = Boolean(insights && analytics);
  const growthPositive = analytics?.revenueGrowth && !analytics.revenueGrowth.startsWith("-");

  return (
    <DashboardLayout role="admin" title="AI অ্যানালিটিক্স">
      <FeatureGate feature="ai_analytics">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground">AI অ্যানালিটিক্স</h2>
                  <p className="text-sm text-muted-foreground">
                    High Smart package-er advanced revenue, menu, demand forecast and Gemini action plan
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">30 days data</Badge>
                <Badge variant="outline">Server-side Gemini</Badge>
                {source && <Badge variant={source === "gemini" ? "default" : "outline"}>{source === "gemini" ? "AI generated" : "Fallback ready"}</Badge>}
                {lastUpdated && <span className="text-xs text-muted-foreground">Last updated: {lastUpdated}</span>}
              </div>
            </div>

            <Button onClick={loadInsights} disabled={loading} className="gap-2">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : ready ? <RefreshCw className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {loading ? "Analyzing..." : ready ? "Refresh AI analysis" : "Generate AI analysis"}
            </Button>
          </div>

          {!ready && !loading && (
            <Card className="border-dashed">
              <CardContent className="space-y-5 py-14 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10">
                  <BarChart3 className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-semibold">Advanced AI অ্যানালিটিক্স ready</p>
                  <p className="mx-auto mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Orders, revenue, menu performance, hourly demand, category sales and next 2 week forecast analyze kore smart business decision dibe.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2">
                  {["KPI score", "Revenue forecast", "Demand forecast", "Menu score", "Peak hour", "Action plan"].map((item) => (
                    <Badge key={item} variant="secondary">{item}</Badge>
                  ))}
                </div>
                <Button onClick={loadInsights} disabled={loading} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Start advanced analysis
                </Button>
              </CardContent>
            </Card>
          )}

          {loading && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                {[1, 2, 3, 4].map((item) => (
                  <div key={item} className="h-28 animate-pulse rounded-lg bg-secondary/60" />
                ))}
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="h-72 animate-pulse rounded-lg bg-secondary/60" />
                <div className="h-72 animate-pulse rounded-lg bg-secondary/60" />
              </div>
            </div>
          )}

          {ready && analytics && insights && !loading && (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-center justify-between">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                      {analytics.revenueGrowth && (
                        <Badge variant="outline" className={growthPositive ? "border-success/40 text-success" : "border-destructive/40 text-destructive"}>
                          {growthPositive ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
                          {analytics.revenueGrowth}
                        </Badge>
                      )}
                    </div>
                    <p className="text-2xl font-bold">{analytics.totalOrders.toLocaleString("bn-BD")}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Total orders, last 30 days</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <DollarSign className="mb-3 h-5 w-5 text-success" />
                    <p className="text-2xl font-bold">{formatCurrency(analytics.totalRevenue30d)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Revenue, last 30 days</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <TrendingUp className="mb-3 h-5 w-5 text-warning" />
                    <p className="text-2xl font-bold">{formatCurrency(analytics.avgOrderValue)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Average order value</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-5">
                    <Clock className="mb-3 h-5 w-5 text-accent-foreground" />
                    <p className="text-2xl font-bold">{analytics.peakHour || "N/A"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Peak order hour</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Revenue Trend & Forecast
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.forecastRevenue.length > 0 ? (
                      <ResponsiveContainer width="100%" height={280}>
                        <ComposedChart data={analytics.forecastRevenue}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(value) => `৳${value}`} />
                          <Tooltip contentStyle={chartTooltip} formatter={(value: number, name: string) => [formatCurrency(value), name === "actual" ? "Actual" : "Forecast"]} />
                          <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} />
                          <Line type="monotone" dataKey="predicted" stroke="hsl(var(--success))" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 4 }} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart icon={<TrendingUp className="h-8 w-8" />} text="Revenue forecast-er jonno order data dorkar" />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Zap className="h-5 w-5 text-warning" />
                      Smart Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <ScoreMeter label="Data confidence" value={analytics.dataConfidence} />
                    <ScoreMeter label="Order completion" value={analytics.completionRate} />
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-xs font-semibold text-primary">Forecast note</p>
                      <p className="mt-1 text-sm leading-6 text-foreground">{insights.forecastTip}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <CalendarDays className="h-5 w-5 text-primary" />
                      Day-wise Sales
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={230}>
                      <BarChart data={analytics.dayOfWeek}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <Tooltip contentStyle={chartTooltip} formatter={(value: number) => [value, "Orders"]} />
                        <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Clock className="h-5 w-5 text-warning" />
                      Hourly Demand Pattern
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.hourlyPattern.length > 0 ? (
                      <ResponsiveContainer width="100%" height={230}>
                        <AreaChart data={analytics.hourlyPattern}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <Tooltip contentStyle={chartTooltip} formatter={(value: number) => [value, "Orders"]} />
                          <Area type="monotone" dataKey="orders" stroke="hsl(var(--warning))" fill="hsl(var(--warning) / 0.18)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart icon={<Clock className="h-8 w-8" />} text="Hourly pattern-er jonno aro order data dorkar" />
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-5 w-5 text-success" />
                      Category Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {analytics.categoryRevenue.length > 0 ? (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={analytics.categoryRevenue}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(value) => `৳${value}`} />
                          <Tooltip contentStyle={chartTooltip} formatter={(value: number, name: string) => [name === "revenue" ? formatCurrency(value) : value, name === "revenue" ? "Revenue" : "Orders"]} />
                          <Bar dataKey="revenue" fill="hsl(var(--success))" radius={[5, 5, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart icon={<BarChart3 className="h-8 w-8" />} text="Category sales data ekhono available na" />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShoppingBag className="h-5 w-5 text-primary" />
                      Item Demand Forecast
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {analytics.demandForecast.length > 0 ? analytics.demandForecast.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/60 p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">{index + 1}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{item.name}</p>
                          <p className="text-xs text-muted-foreground">Next demand: ~{item.predictedOrders} orders</p>
                        </div>
                        <Badge variant="outline" className="gap-1">
                          {trendIcon(item.trend)}
                          {item.changePercent > 0 ? "+" : ""}{item.changePercent}%
                        </Badge>
                      </div>
                    )) : (
                      <EmptyChart icon={<ShoppingBag className="h-8 w-8" />} text="Demand forecast-er jonno recent orders dorkar" />
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Target className="h-5 w-5 text-primary" />
                      Menu Performance Score
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {analytics.menuScores.length > 0 ? analytics.menuScores.map((item) => (
                      <div key={item.id} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-medium">{item.name}</span>
                          <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                            {trendIcon(item.trend)}
                            {item.score}/5
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-secondary">
                          <div
                            className={item.score >= 4 ? "h-full rounded-full bg-success" : item.score >= 2.5 ? "h-full rounded-full bg-primary" : "h-full rounded-full bg-warning"}
                            style={{ width: `${Math.min(100, (item.score / 5) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )) : (
                      <EmptyChart icon={<Target className="h-8 w-8" />} text="Menu score-er jonno item sales dorkar" />
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                      Top & Low Selling Items
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Top performers</p>
                      {analytics.topPerformers.length > 0 ? analytics.topPerformers.map((item, index) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-lg bg-secondary/50 p-2.5">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.name}</span>
                          <span className="text-xs text-muted-foreground">{item.quantity} sold</span>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">Top item data nai</p>}
                    </div>

                    <div className="space-y-2 border-t pt-4">
                      <p className="text-xs font-semibold uppercase text-muted-foreground">Needs attention</p>
                      {analytics.lowPerformers.length > 0 ? analytics.lowPerformers.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate text-muted-foreground">{item.name}</span>
                          <Badge variant="outline">{item.quantity} sold</Badge>
                        </div>
                      )) : <p className="text-sm text-muted-foreground">Low item data nai</p>}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Brain className="h-5 w-5 text-primary" />
                      Gemini Business Advice
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <AdviceRow icon={<Lightbulb className="h-4 w-4 text-primary" />} label="Growth" text={insights.suggestions} />
                    <AdviceRow icon={<DollarSign className="h-4 w-4 text-success" />} label="Pricing" text={insights.pricingTips} />
                    <AdviceRow icon={<Zap className="h-4 w-4 text-warning" />} label="Marketing" text={insights.marketingTips} />
                    <AdviceRow icon={<Target className="h-4 w-4 text-primary" />} label="Menu" text={insights.menuOptimization} />
                    <AdviceRow icon={<TrendingUp className="h-4 w-4 text-success" />} label="Forecast" text={insights.predictiveForecast} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Sparkles className="h-5 w-5 text-warning" />
                      Priority Action Plan
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {insights.actionItems.map((item, index) => (
                      <div key={`${item}-${index}`} className="flex gap-3 rounded-lg border border-border/70 p-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {index + 1}
                        </span>
                        <p className="text-sm leading-6 text-foreground">{item}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}

function ScoreMeter({ label, value }: { label: string; value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

function AdviceRow({ icon, label, text }: { icon: ReactNode; label: string; text: string }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">{icon}</span>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">{label}</p>
          <p className="mt-1 text-sm leading-6">{text}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyChart({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-3 rounded-lg bg-secondary/40 text-muted-foreground">
      {icon}
      <p className="text-center text-sm">{text}</p>
    </div>
  );
}
