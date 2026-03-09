import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Users, Shield, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface User {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string;
}

const SuperAdminUsers = () => {
  const queryClient = useQueryClient();
  const [editUser, setEditUser] = useState<User | null>(null);
  const [deleteUser, setDeleteUser] = useState<User | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editRole, setEditRole] = useState("");

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

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editUser) return;
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: {
          action: "update",
          user_id: editUser.id,
          updates: {
            full_name: editName,
            phone: editPhone,
            role: editRole,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("ব্যবহারকারী আপডেট হয়েছে");
      setEditUser(null);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (err: any) => toast.error(err.message || "আপডেট করতে সমস্যা হয়েছে"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteUser) return;
      const { data, error } = await supabase.functions.invoke("manage-user", {
        body: {
          action: "delete",
          user_id: deleteUser.id,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      toast.success("ব্যবহারকারী মুছে ফেলা হয়েছে");
      setDeleteUser(null);
      queryClient.invalidateQueries({ queryKey: ["all-users"] });
    },
    onError: (err: any) => toast.error(err.message || "মুছতে সমস্যা হয়েছে"),
  });

  const openEdit = (user: User) => {
    setEditUser(user);
    setEditName(user.full_name || "");
    setEditPhone(user.phone || "");
    setEditRole(user.role);
  };

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
          {users.map((u: User) => (
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
                <div className="flex items-center gap-2">
                  <Badge variant={u.role === "super_admin" ? "default" : "secondary"}>
                    {roleLabel(u.role)}
                  </Badge>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDeleteUser(u)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
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

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={() => setEditUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">ব্যবহারকারী এডিট করুন</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>নাম</Label>
              <Input value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ফোন</Label>
              <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>ভূমিকা</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">সুপার অ্যাডমিন</SelectItem>
                  <SelectItem value="admin">অ্যাডমিন</SelectItem>
                  <SelectItem value="waiter">ওয়েটার</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button 
              className="w-full" 
              variant="hero" 
              onClick={() => updateMutation.mutate()} 
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "আপডেট হচ্ছে..." : "আপডেট করুন"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUser} onOpenChange={() => setDeleteUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ব্যবহারকারী মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteUser?.full_name || deleteUser?.email} - এই ব্যবহারকারীকে মুছে ফেললে তার সব তথ্য মুছে যাবে। এটি পূর্বাবস্থায় ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "মুছছে..." : "মুছে ফেলুন"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
};

export default SuperAdminUsers;
