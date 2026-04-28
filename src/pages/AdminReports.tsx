import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import FeatureGate from "@/components/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportOrdersCSV } from "@/utils/exportOrdersCSV";
import { toast } from "sonner";
import {
  FileText, Download, Printer, Filter, TrendingUp, ShoppingCart,
  DollarSign, BarChart3, Wrench, LayoutTemplate,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line, Area, AreaChart, Legend,
} from "recharts";

// ── Template mode ─────────────────────────────────────────────────────────────
type ReportType = "sales" | "items" | "payments";

const REPORT_TYPES: { value: ReportType; label: string; icon: any }[] = [
  { value: "sales",    label: "সেলস রিপোর্ট",   icon: DollarSign },
  { value: "items",    label: "আইটেম রিপোর্ট",   icon: ShoppingCart },
  { value: "payments", label: "পেমেন্ট রিপোর্ট", icon: TrendingUp },
];

interface SummaryRow { label: string; value: string | number; highlight?: boolean }

// ── Builder mode ──────────────────────────────────────────────────────────────
const GROUP_BY_OPTIONS = [
  { value: "day",            label: "দৈনিক" },
  { value: "week",           label: "সাপ্তাহিক" },
  { value: "month",          label: "মাসিক" },
  { value: "category",       label: "ক্যাটাগরি" },
  { value: "table",          label: "টেবিল" },
  { value: "payment_method", label: "পেমেন্ট মাধ্যম" },
  { value: "item",           label: "আইটেম" },
] as const;

type GroupByValue = typeof GROUP_BY_OPTIONS[number]["value"];

const METRIC_OPTIONS = [
  { value: "revenue",      label: "মোট আয়",          color: "hsl(var(--primary))" },
  { value: "order_count",  label: "অর্ডার সংখ্যা",    color: "#3b82f6" },
  { value: "avg_order",    label: "গড় অর্ডার মূল্য",  color: "#22c55e" },
  { value: "paid_revenue", label: "পেইড আয়",          color: "#10b981" },
  { value: "item_qty",     label: "আইটেম পরিমাণ",     color: "#f59e0b" },
] as const;

type MetricValue = typeof METRIC_OPTIONS[number]["value"];
type ChartType   = "bar" | "line" | "area";

const fmt = (metric: MetricValue, v: number) =>
  ["revenue", "avg_order", "paid_revenue"].includes(metric) ? `৳${v.toLocaleString()}` : String(v);

// ─────────────────────────────────────────────────────────────────────────────

