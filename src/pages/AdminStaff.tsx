import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2, Users, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const AdminStaff = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"waiter" | "admin">("waiter");

  const { data: staff = [], isLoading } = useQuery({
    queryKey: ["staff", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      // Get user_roles for this context
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");
      
      if (!roles) return [];

      // Get profiles for those users
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone");

      if (!profiles) return [];

      return roles.map(r => {
        const profile = profiles.find(p => p.id === r.user_id);
        return {
          id: r.user_id,
          name: profile?.full_name || "N/A",
          email: profile?.email || "N/A",
          phone: profile?.phone || "",
          role: r.role,
        };
      }).filter(s => s.role === "waiter" || s.role === "admin");
    },
    enabled: !!restaurantId,
  });

  const addStaffMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("create-staff", {
        body: { email, password, full_name: name, role },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast.success("কর্মী সফলভাবে যোগ করা হয়েছে");
      setOpen(false);
      setEmail("");
      setName("");
      setPassword("");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: any) => toast.error(err.message || "কর্মী যোগ করতে সমস্যা হয়েছে"),
  });

  const removeStaffMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("কর্মী সরানো হয়েছে");
      queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <DashboardLayout role="admin" title="কর্মী ম্যানেজমেন্ট">
      <div className="space-y-6 animate-fade-up">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">কর্মী তালিকা</h2>
            <p className="text-muted-foreground text-sm">ওয়েটার ও অ্যাডমিন ম্যানেজ করুন</p>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="hero"><UserPlus className="w-4 h-4" /> কর্মী যোগ করুন</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-display">নতুন কর্মী যোগ করুন</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>নাম</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} placeholder="কর্মীর নাম" />
                </div>
                <div className="space-y-2">
                  <Label>ইমেইল</Label>
                  <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>পাসওয়ার্ড</Label>
                  <Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="ন্যূনতম ৬ অক্ষর" />
                </div>
                <div className="space-y-2">
                  <Label>ভূমিকা</Label>
                  <Select value={role} onValueChange={(v) => setRole(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="waiter">ওয়েটার</SelectItem>
                      <SelectItem value="admin">অ্যাডমিন</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" variant="hero" onClick={() => addStaffMutation.mutate()} disabled={addStaffMutation.isPending || !email || !password}>
                  {addStaffMutation.isPending ? "যোগ হচ্ছে..." : "যোগ করুন"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4">
          {isLoading && <p className="text-center text-muted-foreground py-8">লোড হচ্ছে...</p>}
          {!isLoading && staff.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="w-12 h-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">কোনো কর্মী নেই। উপরে "কর্মী যোগ করুন" বাটনে ক্লিক করুন।</p>
              </CardContent>
            </Card>
          )}
          {staff.map((s: any) => (
            <Card key={s.id}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{s.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={s.role === "admin" ? "default" : "secondary"}>
                    {s.role === "admin" ? "অ্যাডমিন" : "ওয়েটার"}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => removeStaffMutation.mutate(s.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminStaff;
