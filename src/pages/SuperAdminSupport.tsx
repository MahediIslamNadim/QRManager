import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Headphones, Clock, CheckCircle2, RefreshCw, X,
  ChevronDown, ChevronUp, Send, AlertCircle,
} from "lucide-react";

type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: any }> = {
  open:        { label: "খোলা",        color: "bg-blue-500/15 text-blue-500 border-blue-500/30",     icon: Clock },
  in_progress: { label: "প্রক্রিয়াধীন", color: "bg-warning/15 text-warning border-warning/30",       icon: RefreshCw },
  resolved:    { label: "সমাধান হয়েছে", color: "bg-success/15 text-success border-success/30",       icon: CheckCircle2 },
  closed:      { label: "বন্ধ",         color: "bg-secondary text-muted-foreground border-border",   icon: X },
};

const PRIORITY_COLOR: Record<string, string> = {
  low:    "bg-secondary text-muted-foreground border-border",
  medium: "bg-blue-500/15 text-blue-500 border-blue-500/30",
  high:   "bg-warning/15 text-warning border-warning/30",
  urgent: "bg-destructive/15 text-destructive border-destructive/30",
};

const PRIORITY_LABEL: Record<string, string> = {
  low: "সাধারণ", medium: "মাঝারি", high: "জরুরি", urgent: "অত্যন্ত জরুরি",
};

const STATUS_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: "all",         label: "সব" },
  { value: "open",        label: "খোলা" },
  { value: "in_progress", label: "প্রক্রিয়াধীন" },
  { value: "resolved",    label: "সমাধান হয়েছে" },
  { value: "closed",      label: "বন্ধ" },
];

export default function SuperAdminSupport() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId]     = useState<string | null>(null);
  const [replyText,  setReplyText]      = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["super-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*, restaurants(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ id, reply, status }: { id: string; reply: string; status: TicketStatus }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ admin_reply: reply, status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { id }) => {
      toast.success("উত্তর পাঠানো হয়েছে");
      setReplyText(prev => ({ ...prev, [id]: "" }));
      queryClient.invalidateQueries({ queryKey: ["super-support-tickets"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: TicketStatus }) => {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("স্ট্যাটাস আপডেট হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["super-support-tickets"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const filtered = statusFilter === "all"
    ? tickets
    : tickets.filter((t: any) => t.status === statusFilter);

  const openCount   = tickets.filter((t: any) => t.status === "open").length;
  const urgentCount = tickets.filter((t: any) => t.priority === "urgent" && (t.status === "open" || t.status === "in_progress")).length;

  return (
    <DashboardLayout role="super_admin" title="সাপোর্ট টিকেটসমূহ">
      <div className="space-y-6 animate-fade-up max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Headphones className="w-5 h-5 text-primary" />
              </div>
              সাপোর্ট টিকেটসমূহ
            </h2>
            <p className="text-sm text-muted-foreground mt-1">সকল রেস্টুরেন্টের সাপোর্ট অনুরোধ</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ["super-support-tickets"] })} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> রিফ্রেশ
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "মোট টিকেট",        value: tickets.length,  color: "border-border bg-secondary/30" },
            { label: "খোলা / অপেক্ষমান", value: openCount,       color: "border-warning/20 bg-warning/5" },
            { label: "অত্যন্ত জরুরি",     value: urgentCount,     color: "border-destructive/20 bg-destructive/5" },
          ].map((s, i) => (
            <div key={i} className={`rounded-2xl border px-4 py-3 text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {STATUS_FILTER_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setStatusFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                statusFilter === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
              }`}>
              {opt.label}
              {opt.value !== "all" && (
                <span className="ml-1.5 opacity-60">
                  ({tickets.filter((t: any) => t.status === opt.value).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Ticket list */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="py-16 text-center text-muted-foreground text-sm">লোড হচ্ছে...</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <Headphones className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                <p className="text-sm text-muted-foreground">কোনো টিকেট নেই</p>
              </div>
            ) : (
              <div className="divide-y divide-border/40">
                {filtered.map((ticket: any) => {
                  const st     = STATUS_CONFIG[ticket.status as TicketStatus] || STATUS_CONFIG.open;
                  const StIcon = st.icon;
                  const isOpen = expandedId === ticket.id;

                  return (
                    <div key={ticket.id} className="hover:bg-secondary/20 transition-colors">
                      {/* Row */}
                      <button className="w-full text-left p-4 flex items-start gap-3"
                        onClick={() => setExpandedId(isOpen ? null : ticket.id)}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold truncate">{ticket.subject}</span>
                            <Badge className={`text-[10px] px-1.5 py-0 border ${st.color} flex items-center gap-1`}>
                              <StIcon className="w-3 h-3" /> {st.label}
                            </Badge>
                            <Badge className={`text-[10px] px-1.5 py-0 border ${PRIORITY_COLOR[ticket.priority] || ""}`}>
                              {PRIORITY_LABEL[ticket.priority] || ticket.priority}
                            </Badge>
                            {ticket.priority === "urgent" && (ticket.status === "open" || ticket.status === "in_progress") && (
                              <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground/70">{ticket.restaurants?.name || "—"}</span>
                            <span>·</span>
                            <span>{new Date(ticket.created_at).toLocaleDateString("bn-BD", { day: "2-digit", month: "short", year: "numeric" })}</span>
                          </div>
                        </div>
                        {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                                : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />}
                      </button>

                      {/* Expanded */}
                      {isOpen && (
                        <div className="px-4 pb-5 space-y-4 border-t border-border/30 pt-4 bg-secondary/10">
                          {/* Description */}
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground mb-1">অনুরোধের বিবরণ</p>
                            <p className="text-sm leading-relaxed bg-background rounded-xl p-3 border border-border/50">{ticket.description}</p>
                          </div>

                          {/* Previous reply */}
                          {ticket.admin_reply && (
                            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                              <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                                <Headphones className="w-3.5 h-3.5" /> আপনার আগের উত্তর
                              </p>
                              <p className="text-sm leading-relaxed">{ticket.admin_reply}</p>
                            </div>
                          )}

                          {/* Reply form */}
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">উত্তর দিন</p>
                            <Textarea
                              placeholder="রেস্টুরেন্ট মালিককে উত্তর লিখুন..."
                              value={replyText[ticket.id] || ""}
                              onChange={e => setReplyText(prev => ({ ...prev, [ticket.id]: e.target.value }))}
                              rows={3}
                              className="resize-none"
                            />
                            <div className="flex gap-2 flex-wrap">
                              <Button size="sm" className="gap-1.5" disabled={!replyText[ticket.id]?.trim() || replyMutation.isPending}
                                onClick={() => replyMutation.mutate({
                                  id: ticket.id,
                                  reply: replyText[ticket.id],
                                  status: "in_progress",
                                })}>
                                <Send className="w-3.5 h-3.5" /> উত্তর পাঠান
                              </Button>
                              <Button size="sm" variant="outline" className="gap-1.5 text-success border-success/30 hover:bg-success/10"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: ticket.id, status: "resolved" })}>
                                <CheckCircle2 className="w-3.5 h-3.5" /> সমাধান হয়েছে
                              </Button>
                              <Button size="sm" variant="outline" className="gap-1.5 text-muted-foreground"
                                disabled={statusMutation.isPending}
                                onClick={() => statusMutation.mutate({ id: ticket.id, status: "closed" })}>
                                <X className="w-3.5 h-3.5" /> বন্ধ করুন
                              </Button>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            টিকেট ID: <span className="font-mono">{ticket.id.slice(0, 8).toUpperCase()}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
