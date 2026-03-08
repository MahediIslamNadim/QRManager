import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, Plus, Search, Edit, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Restaurant {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  status: string;
  plan: string;
  owner_id: string | null;
  created_at: string;
}

const SuperAdminRestaurants = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formPlan, setFormPlan] = useState("basic");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const { data: restaurants = [], isLoading } = useQuery({
    queryKey: ["all-restaurants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("restaurants")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Restaurant[];
    },
  });

  const filtered = restaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    (r.address || "").toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setFormName("");
    setFormAddress("");
    setFormPhone("");
    setFormStatus("active");
    setFormPlan("basic");
    setEditingId(null);
  };

  const openAdd = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (r: Restaurant) => {
    setEditingId(r.id);
    setFormName(r.name);
    setFormAddress(r.address || "");
    setFormPhone(r.phone || "");
    setFormStatus(r.status);
    setFormPlan(r.plan);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase
          .from("restaurants")
          .update({ name: formName, address: formAddress, phone: formPhone, status: formStatus, plan: formPlan, updated_at: new Date().toISOString() })
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("restaurants")
          .insert({ name: formName, address: formAddress, phone: formPhone, status: formStatus, plan: formPlan });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingId ? "রেস্টুরেন্ট আপডেট হয়েছে" : "রেস্টুরেন্ট যোগ করা হয়েছে");
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["all-restaurants"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("restaurants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("রেস্টুরেন্ট মুছে ফেলা হয়েছে");
      setDeleteConfirm(null);
      queryClient.invalidateQueries({ queryKey: ["all-restaurants"] });
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <DashboardLayout role="super_admin" title="রেস্টুরেন্ট ম্যানেজমেন্ট">
      <div className="space-y-6 animate-fade-up">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="রেস্টুরেন্ট খুঁজুন..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 bg-secondary/50" />
          </div>
          <Button variant="hero" onClick={openAdd}><Plus className="w-4 h-4" /> নতুন রেস্টুরেন্ট</Button>
        </div>

        {isLoading && <p className="text-center text-muted-foreground py-8">লোড হচ্ছে...</p>}

        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm">রেস্টুরেন্ট</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm hidden md:table-cell">ঠিকানা</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm hidden sm:table-cell">ফোন</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm">প্ল্যান</th>
                    <th className="text-left p-4 font-medium text-muted-foreground text-sm">স্ট্যাটাস</th>
                    <th className="text-right p-4 font-medium text-muted-foreground text-sm">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 && !isLoading && (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">কোনো রেস্টুরেন্ট নেই</td></tr>
                  )}
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                            <Store className="w-5 h-5 text-accent-foreground" />
                          </div>
                          <span className="font-medium text-foreground">{r.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-muted-foreground hidden md:table-cell">{r.address || "—"}</td>
                      <td className="p-4 text-muted-foreground hidden sm:table-cell">{r.phone || "—"}</td>
                      <td className="p-4">
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary capitalize">{r.plan}</span>
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          r.status === "active" ? "bg-success/10 text-success" :
                          r.status === "pending" ? "bg-warning/10 text-warning" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {r.status === "active" ? "সক্রিয়" : r.status === "pending" ? "পেন্ডিং" : "নিষ্ক্রিয়"}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Edit className="w-4 h-4" /></Button>
                          {deleteConfirm === r.id ? (
                            <div className="flex items-center gap-1">
                              <Button variant="destructive" size="sm" onClick={() => deleteMutation.mutate(r.id)} disabled={deleteMutation.isPending}>
                                {deleteMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "হ্যাঁ"}
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(null)}>না</Button>
                            </div>
                          ) : (
                            <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteConfirm(r.id)}>
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) resetForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{editingId ? "রেস্টুরেন্ট সম্পাদনা" : "নতুন রেস্টুরেন্ট যোগ করুন"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>রেস্টুরেন্টের নাম</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="নাম লিখুন" />
            </div>
            <div className="space-y-2">
              <Label>ঠিকানা</Label>
              <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="ঠিকানা লিখুন" />
            </div>
            <div className="space-y-2">
              <Label>ফোন</Label>
              <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+880..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>স্ট্যাটাস</Label>
                <Select value={formStatus} onValueChange={setFormStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">সক্রিয়</SelectItem>
                    <SelectItem value="pending">পেন্ডিং</SelectItem>
                    <SelectItem value="inactive">নিষ্ক্রিয়</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>প্ল্যান</Label>
                <Select value={formPlan} onValueChange={setFormPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="basic">Basic</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full" variant="hero" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formName.trim()}>
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saveMutation.isPending ? "সেভ হচ্ছে..." : editingId ? "আপডেট করুন" : "যোগ করুন"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default SuperAdminRestaurants;
