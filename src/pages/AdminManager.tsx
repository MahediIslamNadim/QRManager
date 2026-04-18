import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import FeatureGate from "@/components/FeatureGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  UserCircle2, Phone, Mail, MessageSquare, Send,
  Clock, CheckCheck, Check, RefreshCw, Star, Headphones,
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
}

interface Message {
  id: string;
  sender_type: "restaurant" | "manager";
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function AdminManager() {
  const { restaurantId } = useAuth();

  const [manager,    setManager]    = useState<Manager | null>(null);
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading,    setLoading]    = useState(true);
  const [sending,    setSending]    = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      // fetch restaurant with manager
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

      // fetch messages
      const { data: msgs } = await supabase
        .from("manager_messages")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("created_at", { ascending: true });
      setMessages((msgs || []) as Message[]);

      // mark manager messages as read
      await supabase
        .from("manager_messages")
        .update({ is_read: true })
        .eq("restaurant_id", restaurantId)
        .eq("sender_type", "manager")
        .eq("is_read", false);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`manager_msgs_${restaurantId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "manager_messages",
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
    } catch (err: any) {
      toast.error("বার্তা পাঠাতে সমস্যা হয়েছে");
    } finally {
      setSending(false);
    }
  };

  const initials = (name: string) =>
    name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleString("bn-BD", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <DashboardLayout role="admin" title="ডেডিকেটেড ম্যানেজার">
      <FeatureGate feature="dedicated_manager">
        <div className="space-y-6 animate-fade-up max-w-3xl">

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center">
                <UserCircle2 className="w-5 h-5 text-primary" />
              </div>
              ডেডিকেটেড ম্যানেজার
            </h2>
            <p className="text-sm text-muted-foreground mt-1">High Smart — আপনার ব্যক্তিগত রেস্টুরেন্ট ম্যানেজার</p>
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
                <CardContent className="p-0">
                  <div className="h-2 bg-gradient-to-r from-primary to-primary/50" />
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

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <h3 className="text-xl font-bold">{manager.name}</h3>
                          {manager.specialty && (
                            <p className="text-sm text-primary font-medium mt-0.5">{manager.specialty}</p>
                          )}
                        </div>
                        <Badge className="bg-success/15 text-success border-success/30 border flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-success inline-block" />
                          অনলাইন
                        </Badge>
                      </div>

                      {manager.bio && (
                        <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{manager.bio}</p>
                      )}

                      <div className="flex items-center gap-1 mt-3 text-xs text-muted-foreground">
                        <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                        <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                        <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                        <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                        <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                        <span className="ml-1">ডেডিকেটেড ম্যানেজার</span>
                      </div>

                      {/* Contact buttons */}
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

              {/* Message thread */}
              <Card>
                <CardHeader className="pb-3 flex-row items-center justify-between border-b border-border/50">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    {manager.name} এর সাথে চ্যাট
                  </CardTitle>
                  <Button size="sm" variant="ghost" onClick={load} className="h-8 gap-1 text-xs text-muted-foreground">
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </CardHeader>

                {/* Messages */}
                <CardContent className="p-0">
                  <div className="h-[360px] overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-center gap-3">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                          <MessageSquare className="w-7 h-7 text-primary/40" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">কথোপকথন শুরু করুন</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {manager.name} আপনার রেস্টুরেন্টের জন্য সর্বদা প্রস্তুত।
                          </p>
                        </div>
                      </div>
                    ) : (
                      messages.map(msg => {
                        const isOwn = msg.sender_type === "restaurant";
                        return (
                          <div key={msg.id} className={`flex ${isOwn ? "justify-end" : "justify-start"} gap-2`}>
                            {!isOwn && (
                              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-xs font-bold text-primary">{initials(manager.name)}</span>
                              </div>
                            )}
                            <div className={`max-w-[75%] ${isOwn ? "items-end" : "items-start"} flex flex-col gap-1`}>
                              <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                                isOwn
                                  ? "bg-primary text-primary-foreground rounded-br-sm"
                                  : "bg-secondary text-foreground rounded-bl-sm"
                              }`}>
                                {msg.message}
                              </div>
                              <div className={`flex items-center gap-1 text-xs text-muted-foreground px-1 ${isOwn ? "flex-row-reverse" : ""}`}>
                                <span>{formatTime(msg.created_at)}</span>
                                {isOwn && (
                                  msg.is_read
                                    ? <CheckCheck className="w-3.5 h-3.5 text-primary" />
                                    : <Check className="w-3.5 h-3.5" />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                    <div ref={bottomRef} />
                  </div>

                  {/* Input */}
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

              {/* SLA note */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-secondary/40 border border-border/50 text-sm">
                <Clock className="w-4 h-4 text-primary flex-shrink-0" />
                <p className="text-muted-foreground">
                  <span className="text-foreground font-medium">{manager.name}</span> সাধারণত <strong>২ ঘণ্টার মধ্যে</strong> উত্তর দেন। জরুরি বিষয়ে সরাসরি WhatsApp বা ফোনে যোগাযোগ করুন।
                </p>
              </div>
            </>
          ) : (
            /* No manager assigned */
            <Card className="border-dashed border-primary/30">
              <CardContent className="py-16 text-center space-y-5">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
                  <Headphones className="w-10 h-10 text-primary/40" />
                </div>
                <div>
                  <p className="font-bold text-lg">ম্যানেজার অ্যাসাইন হচ্ছে</p>
                  <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
                    আপনার অ্যাকাউন্টের জন্য একজন ডেডিকেটেড ম্যানেজার শীঘ্রই অ্যাসাইন করা হবে।
                    সাপোর্ট টিম ২৪ ঘণ্টার মধ্যে আপনাকে জানাবে।
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center text-xs text-muted-foreground">
                  {["👤 ব্যক্তিগত ম্যানেজার", "💬 সরাসরি চ্যাট", "📞 ফোন সাপোর্ট", "⚡ দ্রুত রেসপন্স"].map(t => (
                    <span key={t} className="bg-secondary px-3 py-1 rounded-full">{t}</span>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  এখনই সাপোর্টে জানাতে{" "}
                  <a href="/admin/support" className="text-primary underline underline-offset-2">প্রায়োরিটি সাপোর্ট</a>
                  {" "}পেজে যান
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </FeatureGate>
    </DashboardLayout>
  );
}
