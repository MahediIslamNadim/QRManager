import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import FeatureGate from "@/components/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Headphones, Plus, Clock, CheckCircle2, AlertCircle,
  MessageSquare, RefreshCw, X, ChevronDown, ChevronUp,
  Mail, Phone, Zap,
} from "lucide-react";

type TicketCategory = "technical" | "billing" | "feature" | "general";
type TicketPriority = "low" | "medium" | "high" | "urgent";
type TicketStatus   = "open" | "in_progress" | "resolved" | "closed";

interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  admin_reply: string | null;
  created_at: string;
  updated_at: string;
}

const CATEGORIES: { value: TicketCategory; label: string; icon: string }[] = [
  { value: "technical", label: "প্রযুক্তিগত সমস্যা", icon: "🔧" },
  { value: "billing",   label: "বিলিং ও পেমেন্ট",   icon: "💳" },
  { value: "feature",   label: "ফিচার রিকোয়েস্ট",   icon: "✨" },
  { value: "general",   label: "সাধারণ প্রশ্ন",      icon: "💬" },
];

const PRIORITIES: { value: TicketPriority; label: string; color: string }[] = [
  { value: "low",    label: "সাধারণ",      color: "bg-secondary text-muted-foreground border-border" },
  { value: "medium", label: "মাঝারি",      color: "bg-blue-500/15 text-blue-500 border-blue-500/30" },
  { value: "high",   label: "জরুরি",       color: "bg-warning/15 text-warning border-warning/30" },
  { value: "urgent", label: "অত্যন্ত জরুরি", color: "bg-destructive/15 text-destructive border-destructive/30" },
];

const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; icon: any }> = {
  open:        { label: "খোলা",        color: "bg-blue-500/15 text-blue-500 border-blue-500/30",           icon: Clock },
  in_progress: { label: "প্রক্রিয়াধীন", color: "bg-warning/15 text-warning border-warning/30",             icon: RefreshCw },
  resolved:    { label: "সমাধান হয়েছে", color: "bg-success/15 text-success border-success/30",             icon: CheckCircle2 },
  closed:      { label: "বন্ধ",         color: "bg-secondary text-muted-foreground border-border",         icon: X },
};

