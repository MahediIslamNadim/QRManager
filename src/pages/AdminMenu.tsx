import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Image as ImageIcon, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const categories = ["সব", "বিরিয়ানি", "কাবাব", "ভাত", "পানীয়", "ডেজার্ট", "other"];

const AdminMenu = () => {
  const { restaurantId } = useAuth();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("সব");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price: "", category: "other", description: "", available: true });

  const { data: menuItems = [], isLoading } = useQuery({
    queryKey: ["menu-items", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .order("sort_order");
      return data || [];
    },
    enabled: !!restaurantId,
  });

  const filtered = activeCategory === "সব" ? menuItems : menuItems.filter((i: any) => i.category === activeCategory);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("No restaurant");
      const payload = {
        restaurant_id: restaurantId,
        name: form.name,
        price: Number(form.price),
        category: form.category,
        description: form.description,
        available: form.available,
      };
      if (editingItem) {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      toast.success(editingItem ? "আইটেম আপডেট হয়েছে" : "আইটেম যোগ হয়েছে");
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("menu_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      toast.success("আইটেম মুছে ফেলা হয়েছে");
    },
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const { error } = await supabase.from("menu_items").update({ available }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu-items"] }),
  });

  const resetForm = () => {
    setForm({ name: "", price: "", category: "other", description: "", available: true });
    setEditingItem(null);
    setShowForm(false);
  };

  const openEdit = (item: any) => {
    setForm({ name: item.name, price: String(item.price), category: item.category, description: item.description || "", available: item.available });
    setEditingItem(item);
    setShowForm(true);
  };

  return (
    <DashboardLayout role="admin" title="মেনু ম্যানেজমেন্ট">
      <div className="space-y-6 animate-fade-up">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <Button key={cat} variant={activeCategory === cat ? "default" : "outline"} size="sm" onClick={() => setActiveCategory(cat)}>
                {cat}
              </Button>
            ))}
          </div>
          <Button variant="hero" onClick={() => { resetForm(); setShowForm(true); }}>
            <Plus className="w-4 h-4" /> আইটেম যোগ করুন
          </Button>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="font-display">{editingItem ? "আইটেম সম্পাদনা" : "নতুন আইটেম"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4">
              <div><Label>নাম</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required /></div>
              <div><Label>মূল্য (৳)</Label><Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} required /></div>
              <div>
                <Label>ক্যাটাগরি</Label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full h-10 rounded-md border border-border bg-background px-3 text-sm">
                  {categories.filter(c => c !== "সব").map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><Label>বিবরণ</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="flex items-center gap-2">
                <Switch checked={form.available} onCheckedChange={v => setForm(f => ({ ...f, available: v }))} />
                <Label>উপলব্ধ</Label>
              </div>
              <Button type="submit" variant="hero" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "সেভ হচ্ছে..." : "সেভ করুন"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <p className="text-center text-muted-foreground py-12">লোড হচ্ছে...</p>
        ) : filtered.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">কোনো মেনু আইটেম নেই। "আইটেম যোগ করুন" বাটনে ক্লিক করুন।</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((item: any) => (
              <div key={item.id} className="menu-item-card">
                <div className="h-40 bg-gradient-to-br from-accent to-secondary flex items-center justify-center">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                </div>
                <div className="p-5">
                  <h3 className="font-display font-semibold text-foreground text-lg">{item.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xl font-bold text-primary">৳{item.price}</span>
                    <div className="flex items-center gap-2">
                      <Switch checked={item.available} onCheckedChange={v => toggleAvailability.mutate({ id: item.id, available: v })} />
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Edit className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(item.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminMenu;
