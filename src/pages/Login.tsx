import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createAuthedSupabaseClient, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { authDebug, clearPendingLoginRedirect, setPendingLoginRedirect } from "@/lib/authDebug";
import { toast } from "sonner";
import {
  Eye, EyeOff, ArrowRight,
  QrCode, Zap, ShieldCheck, KeyRound, ArrowLeft, UtensilsCrossed
} from "lucide-react";
import { APP_NAME, COMPANY_NAME, FREE_TRIAL_DAYS } from "@/constants/app";

type Mode = "login" | "signup" | "forgot" | "forgot_sent";
type RedirectRole = "super_admin" | "group_owner" | "admin" | "waiter" | "kitchen";

const waitForSession = async (maxAttempts = 5): Promise<boolean> => {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return true;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return false;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const pickRedirectRole = (
  roleRows: Array<{ role: string }> | null | undefined,
): RedirectRole | null => {
  const roles = new Set((roleRows || []).map((row) => row.role));
  if (roles.has("super_admin")) return "super_admin";
  if (roles.has("group_owner")) return "group_owner";
  if (roles.has("admin")) return "admin";
  if (roles.has("waiter")) return "waiter";
  if (roles.has("kitchen")) return "kitchen";
  return null;
};

// ✅ group_owner → /enterprise/dashboard
const getRedirectPath = (resolvedRole: RedirectRole, inviteId: string | null, restaurantPlan?: string) => {
  if (resolvedRole === "super_admin") return "/super-admin";
  if (resolvedRole === "group_owner" || (resolvedRole === "admin" && restaurantPlan === "high_smart_enterprise")) return "/enterprise/dashboard";
  if (resolvedRole === "waiter") return "/waiter";
  if (resolvedRole === "kitchen") return "/admin/kitchen";
  if (inviteId) return `/admin-setup?invite=${inviteId}`;
  return "/admin";
};

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteId = searchParams.get("invite");
  const { user, role, loading, restaurantId, restaurantPlan, refetchUserData } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantAddress, setRestaurantAddress] = useState("");
  const [restaurantPhone, setRestaurantPhone] = useState("");
  const [selectedPlan, setSelectedPlan] = useState<"medium_smart" | "high_smart">("medium_smart");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resolveRoleForRedirect = async (
    userId: string,
    accessToken: string,
    maxAttempts = 6,
  ): Promise<RedirectRole | null> => {
    const authedClient = createAuthedSupabaseClient(accessToken);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data: roleRows, error: roleError } = await authedClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .order("role");

      const resolvedRole = pickRedirectRole(roleRows as Array<{ role: string }> | null | undefined);
      authDebug("Login", "Direct role lookup attempt finished", {
        attempt: attempt + 1,
        error: roleError?.message ?? null,
        resolvedRole,
        roles: roleRows?.map((row) => row.role) ?? [],
        rowCount: roleRows?.length ?? 0,
        userId,
      });

      if (roleError) console.warn("Login role lookup failed:", roleError.message);
      if (resolvedRole) {
        await refetchUserData(userId, accessToken);
        return resolvedRole;
      }
      await wait(250);
    }

    // Fallback 1: staff_restaurants
    const { data: staffRow } = await authedClient
      .from("staff_restaurants" as any)
      .select("role, restaurant_id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    const staffRole = (staffRow as any)?.role as string | undefined;
    if (staffRole) {
      const fallbackRole = pickRedirectRole([{ role: staffRole }]);
      if (fallbackRole) {
        await (authedClient.from("user_roles") as any).upsert(
          { user_id: userId, role: staffRole, restaurant_id: (staffRow as any)?.restaurant_id ?? null },
          { onConflict: "user_id,role" }
        );
        await refetchUserData(userId, accessToken);
        return fallbackRole;
      }
    }

    // Fallback 2: restaurant owner
    const { data: ownedRestaurant } = await authedClient
      .from("restaurants")
      .select("id")
      .eq("owner_id", userId)
      .limit(1)
      .maybeSingle();

    if (ownedRestaurant?.id) {
      await (authedClient.from("user_roles") as any).upsert(
        { user_id: userId, role: "admin", restaurant_id: ownedRestaurant.id },
        { onConflict: "user_id,role" }
      );
      await refetchUserData(userId, accessToken);
      return "admin";
    }

    return null;
  };

  useEffect(() => {
    authDebug("Login", "Auth context snapshot changed", {
      inviteId, loading, resolvedRole: role, restaurantId, userId: user?.id ?? null,
    });
  }, [inviteId, loading, restaurantId, role, user?.id]);

  useEffect(() => {
    if (loading || !user || !role) return;
    const target = getRedirectPath(role as RedirectRole, inviteId, restaurantPlan);
    authDebug("Login", "Context-based redirect branch chosen", {
      inviteId, resolvedRole: role, restaurantPlan, restaurantId, target, userId: user.id,
    });
    setPendingLoginRedirect({ inviteId, role, target, userId: user.id });
    navigate(target, { replace: true });
  }, [user, role, loading, navigate, inviteId, restaurantId, restaurantPlan]);

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
    clearPendingLoginRedirect();
    if (!email.trim() || !password.trim()) { toast.error("সব ফিল্ড পূরণ করুন"); return; }
    if (mode === "signup" && !restaurantName.trim()) { toast.error("রেস্টুরেন্টের নাম দিন"); return; }
    if (mode === "signup" && password.length < 6) { toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর হতে হবে"); return; }
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(), password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName.trim() } },
        });
        if (error) throw error;
        if (data.session) {
          await supabase.auth.setSession({
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          });
          const sessionReady = await waitForSession();
          if (!sessionReady) throw new Error("Session setup failed. Please try logging in.");
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          if (!currentSession) throw new Error("Authentication session not found. Please try again.");

          const { data: setupData, error: setupError } = await supabase.rpc(
            "complete_admin_signup" as any,
            {
              p_restaurant_name: restaurantName.trim(),
              p_address: restaurantAddress.trim() || null,
              p_phone: restaurantPhone.trim() || null,
              p_trial_days: FREE_TRIAL_DAYS,
              p_plan: selectedPlan,
            } as any,
          );
          if (setupError) throw new Error("সেটআপ ব্যর্থ: " + setupError.message);

          const restaurantId = (setupData as any)?.restaurant_id;
          if (restaurantId) {
            await supabase.from("menu_items").insert([
              { restaurant_id: restaurantId, name: "চিকেন বিরিয়ানি", price: 350, category: "বিরিয়ানি", description: "সুগন্ধি বাসমতি চালে রান্না করা মুরগির বিরিয়ানি" },
              { restaurant_id: restaurantId, name: "বটি কাবাব", price: 180, category: "কাবাব", description: "মশলাযুক্ত গরুর মাংসের কাবাব" },
              { restaurant_id: restaurantId, name: "মটন বিরিয়ানি", price: 450, category: "বিরিয়ানি", description: "খাসির মাংস দিয়ে তৈরি বিরিয়ানি" },
              { restaurant_id: restaurantId, name: "প্লেইন ভাত", price: 60, category: "ভাত", description: "সাদা ভাত" },
              { restaurant_id: restaurantId, name: "মাংগো লাচ্ছি", price: 120, category: "পানীয়", description: "তাজা আমের লাচ্ছি" },
              { restaurant_id: restaurantId, name: "ফিরনি", price: 100, category: "ডেজার্ট", description: "ঐতিহ্যবাহী দুধের ফিরনি" },
              { restaurant_id: restaurantId, name: "শিক কাবাব", price: 220, category: "কাবাব", description: "কাঠকয়লায় ভাজা শিক কাবাব" },
              { restaurant_id: restaurantId, name: "বোরহানি", price: 80, category: "পানীয়", description: "ঐতিহ্যবাহী মশলা পানীয়" },
            ]);
            await supabase.from("restaurant_tables").insert([
              { restaurant_id: restaurantId, name: "T-1", seats: 4 },
              { restaurant_id: restaurantId, name: "T-2", seats: 6 },
              { restaurant_id: restaurantId, name: "T-3", seats: 2 },
              { restaurant_id: restaurantId, name: "T-4", seats: 4 },
              { restaurant_id: restaurantId, name: "T-5", seats: 8 },
              { restaurant_id: restaurantId, name: "T-6", seats: 4 },
            ]);
          }
          const planLabel = selectedPlan === "high_smart" ? "High Smart" : "Medium Smart";
          toast.success(`অ্যাকাউন্ট তৈরি হয়েছে! ${FREE_TRIAL_DAYS} দিনের ফ্রি ট্রায়াল (${planLabel}) শুরু হয়েছে।`);
          if (data.user) await refetchUserData(data.user.id, data.session.access_token);
        } else {
          toast.success("ইমেইল নিশ্চিত করুন! আপনার ইমেইলে একটি লিংক পাঠানো হয়েছে।");
          setMode("login");
        }
      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email: email.trim(), password,
        });
        if (error) throw error;

        const sessionReady = await waitForSession();
        if (!sessionReady) throw new Error("Login succeeded, but the session is still loading. Please try again.");

        const { data: { session } } = await supabase.auth.getSession();
        const currentUser = session?.user || signInData.user;
        if (!currentUser) throw new Error("Login succeeded, but we couldn't load your account session.");

        const accessToken = session?.access_token || signInData.session?.access_token;
        if (!accessToken) throw new Error("Login succeeded, but the access token is not ready yet.");

        const resolvedRole = await resolveRoleForRedirect(currentUser.id, accessToken);
        if (!resolvedRole) {
          toast.error("অ্যাকাউন্টে কোনো ভূমিকা পাওয়া যায়নি। অ্যাডমিনকে জানান।");
          return;
        }

        toast.success("স্বাগতম!");
        const target = getRedirectPath(resolvedRole, inviteId);
        setPendingLoginRedirect({ inviteId, role: resolvedRole, target, userId: currentUser.id });
        navigate(target, { replace: true });
        return;
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      toast.error(err.message || "প্রমাণীকরণ ব্যর্থ");
    } finally {
      setSubmitting(false);
    }
  };

  const gold = "linear-gradient(135deg, #f5d780, #c9a84c, #e8c04a)";
  const goldText: React.CSSProperties = { background: gold, WebkitBackgroundClip: "text", backgroundClip: "text", WebkitTextFillColor: "transparent" };

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 48,
    backgroundColor: "hsl(0 0% 7%)",
    border: "1px solid hsl(0 0% 14%)",
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

  const Logo = ({ size = "md" }: { size?: "sm" | "md" }) => (
    <div style={{ display: "flex", alignItems: "center", gap: size === "sm" ? 10 : 14 }}>
      <div style={{
        width: size === "sm" ? 36 : 44, height: size === "sm" ? 36 : 44,
        borderRadius: size === "sm" ? 10 : 12,
        background: gold, display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 24px rgba(201,168,76,0.35)", flexShrink: 0,
      }}>
        <UtensilsCrossed size={size === "sm" ? 18 : 22} color="#0a0a0a" strokeWidth={2.2} />
      </div>
      <div>
        <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, fontSize: size === "sm" ? 17 : 20, color: "#FFFFFF" }}>{APP_NAME}</div>
        <div style={{ fontSize: 9, letterSpacing: "0.3em", color: "rgba(201,168,76,0.6)", textTransform: "uppercase", fontFamily: "monospace" }}>by {COMPANY_NAME.replace(" Ltd.", "")}</div>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", minHeight: "100vh", display: "flex", backgroundColor: "hsl(0 0% 4%)" }}>

      {/* LEFT PANEL */}
      <div style={{
        width: "52%", position: "relative", overflow: "hidden",
        flexDirection: "column", justifyContent: "space-between", padding: "48px",
        background: "linear-gradient(145deg, hsl(0 0% 5%) 0%, hsl(0 0% 6%) 60%, hsl(0 0% 4%) 100%)",
        borderRight: "1px solid hsl(0 0% 14%)",
      }} className="hidden lg:flex">
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          <div style={{ position: "absolute", top: "-5%", right: "-10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 65%)" }} />
          <div style={{ position: "absolute", bottom: "-10%", left: "-5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 65%)" }} />
          <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(201,168,76,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,168,76,0.04) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
        </div>
        <div style={{ position: "relative", zIndex: 1 }}><Logo /></div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 100, border: "1px solid rgba(201,168,76,0.3)", background: "rgba(201,168,76,0.08)", fontSize: 11, fontWeight: 600, color: "#f5d780", letterSpacing: "0.08em", marginBottom: 28 }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f5d780", boxShadow: "0 0 8px rgba(245,215,128,0.9)" }} />
            {FREE_TRIAL_DAYS} দিন ফ্রি ট্রায়াল — কার্ড লাগবে না
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 48, fontWeight: 700, color: "#FFFFFF", lineHeight: 1.15, marginBottom: 16 }}>
            আপনার রেস্টুরেন্ট,<br /><span style={goldText}>ডিজিটাল যুগে</span>
          </h2>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: 40, maxWidth: 380 }}>QR কোড দিয়ে স্মার্ট অর্ডার, রিয়েলটাইম ট্র্যাকিং, সিট ম্যানেজমেন্ট — সব এক জায়গায়।</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {features.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 20px", borderRadius: 16, background: "hsl(0 0% 7%)", border: "1px solid hsl(0 0% 14%)", transition: "all 0.2s" }}
                onMouseEnter={e => { e.currentTarget.style.background = "hsl(38 92% 50% / 0.06)"; e.currentTarget.style.borderColor = "hsl(38 92% 50% / 0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "hsl(0 0% 7%)"; e.currentTarget.style.borderColor = "hsl(0 0% 14%)"; }}>
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
        <p style={{ position: "relative", zIndex: 1, fontSize: 11, color: "rgba(255,255,255,0.2)" }}>
          © {new Date().getFullYear()} {APP_NAME} · একটি <span style={{ color: "rgba(201,168,76,0.45)" }}>{COMPANY_NAME}</span> পণ্য
        </p>
      </div>

      {/* RIGHT PANEL */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px", overflowY: "auto", background: "hsl(0 0% 4%)" }}>
        <div style={{ width: "100%", maxWidth: 440 }}>

          <div style={{ justifyContent: "center", marginBottom: 36 }} className="flex lg:hidden">
            <Logo size="sm" />
          </div>

          {/* FORGOT SENT */}
          {mode === "forgot_sent" ? (
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 72, height: 72, borderRadius: 20, background: "rgba(201,168,76,0.12)", border: "1px solid rgba(201,168,76,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
                <KeyRound size={32} color="#f5d780" />
              </div>
              <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 700, color: "#FFFFFF", marginBottom: 12 }}>ইমেইল পাঠানো হয়েছে!</h2>
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.8, marginBottom: 8 }}>
                <span style={{ color: "#f5d780", fontWeight: 600 }}>{email}</span> এ পাসওয়ার্ড রিসেট লিংক পাঠানো হয়েছে।
              </p>
              <p style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", marginBottom: 32 }}>Spam/Junk folder চেক করুন যদি না পান।</p>
              <button onClick={() => { setMode("login"); setEmail(""); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#f5d780", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, margin: "0 auto", fontFamily: "'DM Sans', sans-serif" }}>
                <ArrowLeft size={16} /> লগইন পেজে ফিরে যান
              </button>
            </div>

          /* FORGOT FORM */
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
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 34, fontWeight: 700, color: "#FFFFFF", marginBottom: 8 }}>পাসওয়ার্ড ভুলে গেছেন?</h2>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", lineHeight: 1.7 }}>আপনার ইমেইল দিন — পাসওয়ার্ড রিসেট লিংক পাঠানো হবে।</p>
              </div>
              <form onSubmit={handleForgotPassword}>
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <label style={labelStyle}>ইমেইল</label>
                    <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required autoComplete="email"
                      onFocus={e => { e.target.style.borderColor = "hsl(38 92% 50% / 0.6)"; e.target.style.backgroundColor = "hsl(0 0% 9%)"; }}
                      onBlur={e => { e.target.style.borderColor = "hsl(0 0% 14%)"; e.target.style.backgroundColor = "hsl(0 0% 7%)"; }} />
                  </div>
                  <button type="submit" disabled={submitting}
                    style={{ width: "100%", height: 52, borderRadius: 12, background: submitting ? "rgba(201,168,76,0.4)" : gold, border: "none", cursor: submitting ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700, color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 8px 32px rgba(201,168,76,0.3)", transition: "all 0.25s" }}>
                    {submitting ? "অপেক্ষা করুন..." : <>রিসেট লিংক পাঠান <ArrowRight size={16} /></>}
                  </button>
                </div>
              </form>
            </div>

          /* LOGIN / SIGNUP */
          ) : (
            <>
              <div style={{ marginBottom: 28 }}>
                <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 700, color: "#FFFFFF", marginBottom: 8, lineHeight: 1.2 }}>
                  {mode === "signup" ? "শুরু করুন ✨" : "স্বাগতম 👋"}
                </h2>
                <p style={{ fontSize: 14, color: "rgba(255,255,255,0.45)", marginBottom: 20 }}>
                  {mode === "signup" ? `Medium Smart বা High Smart — ${FREE_TRIAL_DAYS} দিন ফ্রি ট্রায়াল` : `${APP_NAME} ড্যাশবোর্ডে লগইন করুন`}
                </p>
                <div style={{ display: "flex", background: "hsl(0 0% 7%)", borderRadius: 12, padding: 4, border: "1px solid hsl(0 0% 14%)" }}>
                  <button type="button" onClick={() => { setMode("login"); setPassword(""); setFullName(""); setRestaurantName(""); setRestaurantAddress(""); setRestaurantPhone(""); }}
                    style={{ flex: 1, height: 38, borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, transition: "all 0.2s",
                      background: mode === "login" ? gold : "transparent",
                      color: mode === "login" ? "#0a0a0a" : "rgba(255,255,255,0.45)",
                      boxShadow: mode === "login" ? "0 2px 12px rgba(201,168,76,0.35)" : "none",
                    }}>লগইন</button>
                  <button type="button" onClick={() => { setMode("signup"); setPassword(""); setFullName(""); setRestaurantName(""); setRestaurantAddress(""); setRestaurantPhone(""); }}
                    style={{ flex: 1, height: 38, borderRadius: 9, border: "none", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, transition: "all 0.2s",
                      background: mode === "signup" ? gold : "transparent",
                      color: mode === "signup" ? "#0a0a0a" : "rgba(255,255,255,0.45)",
                      boxShadow: mode === "signup" ? "0 2px 12px rgba(201,168,76,0.35)" : "none",
                    }}>সাইন আপ</button>
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                  {mode === "signup" && (
                    <>
                      <div>
                        <label style={labelStyle}>আপনার নাম</label>
                        <input type="text" placeholder="আপনার পুরো নাম" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} autoComplete="name"
                          onFocus={e => { e.target.style.borderColor = "hsl(38 92% 50% / 0.6)"; e.target.style.backgroundColor = "hsl(0 0% 9%)"; }}
                          onBlur={e => { e.target.style.borderColor = "hsl(0 0% 14%)"; e.target.style.backgroundColor = "hsl(0 0% 7%)"; }} />
                      </div>
                      <div>
                        <label style={labelStyle}>রেস্টুরেন্টের নাম <span style={{ color: "#f87171" }}>*</span></label>
                        <input type="text" placeholder="আপনার রেস্টুরেন্টের নাম" value={restaurantName} onChange={e => setRestaurantName(e.target.value)} style={inputStyle} required
                          onFocus={e => { e.target.style.borderColor = "hsl(38 92% 50% / 0.6)"; e.target.style.backgroundColor = "hsl(0 0% 9%)"; }}
                          onBlur={e => { e.target.style.borderColor = "hsl(0 0% 14%)"; e.target.style.backgroundColor = "hsl(0 0% 7%)"; }} />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
                        <div>
                          <label style={labelStyle}>ঠিকানা</label>
                          <input type="text" placeholder="ঠিকানা" value={restaurantAddress} onChange={e => setRestaurantAddress(e.target.value)} style={inputStyle}
                            onFocus={e => { e.target.style.borderColor = "hsl(38 92% 50% / 0.6)"; e.target.style.backgroundColor = "hsl(0 0% 9%)"; }}
                            onBlur={e => { e.target.style.borderColor = "hsl(0 0% 14%)"; e.target.style.backgroundColor = "hsl(0 0% 7%)"; }} />
                        </div>
                        <div>
                          <label style={labelStyle}>ফোন</label>
                          <input type="text" placeholder="+880..." value={restaurantPhone} onChange={e => setRestaurantPhone(e.target.value)} style={inputStyle}
                            onFocus={e => { e.target.style.borderColor = "hsl(38 92% 50% / 0.6)"; e.target.style.backgroundColor = "hsl(0 0% 9%)"; }}
                            onBlur={e => { e.target.style.borderColor = "hsl(0 0% 14%)"; e.target.style.backgroundColor = "hsl(0 0% 7%)"; }} />
                        </div>
                      </div>
                      <div>
                        <label style={{ ...labelStyle, marginBottom: 10 }}>প্যাকেজ বেছে নিন <span style={{ color: "#86efac", fontWeight: 700, textTransform: "none", letterSpacing: 0 }}>— {FREE_TRIAL_DAYS} দিন ফ্রি</span></label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          {([
                            { id: "medium_smart" as const, label: "Medium Smart", price: "৳৯৯৯", features: ["QR অর্ডারিং", "রিয়েলটাইম ট্র্যাকিং", "৫ জন স্টাফ"] },
                            { id: "high_smart" as const, label: "High Smart", price: "৳১৯৯৯", features: ["সব Medium ফিচার", "AI Insights", "আনলিমিটেড স্টাফ"] },
                          ]).map(plan => {
                            const active = selectedPlan === plan.id;
                            return (
                              <button key={plan.id} type="button" onClick={() => setSelectedPlan(plan.id)}
                                style={{ padding: "14px 12px", borderRadius: 14, textAlign: "left", cursor: "pointer", border: active ? "2px solid rgba(201,168,76,0.8)" : "2px solid hsl(0 0% 14%)", background: active ? "rgba(201,168,76,0.08)" : "hsl(0 0% 7%)", transition: "all 0.2s", position: "relative", width: "100%" }}>
                                {active && (
                                  <div style={{ position: "absolute", top: 8, right: 8, width: 16, height: 16, borderRadius: "50%", background: gold, display: "flex", alignItems: "center", justifyContent: "center" }}>
                                    <span style={{ fontSize: 9, color: "#0a0a0a", fontWeight: 800 }}>✓</span>
                                  </div>
                                )}
                                <div style={{ fontSize: 13, fontWeight: 700, color: active ? "#f5d780" : "#fff", marginBottom: 4 }}>{plan.label}</div>
                                <div style={{ marginBottom: 8 }}>
                                  <span style={{ fontSize: 16, fontWeight: 800, color: active ? "#f5d780" : "rgba(255,255,255,0.7)" }}>{plan.price}</span>
                                  <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>/মাস</span>
                                </div>
                                {plan.features.map(f => (
                                  <div key={f} style={{ fontSize: 10, color: active ? "rgba(245,215,128,0.7)" : "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", gap: 4 }}>
                                    <span style={{ fontSize: 9 }}>✓</span> {f}
                                  </div>
                                ))}
                              </button>
                            );
                          })}
                        </div>
                        <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, background: "rgba(134,239,172,0.06)", border: "1px solid rgba(134,239,172,0.18)", fontSize: 11, color: "#86efac", textAlign: "center" }}>
                          প্রথম {FREE_TRIAL_DAYS} দিন সম্পূর্ণ বিনামূল্যে — কার্ড লাগবে না
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label style={labelStyle}>ইমেইল</label>
                    <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required
                      onFocus={e => { e.target.style.borderColor = "hsl(38 92% 50% / 0.6)"; e.target.style.backgroundColor = "hsl(0 0% 9%)"; }}
                      onBlur={e => { e.target.style.borderColor = "hsl(0 0% 14%)"; e.target.style.backgroundColor = "hsl(0 0% 7%)"; }} />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                      <label style={{ ...labelStyle, marginBottom: 0 }}>পাসওয়ার্ড</label>
                      {mode === "login" && (
                        <button type="button" onClick={() => setMode("forgot")}
                          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "rgba(201,168,76,0.7)", fontFamily: "'DM Sans', sans-serif", padding: 0 }}>
                          পাসওয়ার্ড ভুলে গেছেন?
                        </button>
                      )}
                    </div>
                    <div style={{ position: "relative" }}>
                      <input type={showPassword ? "text" : "password"} placeholder={mode === "signup" ? "যেমন: Admin@123" : "••••••••"} value={password} onChange={e => setPassword(e.target.value)} style={{ ...inputStyle, paddingRight: 48 }} required minLength={6}
                        onFocus={e => { e.target.style.borderColor = "hsl(38 92% 50% / 0.6)"; e.target.style.backgroundColor = "hsl(0 0% 9%)"; }}
                        onBlur={e => { e.target.style.borderColor = "hsl(0 0% 14%)"; e.target.style.backgroundColor = "hsl(0 0% 7%)"; }} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.35)", display: "flex", alignItems: "center", padding: 0 }}>
                        {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={submitting}
                    style={{ width: "100%", height: 52, borderRadius: 12, background: submitting ? "rgba(201,168,76,0.4)" : gold, border: "none", cursor: submitting ? "not-allowed" : "pointer", fontSize: 15, fontWeight: 700, color: "#0a0a0a", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "'DM Sans', sans-serif", boxShadow: "0 8px 32px rgba(201,168,76,0.3)", transition: "all 0.25s", marginTop: 4 }}>
                    {submitting ? "অপেক্ষা করুন..." : <>{mode === "signup" ? "সাইন আপ করুন" : "লগইন করুন"} <ArrowRight size={16} /></>}
                  </button>
                </div>
              </form>
            </>
          )}

          <p style={{ textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.18)", marginTop: 32 }}>
            © {new Date().getFullYear()} {APP_NAME} · <span style={{ color: "rgba(201,168,76,0.4)" }}>{COMPANY_NAME}</span>
          </p>
        </div>
      </div>

      <style>{`
        input::placeholder { color: rgba(255,255,255,0.25); }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 1000px hsl(0 0% 7%) inset !important; -webkit-text-fill-color: #fff !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default Login;