export default function AdminReports() {
  const { restaurantId } = useAuth();
  const today     = new Date().toISOString().split("T")[0];
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(thirtyAgo);
  const [toDate,   setToDate]   = useState(today);
  const [loading,  setLoading]  = useState(false);
  const [mode,     setMode]     = useState<"template" | "builder">("template");

  // template
  const [reportType, setReportType] = useState<ReportType>("sales");
  const [reportData, setReportData] = useState<any>(null);

  // builder
  const [groupBy,        setGroupBy]        = useState<GroupByValue>("day");
  const [metrics,        setMetrics]        = useState<Set<MetricValue>>(new Set(["revenue", "order_count"]));
  const [chartType,      setChartType]      = useState<ChartType>("bar");
  const [sortOrder,      setSortOrder]      = useState<"label" | "desc" | "asc">("label");
  const [builderData,    setBuilderData]    = useState<any[] | null>(null);
  const [builderSummary, setBuilderSummary] = useState<SummaryRow[]>([]);

  const toggleMetric = (m: MetricValue) =>
    setMetrics(prev => {
      const next = new Set(prev);
      if (next.has(m)) { if (next.size > 1) next.delete(m); }
      else next.add(m);
      return next;
    });

  // ── fetch ──────────────────────────────────────────────────────────────────
  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, created_at, total, status, payment_status, payment_method, restaurant_tables(name), order_items(name, quantity, price, menu_item_id)")
      .eq("restaurant_id", restaurantId!)
      .gte("created_at", `${fromDate}T00:00:00+06:00`)
      .lte("created_at", `${toDate}T23:59:59+06:00`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  };

  // ── Template generate ──────────────────────────────────────────────────────
  const generateReport = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const rows = await fetchOrders();

      if (reportType === "sales") {
        const totalRevenue  = rows.reduce((s, o) => s + Number(o.total || 0), 0);
        const paidRevenue   = rows.filter(o => o.payment_status === "paid").reduce((s, o) => s + Number(o.total || 0), 0);
        const avgOrder      = rows.length > 0 ? Math.round(totalRevenue / rows.length) : 0;
        const dailyMap: Record<string, { orders: number; revenue: number }> = {};
        rows.forEach(o => {
          const date = new Date(o.created_at).toLocaleDateString("en-BD");
          if (!dailyMap[date]) dailyMap[date] = { orders: 0, revenue: 0 };
          dailyMap[date].orders++;
          dailyMap[date].revenue += Number(o.total || 0);
        });
        setReportData({
          type: "sales",
          summary: [
            { label: "মোট অর্ডার", value: rows.length, highlight: true },
            { label: "মোট আয়", value: `৳${totalRevenue.toLocaleString()}`, highlight: true },
            { label: "পেইড আয়", value: `৳${paidRevenue.toLocaleString()}` },
            { label: "বকেয়া", value: `৳${(totalRevenue - paidRevenue).toLocaleString()}` },
            { label: "গড় অর্ডার", value: `৳${avgOrder}` },
          ] as SummaryRow[],
          tableHeaders: ["তারিখ", "অর্ডার সংখ্যা", "মোট আয়"],
          tableRows: Object.entries(dailyMap).map(([date, v]) => [date, v.orders, `৳${v.revenue.toLocaleString()}`]),
          rawOrders: rows,
        });

      } else if (reportType === "items") {
        const itemMap: Record<string, { qty: number; revenue: number }> = {};
        rows.forEach(o => {
          (o.order_items || []).forEach((i: any) => {
            if (!itemMap[i.name]) itemMap[i.name] = { qty: 0, revenue: 0 };
            itemMap[i.name].qty     += Number(i.quantity || 1);
            itemMap[i.name].revenue += Number(i.price || 0) * Number(i.quantity || 1);
          });
        });
        const sorted = Object.entries(itemMap).sort((a, b) => b[1].qty - a[1].qty);
        setReportData({
          type: "items",
          summary: [
            { label: "মোট আইটেম প্রকার", value: sorted.length, highlight: true },
            { label: "মোট বিক্রীত পরিমাণ", value: sorted.reduce((s, [, v]) => s + v.qty, 0), highlight: true },
          ] as SummaryRow[],
          tableHeaders: ["আইটেম নাম", "বিক্রীত পরিমাণ", "আয়"],
          tableRows: sorted.map(([name, v]) => [name, v.qty, `৳${v.revenue.toLocaleString()}`]),
          rawOrders: rows,
        });

      } else {
        const byMethod: Record<string, { count: number; total: number }> = {};
        rows.forEach(o => {
          const m = o.payment_method || "অজানা";
          if (!byMethod[m]) byMethod[m] = { count: 0, total: 0 };
          byMethod[m].count++;
          byMethod[m].total += Number(o.total || 0);
        });
        const paidCount = rows.filter(o => o.payment_status === "paid").length;
        setReportData({
          type: "payments",
          summary: [
            { label: "পেইড অর্ডার", value: paidCount, highlight: true },
            { label: "বকেয়া অর্ডার", value: rows.length - paidCount, highlight: true },
            { label: "পেমেন্ট রেট", value: rows.length > 0 ? `${Math.round((paidCount / rows.length) * 100)}%` : "0%" },
          ] as SummaryRow[],
          tableHeaders: ["পেমেন্ট মাধ্যম", "অর্ডার সংখ্যা", "মোট আয়"],
          tableRows: Object.entries(byMethod).map(([m, v]) => [m, v.count, `৳${v.total.toLocaleString()}`]),
          rawOrders: rows,
        });
      }
      toast.success("রিপোর্ট তৈরি হয়েছে");
    } catch (err: any) {
      toast.error(err.message || "রিপোর্ট তৈরি করতে সমস্যা হয়েছে");
    } finally { setLoading(false); }
  };

  // ── Builder generate ───────────────────────────────────────────────────────
  const generateBuilderReport = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const rows = await fetchOrders();

      const { data: menuItems } = await supabase
        .from("menu_items")
        .select("id, name, category")
        .eq("restaurant_id", restaurantId);
      const menuMap: Record<string, { name: string; category: string }> = {};
      (menuItems || []).forEach((m: any) => { menuMap[m.id] = { name: m.name, category: m.category || "অন্যান্য" }; });

      const map: Record<string, { revenue: number; order_count: number; paid_revenue: number; item_qty: number }> = {};

      const getLabel = (order: any): string => {
        const d = new Date(order.created_at);
        if (groupBy === "day")   return d.toLocaleDateString("bn-BD", { day: "2-digit", month: "short" });
        if (groupBy === "week") {
          const ws = new Date(d); ws.setDate(d.getDate() - d.getDay());
          return ws.toLocaleDateString("bn-BD", { day: "2-digit", month: "short" });
        }
        if (groupBy === "month")          return d.toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
        if (groupBy === "table")          return (order.restaurant_tables as any)?.name || "অজানা টেবিল";
        if (groupBy === "payment_method") return order.payment_method || "অজানা";
        return "";
      };

      rows.forEach((order: any) => {
        const isPaid = order.payment_status === "paid";
        if (groupBy === "category" || groupBy === "item") {
          (order.order_items || []).forEach((oi: any) => {
            const label = groupBy === "item"
              ? (oi.name || "অজানা")
              : (menuMap[oi.menu_item_id]?.category || "অন্যান্য");
            if (!map[label]) map[label] = { revenue: 0, order_count: 0, paid_revenue: 0, item_qty: 0 };
            const lineTotal = Number(oi.price || 0) * Number(oi.quantity || 1);
            map[label].revenue     += lineTotal;
            map[label].order_count += 1;
            map[label].item_qty    += Number(oi.quantity || 1);
            if (isPaid) map[label].paid_revenue += lineTotal;
          });
        } else {
          const label = getLabel(order);
          if (!label) return;
          if (!map[label]) map[label] = { revenue: 0, order_count: 0, paid_revenue: 0, item_qty: 0 };
          map[label].revenue     += Number(order.total || 0);
          map[label].order_count += 1;
          map[label].item_qty    += (order.order_items || []).reduce((s: number, i: any) => s + Number(i.quantity || 1), 0);
          if (isPaid) map[label].paid_revenue += Number(order.total || 0);
        }
      });

      const data = Object.entries(map).map(([label, v]) => ({
        label,
        revenue:      Math.round(v.revenue),
        order_count:  v.order_count,
        avg_order:    v.order_count > 0 ? Math.round(v.revenue / v.order_count) : 0,
        paid_revenue: Math.round(v.paid_revenue),
        item_qty:     v.item_qty,
      }));

      if (sortOrder === "desc") data.sort((a, b) => b.revenue - a.revenue);
      else if (sortOrder === "asc") data.sort((a, b) => a.revenue - b.revenue);

      const totalRev  = data.reduce((s, d) => s + d.revenue, 0);
      const totalOrds = rows.length;
      setBuilderSummary([
        { label: "গ্রুপ সংখ্যা",      value: data.length,                          highlight: true },
        { label: "মোট অর্ডার",         value: totalOrds,                             highlight: true },
        { label: "মোট আয়",             value: `৳${totalRev.toLocaleString()}`,       highlight: true },
        { label: "গড় অর্ডার মূল্য",    value: `৳${totalOrds > 0 ? Math.round(totalRev / totalOrds) : 0}` },
      ]);
      setBuilderData(data);
      toast.success("কাস্টম রিপোর্ট তৈরি হয়েছে");
    } catch (err: any) {
      toast.error(err.message || "রিপোর্ট তৈরি করতে সমস্যা হয়েছে");
    } finally { setLoading(false); }
  };

  // ── Exports ────────────────────────────────────────────────────────────────
  const handleCSVExport = () => {
    if (!reportData?.rawOrders?.length) return;
    const csvRows = reportData.rawOrders.map((o: any) => ({
      id: o.id, created_at: o.created_at, total: Number(o.total),
      status: o.status, payment_status: o.payment_status, payment_method: o.payment_method,
      table_name: (o.restaurant_tables as any)?.name || "—",
      items: (o.order_items || []).map((i: any) => `${i.name}×${i.quantity}`).join("; "),
    }));
    exportOrdersCSV(csvRows, `report_${reportType}_${fromDate}_${toDate}.csv`);
    toast.success("CSV export হয়েছে");
  };

  const handleBuilderCSV = () => {
    if (!builderData?.length) return;
    const selM = METRIC_OPTIONS.filter(m => metrics.has(m.value));
    const header = ["লেবেল", ...selM.map(m => m.label)].join(",");
    const csv = [header, ...builderData.map(row =>
      [row.label, ...selM.map(m => (row as any)[m.value])].join(",")
    )].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `custom_report_${fromDate}_${toDate}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV export হয়েছে");
  };

  const handlePDFPrint = () => {
    if (!reportData) return;
    const typeLabel = REPORT_TYPES.find(t => t.value === reportType)?.label || "";
    const summaryRows = (reportData.summary as SummaryRow[]).map(r =>
      `<tr><td style="padding:4px 8px;color:#555">${r.label}</td><td style="padding:4px 8px;font-weight:${r.highlight ? 700 : 500};text-align:right">${r.value}</td></tr>`
    ).join("");
    const headerCells = reportData.tableHeaders.map((h: string) =>
      `<th style="padding:6px 8px;text-align:left;border-bottom:2px solid #ddd;font-size:12px">${h}</th>`
    ).join("");
    const dataRows = reportData.tableRows.map((row: any[]) =>
      `<tr>${row.map((cell, i) => `<td style="padding:5px 8px;font-size:12px;${i > 0 ? "text-align:right" : ""}">${cell}</td>`).join("")}</tr>`
    ).join("");
    const html = `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8">
<style>body{font-family:'Segoe UI',Arial,sans-serif;margin:20px;color:#111}h1{font-size:20px;margin-bottom:4px}
.sub{color:#666;font-size:12px;margin-bottom:16px}table{width:100%;border-collapse:collapse}
tr:nth-child(even){background:#f9f9f9}@media print{@page{margin:15mm}}</style></head><body>
<h1>${typeLabel}</h1><div class="sub">${fromDate} থেকে ${toDate} · তৈরি: ${new Date().toLocaleString("bn-BD")}</div>
<h3 style="font-size:13px;margin:12px 0 6px">সারসংক্ষেপ</h3>
<table style="margin-bottom:16px;max-width:360px"><tbody>${summaryRows}</tbody></table>
<h3 style="font-size:13px;margin:12px 0 6px">বিস্তারিত</h3>
<table><thead><tr>${headerCells}</tr></thead><tbody>${dataRows}</tbody></table>
<div style="margin-top:24px;font-size:11px;color:#999;text-align:center">QRManager</div>
</body></html>`;
    const win = window.open("", "_blank", "width=800,height=700");
    if (!win) { toast.error("Popup blocked. Browser settings থেকে allow করুন।"); return; }
    win.document.write(html); win.document.close(); setTimeout(() => win.print(), 300);
  };

  // ── Builder chart ──────────────────────────────────────────────────────────
  const renderBuilderChart = () => {
    if (!builderData?.length) return null;
    const selM = METRIC_OPTIONS.filter(m => metrics.has(m.value));
    const common = { data: builderData, margin: { top: 5, right: 20, left: 0, bottom: 5 } };
    const xAxis  = <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} />;
    const yAxis  = <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />;
    const grid   = <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />;
    const tip    = (
      <Tooltip
        contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
        formatter={(v: any, name: string) => [fmt(name as MetricValue, v), METRIC_OPTIONS.find(x => x.value === name)?.label || name]}
      />
    );
    const legend = <Legend formatter={v => METRIC_OPTIONS.find(x => x.value === v)?.label || v} />;

    if (chartType === "bar") return (
      <ResponsiveContainer width="100%" height={280}>
        <BarChart {...common}>{grid}{xAxis}{yAxis}{tip}{legend}
          {selM.map(m => <Bar key={m.value} dataKey={m.value} fill={m.color} radius={[5,5,0,0]} name={m.value} />)}
        </BarChart>
      </ResponsiveContainer>
    );
    if (chartType === "area") return (
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart {...common}>
          <defs>{selM.map(m => (
            <linearGradient key={m.value} id={`grad_${m.value}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={m.color} stopOpacity={0.3} /><stop offset="95%" stopColor={m.color} stopOpacity={0} />
            </linearGradient>
          ))}</defs>
          {grid}{xAxis}{yAxis}{tip}{legend}
          {selM.map(m => <Area key={m.value} type="monotone" dataKey={m.value} stroke={m.color} fill={`url(#grad_${m.value})`} strokeWidth={2} name={m.value} />)}
        </AreaChart>
      </ResponsiveContainer>
    );
    return (
      <ResponsiveContainer width="100%" height={280}>
        <LineChart {...common}>{grid}{xAxis}{yAxis}{tip}{legend}
          {selM.map(m => <Line key={m.value} type="monotone" dataKey={m.value} stroke={m.color} strokeWidth={2} dot={{ r: 3 }} name={m.value} />)}
        </LineChart>
      </ResponsiveContainer>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="admin" title="কাস্টম রিপোর্ট">
      <FeatureGate feature="custom_reports">
        <div className="space-y-6 animate-fade-up max-w-5xl">

          {/* Mode toggle */}
          <div className="flex gap-2 p-1 bg-secondary/50 rounded-xl w-fit">
            {([
              { v: "template", icon: <LayoutTemplate className="w-4 h-4" />, label: "টেমপ্লেট" },
              { v: "builder",  icon: <Wrench className="w-4 h-4" />,         label: "কাস্টম বিল্ডার", badge: true },
            ] as const).map(tab => (
              <button
                key={tab.v}
                onClick={() => { setMode(tab.v); if (tab.v === "template") setBuilderData(null); else setReportData(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === tab.v ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.icon} {tab.label}
                {"badge" in tab && tab.badge && (
                  <Badge className="text-[10px] py-0 px-1.5 bg-primary/15 text-primary border-primary/30 border">নতুন</Badge>
                )}
              </button>
            ))}
          </div>

          {/* ── TEMPLATE MODE ────────────────────────────────────────────── */}
          {mode === "template" && (
            <>
              <div className="flex flex-wrap gap-2">
                {REPORT_TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => { setReportType(value); setReportData(null); }}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${
                      reportType === value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {label}
                  </button>
                ))}
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="w-4 h-4 text-primary" /> ফিল্টার
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4">
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground font-medium">শুরুর তারিখ</p>
                      <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-44" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground font-medium">শেষের তারিখ</p>
                      <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-44" />
                    </div>
                    <Button variant="hero" onClick={generateReport} disabled={loading} className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4" />
                      {loading ? "তৈরি হচ্ছে..." : "রিপোর্ট তৈরি করুন"}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {reportData && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {(reportData.summary as SummaryRow[]).map((row, i) => (
                      <div key={i} className={`rounded-2xl border px-4 py-3 ${row.highlight ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30"}`}>
                        <p className="text-xs text-muted-foreground truncate">{row.label}</p>
                        <p className={`font-bold mt-0.5 ${row.highlight ? "text-primary text-lg" : "text-foreground text-base"}`}>{row.value}</p>
                      </div>
                    ))}
                  </div>
                  <Card>
                    <CardHeader className="pb-3 flex-row items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" />
                        {REPORT_TYPES.find(t => t.value === reportType)?.label}
                        <span className="text-xs font-normal text-muted-foreground">{fromDate} — {toDate}</span>
                      </CardTitle>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={handleCSVExport} className="h-8 text-xs gap-1.5">
                          <Download className="w-3.5 h-3.5" /> CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={handlePDFPrint} className="h-8 text-xs gap-1.5">
                          <Printer className="w-3.5 h-3.5" /> PDF Print
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              {reportData.tableHeaders.map((h: string, i: number) => (
                                <th key={i} className={`p-3 text-xs font-medium text-muted-foreground ${i > 0 ? "text-right" : "text-left"}`}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.tableRows.length === 0
                              ? <tr><td colSpan={reportData.tableHeaders.length} className="p-8 text-center text-sm text-muted-foreground">কোনো ডেটা নেই</td></tr>
                              : reportData.tableRows.map((row: any[], i: number) => (
                                <tr key={i} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                                  {row.map((cell, j) => (
                                    <td key={j} className={`p-3 text-sm ${j > 0 ? "text-right font-medium" : "text-foreground"}`}>{cell}</td>
                                  ))}
                                </tr>
                              ))
                            }
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
              {!reportData && !loading && (
                <div className="rounded-2xl border border-dashed border-border bg-secondary/20 py-16 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">উপরে রিপোর্ট টাইপ ও তারিখ নির্বাচন করে "রিপোর্ট তৈরি করুন" বাটনে ক্লিক করুন</p>
                </div>
              )}
            </>
          )}

          {/* ── BUILDER MODE ─────────────────────────────────────────────── */}
          {mode === "builder" && (
            <>
              <Card className="border-primary/20">
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-primary" /> রিপোর্ট বিল্ডার
                    <span className="text-xs font-normal text-muted-foreground">— গ্রুপ, মেট্রিক্স ও চার্ট বেছে নিন</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-5">
                  {/* Date range */}
                  <div className="flex flex-wrap gap-4">
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground font-medium">শুরুর তারিখ</p>
                      <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-44" />
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs text-muted-foreground font-medium">শেষের তারিখ</p>
                      <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-44" />
                    </div>
                  </div>

                  {/* Group By */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">গ্রুপ করুন</p>
                    <div className="flex flex-wrap gap-2">
                      {GROUP_BY_OPTIONS.map(opt => (
                        <button key={opt.value} onClick={() => setGroupBy(opt.value)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            groupBy === opt.value
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-secondary/50 border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                          }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-2">মেট্রিক্স (একাধিক বাছাই করুন)</p>
                    <div className="flex flex-wrap gap-2">
                      {METRIC_OPTIONS.map(m => (
                        <button key={m.value} onClick={() => toggleMetric(m.value)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            metrics.has(m.value)
                              ? "border-transparent text-white"
                              : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                          }`}
                          style={metrics.has(m.value) ? { background: m.color, borderColor: m.color } : {}}>
                          {metrics.has(m.value) && "✓ "}{m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Chart type + Sort */}
                  <div className="flex flex-wrap gap-6">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">চার্ট টাইপ</p>
                      <div className="flex gap-2">
                        {(["bar", "line", "area"] as ChartType[]).map(ct => (
                          <button key={ct} onClick={() => setChartType(ct)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              chartType === ct
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                            }`}>
                            {ct === "bar" ? "📊 বার" : ct === "line" ? "📈 লাইন" : "🏔️ এরিয়া"}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">সাজানো</p>
                      <div className="flex gap-2">
                        {[{ v: "label", l: "লেবেল" }, { v: "desc", l: "বেশি আয় আগে" }, { v: "asc", l: "কম আয় আগে" }].map(s => (
                          <button key={s.v} onClick={() => setSortOrder(s.v as any)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                              sortOrder === s.v
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                            }`}>
                            {s.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button variant="hero" onClick={generateBuilderReport} disabled={loading} className="gap-2">
                    <BarChart3 className="w-4 h-4" />
                    {loading ? "তৈরি হচ্ছে..." : "কাস্টম রিপোর্ট তৈরি করুন"}
                  </Button>
                </CardContent>
              </Card>

              {builderData && (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {builderSummary.map((row, i) => (
                      <div key={i} className={`rounded-2xl border px-4 py-3 ${row.highlight ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30"}`}>
                        <p className="text-xs text-muted-foreground truncate">{row.label}</p>
                        <p className={`font-bold mt-0.5 ${row.highlight ? "text-primary text-lg" : "text-foreground text-base"}`}>{row.value}</p>
                      </div>
                    ))}
                  </div>

                  <Card>
                    <CardHeader className="pb-3 flex-row items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-primary" /> কাস্টম চার্ট
                        <span className="text-xs font-normal text-muted-foreground">
                          · {GROUP_BY_OPTIONS.find(g => g.value === groupBy)?.label} · {fromDate} — {toDate}
                        </span>
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={handleBuilderCSV} className="h-8 text-xs gap-1.5">
                        <Download className="w-3.5 h-3.5" /> CSV
                      </Button>
                    </CardHeader>
                    <CardContent>{renderBuilderChart()}</CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" /> বিস্তারিত ডেটা টেবিল
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="p-3 text-xs font-medium text-muted-foreground text-left">
                                {GROUP_BY_OPTIONS.find(g => g.value === groupBy)?.label}
                              </th>
                              {METRIC_OPTIONS.filter(m => metrics.has(m.value)).map(m => (
                                <th key={m.value} className="p-3 text-xs font-medium text-muted-foreground text-right">{m.label}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {builderData.length === 0
                              ? <tr><td colSpan={metrics.size + 1} className="p-8 text-center text-sm text-muted-foreground">কোনো ডেটা নেই</td></tr>
                              : builderData.map((row, i) => (
                                <tr key={i} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                                  <td className="p-3 text-sm font-medium">{row.label}</td>
                                  {METRIC_OPTIONS.filter(m => metrics.has(m.value)).map(m => (
                                    <td key={m.value} className="p-3 text-sm text-right font-medium">{fmt(m.value, row[m.value])}</td>
                                  ))}
                                </tr>
                              ))
                            }
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}

              {!builderData && !loading && (
                <div className="rounded-2xl border border-dashed border-primary/20 py-16 text-center">
                  <Wrench className="w-12 h-12 text-primary/20 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">গ্রুপ, মেট্রিক্স ও চার্ট টাইপ বেছে "কাস্টম রিপোর্ট তৈরি করুন" ক্লিক করুন</p>
                </div>
              )}
            </>
          )}
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
