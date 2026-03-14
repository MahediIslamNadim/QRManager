import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import {
  Eye, EyeOff, UtensilsCrossed, ArrowRight,
  QrCode, Zap, ShieldCheck, KeyRound, ArrowLeft
} from "lucide-react";

type Mode = "login" | "signup" | "forgot" | "forgot_sent";

const Login = () => {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("shadin@gmail.com");
  const [password, setPassword] = useState("shadin123");
  const [fullName, setFullName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && role) {
      if (role === "super_admin") navigate("/super-admin", { replace: true });
      else if (role === "waiter") navigate("/waiter", { replace: true });
      else navigate("/admin", { replace: true });
    }
  }, [user, role, loading, navigate]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { toast.error("ইমেইল দিন"); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setMode("forgot_sent");
    } catch (err: any) {
      toast.error(err.message || "সমস্যা হয়েছে, আবার চেষ্টা করুন");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) { toast.error("সব ফিল্ড পূরণ করুন"); return; }
    if (mode === "signup" && !restaurantName.trim()) { toast.error("রেস্টুরেন্টের নাম দিন"); return; }
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        if (data.user) {
          // Always basic plan with 7-day trial
          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 7);

          const { data: restaurant, error: restError } = await supabase
            .from("restaurants")
            .insert({
              name: restaurantName.trim(),
              address: restaurantAddress.trim() || null,
              phone: restaurantPhone.trim() || null,
              plan: "basic",
              owner_id: data.user.id,
              status: "active",
              trial_ends_at: trialEndsAt.toISOString(),
            })
            .select().single();

          if (restError) console.error("Restaurant creation error:", restError);
          await supabase.from("user_roles").insert({ user_id: data.user.id, role: "admin" });

          if (restaurant) {
            await supabase.from("menu_items").insert([
              { restaurant_id: restaurant.id, name: "চিকেন বিরিয়ানি", price: 350, category: "বিরিয়ানি", description: "সুগন্ধি বাসমতি চালে রান্না করা মুরগির বিরিয়ানি" },
              { restaurant_id: restaurant.id, name: "বটি কাবাব", price: 180, category: "কাবাব", description: "মশলাযুক্ত গরুর মাংসের কাবাব" },
              { restaurant_id: restaurant.id, name: "মটন বিরিয়ানি", price: 450, category: "বিরিয়ানি", description: "খাসির মাংস দিয়ে তৈরি বিরিয়ানি" },
              { restaurant_id: restaurant.id, name: "প্লেইন ভাত", price: 60, category: "ভাত", description: "সাদা ভাত" },
              { restaurant_id: restaurant.id, name: "মাংগো লাচ্ছি", price: 120, category: "পানীয়", description: "তাজা আমের লাচ্ছি" },
              { restaurant_id: restaurant.id, name: "ফিরনি", price: 100, category: "ডেজার্ট", description: "ঐতিহ্যবাহী দুধের ফিরনি" },
              { restaurant_id: restaurant.id, name: "শিক কাবাব", price: 220, category: "কাবাব", description: "কাঠকয়লায় ভাজা শিক কাবাব" },
              { restaurant_id: restaurant.id, name: "বোরহানি", price: 80, category: "পানীয়", description: "ঐতিহ্যবাহী মশলা পানীয়" },
            ]);
            await supabase.from("restaurant_tables").insert([
              { restaurant_id: restaurant.id, name: "T-1", seats: 4 },
              { restaurant_id: restaurant.id, name: "T-2", seats: 6 },
              { restaurant_id: restaurant.id, name: "T-3", seats: 2 },
              { restaurant_id: restaurant.id, name: "T-4", seats: 4 },
              { restaurant_id: restaurant.id, name: "T-5", seats: 8 },
              { restaurant_id: restaurant.id, name: "T-6", seats: 4 },
            ]);
          }

          toast.success("অ্যাকাউন্ট তৈরি হয়েছে! ৭ দিনের ফ্রি ট্রায়াল শুরু হয়েছে।");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        toast.success("স্বাগতম!");
      }
    } catch (err: any) {
      toast.error(err.message || "প্রমাণীকরণ ব্যর্থ");
    } finally {
      setSubmitting(false);
    }
  };

  const gold = "linear-gradient(135deg, #f5d780, #c9a84c, #e8c04a)";
  const goldText: React.CSSProperties = { background: gold, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" };

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 48,
    backgroundColor: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(201,168,76,0.2)",
    borderRadius: 12, padding: "0 16px",
    fontSize: 14, color: "#FFFFFF", outline: "none",
    transition: "border-color 0.2s, background-color 0.2s",
    fontFamily: "'DM Sans', sans-serif",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 600,
    color: "rgba(255,255,255,0.65)",
    marginBottom: 6, display: "block",
    fontFamily: "'DM Sans', sans-serif",
    letterSpacing: "0.04em", textTransform: "uppercase",
  };

  const features = [
    { icon: QrCode, title: "QR অর্ডারিং", desc: "কাস্টমার নিজেই স্ক্যান করে অর্ডার দেয়" },
    { icon: Zap, title: "রিয়েলটাইম", desc: "লাইভ অর্ডার ট্র্যাকিং ও নোটিফিকেশন" },
    { icon: ShieldCheck, title: "নিরাপদ", desc: "সম্পূর্ণ সুরক্ষিত ডেটা ম্যানেজমেন্ট" },
  ];

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", display: "flex", backgroundColor: "#0a0a0a" }}>

      {/* ── LEFT PANEL ── */}
      <div style={{
        display: "none", width: "52%", position: "relative", overflow: "hidden",
        flexDirection: "column", justifyContent: "space-between", padding: "48px",
        background: "linear-gradient(145deg, #0d0d0d 0%, #0f0c07 60%, #0a0a0a 100%)",
        borderRight: "1px solid rgba(201,168,76,0.1)",
      }} className="lg-flex">
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "-5%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 65%)" }} />
          <div style={{ position: "absolute", bottom: "-10%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 65%)" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>
        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: gold, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 24px rgba(201,168,76,0.35)" }}>
            <UtensilsCrossed size={22} color="#0a0a0a" />
          </div>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 20, color: "#FFFFFF" }}>QRManager</div>
            <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "rgba(201,168,76,0.6)", textTransform: "uppercase", fontFamily: "monospace" }}>by NexCore Technologies</div>
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 100, border: "1px solid rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.08)", fontSize: 11, fontWeight: 600, color: "#f5d780", letterSpacing: "0.08em", marginBottom: 28 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f5d780", boxShadow: "0 0 8px rgba(245,215,128,0.9)" }} />
            ৭ দিন ফ্রি ট্রায়াল — কার্ড লাগবে না
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 48, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.15, marginBottom: 16 }}>
            আপনার রেস্টুরেন্ট,<br /><span style={goldText}>ডিজিটাল যুগে</span>
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: 40, maxWidth: 380 }}>QR কোড দিয়ে স্মার্ট অর্ডার, রিয়েলটাইম ট্র্যাকিং, সিট ম্যানেজমেন্ট — সব এক জায়গায়।</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,168,76,0.1)", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,168,76,0.06)"; e.currentTarget.style.borderColor = "rgba(201,168,76,0.25)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(201,168,76,0.1)"; }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(201,168,76,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <f.icon size={18} color="#f5d780" />
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#FFFFFF", marginBottom: 2 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <p style={{ fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.03em" }}>
            © {new Date().getFullYear()} QRManager · একটি <span style={{ color: "rgba(201,168,76,0.45)" }}>NexCore Technologies Ltd.</span> পণ্য
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL (FORM) ── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", overflowY: "auto", background: "#0a0a0a" }}>
        <div style={{ width: "100%", maxWidth: 440 }}>

          {/* Mobile logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36, justifyContent: "center" }} className="lg-hide">
            <div style={{ width: 44, height: 44, borderRadius: 12, background: gold, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 20px rgba(201,168,76,0.3)" }}>
              <UtensilsCrossed size={20} color="#0a0a0a" />
            </div>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>QRManager</div>
              <div style={{ fontSize: 9, letterSpacing: "0.28em", color: "rgba(201,168,76,0.55)", textTransform: "uppercase", fontFamily: "monospace" }}>by NexCore Technologies</div>
            </div>
          </div>

          {/* FORGOT PASSWORD — Email sent screen */}
          {mode === "forgot_sent" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <KeyRound size={32} color="#f5d780" />
              </div>
              <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 700, color: "#FFFFFF", marginBottom: 12 }}>ইমেইল পাঠানো হয়েছে!</h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: 8 }}>
                <span style={{ color: "#f5d780", fontWeight: 600 }}>{email}</span> এই ইমেইলে পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 32 }}>Spam/Junk folder চেক করুন যদি না পান।</p>
              <button onClick={() => { setMode("login"); setEmail(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#f5d780", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, margin: "0 auto", fontFamily: "'DM Sans', sans-serif" }}>
                <ArrowLeft size={16} /> লগইন পেজে ফিরে যান
              </button>
            </div>

          ) : mode === "forgot" ? (
            <div>
              <button onClick={() => setMode("login")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.4)", fontSize: 13, display: "flex", alignItems: "center", gap: 6, marginBottom: 28, fontFamily: "'DM Sans', sans-serif", transition: "color 0.2s" }}
                onMouseEnter={e => e.currentTarget.style.color = "#f5d780"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}>
                <ArrowLeft size={15} /> লগইনে ফিরে যান
              </button>

              <div style={{ marginBottom: 32 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <KeyRound size={24} color="#f5d780" />
                </div>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 34, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>পাসওয়ার্ড ভুলে গেছেন?</h2>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>আপনার ইমেইল দিন — পাসওয়ার্ড রিসেট লিংক পাঠানো হবে।</p>
              </div>

              <form onSubmit={handleForgotPassword}>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <label style={labelStyle}>ইমেইল</label>
                    <input
                      type="email" placeholder="your@email.com"
                      value={email} onChange={e => setEmail(e.target.value)}
                      style={inputStyle} required
                      onFocus={e => { e.target.style.borderColor = "rgba(201,168,76,0.6)"; e.target.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(201,168,76,0.2)"; e.target.style.backgroundColor = "rgba(255,255,255,0.04)"; }}
                    />
                  </div>
                  <button type="submit" disabled={submitting}
                    style={{
                      width: "100%", height: 52, borderRadius: 12,
                      background: submitting ? "rgba(201,168,76,0.4)" : gold,
                      border: "none", cursor: submitting ? "not-allowed" : "pointer",
                      fontSize: 15, fontWeight: 700, color: "#0a0a0a",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.03em",
                      boxShadow: submitting ? "none" : "0 8px 32px rgba(201,168,76,0.3)",
                      transition: "all 0.25s",
                    }}
                    onMouseEnter={e => { if (!submitting) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(201,168,76,0.45)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(201,168,76,0.3)"; }}>
                    {submitting ? (
                      <><span style={{ width: 16, height: 16, border: "2px solid rgba(10,10,10,0.3)", borderTopColor: "#0a0a0a", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> অপেক্ষা করুন...</>
                    ) : (
                      <> রিসেট লিংক পাঠান <ArrowRight size={16} /></>
                    )}
                  </button>
                </div>
              </form>
            </div>

          ) : (
            <>
              <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 700, color: "#FFFFFF", marginBottom: 8, lineHeight: 1.2 }}>
                  {mode === "signup" ? "শুরু করুন" : "স্বাগতম 👋"}
                </h2>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)" }}>
                  {mode === "signup" ? "নতুন অ্যাকাউন্ট তৈরি করুন • ৭ দিন ফ্রি ট্রায়াল (Basic)" : "আপনার ড্যাশবোর্ডে লগইন করুন"}
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {mode === "signup" && (
                    <>
                      <div>
                        <label style={labelStyle}>আপনার নাম</label>
                        <input type="text" placeholder="আপনার পুরো নাম" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle}
                          onFocus={e => { e.target.style.borderColor = "rgba(201,168,76,0.6)"; e.target.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                          onBlur={e => { e.target.style.borderColor = "rgba(201,168,76,0.2)"; e.target.style.backgroundColor = "rgba(255,255,255,0.04)"; }} />
                      </div>
                      <div>
                        <label style={labelStyle}>রেস্টুরেন্টের নাম <span style={{ color: "#f87171" }}>*</span></label>
                        <input type="text" placeholder="আপনার রেস্টুরেন্টের নাম" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} style={inputStyle} required
                          onFocus={e => { e.target.style.borderColor = "rgba(201,168,76,0.6)"; e.target.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                          onBlur={e => { e.target.style.borderColor = "rgba(201,168,76,0.2)"; e.target.style.backgroundColor = "rgba(255,255,255,0.04)"; }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                        <div>
                          <label style={labelStyle}>ঠিকানা</label>
                          <input type="text" placeholder="ঠিকানা" value={restaurantAddress} onChange={e => setRestaurantAddress(e.target.value)} style={inputStyle}
                            onFocus={e => { e.target.style.borderColor = "rgba(201,168,76,0.6)"; e.target.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                            onBlur={e => { e.target.style.borderColor = "rgba(201,168,76,0.2)"; e.target.style.backgroundColor = "rgba(255,255,255,0.04)"; }} />
                        </div>
                        <div>
                          <label style={labelStyle}>ফোন</label>
                          <input type="text" placeholder="+880..." value={restaurantPhone} onChange={e => setRestaurantPhone(e.target.value)} style={inputStyle}
                            onFocus={e => { e.target.style.borderColor = "rgba(201,168,76,0.6)"; e.target.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                            onBlur={e => { e.target.style.borderColor = "rgba(201,168,76,0.2)"; e.target.style.backgroundColor = "rgba(255,255,255,0.04)"; }} />
                        </div>
                      </div>
                      {/* Auto-assigned plan info */}
                      <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(201,168,76,0.08)", border: "1px solid rgba(201,168,76,0.2)" }}>
                        <p style={{ fontSize: 13, color: "#f5d780", fontWeight: 600, marginBottom: 4 }}>✦ Basic প্ল্যান — ৭ দিন ফ্রি ট্রায়াল</p>
                        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.45)" }}>কোনো ক্রেডিট কার্ড লাগবে না। ট্রায়াল শেষে প্ল্যান কিনতে পারবেন।</p>
                      </div>
                    </>
                  )}

                  {/* Email */}
                  <div>
                    <label style={labelStyle}>ইমেইল</label>
                    <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required
                      onFocus={e => { e.target.style.borderColor = "rgba(201,168,76,0.6)"; e.target.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                      onBlur={e => { e.target.style.borderColor = "rgba(201,168,76,0.2)"; e.target.style.backgroundColor = "rgba(255,255,255,0.04)"; }} />
                  </div>

                  {/* Password */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>পাসওয়ার্ড</label>
                      {mode === "login" && (
                        <button type="button" onClick={() => setMode("forgot")}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "rgba(201,168,76,0.7)", fontFamily: "'DM Sans', sans-serif", transition: "color 0.2s", padding: 0 }}
                          onMouseEnter={e => e.currentTarget.style.color = "#f5d780"}
                          onMouseLeave={e => e.currentTarget.style.color = "rgba(201,168,76,0.7)"}>
                          পাসওয়ার্ড ভুলে গেছেন?
                        </button>
                      )}
                    </div>
                    <div style={{ position: "relative" }}>
                      <input type={showPassword ? "text" : "password"} placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, paddingRight: 48 }} required
                        onFocus={e => { e.target.style.borderColor = "rgba(201,168,76,0.6)"; e.target.style.backgroundColor = "rgba(255,255,255,0.06)"; }}
                        onBlur={e => { e.target.style.borderColor = "rgba(201,168,76,0.2)"; e.target.style.backgroundColor = "rgba(255,255,255,0.04)"; }} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", padding: 0, transition: "color 0.2s" }}
                        onMouseEnter={e => e.currentTarget.style.color = "rgba(245,215,128,0.8)"}
                        onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}>
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  {/* Submit */}
                  <button type="submit" disabled={submitting}
                    style={{ width: "100%", height: 52, borderRadius: 12, background: submitting ? "rgba(201,168,76,0.4)" : gold, border: "none", cursor: submitting ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700, color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.03em", boxShadow: submitting ? "none" : "0 8px 32px rgba(201,168,76,0.3)", transition: "all 0.25s", marginTop: 4 }}
                    onMouseEnter={e => { if (!submitting) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 12px 40px rgba(201,168,76,0.45)"; } }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(201,168,76,0.3)"; }}>
                    {submitting ? (
                      <><span style={{ width: 16, height: 16, border: "2px solid rgba(10,10,10,0.3)", borderTopColor: "#0a0a0a", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} /> অপেক্ষা করুন...</>
                    ) : (
                      <>{mode === "signup" ? "সাইন আপ করুন" : "লগইন করুন"} <ArrowRight size={16} /></>
                    )}
                  </button>
                </div>
              </form>

              <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "24px 0" }}>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
                <span style={{ fontSize: 12, color: "rgba(255,255,255,0.25)" }}>অথবা</span>
                <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.08)" }} />
              </div>

              <p style={{ textAlign: "center", fontSize: 14, color: "rgba(255,255,255,0.45)" }}>
                {mode === "signup" ? "ইতিমধ্যে অ্যাকাউন্ট আছে? " : "অ্যাকাউন্ট নেই? "}
                <button onClick={() => setMode(mode === "signup" ? "login" : "signup")}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, fontWeight: 700, color: "#f5d780", fontFamily: "'DM Sans', sans-serif", transition: "color 0.2s", padding: 0 }}
                  onMouseEnter={e => e.currentTarget.style.color = "#c9a84c"}
                  onMouseLeave={e => e.currentTarget.style.color = "#f5d780"}>
                  {mode === "signup" ? "লগইন করুন" : "সাইন আপ করুন"}
                </button>
              </p>
            </>
          )}

          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: 32, letterSpacing: "0.03em" }}>
            © {new Date().getFullYear()} QRManager · <span style={{ color: "rgba(201,168,76,0.4)" }}>NexCore Technologies Ltd.</span>
          </p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px #111 inset !important; -webkit-text-fill-color: #fff !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .lg-flex { display: none !important; }
        .lg-hide { display: flex !important; }
        @media (min-width: 1024px) {
          .lg-flex { display: flex !important; }
          .lg-hide { display: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Login;
