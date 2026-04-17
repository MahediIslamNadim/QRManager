import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import FeatureGate from "@/components/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { exportOrdersCSV } from "@/utils/exportOrdersCSV";
import { toast } from "sonner";
import { FileText, Download, Printer, Filter, TrendingUp, ShoppingCart, DollarSign, BarChart3 } from "lucide-react";

type ReportType = "sales" | "items" | "payments";

const REPORT_TYPES: { value: ReportType; label: string; icon: any }[] = [
  { value: "sales", label: "সেলস রিপোর্ট", icon: DollarSign },
  { value: "items", label: "আইটেম রিপোর্ট", icon: ShoppingCart },
  { value: "payments", label: "পেমেন্ট রিপোর্ট", icon: TrendingUp },
];

interface SummaryRow {
  label: string;
  value: string | number;
  highlight?: boolean;
}

export default function AdminReports() {
  const { restaurantId } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const thirtyAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const [reportType, setReportType] = useState<ReportType>("sales");
  const [fromDate, setFromDate] = useState(thirtyAgo);
  const [toDate, setToDate] = useState(today);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  const generateReport = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, created_at, total, status, payment_status, payment_method, restaurant_tables(name), order_items(name, quantity, price, menu_item_id)")
        .eq("restaurant_id", restaurantId)
        .gte("created_at", `${fromDate}T00:00:00+06:00`)
        .lte("created_at", `${toDate}T23:59:59+06:00`)
        .order("created_at", { ascending: false });

      if (error) throw error;
      const rows = orders || [];

      if (reportType === "sales") {
        const totalRevenue = rows.reduce((s, o) => s + Number(o.total || 0), 0);
        const paidRevenue = rows.filter(o => o.payment_status === "paid").reduce((s, o) => s + Number(o.total || 0), 0);
        const unpaidRevenue = totalRevenue - paidRevenue;
        const avgOrder = rows.length > 0 ? Math.round(totalRevenue / rows.length) : 0;

        // Daily breakdown
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
            { label: "বকেয়া", value: `৳${unpaidRevenue.toLocaleString()}` },
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
            itemMap[i.name].qty += Number(i.quantity || 1);
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
    } finally {
      setLoading(false);
    }
  };

  const handleCSVExport = () => {
    if (!reportData?.rawOrders?.length) return;
    const rows = reportData.rawOrders.map((o: any) => ({
      id: o.id,
      created_at: o.created_at,
      total: Number(o.total),
      status: o.status,
      payment_status: o.payment_status,
      payment_method: o.payment_method,
      table_name: (o.restaurant_tables as any)?.name || "—",
      items: (o.order_items || []).map((i: any) => `${i.name}×${i.quantity}`).join("; "),
    }));
    exportOrdersCSV(rows, `report_${reportType}_${fromDate}_${toDate}.csv`);
    toast.success("CSV export হয়েছে");
  };

  const handlePDFPrint = () => {
    if (!reportData) return;
    const typeLabel = REPORT_TYPES.find(t => t.value === reportType)?.label || "";
    const summaryRows = (reportData.summary as SummaryRow[])
      .map(r => `<tr><td style="padding:4px 8px;color:#555">${r.label}</td><td style="padding:4px 8px;font-weight:${r.highlight ? 700 : 500};text-align:right">${r.value}</td></tr>`)
      .join("");
    const headerCells = reportData.tableHeaders.map((h: string) => `<th style="padding:6px 8px;text-align:left;border-bottom:2px solid #ddd;font-size:12px">${h}</th>`).join("");
    const dataRows = reportData.tableRows.map((row: any[]) =>
      `<tr>${row.map((cell, i) => `<td style="padding:5px 8px;font-size:12px;${i > 0 ? 'text-align:right' : ''}">${cell}</td>`).join("")}</tr>`
    ).join("");

    const html = `<!DOCTYPE html><html lang="bn"><head><meta charset="UTF-8">
<style>body{font-family:'Segoe UI',Arial,sans-serif;margin:20px;color:#111}
h1{font-size:20px;margin-bottom:4px}
.sub{color:#666;font-size:12px;margin-bottom:16px}
table{width:100%;border-collapse:collapse}
tr:nth-child(even){background:#f9f9f9}
@media print{@page{margin:15mm}}</style></head>
<body>
<h1>${typeLabel}</h1>
<div class="sub">${fromDate} থেকে ${toDate} · তৈরি: ${new Date().toLocaleString("bn-BD")}</div>
<h3 style="font-size:13px;margin:12px 0 6px">সারসংক্ষেপ</h3>
<table style="margin-bottom:16px;max-width:360px"><tbody>${summaryRows}</tbody></table>
<h3 style="font-size:13px;margin:12px 0 6px">বিস্তারিত</h3>
<table><thead><tr>${headerCells}</tr></thead><tbody>${dataRows}</tbody></table>
<div style="margin-top:24px;font-size:11px;color:#999;text-align:center">QRManager · qrmanager.app</div>
</body></html>`;

    const win = window.open("", "_blank", "width=800,height=700");
    if (!win) { toast.error("Popup block আছে। Browser settings থেকে allow করুন।"); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 300);
  };

  return (
    <DashboardLayout role="admin" title="কাস্টম রিপোর্ট">
      <FeatureGate feature="custom_reports">
        <div className="space-y-6 animate-fade-up max-w-5xl">

          {/* Report type selector */}
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
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* Filters */}
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

          {/* Report Output */}
          {reportData && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {(reportData.summary as SummaryRow[]).map((row, i) => (
                  <div key={i} className={`rounded-2xl border px-4 py-3 ${row.highlight ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/30"}`}>
                    <p className="text-xs text-muted-foreground truncate">{row.label}</p>
                    <p className={`font-bold mt-0.5 ${row.highlight ? "text-primary text-lg" : "text-foreground text-base"}`}>{row.value}</p>
                  </div>
                ))}
              </div>

              {/* Data table */}
              <Card>
                <CardHeader className="pb-3 flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    {REPORT_TYPES.find(t => t.value === reportType)?.label}
                    <span className="text-xs font-normal text-muted-foreground">
                      {fromDate} — {toDate}
                    </span>
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
                        {reportData.tableRows.length === 0 ? (
                          <tr><td colSpan={reportData.tableHeaders.length} className="p-8 text-center text-sm text-muted-foreground">কোনো ডেটা নেই</td></tr>
                        ) : reportData.tableRows.map((row: any[], i: number) => (
                          <tr key={i} className="border-b border-border/40 hover:bg-secondary/30 transition-colors">
                            {row.map((cell, j) => (
                              <td key={j} className={`p-3 text-sm ${j > 0 ? "text-right font-medium" : "text-foreground"}`}>{cell}</td>
                            ))}
                          </tr>
                        ))}
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
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
