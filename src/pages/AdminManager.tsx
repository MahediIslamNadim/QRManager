import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import FeatureGate from "@/components/FeatureGate";
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
  UserCircle2, Phone, Mail, MessageSquare, Send,
  Clock, CheckCheck, Check, RefreshCw, Star, Headphones,
  Lock, Zap, ChevronRight, Plus, Edit2, Trash2, KeyRound, UserX, LogIn,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Manager {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  photo_url: string | null;
  bio: string | null;
  specialty: string | null;
  user_id: string | null;
}

interface Message {
  id: string;
  sender_type: "restaurant" | "manager";
  message: string;
  is_read: boolean;
  created_at: string;
}

const EMPTY_FORM = { name: "", email: "", phone: "", whatsapp: "", photo_url: "", bio: "", specialty: "" };

// ── Upgrade prompt (Medium Smart) ─────────────────────────────────────────────
function ManagerUpgradePrompt() {
  const navigate = useNavigate();
  return (
    <div className="space-y-6 animate-fade-up max-w-2xl mx-auto">
      <Card className="border-primary/20 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-primary via-purple-500 to-primary" />
        <CardContent className="py-10 text-center space-y-5 px-8">
          <div className="relative inline-block">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-purple-500/10 flex items-center justify-center mx-auto">
              <UserCircle2 className="w-10 h-10 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-destructive/15 border-2 border-background flex items-center justify-center">
              <Lock className="w-3.5 h-3.5 text-destructive" />
            </div>
          </div>
          <div>
            <h2 className="text-xl font-bold">ডেডিকেটেড ম্যানেজার</h2>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
              আপনার রেস্টুরেন্টের জন্য একজন ব্যক্তিগত ম্যানেজার যোগ করুন — যিনি সরাসরি আপনাকে সাহায্য করবেন।
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto">
            {[
              { icon: "👤", title: "ব্যক্তিগত ম্যানেজার", desc: "শুধু আপনার জন্য নির্ধারিত একজন বিশেষজ্ঞ" },
              { icon: "💬", title: "সরাসরি চ্যাট", desc: "যেকোনো সময় মেসেজ করুন, দ্রুত উত্তর পান" },
              { icon: "📞", title: "ফোন / WhatsApp", desc: "সরাসরি ফোন ও WhatsApp যোগাযোগ" },
              { icon: "⚡", title: "দ্রুত সমস্যা সমাধান", desc: "২ ঘণ্টার মধ্যে রেসপন্স গ্যারান্টি" },
            ].map(f => (
              <div key={f.title} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40">
                <span className="text-xl flex-shrink-0">{f.icon}</span>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3 pt-2">
            <Button onClick={() => navigate("/upgrade")}
              className="bg-gradient-to-r from-primary to-purple-600 text-white gap-2 px-8 py-3 h-auto rounded-xl font-semibold hover:opacity-90">
              <Zap className="w-4 h-4" /> হাই স্মার্টে আপগ্রেড করুন
            </Button>
            <p className="text-xs text-muted-foreground">১৪ দিনের ফ্রি ট্রায়াল • যেকোনো সময় বাতিল করুন</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground uppercase tracking-wide">প্ল্যান তুলনা</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {[
            { feature: "ডেডিকেটেড ম্যানেজার যোগ করা", medium: false, high: true },
            { feature: "সরাসরি চ্যাট সাপোর্ট",         medium: false, high: true },
            { feature: "প্রায়োরিটি সাপোর্ট ২৪/৭",      medium: false, high: true },
            { feature: "AI অ্যাডভান্সড অ্যানালিটিক্স",  medium: false, high: true },
            { feature: "আনলিমিটেড মেনু আইটেম",         medium: false, high: true },
            { feature: "বেসিক অ্যানালিটিক্স",           medium: true,  high: true },
            { feature: "QR অর্ডারিং",                   medium: true,  high: true },
          ].map(r => (
            <div key={r.feature} className="flex items-center px-5 py-3 text-sm border-b border-border/30 last:border-0">
              <span className="flex-1 text-muted-foreground">{r.feature}</span>
              <span className={`w-24 text-center text-xs font-medium ${r.medium ? "text-success" : "text-muted-foreground/40"}`}>
                {r.medium ? "✓ মিডিয়াম" : "✗"}
              </span>
              <span className={`w-24 text-center text-xs font-medium ${r.high ? "text-primary" : "text-muted-foreground/40"}`}>
                {r.high ? "✓ হাই স্মার্ট" : "✗"}
              </span>
            </div>
          ))}
          <div className="p-4">
            <Button variant="outline" onClick={() => navigate("/upgrade")} className="w-full gap-2">
              পূর্ণ প্ল্যান বিস্তারিত দেখুন <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminManager() {
  const { restaurantId } = useAuth();

  const [manager,    setManager]    = useState<Manager | null>(null);
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);

  // form state
  const [formOpen,  setFormOpen]  = useState(false);
  const [form,      setForm]      = useState(EMPTY_FORM);
  const [saving,    setSaving]    = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  // account creation dialog
  const [accountOpen,     setAccountOpen]     = useState(false);
  const [accountEmail,    setAccountEmail]    = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountSaving,   setAccountSaving]   = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const { data: rest } = await supabase
        .from("restaurants")
        .select("dedicated_manager_id")
        .eq("id", restaurantId)
        .single();

      if (rest?.dedicated_manager_id) {
        const { data: mgr } = await supabase
          .from("dedicated_managers")
          .select("*")
          .eq("id", rest.dedicated_manager_id)
          .single();
        setManager(mgr || null);
      } else {
        setManager(null);
      }

      const { data: msgs } = await supabase
        .from("manager_messages")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: true });
      setMessages((msgs || []) as Message[]);

      await supabase
        .from("manager_messages")
        .update({ is_read: true })
        .eq("restaurant_id", restaurantId)
        .eq("sender_type", "manager")
        .eq("is_read", false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`mgr_msgs_${restaurantId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "manager_messages",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, payload => {
        setMessages(prev => [...prev, payload.new as Message]);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Save manager ──────────────────────────────────────────────────────────
  const openAdd = () => {
    setForm(EMPTY_FORM);
    setIsEditing(false);
    setFormOpen(true);
  };

  const openEdit = () => {
    if (!manager) return;
    setForm({
      name: manager.name,
      email: manager.email || "",
      phone: manager.phone || "",
      whatsapp: manager.whatsapp || "",
      photo_url: manager.photo_url || "",
      bio: manager.bio || "",
      specialty: manager.specialty || "",
    });
    setIsEditing(true);
    setFormOpen(true);
  };

  const saveManager = async () => {
    if (!restaurantId || !form.name.trim()) { toast.error("নাম লিখুন"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        whatsapp: form.whatsapp || null,
        photo_url: form.photo_url || null,
        bio: form.bio || null,
        specialty: form.specialty || null,
        is_active: true,
      };

      if (isEditing && manager) {
        const { error } = await supabase.from("dedicated_managers").update(payload).eq("id", manager.id);
        if (error) throw error;
        toast.success("ম্যানেজার তথ্য আপডেট হয়েছে");
      } else {
        const { data: newMgr, error } = await supabase
          .from("dedicated_managers")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;

        // Link to restaurant
        const { error: linkErr } = await supabase
          .from("restaurants")
          .update({ dedicated_manager_id: newMgr.id })
          .eq("id", restaurantId);
        if (linkErr) throw linkErr;
        toast.success("ম্যানেজার সফলভাবে যোগ হয়েছে");
      }

      setFormOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "সেভ করতে সমস্যা হয়েছে");
    } finally {
      setSaving(false);
    }
  };

  const openAccountDialog = () => {
    setAccountEmail(manager?.email || "");
    setAccountPassword("");
    setAccountOpen(true);
  };

  const invokeManager = async (body: object) => {
    const { data, error } = await supabase.functions.invoke("create-manager", { body });
    if (error) throw new Error(`Edge function error: ${error.message}`);
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const createManagerAccount = async () => {
    if (!manager || !accountEmail.trim()) { toast.error("ইমেইল লিখুন"); return; }
    setAccountSaving(true);
    try {
      await invokeManager({
        action: "create",
        manager_id: manager.id,
        email: accountEmail.trim(),
        password: accountPassword || undefined,
        full_name: manager.name,
      });
      toast.success("লগইন অ্যাকাউন্ট তৈরি হয়েছে! ম্যানেজার এখন লগইন করতে পারবেন।");
      setAccountOpen(false);
      load();
    } catch (err: any) {
      toast.error(err.message || "অ্যাকাউন্ট তৈরিতে সমস্যা হয়েছে");
    } finally { setAccountSaving(false); }
  };

  const removeManagerAccount = async () => {
    if (!manager) return;
    if (!confirm(`${manager.name} এর লগইন অ্যাক্সেস সরিয়ে দেবেন?`)) return;
    try {
      await invokeManager({ action: "remove", manager_id: manager.id });
      toast.success("লগইন অ্যাক্সেস সরানো হয়েছে");
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const removeManager = async () => {
    if (!restaurantId || !manager) return;
    if (!confirm("এই ম্যানেজার সরিয়ে দেবেন?")) return;
    try {
      await supabase.from("restaurants").update({ dedicated_manager_id: null }).eq("id", restaurantId);
      await supabase.from("dedicated_managers").delete().eq("id", manager.id);
      toast.success("ম্যানেজার সরানো হয়েছে");
      load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = async () => {
    if (!restaurantId || !newMessage.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.from("manager_messages").insert({
        restaurant_id: restaurantId,
        sender_type: "restaurant",
        message: newMessage.trim(),
      });
      if (error) throw error;
      setNewMessage("");
    } catch {
      toast.error("বার্তা পাঠাতে সমস্যা হয়েছে");
    } finally {
      setSending(false);
    }
  };

  const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const fmtTime  = (iso: string) => new Date(iso).toLocaleString("bn-BD", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <DashboardLayout role="admin" title="ডেডিকেটেড ম্যানেজার">
      <FeatureGate feature="dedicated_manager" fallback={<ManagerUpgradePrompt />}>
        <div className="space-y-6 animate-fade-up max-w-3xl">

          {/* Header */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                  <UserCircle2 className="w-5 h-5 text-primary" />
                </div>
                ডেডিকেটেড ম্যানেজার
              </h2>
              <p className="text-sm text-muted-foreground mt-1">High Smart — আপনার ব্যক্তিগত রেস্টুরেন্ট ম্যানেজার</p>
            </div>
            {!loading && !manager && (
              <Button onClick={openAdd} className="gap-2" variant="hero">
                <Plus className="w-4 h-4" /> ম্যানেজার যোগ করুন
              </Button>
            )}
          </div>

          {loading ? (
            <div className="space-y-4">
              <div className="h-44 rounded-2xl bg-secondary/40 animate-pulse" />
              <div className="h-80 rounded-2xl bg-secondary/40 animate-pulse" />
            </div>
          ) : manager ? (
            <>
              {/* Manager profile card */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-primary to-primary/40" />
                <CardContent className="p-0">
                  <div className="p-6 flex flex-col sm:flex-row gap-5 items-start">
                    {/* Avatar */}
                    {manager.photo_url ? (
                      <img src={manager.photo_url} alt={manager.name}
                        className="w-20 h-20 rounded-2xl object-cover border-2 border-primary/20 flex-shrink-0" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center flex-shrink-0 border-2 border-primary/20">
                        <span className="text-2xl font-bold text-primary">{initials(manager.name)}</span>
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="text-xl font-bold">{manager.name}</h3>
                          {manager.specialty && <p className="text-sm text-primary font-medium mt-0.5">{manager.specialty}</p>}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-success/15 text-success border-success/30 border flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" /> সক্রিয়
                          </Badge>
                          <Button size="icon" variant="ghost" onClick={openEdit} className="h-8 w-8">
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={removeManager}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                          {manager.user_id ? (
                            <Button size="sm" variant="ghost" onClick={removeManagerAccount}
                              className="h-8 px-2 text-xs gap-1 text-destructive/70 hover:text-destructive hover:bg-destructive/10">
                              <UserX className="w-3.5 h-3.5" /> লগইন সরান
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={openAccountDialog}
                              className="h-8 px-2 text-xs gap-1 text-primary border-primary/40 hover:bg-primary/10">
                              <KeyRound className="w-3.5 h-3.5" /> লগইন তৈরি করুন
                            </Button>
                          )}
                        </div>
                      </div>

                      {manager.bio && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{manager.bio}</p>}

                      <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                        {[1,2,3,4,5].map(i => <Star key={i} className="w-3.5 h-3.5 text-warning fill-warning" />)}
                        <span className="ml-1">ডেডিকেটেড ম্যানেজার</span>
                        {manager.user_id && (
                          <span className="ml-2 flex items-center gap-1 text-success">
                            <LogIn className="w-3 h-3" /> লগইন সক্রিয়
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2 mt-4">
                        {manager.whatsapp && (
                          <a href={`https://wa.me/${manager.whatsapp.replace(/\D/g, "")}`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/15 text-success border border-success/30 text-xs font-medium hover:bg-success/25 transition-colors">
                            <Phone className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                        )}
                        {manager.phone && (
                          <a href={`tel:${manager.phone}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/25 transition-colors">
                            <Phone className="w-3.5 h-3.5" /> কল করুন
                          </a>
                        )}
                        {manager.email && (
                          <a href={`mailto:${manager.email}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border text-xs font-medium hover:bg-secondary/80 transition-colors text-muted-foreground">
                            <Mail className="w-3.5 h-3.5" /> ইমেইল
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Chat */}
              <Card>
                <CardHeader className="pb-3 flex-row items-center justify-between border-b border-border/50">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" /> {manager.name} এর সাথে চ্যাট
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={load} className="h-8 gap-1 text-xs text-muted-foreground">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="h-[340px] overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <MessageSquare className="w-7 h-7 text-primary/40" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">কথোপকথন শুরু করুন</p>
                          <p className="text-xs text-muted-foreground mt-1">{manager.name} আপনার জন্য সর্বদা প্রস্তুত।</p>
                        </div>
                      </div>
                    ) : messages.map(msg => {
                      const isOwn = msg.sender_type === "restaurant";
                      return (
                        <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} gap-2`}>
                          {!isOwn && (
                            <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-primary">{initials(manager.name)}</span>
                            </div>
                          )}
                          <div className={`max-w-[75%] flex flex-col gap-1 ${isOwn ? "items-end" : "items-start"}`}>
                            <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                              isOwn ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"
                            }`}>
                              {msg.message}
                            </div>
                            <div className={`flex items-center gap-1 text-xs text-muted-foreground px-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                              <span>{fmtTime(msg.created_at)}</span>
                              {isOwn && (msg.is_read ? <CheckCheck className="w-3.5 h-3.5 text-primary" /> : <Check className="w-3.5 h-3.5" />)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={bottomRef} />
                  </div>
                  <div className="p-4 border-t border-border/50 flex gap-2">
                    <Textarea
                      placeholder={`${manager.name} কে বার্তা পাঠান...`}
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                      rows={1}
                      className="resize-none flex-1"
                    />
                    <Button onClick={sendMessage} disabled={sending || !newMessage.trim()} size="icon" className="h-10 w-10 flex-shrink-0">
                      {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/40 border border-border/50 text-sm">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-muted-foreground">
                  জরুরি বিষয়ে সরাসরি <strong>WhatsApp বা ফোনে</strong> যোগাযোগ করুন।
                </p>
              </div>
            </>
          ) : (
            /* No manager */
            <Card className="border-dashed border-primary/30">
              <CardContent className="py-16 text-center space-y-5">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Headphones className="w-10 h-10 text-primary/40" />
                </div>
                <div>
                  <p className="font-bold text-lg">কোনো ম্যানেজার যোগ করা হয়নি</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                    আপনার রেস্টুরেন্টের জন্য একজন ডেডিকেটেড ম্যানেজার যোগ করুন — তার নাম, ফোন ও WhatsApp নম্বর রাখুন।
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                  {["👤 ব্যক্তিগত ম্যানেজার", "💬 সরাসরি চ্যাট", "📞 ফোন সাপোর্ট", "⚡ দ্রুত রেসপন্স"].map(t => (
                    <span key={t} className="bg-secondary px-3 py-1 rounded-full">{t}</span>
                  ))}
                </div>
                <Button onClick={openAdd} className="gap-2" variant="hero">
                  <Plus className="w-4 h-4" /> ম্যানেজার যোগ করুন
                </Button>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Account creation dialog */}
        <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" />
                লগইন অ্যাকাউন্ট তৈরি করুন
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              <p className="text-sm text-muted-foreground">
                <strong>{manager?.name}</strong> এর জন্য একটি লগইন তৈরি হবে।
                তিনি এই ইমেইল ও পাসওয়ার্ড দিয়ে সরাসরি লগইন করতে পারবেন।
              </p>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">ইমেইল *</p>
                <Input
                  type="email"
                  value={accountEmail}
                  onChange={e => setAccountEmail(e.target.value)}
                  placeholder="manager@example.com"
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">পাসওয়ার্ড (নতুন অ্যাকাউন্টের জন্য)</p>
                <Input
                  type="password"
                  value={accountPassword}
                  onChange={e => setAccountPassword(e.target.value)}
                  placeholder="কমপক্ষে ৬ অক্ষর"
                />
                <p className="text-[10px] text-muted-foreground">
                  যদি এই ইমেইলে আগেই অ্যাকাউন্ট থাকে তাহলে পাসওয়ার্ড লাগবে না।
                </p>
              </div>
              <div className="flex gap-3 pt-1">
                <Button onClick={createManagerAccount} disabled={accountSaving} className="flex-1 gap-2">
                  {accountSaving
                    ? <><RefreshCw className="w-4 h-4 animate-spin" />তৈরি হচ্ছে...</>
                    : <><KeyRound className="w-4 h-4" />অ্যাকাউন্ট তৈরি করুন</>}
                </Button>
                <Button variant="outline" onClick={() => setAccountOpen(false)}>বাতিল</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Manager form dialog */}
        <Dialog open={formOpen} onOpenChange={setFormOpen}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserCircle2 className="w-5 h-5 text-primary" />
                {isEditing ? "ম্যানেজার তথ্য সম্পাদনা" : "নতুন ম্যানেজার যোগ করুন"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {[
                { key: "name",      label: "পুরো নাম *",        placeholder: "Md. Rahim Uddin" },
                { key: "specialty", label: "বিশেষত্ব / পদবি",   placeholder: "রেস্টুরেন্ট কনসালট্যান্ট" },
                { key: "phone",     label: "ফোন নম্বর",          placeholder: "+880 17XX-XXXXXX" },
                { key: "whatsapp",  label: "WhatsApp নম্বর",     placeholder: "+880 17XX-XXXXXX" },
                { key: "email",     label: "ইমেইল (ঐচ্ছিক)",    placeholder: "manager@example.com" },
                { key: "photo_url", label: "ছবির URL (ঐচ্ছিক)", placeholder: "https://..." },
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
              <div className="flex gap-3 pt-2">
                <Button onClick={saveManager} disabled={saving} className="flex-1">
                  {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />সেভ হচ্ছে...</> : isEditing ? "আপডেট করুন" : "ম্যানেজার যোগ করুন"}
                </Button>
                <Button variant="outline" onClick={() => setFormOpen(false)}>বাতিল</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </FeatureGate>
    </DashboardLayout>
  );
}
