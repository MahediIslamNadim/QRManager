import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  role: string | null;
  restaurantId: string | null;
  restaurantPlan: string;
  loading: boolean;
  trialExpired: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  restaurantId: null,
  restaurantPlan: "basic",
  loading: true,
  trialExpired: false,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantPlan, setRestaurantPlan] = useState("basic");
  const [loading, setLoading] = useState(true);
  const [trialExpired, setTrialExpired] = useState(false);
  const fetchUserData = useCallback(async (userId: string) => {
    try {
      const { data: roleRow } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .order("role");

      const roles = (roleRow || []).map((r: any) => r.role);
      const superCheck = { data: roles.includes("super_admin") };
      const adminCheck = { data: roles.includes("admin") };
      const waiterCheck = { data: roles.includes("waiter") };

      let bestRole = "admin";
      if (superCheck.data === true) bestRole = "super_admin";
      else if (adminCheck.data === true) bestRole = "admin";
      else if (waiterCheck.data === true) bestRole = "waiter";
      setRole(bestRole);

      let foundRestId: string | null = null;

      // 1️⃣ RPC lookup
      try {
        const { data: restId, error: rpcError } = await supabase
          .rpc("get_user_restaurant_id", { _user_id: userId });
        if (rpcError) console.warn("get_user_restaurant_id RPC error:", rpcError.message);
        if (restId) {
          foundRestId = restId;
          setRestaurantId(restId);
        }
      } catch (e) {
        console.warn("get_user_restaurant_id failed:", e);
      }

      // 2️⃣ owner_id lookup
      if (!foundRestId) {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("id")
          .eq("owner_id", userId)
          .limit(1);
        if (restaurants && restaurants.length > 0) {
          foundRestId = restaurants[0].id;
          setRestaurantId(restaurants[0].id);
        }
      }

      // ✅ 3️⃣ staff_restaurants lookup — .maybeSingle() ব্যবহার করা হয়েছে
      if (!foundRestId) {
        const { data: staffRow } = await supabase
          .from("staff_restaurants" as any)
          .select("restaurant_id")
          .eq("user_id", userId)
          .limit(1)
          .maybeSingle();
        if (staffRow && (staffRow as any).restaurant_id) {
          foundRestId = (staffRow as any).restaurant_id;
          setRestaurantId((staffRow as any).restaurant_id);
        }
      }

      // Check trial expiry and plan
      if (foundRestId) {
        const { data: restaurant, error: restError } = await supabase
          .from("restaurants")
          .select("trial_ends_at, status, plan")
          .eq("id", foundRestId)
          .single();
        if (restError) console.warn("Restaurant fetch error:", restError.message);

        if (restaurant) {
          setRestaurantPlan(restaurant.plan || "basic");

          // Trial expiry is determined server-side by the expire-trials edge function
          // (scheduled daily). Client only reads the current status — no DB writes here.
          if (bestRole === "admin") {
            const trialEnded = restaurant.status === "inactive" ||
              (restaurant.trial_ends_at
                ? new Date() > new Date(restaurant.trial_ends_at) && restaurant.status !== "active_paid"
                : false);
            setTrialExpired(trialEnded);
          } else {
            setTrialExpired(false);
          }
        }
      } else {
        setTrialExpired(false);
      }
    } catch (err) {
      console.error("fetchUserData error:", err);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const clearUser = () => {
      setUser(null);
      setRole(null);
      setRestaurantId(null);
      setTrialExpired(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          fetchUserData(session.user.id).then(() => {
            if (mounted) setLoading(false);
          });
        } else {
          clearUser();
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        if (mounted) setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, restaurantId, restaurantPlan, loading, trialExpired, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
