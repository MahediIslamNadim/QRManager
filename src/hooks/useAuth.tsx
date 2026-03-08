import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  role: string | null;
  restaurantId: string | null;
  loading: boolean;
  trialExpired: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  restaurantId: null,
  loading: true,
  trialExpired: false,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
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

      // Check trial expiry for admin users (not super_admin)
      if (bestRole === "admin" && foundRestId) {
        const { data: restaurant } = await supabase
          .from("restaurants")
          .select("trial_ends_at, status")
          .eq("id", foundRestId)
          .single();

        if (restaurant) {
          const trialEndsAt = restaurant.trial_ends_at ? new Date(restaurant.trial_ends_at) : null;
          const now = new Date();

          if (trialEndsAt && now > trialEndsAt && restaurant.status !== "active_paid") {
            // Trial expired - deactivate restaurant
            await supabase
              .from("restaurants")
              .update({ status: "inactive" })
              .eq("id", foundRestId);
            setTrialExpired(true);
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
    let initialLoadDone = false;

    const loadUser = async (authUser: User) => {
      setUser(authUser);
      await fetchUserData(authUser.id);
    };

    const clearUser = () => {
      setUser(null);
      setRole(null);
      setRestaurantId(null);
      setTrialExpired(false);
    };

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        await loadUser(session.user);
      }
      initialLoadDone = true;
      if (mounted) setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (!initialLoadDone) return;

        if (event === "SIGNED_IN" && session?.user) {
          setLoading(true);
          await loadUser(session.user);
          if (mounted) setLoading(false);
        } else if (event === "SIGNED_OUT") {
          clearUser();
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, restaurantId, loading, trialExpired, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
