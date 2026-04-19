import { useState, useEffect, useRef } from "react";
import { Routes, Route, NavLink, useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  UserCircle2, Store, MessageSquare, Send, RefreshCw,
  Phone, Mail, Check, CheckCheck, Star, Clock,
  Building2, Edit2, Eye,
} from "lucide-react";

interface ManagerProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  photo_url: string | null;
  bio: string | null;
  specialty: string | null;
  is_active: boolean;
}

interface AssignedRestaurant {
  id: string;
  name: string;
  tier: string;
  owner_id: string;
}

interface Message {
  id: string;
  restaurant_id: string;
  sender_type: "restaurant" | "manager";
  message: string;
  is_read: boolean;
  created_at: string;
}

const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
const fmtTime  = (iso: string) => new Date(iso).toLocaleString("bn-BD", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

// ── Overview ──────────────────────────────────────────────────────────────────
function Overview({ profile, restaurants, messages, onSelectChat }: {
  profile: ManagerProfile | null;
  restaurants: AssignedRestaurant[];
  messages: Message[];
  onSelectChat: (restId: string) => void;
}) {
  if (!profile) return (
    <div className="flex items-center justify-center py-32">
      <div className="text-center space-y-3">
        <UserCircle2 className="w-12 h-12 text-muted-foreground/20 mx-auto" />
        <p className="text-sm text-muted-foreground">প্রোফাইল লোড হচ্ছে...</p>
      </div>
    </div>
  );

  const unreadCount = messages.filter(m => m.sender_type === "restaurant" && !m.is_read).length;

  return (
    <div className="space-y-6 animate-fade-up max-w-3xl">
      {/* Profile card */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary to-primary/40" />
        <CardContent className="p-6 flex flex-col sm:flex-row gap-5 items-start">
          {profile.photo_url ? (
            <img src={profile.photo_url} alt={profile.name}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-primary/20 flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0 border-2 border-primary/20">
              <span className="text-2xl font-bold text-primary">{initials(profile.name)}</span>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <h3 className="text-xl font-bold">{profile.name}</h3>
                {profile.specialty && <p className="text-sm text-primary font-medium mt-0.5">{profile.specialty}</p>}
              </div>
              <Badge className="bg-success/15 text-success border-success/30 border flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" /> সক্রিয়
              </Badge>
            </div>
            {profile.bio && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{profile.bio}</p>}
            <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
              {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 text-warning fill-warning" />)}
              <span className="ml-1">ডেডিকেটেড ম্যানেজার</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "অ্যাসাইন রেস্টুরেন্ট", value: restaurants.length, color: "border-primary/20 bg-primary/5" },
          { label: "মোট বার্তা",            value: messages.length,    color: "border-border bg-secondary/30" },
          { label: "অপেক্ষমাণ বার্তা",      value: unreadCount,        color: unreadCount > 0 ? "border-warning/20 bg-warning/5" : "border-border bg-secondary/30" },
        ].map((s, i) => (
          <div key={i} className={`rounded-2xl border px-4 py-3 text-center ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Assigned restaurants */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Store className="w-5 h-5 text-primary" /> অ্যাসাইন রেস্টুরেন্টসমূহ
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {restaurants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-10">কোনো রেস্টুরেন্ট অ্যাসাইন নেই।</p>
          ) : (
            <div className="divide-y divide-border/40">
              {restaurants.map(rest => {
                const restMsgs = messages.filter(m => m.restaurant_id === rest.id);
                const unread   = restMsgs.filter(m => m.sender_type === "restaurant" && !m.is_read).length;
                const lastMsg  = restMsgs.at(-1);
                return (
                  <div key={rest.id} className="flex items-center gap-4 p-4 hover:bg-secondary/20 transition-colors">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{rest.name}</p>
                      {lastMsg ? (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {lastMsg.sender_type === "manager" ? "আপনি: " : "রেস্টুরেন্ট: "}
                          {lastMsg.message}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground mt-0.5">কোনো বার্তা নেই</p>
                      )}
                    </div>
                    {unread > 0 && (
                      <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                        {unread}
                      </span>
                    )}
                    <Button size="sm" variant="outline" onClick={() => onSelectChat(rest.id)} className="h-8 gap-1 text-xs flex-shrink-0">
                      <MessageSquare className="w-3.5 h-3.5" /> চ্যাট
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Messages (all threads) ────────────────────────────────────────────────────
function MessagesTab({ profile, restaurants, messages, onReload }: {
  profile: ManagerProfile | null;
  restaurants: AssignedRestaurant[];
  messages: Message[];
  onReload: () => void;
}) {
  const [selectedRest, setSelectedRest] = useState<string | null>(null);
  const [replyText,    setReplyText]    = useState("");
  const [sending,      setSending]      = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, selectedRest]);

  const sendReply = async () => {
    if (!selectedRest || !replyText.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("manager_messages").insert({
        restaurant_id: selectedRest,
        sender_type: "manager",
        message: replyText.trim(),
      });
      if (error) throw error;
      await supabase.from("manager_messages").update({ is_read: true })
        .eq("restaurant_id", selectedRest).eq("sender_type", "restaurant").eq("is_read", false);
      setReplyText("");
      onReload();
    } catch (err: any) { toast.error(err.message); }
    finally { setSending(false); }
  };

  const threadMessages = messages.filter(m => m.restaurant_id === selectedRest);
  const selectedRestName = restaurants.find(r => r.id === selectedRest)?.name || "";

  return (
    <div className="grid gap-4 md:grid-cols-3 max-w-5xl animate-fade-up">
      <Card className="md:col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">কথোপকথন</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {restaurants.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">কোনো রেস্টুরেন্ট নেই।</p>
          ) : (
            <div className="divide-y divide-border/30">
              {restaurants.map(rest => {
                const restMsgs = messages.filter(m => m.restaurant_id === rest.id);
                const unread   = restMsgs.filter(m => m.sender_type === "restaurant" && !m.is_read).length;
                const lastMsg  = restMsgs.at(-1);
                return (
                  <button key={rest.id} onClick={() => setSelectedRest(rest.id)}
                    className={`w-full text-left p-3 flex items-start gap-3 hover:bg-secondary/30 transition-colors ${selectedRest === rest.id ? "bg-primary/5" : ""}`}>
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Store className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold truncate">{rest.name}</p>
                        {unread > 0 && (
                          <span className="w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[9px] flex items-center justify-center font-bold flex-shrink-0">
                            {unread}
                          </span>
                        )}
                      </div>
                      {lastMsg && (
                        <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                          {lastMsg.sender_type === "manager" ? "আপনি: " : ""}{lastMsg.message}
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        {selectedRest ? (
          <>
            <CardHeader className="pb-3 border-b border-border/50">
              <CardTitle className="text-sm flex items-center gap-2">
                <Store className="w-4 h-4 text-primary" /> {selectedRestName}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[360px] overflow-y-auto p-4 space-y-3">
                {threadMessages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm text-muted-foreground">এখনো কোনো বার্তা নেই।</p>
                  </div>
                ) : threadMessages.map(msg => {
                  const isManager = msg.sender_type === "manager";
                  return (
                    <div key={msg.id} className={`flex ${isManager ? "justify-end" : "justify-start"} gap-2`}>
                      <div className={`max-w-[75%] flex flex-col gap-1 ${isManager ? "items-end" : "items-start"}`}>
                        <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                          isManager ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                        }`}>
                          {msg.message}
                        </div>
                        <div className={`flex items-center gap-1 text-xs text-muted-foreground px-1 ${isManager ? "flex-row-reverse" : ""}`}>
                          <span>{fmtTime(msg.created_at)}</span>
                          {isManager && (msg.is_read ? <CheckCheck className="w-3.5 h-3.5 text-primary" /> : <Check className="w-3.5 h-3.5" />)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
              <div className="p-4 border-t border-border/50 flex gap-2">
                <Textarea
                  placeholder={`${selectedRestName} কে উত্তর দিন...`}
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  rows={2}
                  className="resize-none flex-1"
                />
                <Button onClick={sendReply} disabled={sending || !replyText.trim()} size="icon" className="h-10 w-10 flex-shrink-0 self-end">
                  {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </CardContent>
          </>
        ) : (
          <CardContent className="flex items-center justify-center h-full py-24 text-center">
            <div>
              <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">বাম পাশ থেকে একটি রেস্টুরেন্ট বেছে নিন</p>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}

// ── Profile edit ──────────────────────────────────────────────────────────────
function ProfileTab({ profile, onReload }: { profile: ManagerProfile | null; onReload: () => void }) {
  const [form, setForm]     = useState({ name: "", specialty: "", phone: "", whatsapp: "", email: "", photo_url: "", bio: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) setForm({
      name: profile.name, specialty: profile.specialty || "",
      phone: profile.phone || "", whatsapp: profile.whatsapp || "",
      email: profile.email || "", photo_url: profile.photo_url || "",
      bio: profile.bio || "",
    });
  }, [profile]);

  const save = async () => {
    if (!profile || !form.name.trim()) { toast.error("নাম লিখুন"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("dedicated_managers").update({
        name: form.name.trim(), specialty: form.specialty || null,
        phone: form.phone || null, whatsapp: form.whatsapp || null,
        photo_url: form.photo_url || null, bio: form.bio || null,
      }).eq("id", profile.id);
      if (error) throw error;
      toast.success("প্রোফাইল আপডেট হয়েছে");
      onReload();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  if (!profile) return null;

  return (
    <div className="max-w-lg space-y-6 animate-fade-up">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <UserCircle2 className="w-4 h-4 text-primary" />
          </div>
          আমার প্রোফাইল
        </h2>
        <p className="text-sm text-muted-foreground mt-1">আপনার তথ্য রেস্টুরেন্টের কাছে দেখানো হয়</p>
      </div>
      <Card>
        <CardContent className="pt-6 space-y-4">
          {[
            { key: "name",      label: "পুরো নাম *",         placeholder: "Md. Rahim Uddin" },
            { key: "specialty", label: "বিশেষত্ব / পদবি",    placeholder: "রেস্টুরেন্ট কনসালট্যান্ট" },
            { key: "phone",     label: "ফোন নম্বর",           placeholder: "+880 17XX-XXXXXX" },
            { key: "whatsapp",  label: "WhatsApp নম্বর",      placeholder: "+880 17XX-XXXXXX" },
            { key: "photo_url", label: "ছবির URL",             placeholder: "https://..." },
          ].map(f => (
            <div key={f.key} className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">{f.label}</p>
              <Input
                value={(form as any)[f.key]}
                onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">পরিচয় (Bio)</p>
            <Textarea
              value={form.bio}
              onChange={e => setForm(prev => ({ ...prev, bio: e.target.value }))}
              placeholder="সংক্ষিপ্ত পরিচয়..."
              rows={3}
              className="resize-none"
            />
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />সেভ হচ্ছে...</> : "প্রোফাইল আপডেট করুন"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main wrapper ──────────────────────────────────────────────────────────────
export default function ManagerDashboard() {
  const { user } = useAuth();
  const [profile,     setProfile]     = useState<ManagerProfile | null>(null);
  const [restaurants, setRestaurants] = useState<AssignedRestaurant[]>([]);
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState<"overview" | "messages" | "profile">("overview");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: mgr } = await supabase
        .from("dedicated_managers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mgr) { setLoading(false); return; }
      setProfile(mgr as ManagerProfile);

      const { data: rests } = await supabase
        .from("restaurants")
        .select("id, name, tier, owner_id")
        .eq("dedicated_manager_id", mgr.id);
      setRestaurants((rests || []) as AssignedRestaurant[]);

      const restIds = (rests || []).map(r => r.id);
      if (restIds.length > 0) {
        const { data: msgs } = await supabase
          .from("manager_messages")
          .select("*")
          .in("restaurant_id", restIds)
          .order("created_at", { ascending: true });
        setMessages((msgs || []) as Message[]);
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [user]);

  useEffect(() => {
    if (!profile) return;
    const channel = supabase
      .channel(`mgr_dashboard_${profile.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "manager_messages",
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile]);

  const getTitle = () => {
    if (activeTab === "messages") return "মেসেজ";
    if (activeTab === "profile")  return "প্রোফাইল";
    return "ড্যাশবোর্ড";
  };

  return (
    <DashboardLayout role="dedicated_manager" title={getTitle()}>
      {loading ? (
        <div className="space-y-4">
          <div className="h-44 rounded-2xl bg-secondary/40 animate-pulse" />
          <div className="h-32 rounded-2xl bg-secondary/40 animate-pulse" />
        </div>
      ) : !profile ? (
        <div className="flex items-center justify-center py-32">
          <div className="text-center space-y-3">
            <UserCircle2 className="w-16 h-16 text-muted-foreground/20 mx-auto" />
            <p className="font-semibold">প্রোফাইল পাওয়া যায়নি</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Super admin আপনার অ্যাকাউন্ট সঠিকভাবে সেটআপ করেনি। সাহায্যের জন্য যোগাযোগ করুন।
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Tab bar */}
          <div className="flex gap-2 p-1 bg-secondary/50 rounded-xl w-fit">
            {([
              { v: "overview",  l: "ওভারভিউ",  icon: <UserCircle2 className="w-4 h-4" /> },
              { v: "messages",  l: "মেসেজ",     icon: <MessageSquare className="w-4 h-4" />, badge: messages.filter(m => m.sender_type === "restaurant" && !m.is_read).length },
              { v: "profile",   l: "প্রোফাইল", icon: <Edit2 className="w-4 h-4" /> },
            ] as const).map(t => (
              <button key={t.v} onClick={() => setActiveTab(t.v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === t.v ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}>
                {t.icon} {t.l}
                {"badge" in t && t.badge > 0 && (
                  <span className="w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>

          {activeTab === "overview" && (
            <Overview
              profile={profile}
              restaurants={restaurants}
              messages={messages}
              onSelectChat={() => setActiveTab("messages")}
            />
          )}
          {activeTab === "messages" && (
            <MessagesTab
              profile={profile}
              restaurants={restaurants}
              messages={messages}
              onReload={load}
            />
          )}
          {activeTab === "profile" && (
            <ProfileTab profile={profile} onReload={load} />
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
