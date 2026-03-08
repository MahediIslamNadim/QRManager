import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const SuperAdminUsers = () => {
  const { data: users = [], isLoading } = useQuery({
    queryKey: ["all-users"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, phone, created_at");
      
      if (!profiles) return [];

      return profiles.map(p => {
        const userRole = roles?.find(r => r.user_id === p.id);
        return {
          ...p,
          role: userRole?.role || "user",
        };
      });
    },
  });

  const roleLabel = (role: string) => {
    switch (role) {
      case "super_admin": return "সুপার অ্যাডমিন";
      case "admin": return "অ্যাডমিন";
      case "waiter": return "ওয়েটার";
      default: return "ব্যবহারকারী";
    }
  };

  return (
    <DashboardLayout role="super_admin" title="ব্যবহারকারী">
      <div className="space-y-6 animate-fade-up">
        <h2 className="font-display text-2xl font-bold text-foreground">সকল ব্যবহারকারী</h2>
        
        {isLoading && <p className="text-center text-muted-foreground py-8">লোড হচ্ছে...</p>}
        
        <div className="grid gap-3">
          {users.map((u: any) => (
            <Card key={u.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{u.full_name || "N/A"}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                </div>
                <Badge variant={u.role === "super_admin" ? "default" : "secondary"}>
                  {roleLabel(u.role)}
                </Badge>
              </CardContent>
            </Card>
          ))}
          {!isLoading && users.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center py-12">
                <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">কোনো ব্যবহারকারী নেই</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default SuperAdminUsers;
