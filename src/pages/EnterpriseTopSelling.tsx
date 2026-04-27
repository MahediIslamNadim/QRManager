import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEnterpriseContext, useEnterpriseTopSelling } from "@/hooks/useEnterpriseAdmin";

const fmt = (v: number) => `৳${v.toLocaleString("en-BD")}`;

type DateFilter = "today" | "week" | "month";

const DATE_LABELS: Record<DateFilter, string> = {
  today: "আজকের",
  week: "এই সপ্তাহের",
  month: "এই মাসের",
};

export default function EnterpriseTopSelling() {
  const { groupId } = useEnterpriseContext();
  const topSellingQuery = useEnterpriseTopSelling(groupId);
  const [dateFilter, setDateFilter] = useState<DateFilter>("month");

  const allItems = topSellingQuery.data ?? [];

  // Client-side date filtering (hook থেকে সব data এসে locally filter)
  const now = new Date();
  const filtered = allItems.filter((item: any) => {
    // যদি item এ created_at না থাকে তাহলে সব দেখাও
    if (!item.created_at) return true;
    const d = new Date(item.created_at);
    if (dateFilter === "today") {
      return d.toDateString() === now.toDateString();
    }
    if (dateFilter === "week") {
      const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7);
      return d >= weekAgo;
    }
    // month — default (backend usually returns last 30 days anyway)
    return true;
  });

  // যদি created_at না থাকে তাহলে সরাসরি allItems দেখাও
  const items = allItems.length > 0 && (allItems[0] as any).created_at ? filtered : allItems;

  return (
    <DashboardLayout role="group_owner" title="টপ সেলিং আইটেম">
      <div className="space-y-6">

        {/* Header + filter */}
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">সকল রেস্টুরেন্টের সেরা বিক্রিত আইটেম</p>
              <p className="text-sm text-muted-foreground mt-0.5">কোন রেস্টুরেন্টে কোন খাবার সবচেয়ে বেশি বিক্রি হচ্ছে</p>
            </div>
            <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">আজকের</SelectItem>
                <SelectItem value="week">এই সপ্তাহের</SelectItem>
                <SelectItem value="month">এই মাসের</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Bar chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{DATE_LABELS[dateFilter]} সেরা বিক্রিত আইটেম (চার্ট)</CardTitle>
          </CardHeader>
          <CardContent>
            {topSellingQuery.isLoading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                লোড হচ্ছে...
              </div>
            ) : items.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                এখনো বিক্রয় ডেটা নেই।
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={items.slice(0, 10)} margin={{ top: 10, right: 20, left: 0, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="item_name" angle={-20} textAnchor="end" height={70} interval={0} />
                  <YAxis />
                  <Tooltip
                    formatter={(value: number, name: string) => {
                      if (name === "revenue") return [fmt(value), "আয়"];
                      return [value, "বিক্রি"];
                    }}
                  />
                  <Bar dataKey="quantity" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Ranked list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{DATE_LABELS[dateFilter]} র‌্যাঙ্কিং তালিকা</CardTitle>
            <Badge variant="outline">{items.length}টি আইটেম</Badge>
          </CardHeader>
          <CardContent className="space-y-3">
            {items.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">কোনো ডেটা নেই।</div>
            ) : (
              items.map((item, i) => (
                <div key={`${item.restaurant_id}-${item.item_name}-${i}`} className="rounded-2xl border border-border p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium">{item.item_name}</p>
                        <p className="text-sm text-muted-foreground">{item.restaurant_name}</p>
                      </div>
                    </div>
                    <Badge variant="outline">{item.quantity}টি বিক্রি</Badge>
                  </div>
                  <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
                    <p>মোট আয়: {fmt(item.revenue)}</p>
                    <p>রেস্টুরেন্ট: {item.restaurant_name}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