export default function AdminSupport() {
  const { restaurantId } = useAuth();

  const [tickets,      setTickets]      = useState<SupportTicket[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [submitting,   setSubmitting]   = useState(false);
  const [showForm,     setShowForm]     = useState(false);
  const [expandedId,   setExpandedId]   = useState<string | null>(null);

  const [subject,      setSubject]      = useState("");
  const [description,  setDescription]  = useState("");
  const [category,     setCategory]     = useState<TicketCategory>("technical");
  const [priority,     setPriority]     = useState<TicketPriority>("medium");

  const loadTickets = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setTickets((data || []) as SupportTicket[]);
    } catch (err: any) {
      toast.error("টিকেট লোড করতে সমস্যা হয়েছে");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTickets(); }, [restaurantId]);

  const submitTicket = async () => {
    if (!restaurantId) return;
    if (!subject.trim())      { toast.error("বিষয় লিখুন"); return; }
    if (!description.trim())  { toast.error("বিস্তারিত লিখুন"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("support_tickets").insert({
        restaurant_id: restaurantId,
        subject:       subject.trim(),
        description:   description.trim(),
        category,
        priority,
        status: "open",
      });
      if (error) throw error;
      toast.success("সাপোর্ট টিকেট জমা হয়েছে! শীঘ্রই যোগাযোগ করা হবে।");
      setSubject(""); setDescription("");
      setCategory("technical"); setPriority("medium");
      setShowForm(false);
      loadTickets();
    } catch (err: any) {
      toast.error(err.message || "টিকেট জমা দিতে সমস্যা হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  const openCount       = tickets.filter(t => t.status === "open" || t.status === "in_progress").length;
  const resolvedCount   = tickets.filter(t => t.status === "resolved" || t.status === "closed").length;

  return (
    <DashboardLayout role="admin" title="প্রায়োরিটি সাপোর্ট ২৪/৭">
      <FeatureGate feature="priority_support">
        <div className="space-y-6 animate-fade-up max-w-4xl">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Headphones className="w-5 h-5 text-primary" />
                </div>
                প্রায়োরিটি সাপোর্ট ২৪/৭
              </h2>
              <p className="text-sm text-muted-foreground mt-1">High Smart — ডেডিকেটেড সাপোর্ট টিম সর্বদা প্রস্তুত</p>
            </div>
            <Button onClick={() => setShowForm(v => !v)} className="gap-2" variant="hero">
              <Plus className="w-4 h-4" /> নতুন টিকেট খুলুন
            </Button>
          </div>

          {/* Contact channels */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                icon: <Zap className="w-5 h-5 text-success" />,
                label: "গড় রেসপন্স টাইম",
                value: "< ২ ঘণ্টা",
                color: "border-success/20 bg-success/5",
              },
              {
                icon: <Phone className="w-5 h-5 text-primary" />,
                label: "WhatsApp সাপোর্ট",
                value: "+880 1700-000000",
                color: "border-primary/20 bg-primary/5",
              },
              {
                icon: <Mail className="w-5 h-5 text-blue-500" />,
                label: "ইমেইল সাপোর্ট",
                value: "support@nexcore.app",
                color: "border-blue-500/20 bg-blue-500/5",
              },
            ].map((c, i) => (
              <Card key={i} className={`border ${c.color}`}>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-background flex items-center justify-center flex-shrink-0">
                    {c.icon}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{c.label}</p>
                    <p className="text-sm font-semibold">{c.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "মোট টিকেট",    value: tickets.length,  color: "border-border bg-secondary/30" },
              { label: "খোলা / চলমান", value: openCount,       color: "border-warning/20 bg-warning/5" },
              { label: "সমাধান হয়েছে", value: resolvedCount,   color: "border-success/20 bg-success/5" },
            ].map((s, i) => (
              <div key={i} className={`rounded-2xl border px-4 py-3 text-center ${s.color}`}>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* New ticket form */}
          {showForm && (
            <Card className="border-primary/20 bg-gradient-to-br from-primary/3 to-transparent">
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-primary" /> নতুন সাপোর্ট টিকেট
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Category */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">বিভাগ</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CATEGORIES.map(c => (
                      <button key={c.value} onClick={() => setCategory(c.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                          category === c.value
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                        }`}>
                        <span>{c.icon}</span> {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Priority */}
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">অগ্রাধিকার</p>
                  <div className="flex flex-wrap gap-2">
                    {PRIORITIES.map(p => (
                      <button key={p.value} onClick={() => setPriority(p.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          priority === p.value ? p.color + " border" : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                        }`}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">বিষয়</p>
                  <Input
                    placeholder="সমস্যার সংক্ষিপ্ত বিবরণ..."
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    maxLength={120}
                  />
                </div>

                {/* Description */}
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground">বিস্তারিত বিবরণ</p>
                  <Textarea
                    placeholder="সমস্যাটি বিস্তারিত লিখুন — কখন হচ্ছে, কী করলে হচ্ছে, স্ক্রিনশট থাকলে উল্লেখ করুন..."
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                </div>

                <div className="flex gap-3">
                  <Button onClick={submitTicket} disabled={submitting} className="gap-2">
                    {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> জমা হচ্ছে...</> : "টিকেট জমা দিন"}
                  </Button>
                  <Button variant="outline" onClick={() => setShowForm(false)}>বাতিল</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Ticket list */}
          <Card>
            <CardHeader className="pb-3 flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" /> টিকেট ইতিহাস
              </CardTitle>
              <Button size="sm" variant="outline" onClick={loadTickets} disabled={loading} className="h-8 gap-1.5 text-xs">
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> রিফ্রেশ
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {tickets.length === 0 ? (
                <div className="py-16 text-center space-y-3">
                  <Headphones className="w-12 h-12 text-muted-foreground/20 mx-auto" />
                  <p className="text-sm text-muted-foreground">কোনো টিকেট নেই।</p>
                  <p className="text-xs text-muted-foreground">সমস্যা হলে "নতুন টিকেট খুলুন" বাটনে ক্লিক করুন।</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {tickets.map(ticket => {
                    const st      = STATUS_CONFIG[ticket.status];
                    const pr      = PRIORITIES.find(p => p.value === ticket.priority);
                    const cat     = CATEGORIES.find(c => c.value === ticket.category);
                    const isOpen  = expandedId === ticket.id;
                    const StIcon  = st.icon;

                    return (
                      <div key={ticket.id} className="hover:bg-secondary/20 transition-colors">
                        <button
                          className="w-full text-left p-4 flex items-start gap-3"
                          onClick={() => setExpandedId(isOpen ? null : ticket.id)}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-sm font-semibold truncate">{ticket.subject}</span>
                              <Badge className={`text-[10px] px-1.5 py-0 border ${st.color} flex items-center gap-1`}>
                                <StIcon className="w-3 h-3" /> {st.label}
                              </Badge>
                              {pr && (
                                <Badge className={`text-[10px] px-1.5 py-0 border ${pr.color}`}>{pr.label}</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{cat?.icon} {cat?.label}</span>
                              <span>·</span>
                              <span>{new Date(ticket.created_at).toLocaleDateString("bn-BD", { day: "2-digit", month: "short", year: "numeric" })}</span>
                            </div>
                          </div>
                          {isOpen
                            ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                            : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                          }
                        </button>

                        {isOpen && (
                          <div className="px-4 pb-4 space-y-3 border-t border-border/30 pt-3 bg-secondary/10">
                            <div>
                              <p className="text-xs font-semibold text-muted-foreground mb-1">আপনার বিবরণ</p>
                              <p className="text-sm leading-relaxed">{ticket.description}</p>
                            </div>
                            {ticket.admin_reply && (
                              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                                <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1">
                                  <Headphones className="w-3.5 h-3.5" /> সাপোর্ট টিমের উত্তর
                                </p>
                                <p className="text-sm leading-relaxed">{ticket.admin_reply}</p>
                              </div>
                            )}
                            {!ticket.admin_reply && (ticket.status === "open" || ticket.status === "in_progress") && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-warning" />
                                সাপোর্ট টিম শীঘ্রই উত্তর দেবে...
                              </div>
                            )}
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

          {/* SLA info */}
          <Card className="border-primary/10 bg-gradient-to-br from-primary/3 to-transparent">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm mb-2">High Smart সাপোর্ট গ্যারান্টি</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    <li>• <strong>Urgent</strong> টিকেট: ৩০ মিনিটের মধ্যে প্রথম রেসপন্স</li>
                    <li>• <strong>High</strong> টিকেট: ২ ঘণ্টার মধ্যে রেসপন্স</li>
                    <li>• <strong>Medium/Low</strong> টিকেট: ২৪ ঘণ্টার মধ্যে রেসপন্স</li>
                    <li>• সপ্তাহে ৭ দিন, দিনে ২৪ ঘণ্টা সাপোর্ট উপলব্ধ</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
