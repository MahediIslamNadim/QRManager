import { useMemo, useState } from "react";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEnterpriseContext, useEnterpriseRestaurants } from "@/hooks/useEnterpriseAdmin";
import { useSharedMenu } from "@/hooks/useRestaurantGroup";
import { useEffect } from "react";

type MenuScope = "all" | "restaurant";

interface MenuFormState {
  name: string;
  category: string;
  description: string;
  price: string;
  active: boolean;
}

const EMPTY_FORM: MenuFormState = {
  name: "",
  category: "Main",
  description: "",
  price: "",
  active: true,
};

const formatCurrency = (value: number) => `BDT ${value.toLocaleString("en-BD")}`;

export default function EnterpriseMenus() {
  const queryClient = useQueryClient();
  const { groupId } = useEnterpriseContext();
  const restaurantsQuery = useEnterpriseRestaurants(groupId);
  const sharedMenu = useSharedMenu(groupId);

  const [scope, setScope] = useState<MenuScope>("all");
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MenuFormState>(EMPTY_FORM);

  // AlertDialog state (replaces window.confirm)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const restaurants = restaurantsQuery.data ?? [];

  useEffect(() => {
    if (!selectedRestaurantId && restaurants.length > 0) {
      setSelectedRestaurantId(restaurants[0].restaurant_id);
    }
  }, [restaurants, selectedRestaurantId]);

  const localMenuQuery = useQuery({
    queryKey: ["enterprise-local-menu", selectedRestaurantId],
    queryFn: async () => {
      if (!selectedRestaurantId) return [];
      const { data, error } = await supabase
        .from("menu_items")
        .select("*")
        .eq("restaurant_id", selectedRestaurantId)
        .is("shared_menu_item_id", null)
        .order("category")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: scope === "restaurant" && !!selectedRestaurantId,
  });

  const restaurantLabel = useMemo(() => {
    return restaurants.find((r) => r.restaurant_id === selectedRestaurantId)?.name || "নির্বাচিত রেস্টুরেন্ট";
  }, [restaurants, selectedRestaurantId]);

  const saveLocalMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRestaurantId) throw new Error("প্রথমে একটি রেস্টুরেন্ট নির্বাচন করুন।");
      const payload = {
        restaurant_id: selectedRestaurantId,
        name: form.name.trim(),
        category: form.category.trim(),
        description: form.description.trim() || null,
        price: Number(form.price),
        available: form.active,
      };
      if (editingId) {
        const { error } = await supabase
          .from("menu_items")
          .update(payload)
          .eq("id", editingId)
          .eq("restaurant_id", selectedRestaurantId)
          .is("shared_menu_item_id", null);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("menu_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["enterprise-local-menu", selectedRestaurantId] });
      queryClient.invalidateQueries({ queryKey: ["enterprise-restaurants", groupId] });
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      toast.success(editingId ? "মেনু আইটেম আপডেট হয়েছে।" : "মেনু আইটেম যোগ হয়েছে।");
      setDialogOpen(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "সেভ করা যায়নি।"),
  });

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      category: item.category || "Main",
      description: item.description || "",
      price: String(item.price || ""),
      active: scope === "all" ? !!item.is_active : !!item.available,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) {
      toast.error("নাম এবং মূল্য আবশ্যক।");
      return;
    }
    try {
      if (scope === "all") {
        if (!groupId) throw new Error("Enterprise group এখনো প্রস্তুত নয়।");
        if (editingId) {
          await sharedMenu.updateItem.mutateAsync({
            id: editingId,
            name: form.name.trim(),
            category: form.category.trim(),
            description: form.description.trim() || null,
            price: Number(form.price),
            is_active: form.active,
          });
        } else {
          await sharedMenu.createItem.mutateAsync({
            group_id: groupId,
            name: form.name.trim(),
            category: form.category.trim(),
            description: form.description.trim() || null,
            price: Number(form.price),
            image_url: null,
            is_active: form.active,
          });
        }
        toast.success(editingId ? "Shared মেনু আপডেট হয়েছে।" : "Shared মেনু আইটেম যোগ হয়েছে।");
        setDialogOpen(false);
        setEditingId(null);
        setForm(EMPTY_FORM);
        return;
      }
      await saveLocalMutation.mutateAsync();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "সেভ করা যায়নি।");
    }
  };

  // Step 1: ask for confirmation via AlertDialog
  const handleDeleteClick = (item: any) => {
    setDeleteTarget({ id: item.id, name: item.name });
  };

  // Step 2: confirmed — actually delete
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (scope === "all") {
        await sharedMenu.deleteItem.mutateAsync(deleteTarget.id);
        toast.success("Shared মেনু আইটেম মুছে ফেলা হয়েছে।");
      } else {
        if (!selectedRestaurantId) throw new Error("রেস্টুরেন্ট নির্বাচন করুন।");
        const { error } = await supabase
          .from("menu_items")
          .delete()
          .eq("id", deleteTarget.id)
          .eq("restaurant_id", selectedRestaurantId)
          .is("shared_menu_item_id", null);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["enterprise-local-menu", selectedRestaurantId] });
        toast.success("মেনু আইটেম মুছে ফেলা হয়েছে।");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "মুছে ফেলা যায়নি।");
    } finally {
      setDeleteTarget(null);
    }
  };

  const rows = scope === "all" ? sharedMenu.data ?? [] : localMenuQuery.data ?? [];
  const loading = scope === "all" ? sharedMenu.isLoading : localMenuQuery.isLoading;

  return (
    <DashboardLayout role="group_owner" title="সকল মেনু">
      {/* Delete confirm dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>মেনু আইটেম মুছে ফেলবেন?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{deleteTarget?.name}</span> স্থায়ীভাবে মুছে যাবে। এই কাজ পূর্বাবস্থায় ফেরানো যাবে না।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>বাতিল</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              মুছে ফেলুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-6">
        {/* Scope selector */}
        <Card>
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>মেনু স্কোপ</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as MenuScope)}>
                  <SelectTrigger className="mt-2 w-full md:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">সকল রেস্টুরেন্ট (Shared)</SelectItem>
                    <SelectItem value="restaurant">নির্দিষ্ট রেস্টুরেন্ট</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {scope === "restaurant" && (
                <div>
                  <Label>রেস্টুরেন্ট</Label>
                  <Select value={selectedRestaurantId} onValueChange={setSelectedRestaurantId}>
                    <SelectTrigger className="mt-2 w-full md:w-72">
                      <SelectValue placeholder="রেস্টুরেন্ট নির্বাচন করুন" />
                    </SelectTrigger>
                    <SelectContent>
                      {restaurants.map((r) => (
                        <SelectItem key={r.restaurant_id} value={r.restaurant_id}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <Button onClick={handleOpenCreate}>
              <Plus className="mr-2 h-4 w-4" />
              মেনু আইটেম যোগ করুন
            </Button>
          </CardContent>
        </Card>

        {scope === "restaurant" && selectedRestaurantId && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="p-4 text-sm text-muted-foreground">
              আপনি <span className="font-medium text-foreground">{restaurantLabel}</span> এর local মেনু সম্পাদনা করছেন।
              এই আইটেমগুলো শুধু এই রেস্টুরেন্টে দেখা যাবে।
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {scope === "all" ? "সকল রেস্টুরেন্টের Shared মেনু" : `${restaurantLabel} এর Local মেনু`}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                লোড হচ্ছে...
              </div>
            ) : rows.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                এই স্কোপে কোনো মেনু আইটেম নেই।
              </div>
            ) : (
              rows.map((item: any) => (
                <div key={item.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.name}</p>
                        <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {scope === "all"
                            ? (item.is_active ? "সক্রিয়" : "লুকানো")
                            : (item.available ? "পাওয়া যাচ্ছে" : "লুকানো")}
                        </Badge>
                      </div>
                      {item.description && (
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      )}
                      <p className="mt-2 text-sm font-semibold">{formatCurrency(Number(item.price || 0))}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenEdit(item)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        সম্পাদনা
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteClick(item)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        মুছুন
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "মেনু আইটেম সম্পাদনা করুন" : "নতুন মেনু আইটেম যোগ করুন"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>নাম *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((c) => ({ ...c, name: e.target.value }))}
                  maxLength={200}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>ক্যাটাগরি</Label>
                  <Input
                    value={form.category}
                    onChange={(e) => setForm((c) => ({ ...c, category: e.target.value }))}
                    maxLength={100}
                  />
                </div>
                <div className="space-y-2">
                  <Label>মূল্য (BDT) *</Label>
                  <Input
                    type="number"
                    min="0"
                    value={form.price}
                    onChange={(e) => setForm((c) => ({ ...c, price: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>বিবরণ</Label>
                <Textarea
                  rows={3}
                  value={form.description}
                  onChange={(e) => setForm((c) => ({ ...c, description: e.target.value }))}
                  maxLength={1000}
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.active}
                  onCheckedChange={(checked) => setForm((c) => ({ ...c, active: checked }))}
                />
                <Label>
                  {scope === "all"
                    ? "সকল শাখায় এই আইটেম সক্রিয় রাখুন"
                    : "এই রেস্টুরেন্টের মেনুতে দেখান"}
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
              <Button
                onClick={handleSave}
                disabled={
                  sharedMenu.createItem.isPending ||
                  sharedMenu.updateItem.isPending ||
                  saveLocalMutation.isPending
                }
              >
                {sharedMenu.createItem.isPending || sharedMenu.updateItem.isPending || saveLocalMutation.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> সেভ হচ্ছে...</>
                ) : "সেভ করুন"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
