import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Sparkles } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  useEnterpriseAiAnalytics,
  useEnterpriseAnalytics,
  useEnterpriseContext,
  useEnterpriseRestaurants,
} from "@/hooks/useEnterpriseAdmin";

const fmt = (v: number) => `৳${v.toLocaleString("en-BD")}`;

export default function EnterpriseAnalytics() {
  const { groupId } = useEnterpriseContext();
  const restaurantsQuery = useEnterpriseRestaurants(groupId);
  const [searchParams] = useSearchParams();

  // URL থেকে pre-filter support (EnterpriseRestaurantDetails থেকে navigate করলে)
  const defaultRestaurantId = searchParams.get("restaurant") || "all";
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>(defaultRestaurantId);

  const restaurantFilter = selectedRestaurantId === "all" ? null : selectedRestaurantId;
  const analyticsQuery = useEnterpriseAnalytics(groupId, restaurantFilter);
  const aiQuery = useEnterpriseAiAnalytics(groupId, restaurantFilter);

  const restaurants = restaurantsQuery.data ?? [];
  const analytics = analyticsQuery.data;

  const selectedRestaurantName = useMemo(() => {
    if (selectedRestaurantId === "all") return "সকল রেস্টুরেন্ট";
    return restaurants.find((r) => r.restaurant_id === selectedRestaurantId)?.name || "রেস্টুরেন্ট";
  }, [restaurants, selectedRestaurantId]);

  return (
    <DashboardLayout role="group_owner" title="সকল রেস্টুরেন্ট অ্যানালিটিক্স">
      <div className="space-y-6">

        {/* Filter card */}
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-medium">এন্টারপ্রাইজ গ্রুপের সামগ্রিক বিক্রয় ও পারফরম্যান্স বিশ্লেষণ</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                Gemini AI দিয়ে পরিচালিত ব্যবসায়িক অন্তর্দৃষ্টি
              </p>
            </div>
            <div className="w-full md:w-80">
              <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
                <SelectTrigger>
                  <SelectValue placeholder="রেস্টুরেন্ট ফিল্টার করুন" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">সকল রেস্টুরেন্ট</SelectItem>
                  {restaurants.map((r) => (
                    <SelectItem key={r.restaurant_id} value={r.restaurant_id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Summary stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">মোট আয়</p>
              <p className="mt-2 text-2xl font-semibold">{fmt(analytics?.total_revenue ?? 0)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{selectedRestaurantName}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">মোট অর্ডার</p>
              <p className="mt-2 text-2xl font-semibold">{analytics?.total_orders ?? 0}</p>
              <p className="mt-1 text-xs text-muted-foreground">গত ৩০ দিন</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">গড় অর্ডার মূল্য</p>
              <p className="mt-2 text-2xl font-semibold">{fmt(analytics?.avg_order_value ?? 0)}</p>
              <p className="mt-1 text-xs text-muted-foreground">বর্তমান ফিল্টার অনুযায়ী</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">দৈনিক আয়ের ট্রেন্ড</CardTitle>
            </CardHeader>
            <CardContent>
              {analyticsQuery.isLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  অ্যানালিটিক্স লোড হচ্ছে...
                </div>
              ) : (analytics?.daily_trend.length ?? 0) === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  এখনো যথেষ্ট অর্ডার ডেটা নেই।
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analytics?.daily_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === "revenue") return [fmt(value), "আয়"];
                        return [value, "অর্ডার"];
                      }}
                    />
                    <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} />
                    <Line type="monotone" dataKey="orders" stroke="hsl(var(--success))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">রেস্টুরেন্ট আয় তুলনা</CardTitle>
            </CardHeader>
            <CardContent>
              {(analytics?.restaurant_breakdown.length ?? 0) === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  এখনো তুলনার ডেটা নেই।
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analytics?.restaurant_breakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" hide />
                    <YAxis />
                    <Tooltip formatter={(value: number) => [fmt(value), "আয়"]} />
                    <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Category breakdown + AI */}
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ক্যাটাগরি বিশ্লেষণ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {(analytics?.category_breakdown.length ?? 0) === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  এখনো ক্যাটাগরি ডেটা নেই।
                </div>
              ) : (
                analytics?.category_breakdown.map((cat) => (
                  <div key={cat.category} className="rounded-xl border border-border p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="font-medium">{cat.category}</p>
                      <Badge variant="outline">{cat.quantity}টি বিক্রি</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{fmt(cat.revenue)} আয়</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                Gemini এন্টারপ্রাইজ বিশ্লেষণ
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {aiQuery.isLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  AI বিশ্লেষণ তৈরি হচ্ছে...
                </div>
              ) : (
                <>
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm leading-6">{aiQuery.data?.summary}</p>
                  </div>
                  <div>
                    <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">মনোযোগের ক্ষেত্র</p>
                    <p className="text-sm">{aiQuery.data?.focus_area}</p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">পরামর্শ</p>
                    {(aiQuery.data?.recommendations ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">আরও ডেটা সংগ্রহ হলে পরামর্শ দেওয়া হবে।</p>
                    ) : (
                      aiQuery.data?.recommendations.map((rec, i) => (
                        <div key={i} className="rounded-xl border border-border p-3 text-sm">
                          {rec}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
