import { useState, useEffect, useRef, createContext, useContext, ReactNode, useCallback } from "react";
import { User } from "@supabase/supabase-js";
import { createAuthedSupabaseClient, supabase } from "@/integrations/supabase/client";
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
        let authedClient = accessToken
          ? createAuthedSupabaseClient(accessToken)
          : null;

        const getAuthedClient = async () => {
          if (authedClient) return authedClient;

          const { data: { session } } = await supabase.auth.getSession();
          if (session?.access_token && session.user.id === userId) {
            authedClient = createAuthedSupabaseClient(session.access_token);
          }

          return authedClient;
        };

        let { data: roleRows, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .order("role");

        authDebug("useAuth", "Initial user_roles query finished", {
          error: roleError?.message ?? null,
          roles: roleRows?.map((row: any) => row.role) ?? [],
          rowCount: roleRows?.length ?? 0,
          userId,
        });

        const roleRetryClient = await getAuthedClient();
        if (roleRetryClient && ((!roleRows || roleRows.length === 0) || roleError)) {
          const retry = await roleRetryClient
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .order("role");

          roleRows = retry.data;
          roleError = retry.error;

          authDebug("useAuth", "Retried user_roles query with explicit bearer token", {
            error: roleError?.message ?? null,
            roles: roleRows?.map((row: any) => row.role) ?? [],
            rowCount: roleRows?.length ?? 0,
            userId,
          });
        }

        if (roleError) {
          console.warn("Role fetch error:", roleError.message);
        }

        const roles = (roleRows || []).map((row: any) => row.role);
        let bestRole: string | null = null;

        if (roles.includes("super_admin")) bestRole = "super_admin";
        else if (roles.includes("admin")) bestRole = "admin";
        else if (roles.includes("dedicated_manager")) bestRole = "dedicated_manager";
        else if (roles.includes("waiter")) bestRole = "waiter";
        else if (roles.includes("kitchen")) bestRole = "kitchen";

        // Fallback: if user_roles is empty, infer role from other tables
        if (!bestRole) {
          const retryClient = await getAuthedClient();
          const client = retryClient ?? supabase;

          // Check staff_restaurants
          const { data: staffFallback } = await (client.from("staff_restaurants") as any)
            .select("role, restaurant_id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();

          if (staffFallback?.role) {
            bestRole = staffFallback.role as string;
            authDebug("useAuth", "Role resolved from staff_restaurants fallback", { bestRole, userId });
            // Backfill user_roles so future fetches don't need fallback
            await (client.from("user_roles") as any).upsert(
              { user_id: userId, role: staffFallback.role, restaurant_id: staffFallback.restaurant_id ?? null },
              { onConflict: "user_id,role" }
            );
          } else {
            // Check dedicated_managers via SECURITY DEFINER RPC (handles email match + backfill)
            const { data: resolvedMgrRole } = await (client.rpc as any)("resolve_manager_role");
            if (resolvedMgrRole === "dedicated_manager") {
              bestRole = "dedicated_manager";
              authDebug("useAuth", "Role resolved from resolve_manager_role RPC fallback", { userId });
            } else {
              // Check restaurant ownership (owner = admin)
              const { data: ownedRest } = await client
                .from("restaurants")
                .select("id")
                .eq("owner_id", userId)
                .limit(1)
                .maybeSingle();

              if (ownedRest?.id) {
                bestRole = "admin";
                authDebug("useAuth", "Role resolved from restaurant ownership fallback", { userId });
                await (client.from("user_roles") as any).upsert(
                  { user_id: userId, role: "admin", restaurant_id: ownedRest.id },
                  { onConflict: "user_id,role" }
                );
              }
            }
          }
        }

        setRole(bestRole);
        authDebug("useAuth", "Resolved app role from user_roles", {
          resolvedRole: bestRole,
          roles,
          userId,
        });

        let foundRestaurantId: string | null = null;

        try {
          let { data: restId, error: rpcError } = await supabase
            .rpc("get_user_restaurant_id", { _user_id: userId });

          authDebug("useAuth", "RPC restaurant lookup finished", {
            error: rpcError?.message ?? null,
            restaurantId: restId ?? null,
            userId,
          });

          const rpcRetryClient = await getAuthedClient();
          if (rpcRetryClient && (!restId || rpcError)) {
            const retry = await rpcRetryClient
              .rpc("get_user_restaurant_id", { _user_id: userId });

            restId = retry.data;
            rpcError = retry.error;

            authDebug("useAuth", "Retried RPC restaurant lookup with explicit bearer token", {
              error: rpcError?.message ?? null,
              restaurantId: restId ?? null,
              userId,
            });
          }

          if (rpcError) console.warn("get_user_restaurant_id RPC error:", rpcError.message);
          if (restId) {
            foundRestaurantId = restId;
            setRestaurantId(restId);
          }
        } catch (error) {
          console.warn("get_user_restaurant_id failed:", error);
        }

        if (!foundRestaurantId) {
          let { data: ownerRestaurants, error: ownerError } = await supabase
            .from("restaurants")
            .select("id")
            .eq("owner_id", userId)
            .limit(1);

          authDebug("useAuth", "Owner restaurant lookup finished", {
            error: ownerError?.message ?? null,
            rowCount: ownerRestaurants?.length ?? 0,
            userId,
          });

          const ownerRetryClient = await getAuthedClient();
          if (ownerRetryClient && ((!ownerRestaurants || ownerRestaurants.length === 0) || ownerError)) {
            const retry = await ownerRetryClient
              .from("restaurants")
              .select("id")
              .eq("owner_id", userId)
              .limit(1);

            ownerRestaurants = retry.data;
            ownerError = retry.error;

            authDebug("useAuth", "Retried owner restaurant lookup with explicit bearer token", {
              error: ownerError?.message ?? null,
              rowCount: ownerRestaurants?.length ?? 0,
              userId,
            });
          }

          if (ownerRestaurants && ownerRestaurants.length > 0) {
            foundRestaurantId = ownerRestaurants[0].id;
            setRestaurantId(ownerRestaurants[0].id);
          }
        }

        if (!foundRestaurantId) {
          let { data: staffRow, error: staffError } = await supabase
            .from("staff_restaurants" as any)
            .select("restaurant_id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();

          authDebug("useAuth", "Staff restaurant lookup finished", {
            error: staffError?.message ?? null,
            restaurantId: (staffRow as any)?.restaurant_id ?? null,
            userId,
          });

          const staffRetryClient = await getAuthedClient();
          if (staffRetryClient && (!(staffRow as any)?.restaurant_id || staffError)) {
            const retry = await staffRetryClient
              .from("staff_restaurants" as any)
              .select("restaurant_id")
              .eq("user_id", userId)
              .limit(1)
              .maybeSingle();

            staffRow = retry.data;
            staffError = retry.error;

            authDebug("useAuth", "Retried staff restaurant lookup with explicit bearer token", {
              error: staffError?.message ?? null,
              restaurantId: (staffRow as any)?.restaurant_id ?? null,
              userId,
            });
          }

          if (staffRow && (staffRow as any).restaurant_id) {
            foundRestaurantId = (staffRow as any).restaurant_id;
            setRestaurantId((staffRow as any).restaurant_id);
          }
        }

        if (!foundRestaurantId) {
          setRestaurantId(null);
          setRestaurantPlan("basic");
        }

        authDebug("useAuth", "Resolved restaurant context", {
          resolvedRestaurantId: foundRestaurantId,
          userId,
        });

        if (foundRestaurantId) {
          let { data: restaurant, error: restaurantError } = await supabase
            .from("restaurants")
            .select("trial_ends_at, status, plan, subscription_status, tier")
            .eq("id", foundRestaurantId)
            .single();

          const restaurantRetryClient = await getAuthedClient();
          if (restaurantRetryClient && (!restaurant || restaurantError)) {
            const retry = await restaurantRetryClient
              .from("restaurants")
              .select("trial_ends_at, status, plan, subscription_status, tier")
              .eq("id", foundRestaurantId)
              .single();

            restaurant = retry.data;
            restaurantError = retry.error;

            authDebug("useAuth", "Retried restaurant plan lookup with explicit bearer token", {
              error: restaurantError?.message ?? null,
              restaurantId: foundRestaurantId,
              userId,
            });
          }

          if (restaurantError) {
            console.warn("Restaurant fetch error:", restaurantError.message);
          }

          if (restaurant) {
            setRestaurantPlan(restaurant.tier || restaurant.plan || "basic");

            if (bestRole === "admin") {
              const subStatus = restaurant.subscription_status || "trial";
              const trialEnded = subStatus === "expired" || subStatus === "cancelled" ||
                (restaurant.trial_ends_at
                  ? new Date() > new Date(restaurant.trial_ends_at) && subStatus !== "active"
                  : false);
              setTrialExpired(trialEnded);
            } else {
              setTrialExpired(false);
            }
          } else {
            setTrialExpired(false);
          }
        } else {
          setTrialExpired(false);
        }
      } catch (error) {
        console.error("fetchUserData error:", error);
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
