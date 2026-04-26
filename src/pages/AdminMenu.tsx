import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Edit, Trash2, Image as ImageIcon, Upload, X, CheckCircle, XCircle, Clock, ShoppingBag, TrendingUp } from "lucide-react";
import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getPlanLimits, formatLimit } from "@/lib/planLimits";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

const categories = ["সব", "বিরিয়ানি", "কাবাব", "ভাত", "পানীয়", "ডেজার্ট", "other"];

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

const getImageUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/menu-images/${path}`;
};

const isSharedMenuItem = (item: any) => Boolean(item?.shared_menu_item_id);

const AdminMenu = () => {
  const { restaurantId, restaurantPlan } = useAuth();
  const limits = getPlanLimits(restaurantPlan);
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("সব");
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form, setForm] = useState({ name: "", price: "", category: "other", description: "", available: true, hasStock: false, stockQty: "", prepTime: "" });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sortBy, setSortBy] = useState<'default' | 'popular' | 'price' | 'available'>('available');

  const { data: menuItemsRaw = [], isLoading } = useQuery({
    queryKey: ["menu-items", restaurantId],
    queryFn: async () => {
      if (!restaurantId) return [];
      const { data } = await supabase
        .from("menu_items")
        .select(`
          *,
          menu_item_metrics(order_count, view_count)
        `)
        .eq("restaurant_id", restaurantId);
      return data || [];
    },
    enabled: !!restaurantId,
  });

  // Fetch average ratings per menu item
  const { data: ratingsMap = {} } = useQuery({
    queryKey: ["menu-item-ratings", restaurantId],
    queryFn: async () => {
      if (!restaurantId || menuItemsRaw.length === 0) return {};
      const ids = menuItemsRaw.map((i: any) => i.id);
      const { data } = await supabase
        .from("reviews")
        .select("menu_item_id, rating")
        .in("menu_item_id", ids);
      if (!data) return {};
      const map: Record<string, { avg: number; count: number }> = {};
      data.forEach((r: any) => {
        if (!map[r.menu_item_id]) map[r.menu_item_id] = { avg: 0, count: 0 };
        map[r.menu_item_id].count += 1;
        map[r.menu_item_id].avg += r.rating;
      });
      Object.keys(map).forEach(id => {
        map[id].avg = Math.round((map[id].avg / map[id].count) * 10) / 10;
      });
      return map;
    },
    enabled: !!restaurantId && menuItemsRaw.length > 0,
  });

  // Sort menu items — always push unavailable items to the bottom
  const menuItems = [...menuItemsRaw].sort((a: any, b: any) => {
    // Available items always come first (unless explicit sort chosen)
    if (sortBy === 'available') {
      if (a.available === b.available) return a.sort_order - b.sort_order;
      return a.available ? -1 : 1; // available first
    }
    if (sortBy === 'popular') {
      if (a.available !== b.available) return a.available ? -1 : 1; // unavailable goes bottom
      const aOrders = a.menu_item_metrics?.[0]?.order_count || 0;
      const bOrders = b.menu_item_metrics?.[0]?.order_count || 0;
      return bOrders - aOrders; // Most popular first
    }
    if (sortBy === 'price') {
      if (a.available !== b.available) return a.available ? -1 : 1;
      return a.price - b.price; // Lowest price first
    }
    // default
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.sort_order - b.sort_order;
  });

  const filtered = activeCategory === "সব" ? menuItems : menuItems.filter((i: any) => i.category === activeCategory);

  const uploadImage = async (file: File): Promise<string | null> => {
    const ext = file.name.split(".").pop();
    const fileName = `${restaurantId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("menu-images").upload(fileName, file, { upsert: true });
    if (error) {
      console.error("Upload error:", error);
      throw new Error("ইমেজ আপলোড ব্যর্থ: " + error.message);
    }
    return fileName;
  };

  const localMenuItemsCount = menuItemsRaw.filter((item: any) => !isSharedMenuItem(item)).length;
  const isAtMenuLimit = localMenuItemsCount >= limits.maxMenuItems;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error("No restaurant");
      if (isSharedMenuItem(editingItem)) throw new Error("Shared menu items are controlled by head office.");
      if (!editingItem && isAtMenuLimit) throw new Error(`আপনার ${limits.label} প্ল্যানে সর্বোচ্চ ${formatLimit(limits.maxMenuItems)} টি আইটেম যোগ করা যায়। আপগ্রেড করুন।`);
      if (!form.name.trim() || form.name.trim().length < 2) throw new Error("আইটেমের নাম কমপক্ষে ২ অক্ষর হতে হবে");
      if (Number(form.price) <= 0) throw new Error("মূল্য অবশ্যই শূন্যের বেশি হতে হবে");
      setUploading(true);

      let image_url = editingItem?.image_url || null;

      // Upload image if selected
      if (imageFile) {
        image_url = await uploadImage(imageFile);
      }

      const payload = {
        restaurant_id: restaurantId,
        name: form.name,
        price: Number(form.price),
        category: form.category,
        description: form.description,
        available: form.available,
        image_url,
        stock_quantity: form.hasStock ? (Number(form.stockQty) || 0) : null,
        prep_time_minutes: form.prepTime ? Number(form.prepTime) : null,
      };

      if (editingItem) {
        const { error } = await supabase.from("menu_items").update(payload).eq("id", editingItem.id).eq("restaurant_id", restaurantId);
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
    onSettled: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("menu_items")
        .delete()
        .eq("id", id)
        .eq("restaurant_id", restaurantId)
        .is("shared_menu_item_id", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["menu-items"] });
      toast.success("আইটেম মুছে ফেলা হয়েছে");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleAvailability = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const { error } = await supabase
        .from("menu_items")
        .update({ available })
        .eq("id", id)
        .eq("restaurant_id", restaurantId)
        .is("shared_menu_item_id", null);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["menu-items"] }),
    onError: (err: any) => toast.error(err.message),
  });

  const resetForm = () => {
    setForm({ name: "", price: "", category: "other", description: "", available: true, hasStock: false, stockQty: "", prepTime: "" });
    setEditingItem(null);
    setShowForm(false);
    setImageFile(null);
    setImagePreview(null);
  };

  const openEdit = (item: any) => {
    if (isSharedMenuItem(item)) {
      toast.error("Shared menu items are controlled by head office.");
      return;
    }
    const hasStock = item.stock_quantity !== null && item.stock_quantity !== undefined;
    setForm({ name: item.name, price: String(item.price), category: item.category, description: item.description || "", available: item.available, hasStock, stockQty: hasStock ? String(item.stock_quantity) : "", prepTime: item.prep_time_minutes ? String(item.prep_time_minutes) : "" });
    setEditingItem(item);
    setImageFile(null);
    setImagePreview(item.image_url ? getImageUrl(item.image_url) : null);
    setShowForm(true);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("শুধুমাত্র ইমেজ ফাইল আপলোড করুন");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("ফাইল সাইজ ৫MB এর বেশি হতে পারবে না");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
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
          <div className="flex items-center gap-3">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="available">✅ স্টক আগে</option>
              <option value="popular">🔥 জনপ্রিয়তা</option>
              <option value="price">মূল্য অনুযায়ী</option>
              <option value="default">সাজানো ক্রম</option>
            </select>
            <span className="text-xs text-muted-foreground bg-secondary px-3 py-1.5 rounded-full">
              {localMenuItemsCount}/{formatLimit(limits.maxMenuItems)} local
            </span>
            <Button variant="hero" onClick={() => { resetForm(); setShowForm(true); }} disabled={isAtMenuLimit}>
              <Plus className="w-4 h-4" /> আইটেম যোগ করুন
            </Button>
          </div>
        </div>
        {isAtMenuLimit && (
          <div className="bg-warning/10 border border-warning/30 rounded-xl p-3 text-sm text-warning flex items-center gap-2">
            ⚠️ আপনার {limits.label} প্ল্যানের মেনু আইটেম লিমিট ({formatLimit(limits.maxMenuItems)}) পূর্ণ হয়েছে। আরো যোগ করতে প্ল্যান আপগ্রেড করুন।
          </div>
        )}

        {/* Add/Edit Dialog */}
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <DialogContent className="max-w-md flex flex-col max-h-[90vh]">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle className="font-display">{editingItem ? "আইটেম সম্পাদনা" : "নতুন আইটেম"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); saveMutation.mutate(); }} className="space-y-4 overflow-y-auto flex-1 pr-1">
              {/* Image Upload */}
              <div>
                <Label>ছবি</Label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 relative h-40 rounded-xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer overflow-hidden bg-secondary/30 flex items-center justify-center group"
                >
                  {imagePreview ? (
                    <>
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="text-primary-foreground text-sm font-medium flex items-center gap-2">
                          <Upload className="w-4 h-4" /> ছবি পরিবর্তন করুন
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setImageFile(null); setImagePreview(null); }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">ক্লিক করে ছবি আপলোড করুন</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">JPG, PNG — সর্বোচ্চ ৫MB</p>
                    </div>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />
              </div>

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

              {/* Prep time */}
              <div className="border border-border rounded-xl p-3 bg-secondary/20">
                <Label className="flex items-center gap-1.5 mb-2">
                  <Clock className="w-3.5 h-3.5 text-primary" /> রান্নার আনুমানিক সময় (মিনিট)
                </Label>
                <div className="flex gap-2 flex-wrap mb-2">
                  {["5","10","15","20","30","45","60"].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, prepTime: f.prepTime === t ? "" : t }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        form.prepTime === t
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-accent"
                      }`}
                    >
                      {t} মিনিট
                    </button>
                  ))}
                </div>
                <Input
                  type="number"
                  min="1"
                  max="180"
                  placeholder="নিজে লিখুন (যেমন: ২৫)"
                  value={form.prepTime}
                  onChange={e => setForm(f => ({ ...f, prepTime: e.target.value }))}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground mt-1">খালি রাখলে customer-এ সময় দেখাবে না।</p>
              </div>

              {/* Stock quantity */}
              <div className="border border-border rounded-xl p-3 space-y-3 bg-secondary/20">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={form.hasStock}
                    onCheckedChange={v => setForm(f => ({ ...f, hasStock: v, stockQty: v ? f.stockQty : "" }))}
                  />
                  <Label>পরিমাণ সীমা আছে (স্টক ট্র্যাক করুন)</Label>
                </div>
                {form.hasStock && (
                  <div>
                    <Label className="text-xs text-muted-foreground">বর্তমান স্টক পরিমাণ</Label>
                    <Input
                      type="number"
                      min="0"
                      placeholder="যেমন: ৫০"
                      value={form.stockQty}
                      onChange={e => setForm(f => ({ ...f, stockQty: e.target.value }))}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">স্টক ০ হলে কাস্টমার অর্ডার করতে পারবে না।</p>
                  </div>
                )}
              </div>

              <Button type="submit" variant="hero" className="w-full sticky bottom-0" disabled={saveMutation.isPending || uploading}>
                {uploading ? "আপলোড হচ্ছে..." : saveMutation.isPending ? "সেভ হচ্ছে..." : "সেভ করুন"}
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
            {filtered.map((item: any) => {
              const imgUrl = getImageUrl(item.image_url);
              const isAvailable = item.available;
              const orderCount = item.menu_item_metrics?.[0]?.order_count || 0;
              const isPopular = orderCount > 10;
              const rating = (ratingsMap as any)[item.id];
              const isShared = isSharedMenuItem(item);
              return (
                <div key={item.id} className={`menu-item-card relative ${!isAvailable ? "opacity-80" : ""}`}>
                  <div className={`h-40 bg-gradient-to-br from-accent to-secondary flex items-center justify-center overflow-hidden relative ${!isAvailable ? "grayscale" : ""}`}>
                    {imgUrl ? (
                      <img src={imgUrl} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
                    )}
                    {/* Stock badge on image */}
                    <div className={`absolute top-2 left-2 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                      isAvailable
                        ? "bg-success/90 text-success-foreground"
                        : "bg-destructive/90 text-destructive-foreground"
                    }`}>
                      {isAvailable ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {isAvailable ? "ইন স্টক" : "স্টক আউট"}
                    </div>
                    {/* Stock quantity badge */}
                    {item.stock_quantity !== null && item.stock_quantity !== undefined && (
                      <div className={`absolute bottom-2 left-2 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                        item.stock_quantity === 0
                          ? "bg-destructive/90 text-destructive-foreground"
                          : item.stock_quantity <= 5
                          ? "bg-warning/90 text-warning-foreground"
                          : "bg-background/80 text-foreground"
                      }`}>
                        স্টক: {item.stock_quantity}
                      </div>
                    )}
                    {/* Popular badge */}
                    {isPopular && (
                      <div className="absolute top-2 right-2 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center gap-1">
                        🔥 জনপ্রিয়
                      </div>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display font-semibold text-foreground text-lg">{item.name}</h3>
                      {isShared && (
                        <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          Shared
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <span className="text-xl font-bold text-primary">৳{item.price}</span>
                      {item.prep_time_minutes && (
                        <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground bg-secondary px-2 py-1 rounded-lg">
                          <Clock className="w-3 h-3" /> ~{item.prep_time_minutes} মিনিট
                        </span>
                      )}
                    </div>
                    {/* Sales + rating stats bar */}
                    <div className={`flex items-center gap-2 mt-3 px-3 py-2 rounded-xl ${orderCount > 0 ? "bg-primary/5 border border-primary/10" : "bg-muted/40 border border-border/40"}`}>
                      <ShoppingBag className={`w-3.5 h-3.5 flex-shrink-0 ${orderCount > 0 ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-semibold ${orderCount > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {orderCount > 0 ? `${orderCount} বার` : "অর্ডার নেই"}
                      </span>
                      {orderCount > 0 && <TrendingUp className="w-3 h-3 text-primary" />}
                      <div className="ml-auto flex items-center gap-1">
                        {rating ? (
                          <>
                            <span className="text-yellow-500 text-sm leading-none">★</span>
                            <span className="text-xs font-bold text-foreground">{rating.avg}</span>
                            <span className="text-[10px] text-muted-foreground">({rating.count})</span>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">রেটিং নেই</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-3">
                      <span />
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <Switch
                            checked={isAvailable}
                            onCheckedChange={v => toggleAvailability.mutate({ id: item.id, available: v })}
                            className={isAvailable ? "data-[state=checked]:bg-success" : ""}
                            disabled={isShared}
                          />
                          <span className={`text-xs font-semibold ${isAvailable ? "text-success" : "text-destructive"}`}>
                            {isAvailable ? "চালু" : "বন্ধ"}
                          </span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(item)} disabled={isShared}><Edit className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(item.id)} disabled={isShared}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminMenu;
