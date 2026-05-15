import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { resolveAuthContext } from "@/lib/authContext";
import { authDebug } from "@/lib/authDebug";

interface AuthContextType {
  user: User | null;
  role: string | null;
  restaurantId: string | null;
  restaurantPlan: string;
  loading: boolean;
  trialExpired: boolean;
  signOut: () => Promise<void>;
  refetchUserData: (userId: string, accessToken?: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  restaurantId: null,
  restaurantPlan: "basic",
  loading: true,
  trialExpired: false,
  signOut: async () => {},
  refetchUserData: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [restaurantPlan, setRestaurantPlan] = useState("basic");
  const [loading, setLoading] = useState(true);
  const [trialExpired, setTrialExpired] = useState(false);
  const fetchingRef = useRef<{ promise: Promise<void>; userId: string } | null>(null);

  const fetchUserData = useCallback(async (userId: string, accessToken?: string) => {
    if (fetchingRef.current?.userId === userId) {
      authDebug("useAuth", "Awaiting in-flight fetchUserData call", { userId });
      return fetchingRef.current.promise;
    }

    const fetchPromise = (async () => {
      authDebug("useAuth", "Starting fetchUserData", {
        hasAccessToken: Boolean(accessToken),
        userId,
      });

      try {
        const authContext = await resolveAuthContext(accessToken);

        setRole(authContext.role);
        setRestaurantId(authContext.restaurantId);
        setRestaurantPlan(authContext.restaurantPlan);
        setTrialExpired(authContext.role === "admin" ? authContext.trialExpired : false);

        authDebug("useAuth", "Resolved auth context from secure RPC", {
          resolvedRestaurantId: authContext.restaurantId,
          resolvedRole: authContext.role,
          restaurantPlan: authContext.restaurantPlan,
          trialExpired: authContext.trialExpired,
          userId,
        });
      } catch (error) {
        console.error("fetchUserData error:", error);
        setRole(null);
        setRestaurantId(null);
        setRestaurantPlan("basic");
        setTrialExpired(false);
      } finally {
        if (fetchingRef.current?.userId === userId) {
          fetchingRef.current = null;
        }
        authDebug("useAuth", "Finished fetchUserData", { userId });
      }
    })();

    fetchingRef.current = { promise: fetchPromise, userId };
    return fetchPromise;
  }, []);

  useEffect(() => {
    let mounted = true;

    const clearUser = () => {
      setUser(null);
      setRole(null);
      setRestaurantId(null);
      setRestaurantPlan("basic");
      setTrialExpired(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      authDebug("useAuth", "Initial auth session check finished", {
        hasSession: Boolean(session),
        userId: session?.user.id ?? null,
      });

      if (!mounted) return;

      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id, session.access_token).then(() => {
          if (mounted) setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      authDebug("useAuth", "Supabase auth state change", {
        event,
        hasSession: Boolean(session),
        userId: session?.user.id ?? null,
      });

      if (!mounted) return;

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        if (session?.user) {
          setLoading(true);
          setUser(session.user);
          fetchingRef.current = null;
          fetchUserData(session.user.id, session.access_token).then(() => {
            if (mounted) setLoading(false);
          });
        }
      } else if (event === "SIGNED_OUT") {
        authDebug("useAuth", "Clearing auth context after sign-out");
        clearUser();
        setLoading(false);
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
    <AuthContext.Provider
      value={{
        user,
        role,
        restaurantId,
        restaurantPlan,
        loading,
        trialExpired,
        signOut,
        refetchUserData: fetchUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
