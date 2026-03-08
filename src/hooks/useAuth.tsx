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
      
      if (roles && roles.length > 0) {
        setRole(roles[0].role);
      } else {
        setRole("admin"); // default role for new users
      }

      // Get restaurant using RPC to avoid RLS issues
      const { data: restId, error: restError } = await supabase
        .rpc("get_user_restaurant_id", { _user_id: userId });
      
      if (restError) console.error("Restaurant fetch error:", restError);
      
      if (restId) {
        setRestaurantId(restId);
      } else {
        // Fallback: direct query
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
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setUser(session.user);
          await fetchUserData(session.user.id);
        } else {
          setUser(null);
          setRole(null);
          setRestaurantId(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        fetchUserData(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
