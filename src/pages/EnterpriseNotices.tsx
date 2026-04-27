import { useMemo, useState } from "react";
import { Loader2, Send, Bell } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useEnterpriseContext,
  useEnterpriseNotices,
  useEnterpriseRestaurants,
  useSendEnterpriseNotice,
} from "@/hooks/useEnterpriseAdmin";

type Audience = "all" | "selected";

export default function EnterpriseNotices() {
  const { groupId } = useEnterpriseContext();
  const restaurantsQuery = useEnterpriseRestaurants(groupId);
  const noticesQuery = useEnterpriseNotices(groupId);
  const sendMutation = useSendEnterpriseNotice(groupId);

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [audience, setAudience] = useState<Audience>("all");
  const [sendEmail, setSendEmail] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const restaurants = restaurantsQuery.data ?? [];

  const summary = useMemo(() => {
    if (audience === "all") return "সকল রেস্টুরেন্ট";
    if (selectedIds.length === 0) return "কোনো রেস্টুরেন্ট নির্বাচিত নয়";
    return `${selectedIds.length}টি রেস্টুরেন্ট নির্বাচিত`;
  }, [audience, selectedIds]);

  const toggle = (id: string) =>
    setSelectedIds((c) => c.includes(id) ? c.filter((x) => x !== id) : [...c, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) { toast.error("শিরোনাম ও বার্তা আবশ্যক।"); return; }
    if (audience === "selected" && selectedIds.length === 0) {
      toast.error("কমপক্ষে একটি রেস্টুরেন্ট নির্বাচন করুন।"); return;
    }
    try {
      await sendMutation.mutateAsync({ title: title.trim(), message: message.trim(), audience, restaurantIds: selectedIds, sendEmail });
      toast.success("নোটিস সফলভাবে পাঠানো হয়েছে।");
      setTitle(""); setMessage(""); setAudience("all"); setSendEmail(true); setSelectedIds([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "নোটিস পাঠানো যায়নি।");
    }
  };

  return (
    <DashboardLayout role="group_owner" title="নোটিস পাঠান">
      <div className="space-y-6">
        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">

          {/* Create form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-amber-500" />
                নতুন নোটিস তৈরি করুন
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label>শিরোনাম *</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="নোটিসের শিরোনাম লিখুন"
                    maxLength={200}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>বার্তা *</Label>
                  <Textarea
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="বিস্তারিত বার্তা লিখুন..."
                    maxLength={2000}
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label>প্রেরণের লক্ষ্য</Label>
                    <Select value={audience} onValueChange={(v) => setAudience(v as Audience)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">সকল রেস্টুরেন্ট</SelectItem>
                        <SelectItem value="selected">নির্বাচিত রেস্টুরেন্ট</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label>ডেলিভারি মোড</Label>
                    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
                      <Switch checked={sendEmail} onCheckedChange={setSendEmail} />
                      <div>
                        <p className="text-sm font-medium">ইমেইলেও পাঠান</p>
                        <p className="text-xs text-muted-foreground">In-app সবসময় যাবে। ইমেইল শুধু যেখানে configure করা আছে।</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Restaurant picker */}
                {audience === "selected" && (
                  <div className="space-y-3 rounded-2xl border border-border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-sm">রেস্টুরেন্ট নির্বাচন করুন</p>
                      <Badge variant="outline" className="text-xs">{summary}</Badge>
                    </div>
                    {restaurantsQuery.isLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" /> লোড হচ্ছে...
                      </div>
                    ) : (
                      <div className="grid gap-2 md:grid-cols-2">
                        {restaurants.map((r) => (
                          <label
                            key={r.restaurant_id}
                            className="flex items-center gap-3 rounded-xl border border-border px-3 py-3 text-sm cursor-pointer hover:bg-secondary/30"
                          >
                            <Checkbox
                              checked={selectedIds.includes(r.restaurant_id)}
                              onCheckedChange={() => toggle(r.restaurant_id)}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-medium">{r.name}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {r.address || "ঠিকানা নেই"}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <Button type="submit" disabled={sendMutation.isPending} className="gap-2">
                  {sendMutation.isPending
                    ? <><Loader2 className="h-4 w-4 animate-spin" /> পাঠানো হচ্ছে...</>
                    : <><Send className="h-4 w-4" /> নোটিস পাঠান</>
                  }
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">নোটিস ইতিহাস</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {noticesQuery.isLoading ? (
                <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> লোড হচ্ছে...
                </div>
              ) : (noticesQuery.data?.length ?? 0) === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  এখনো কোনো নোটিস পাঠানো হয়নি।
                </div>
              ) : (
                noticesQuery.data?.map((n) => (
                  <div key={n.id} className="rounded-2xl border border-border p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="font-medium truncate">{n.title}</p>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">
                        {n.audience === "all" ? "সকল" : "নির্বাচিত"}
                      </Badge>
                    </div>
                    <p className="mb-3 text-sm text-muted-foreground line-clamp-2">{n.message}</p>
                    <div className="grid gap-1 text-xs text-muted-foreground md:grid-cols-3">
                      <p>{n.target_count}টি লক্ষ্য</p>
                      <p>{n.delivered_count}টি delivered</p>
                      <p>{n.emailed_count}টি email</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
