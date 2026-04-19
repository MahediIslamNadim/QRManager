import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  UserCircle2, Plus, Edit2, Trash2, Send, MessageSquare,
  Store, Check, RefreshCw, Users, Building2, ChevronDown, ChevronUp,
  KeyRound, LogIn, UserX,
} from "lucide-react";

interface Manager {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  photo_url: string | null;
  bio: string | null;
  specialty: string | null;
  is_active: boolean;
  created_at: string;
  user_id: string | null;
}

interface Restaurant {
  id: string;
  name: string;
  tier: string;
  dedicated_manager_id: string | null;
}

interface Message {
  id: string;
  restaurant_id: string;
  sender_type: "restaurant" | "manager";
  message: string;
  is_read: boolean;
  created_at: string;
}

const EMPTY_FORM = { name: "", email: "", phone: "", whatsapp: "", photo_url: "", bio: "", specialty: "রেস্টুরেন্ট ম্যানেজমেন্ট" };

const initials = (name: string) => name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
const fmtTime  = (iso: string) => new Date(iso).toLocaleString("bn-BD", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function SuperAdminManagers() {
  const [tab,       setTab]       = useState<"managers" | "assignments" | "messages">("managers");
  const [managers,  setManagers]  = useState<Manager[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [messages,  setMessages]  = useState<Message[]>([]);
  const [loading,   setLoading]   = useState(false);

  // Form state
  const [formOpen,   setFormOpen]   = useState(false);
  const [editId,     setEditId]     = useState<string | null>(null);
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [saving,     setSaving]     = useState(false);

  // Account creation dialog
  const [accountDialogMgr, setAccountDialogMgr] = useState<Manager | null>(null);
  const [accountEmail,     setAccountEmail]     = useState("");
  const [accountPassword,  setAccountPassword]  = useState("");
  const [accountSaving,    setAccountSaving]    = useState(false);

  // Messages tab
  const [selectedRest, setSelectedRest] = useState<string | null>(null);
  const [replyText,    setReplyText]    = useState("");
  const [replying,     setReplying]     = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: mgrs }, { data: rests }, { data: msgs }] = await Promise.all([
        supabase.from("dedicated_managers").select("*").order("created_at", { ascending: false }),
        supabase.from("restaurants").select("id, name, tier, dedicated_manager_id").order("name"),
        supabase.from("manager_messages").select("*").order("created_at", { ascending: true }),
      ]);
      setManagers((mgrs || []) as Manager[]);
      setRestaurants((rests || []) as Restaurant[]);
      setMessages((msgs || []) as Message[]);
    } catch { toast.error("ডেটা লোড করতে সমস্যা হয়েছে"); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, selectedRest]);

  // ── Manager CRUD ──────────────────────────────────────────────────────────
  const openCreate = () => { setEditId(null); setForm(EMPTY_FORM); setFormOpen(true); };

  const openEdit = (mgr: Manager) => {
    setEditId(mgr.id);
    setForm({ name: mgr.name, email: mgr.email || "", phone: mgr.phone || "",
      whatsapp: mgr.whatsapp || "", photo_url: mgr.photo_url || "",
      bio: mgr.bio || "", specialty: mgr.specialty || "রেস্টুরেন্ট ম্যানেজমেন্ট" });
    setFormOpen(true);
  };

  const saveManager = async () => {
    if (!form.name.trim()) { toast.error("নাম লিখুন"); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), email: form.email || null, phone: form.phone || null,
        whatsapp: form.whatsapp || null, photo_url: form.photo_url || null,
        bio: form.bio || null, specialty: form.specialty || null,
      };
      if (editId) {
        const { error } = await supabase.from("dedicated_managers").update(payload).eq("id", editId);
        if (error) throw error;
        toast.success("ম্যানেজার আপডেট হয়েছে");
      } else {
        const { error } = await supabase.from("dedicated_managers").insert(payload);
        if (error) throw error;
        toast.success("ম্যানেজার যোগ হয়েছে");
      }
      setFormOpen(false);
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const deleteManager = async (id: string) => {
    if (!confirm("এই ম্যানেজার মুছে ফেলবেন?")) return;
    await supabase.from("dedicated_managers").delete().eq("id", id);
    toast.success("ম্যানেজার মুছে ফেলা হয়েছে");
    load();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("dedicated_managers").update({ is_active: !current }).eq("id", id);
    load();
  };

  // ── Assignment ────────────────────────────────────────────────────────────
  const assignManager = async (restaurantId: string, managerId: string | null) => {
    await supabase.from("restaurants").update({ dedicated_manager_id: managerId }).eq("id", restaurantId);
    toast.success(managerId ? "ম্যানেজার অ্যাসাইন হয়েছে" : "অ্যাসাইনমেন্ট বাতিল হয়েছে");
    load();
  };

  // ── Reply as manager ──────────────────────────────────────────────────────
  const sendReply = async () => {
    if (!selectedRest || !replyText.trim()) return;
    setReplying(true);
    try {
      const { error } = await supabase.from("manager_messages").insert({
        restaurant_id: selectedRest,
        sender_type: "manager",
        message: replyText.trim(),
      });
      if (error) throw error;
      // mark restaurant messages as read
      await supabase.from("manager_messages").update({ is_read: true })
        .eq("restaurant_id", selectedRest).eq("sender_type", "restaurant").eq("is_read", false);
      setReplyText("");
      load();
    } catch (err: any) { toast.error(err.message); }
    finally { setReplying(false); }
  };

  const openAccountDialog = (mgr: Manager) => {
    setAccountDialogMgr(mgr);
    setAccountEmail(mgr.email || "");
    setAccountPassword("");
  };

  const callStaffFn = async (body: object) => {
    const { data, error } = await supabase.functions.invoke("create-staff", { body });
    if (error) {
      const msg = (error as any)?.context?.error || error.message;
      throw new Error(msg);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const createManagerAccount = async () => {
    if (!accountDialogMgr || !accountEmail.trim()) { toast.error("ইমেইল লিখুন"); return; }
    setAccountSaving(true);
    try {
      await callStaffFn({
        role: "dedicated_manager",
        manager_id: accountDialogMgr.id,
        email: accountEmail.trim(),
        password: accountPassword || undefined,
        full_name: accountDialogMgr.name,
      });
      toast.success("ম্যানেজার অ্যাকাউন্ট তৈরি হয়েছে! এখন লগইন করতে পারবেন।");
      setAccountDialogMgr(null);
      load();
    } catch (err: any) {
      toast.error(err.message || "অ্যাকাউন্ট তৈরি করতে সমস্যা হয়েছে");
    } finally { setAccountSaving(false); }
  };

  const removeManagerAccount = async (mgr: Manager) => {
    if (!confirm(`${mgr.name} এর লগইন অ্যাক্সেস সরিয়ে দেবেন?`)) return;
    try {
      await callStaffFn({ action: "remove", manager_id: mgr.id });
      toast.success("লগইন অ্যাক্সেস সরানো হয়েছে");
      load();
    } catch (err: any) { toast.error(err.message); }
  };

  const highSmartRests = restaurants.filter(r => r.tier === "high_smart");
  const restWithMsgs   = [...new Set(messages.map(m => m.restaurant_id))];
  const unreadCount    = messages.filter(m => m.sender_type === "restaurant" && !m.is_read).length;

  const selectedRestName = restaurants.find(r => r.id === selectedRest)?.name || "";
  const threadMessages   = messages.filter(m => m.restaurant_id === selectedRest);

  return (
    <DashboardLayout role="super_admin" title="ডেডিকেটেড ম্যানেজার">
      <div className="space-y-6 animate-fade-up max-w-5xl">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              ডেডিকেটেড ম্যানেজার ম্যানেজমেন্ট
            </h2>
            <p className="text-sm text-muted-foreground mt-1">High Smart রেস্টুরেন্টে ম্যানেজার অ্যাসাইন ও মেসেজ ম্যানেজ করুন</p>
          </div>
          <Button onClick={load} variant="outline" size="sm" className="gap-2" disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> রিফ্রেশ
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "মোট ম্যানেজার",      value: managers.length,          color: "border-border bg-secondary/30" },
            { label: "অ্যাসাইন হয়েছে",    value: highSmartRests.filter(r => r.dedicated_manager_id).length, color: "border-success/20 bg-success/5" },
            { label: "অপেক্ষমাণ মেসেজ",   value: unreadCount,              color: unreadCount > 0 ? "border-warning/20 bg-warning/5" : "border-border bg-secondary/30" },
          ].map((s, i) => (
            <div key={i} className={`rounded-2xl border px-4 py-3 text-center ${s.color}`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 p-1 bg-secondary/50 rounded-xl w-fit">
          {([
            { v: "managers",    l: "ম্যানেজারসমূহ",       icon: <UserCircle2 className="w-4 h-4" /> },
            { v: "assignments", l: "অ্যাসাইনমেন্ট",       icon: <Building2 className="w-4 h-4" /> },
            { v: "messages",    l: "মেসেজ",                icon: <MessageSquare className="w-4 h-4" />, badge: unreadCount },
          ] as const).map(t => (
            <button key={t.v} onClick={() => setTab(t.v)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.v ? "bg-card shadow text-foreground" : "text-muted-foreground hover:text-foreground"
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

        {/* ── MANAGERS TAB ───────────────────────────────────────────────── */}
        {tab === "managers" && (
          <div className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={openCreate} className="gap-2"><Plus className="w-4 h-4" /> নতুন ম্যানেজার</Button>
            </div>

            {managers.length === 0 ? (
              <div className="text-center py-16 border border-dashed rounded-2xl">
                <UserCircle2 className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">কোনো ম্যানেজার নেই। "নতুন ম্যানেজার" বাটন ক্লিক করে যোগ করুন।</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {managers.map(mgr => (
                  <Card key={mgr.id} className={`${!mgr.is_active ? "opacity-60" : ""}`}>
                    <CardContent className="p-5 flex gap-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 border border-primary/20">
                        {mgr.photo_url
                          ? <img src={mgr.photo_url} alt={mgr.name} className="w-full h-full rounded-xl object-cover" />
                          : <span className="text-lg font-bold text-primary">{initials(mgr.name)}</span>
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <p className="font-semibold">{mgr.name}</p>
                          <Badge className={`text-[10px] px-1.5 py-0 border ${mgr.is_active ? "bg-success/15 text-success border-success/30" : "bg-secondary text-muted-foreground border-border"}`}>
                            {mgr.is_active ? "সক্রিয়" : "নিষ্ক্রিয়"}
                          </Badge>
                        </div>
                        {mgr.specialty && <p className="text-xs text-primary">{mgr.specialty}</p>}
                        {mgr.phone && <p className="text-xs text-muted-foreground mt-0.5">{mgr.phone}</p>}
                        <p className="text-xs text-muted-foreground">
                          অ্যাসাইন: {restaurants.filter(r => r.dedicated_manager_id === mgr.id).length} রেস্টুরেন্ট
                        </p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <Button size="sm" variant="outline" onClick={() => openEdit(mgr)} className="h-7 text-xs gap-1">
                            <Edit2 className="w-3 h-3" /> সম্পাদনা
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => toggleActive(mgr.id, mgr.is_active)}
                            className={`h-7 text-xs gap-1 ${mgr.is_active ? "text-warning border-warning/40" : "text-success border-success/40"}`}>
                            {mgr.is_active ? "নিষ্ক্রিয়" : "সক্রিয়"}
                          </Button>
                          {mgr.user_id ? (
                            <Button size="sm" variant="ghost" onClick={() => removeManagerAccount(mgr)}
                              className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <UserX className="w-3 h-3" /> লগইন সরান
                            </Button>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => openAccountDialog(mgr)}
                              className="h-7 text-xs gap-1 text-primary border-primary/40 hover:bg-primary/10">
                              <KeyRound className="w-3 h-3" /> লগইন তৈরি করুন
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => deleteManager(mgr.id)} className="h-7 text-destructive hover:text-destructive hover:bg-destructive/10">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        {mgr.user_id && (
                          <p className="text-[10px] text-success flex items-center gap-1 mt-2">
                            <LogIn className="w-3 h-3" /> লগইন সক্রিয়
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── ASSIGNMENTS TAB ────────────────────────────────────────────── */}
        {tab === "assignments" && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                High Smart রেস্টুরেন্ট অ্যাসাইনমেন্ট
                <Badge variant="outline" className="ml-auto">{highSmartRests.length} রেস্টুরেন্ট</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {highSmartRests.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">কোনো High Smart রেস্টুরেন্ট নেই।</p>
              ) : (
                <div className="divide-y divide-border/40">
                  {highSmartRests.map(rest => {
                    const assignedMgr = managers.find(m => m.id === rest.dedicated_manager_id);
                    return (
                      <div key={rest.id} className="flex items-center gap-4 p-4 hover:bg-secondary/20 transition-colors">
                        <div className="w-9 h-9 rounded-xl bg-secondary flex items-center justify-center flex-shrink-0">
                          <Building2 className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{rest.name}</p>
                          {assignedMgr ? (
                            <p className="text-xs text-success flex items-center gap-1 mt-0.5">
                              <Check className="w-3 h-3" /> {assignedMgr.name}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-0.5">ম্যানেজার অ্যাসাইন নেই</p>
                          )}
                        </div>
                        <Select
                          value={rest.dedicated_manager_id || "none"}
                          onValueChange={v => assignManager(rest.id, v === "none" ? null : v)}
                        >
                          <SelectTrigger className="w-44 h-8 text-xs">
                            <SelectValue placeholder="ম্যানেজার বাছুন" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">— অ্যাসাইন নেই —</SelectItem>
                            {managers.filter(m => m.is_active).map(m => (
                              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── MESSAGES TAB ───────────────────────────────────────────────── */}
        {tab === "messages" && (
          <div className="grid gap-4 md:grid-cols-3">
            {/* Sidebar: restaurant list */}
            <Card className="md:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">কথোপকথন</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {restWithMsgs.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">কোনো বার্তা নেই।</p>
                ) : (
                  <div className="divide-y divide-border/30">
                    {restWithMsgs.map(rId => {
                      const rest      = restaurants.find(r => r.id === rId);
                      const lastMsg   = messages.filter(m => m.restaurant_id === rId).at(-1);
                      const unread    = messages.filter(m => m.restaurant_id === rId && m.sender_type === "restaurant" && !m.is_read).length;
                      return (
                        <button key={rId} onClick={() => setSelectedRest(rId === selectedRest ? null : rId)}
                          className={`w-full text-left p-3 flex items-start gap-3 hover:bg-secondary/30 transition-colors ${selectedRest === rId ? "bg-primary/5" : ""}`}>
                          <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                            <Store className="w-4 h-4 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-semibold truncate">{rest?.name || rId.slice(0, 8)}</p>
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
                          {selectedRest === rId ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Thread */}
            <Card className="md:col-span-2">
              {selectedRest ? (
                <>
                  <CardHeader className="pb-3 border-b border-border/50">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Store className="w-4 h-4 text-primary" /> {selectedRestName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[340px] overflow-y-auto p-4 space-y-3">
                      {threadMessages.map(msg => {
                        const isManager = msg.sender_type === "manager";
                        return (
                          <div key={msg.id} className={`flex ${isManager ? "justify-end" : "justify-start"}`}>
                            <div className="max-w-[75%]">
                              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                isManager
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-secondary text-foreground rounded-bl-sm"
                              }`}>
                                {msg.message}
                              </div>
                              <p className={`text-[10px] text-muted-foreground mt-1 px-1 ${isManager ? "text-right" : ""}`}>
                                {isManager ? "আপনি (ম্যানেজার)" : selectedRestName} · {fmtTime(msg.created_at)}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={bottomRef} />
                    </div>
                    <div className="p-4 border-t border-border/50 flex gap-2">
                      <Textarea
                        placeholder="ম্যানেজার হিসেবে উত্তর দিন..."
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                        rows={2}
                        className="resize-none flex-1"
                      />
                      <Button onClick={sendReply} disabled={replying || !replyText.trim()} size="icon" className="h-10 w-10 flex-shrink-0 self-end">
                        {replying ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </Button>
                    </div>
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex items-center justify-center h-full py-24 text-center">
                  <div>
                    <MessageSquare className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">বাম পাশ থেকে একটি কথোপকথন বেছে নিন</p>
                  </div>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </div>

      {/* Account creation dialog */}
      <Dialog open={!!accountDialogMgr} onOpenChange={open => !open && setAccountDialogMgr(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              লগইন অ্যাকাউন্ট তৈরি করুন
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <p className="text-sm text-muted-foreground">
              <strong>{accountDialogMgr?.name}</strong> এর জন্য একটি লগইন অ্যাকাউন্ট তৈরি হবে।
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
                যদি এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট থাকে তাহলে পাসওয়ার্ড লাগবে না।
              </p>
            </div>
            <div className="flex gap-3 pt-1">
              <Button onClick={createManagerAccount} disabled={accountSaving} className="flex-1 gap-2">
                {accountSaving ? <><RefreshCw className="w-4 h-4 animate-spin" />তৈরি হচ্ছে...</> : <><KeyRound className="w-4 h-4" />অ্যাকাউন্ট তৈরি করুন</>}
              </Button>
              <Button variant="outline" onClick={() => setAccountDialogMgr(null)}>বাতিল</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manager form dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "ম্যানেজার সম্পাদনা" : "নতুন ম্যানেজার"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {[
              { key: "name",      label: "পুরো নাম *",         placeholder: "Md. Rahim Uddin" },
              { key: "specialty", label: "বিশেষত্ব",            placeholder: "রেস্টুরেন্ট ম্যানেজমেন্ট" },
              { key: "email",     label: "ইমেইল",               placeholder: "rahim@nexcore.app" },
              { key: "phone",     label: "ফোন নম্বর",           placeholder: "+880 17XX-XXXXXX" },
              { key: "whatsapp",  label: "WhatsApp নম্বর",      placeholder: "+880 17XX-XXXXXX" },
              { key: "photo_url", label: "ছবির URL (ঐচ্ছিক)",   placeholder: "https://..." },
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
                {saving ? <><RefreshCw className="w-4 h-4 animate-spin mr-2" />সেভ হচ্ছে...</> : "সেভ করুন"}
              </Button>
              <Button variant="outline" onClick={() => setFormOpen(false)}>বাতিল</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
