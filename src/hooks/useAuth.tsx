import { useState, useEffect, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  role: string | null;
  restaurantId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  restaurantId: null,
  loading: true,
  signOut: async () => {},
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (userId: string) => {
    try {
      // Get role
      const { data: roles, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      
      if (roleError) console.error("Role fetch error:", roleError);
      
      let bestRole = "admin"; // default
      if (roles && roles.length > 0) {
        const priority = ["super_admin", "admin", "waiter"];
        bestRole = roles
          .map(r => r.role)
          .sort((a, b) => priority.indexOf(a) - priority.indexOf(b))[0];
      }
      console.log("User roles:", roles, "Best role:", bestRole);
      setRole(bestRole);

      // Get restaurant
      const { data: restId, error: restError } = await supabase
        .rpc("get_user_restaurant_id", { _user_id: userId });
      
      if (restError) console.error("Restaurant fetch error:", restError);
      
      if (restId) {
        setRestaurantId(restId);
      } else {
        const { data: restaurants } = await supabase
          .from("restaurants")
          .select("id")
          .eq("owner_id", userId)
          .limit(1);
        if (restaurants && restaurants.length > 0) {
          setRestaurantId(restaurants[0].id);
        }
      }
    } catch (err) {
      console.error("fetchUserData error:", err);
    }
  };

  useEffect(() => {
    let mounted = true;

    // First get session
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      
      if (session?.user) {
        setUser(session.user);
        await fetchUserData(session.user.id);
      }
      if (mounted) setLoading(false);
    };

    init();

    // Then listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          // Use setTimeout to avoid Supabase deadlock
          setTimeout(async () => {
            await fetchUserData(session.user.id);
            if (mounted) setLoading(false);
          }, 0);
        } else {
          setUser(null);
          setRole(null);
          setRestaurantId(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, restaurantId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
