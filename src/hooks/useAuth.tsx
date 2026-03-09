import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
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
      const [superCheck, adminCheck, waiterCheck] = await Promise.all([
        supabase.rpc("has_role", { _user_id: userId, _role: "super_admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: userId, _role: "waiter" }),
      ]);

      let bestRole = "admin";
      if (superCheck.data === true) {
        bestRole = "super_admin";
      } else if (adminCheck.data === true) {
        bestRole = "admin";
      } else if (waiterCheck.data === true) {
        bestRole = "waiter";
      }
      console.log("Role checks - super:", superCheck.data, "admin:", adminCheck.data, "waiter:", waiterCheck.data, "Best:", bestRole);
      setRole(bestRole);

      // Get restaurant
      let foundRestId: string | null = null;
      try {
        const { data: restId } = await supabase
          .rpc("get_user_restaurant_id", { _user_id: userId });
        if (restId) {
          foundRestId = restId;
          setRestaurantId(restId);
        }
      } catch {}

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

      // Check trial expiry and plan for admin users (not super_admin)
      if (foundRestId) {
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("trial_ends_at, status, plan")
          .eq("id", foundRestId)
          .single();

        if (restaurant) {
          setRestaurantPlan(restaurant.plan || "basic");

          if (bestRole === "admin") {
            const trialEndsAt = restaurant.trial_ends_at ? new Date(restaurant.trial_ends_at) : null;
            const now = new Date();

            if (trialEndsAt && now > trialEndsAt && restaurant.status !== "active_paid") {
              await supabase
                .from("restaurants")
                .update({ status: "inactive" })
                .eq("id", foundRestId);
              setTrialExpired(true);
            } else {
              setTrialExpired(false);
            }
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

    // Set up auth state listener FIRST (before getSession)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        if (session?.user) {
          setUser(session.user);
          // Fire and forget - don't await in callback
          fetchUserData(session.user.id).then(() => {
            if (mounted) setLoading(false);
          });
        } else {
          clearUser();
          setLoading(false);
        }
      }
    );

    // Then check for existing session
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
