import { useState, useEffect } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Minus, UtensilsCrossed, X, Send, Image as ImageIcon, Flame, CheckCircle, XCircle, Package, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const getImageUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/menu-images/${path}`;
};

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  available: boolean;
  image_url?: string | null;
}

interface CartItem extends MenuItem {
  quantity: number;
}

// Assign each category a unique color
const categoryColors: Record<string, { bg: string; text: string; border: string; dot: string }> = {};
const colorPalette = [
  { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30", dot: "bg-primary" },
  { bg: "bg-info/10", text: "text-info", border: "border-info/30", dot: "bg-info" },
  { bg: "bg-success/10", text: "text-success", border: "border-success/30", dot: "bg-success" },
  { bg: "bg-rose/10", text: "text-rose", border: "border-rose/30", dot: "bg-rose" },
  { bg: "bg-amber/10", text: "text-amber", border: "border-amber/30", dot: "bg-amber" },
  { bg: "bg-accent", text: "text-accent-foreground", border: "border-accent-foreground/20", dot: "bg-accent-foreground" },
];

const getCategoryColor = (category: string) => {
  if (!categoryColors[category]) {
    const idx = Object.keys(categoryColors).length % colorPalette.length;
    categoryColors[category] = colorPalette[idx];
  }
  return categoryColors[category];
};

const CustomerMenu = () => {
  const { restaurantId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableId = searchParams.get("table");
  const seatId = searchParams.get("seat");
  const isDemo = !restaurantId;

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [tableName, setTableName] = useState<string>("N/A");
  const [seatNumber, setSeatNumber] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>(["সব"]);
  const [activeCategory, setActiveCategory] = useState("সব");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (isDemo) {
        setRestaurant({ name: "Spice Garden" });
        setTableName("T-5");
        const demoItems: MenuItem[] = [
          { id: "1", name: "চিকেন বিরিয়ানি", price: 350, category: "বিরিয়ানি", description: "সুগন্ধি বাসমতি চালে রান্না করা মুরগির বিরিয়ানি", available: true },
          { id: "2", name: "বটি কাবাব", price: 180, category: "কাবাব", description: "মশলাযুক্ত গরুর মাংসের কাবাব", available: true },
          { id: "3", name: "মটন বিরিয়ানি", price: 450, category: "বিরিয়ানি", description: "খাসির মাংস দিয়ে তৈরি বিরিয়ানি", available: false },
          { id: "4", name: "প্লেইন ভাত", price: 60, category: "ভাত", description: "সাদা ভাত", available: true },
          { id: "5", name: "মাংগো লাচ্ছি", price: 120, category: "পানীয়", description: "তাজা আমের লাচ্ছি", available: true },
          { id: "6", name: "ফিরনি", price: 100, category: "ডেজার্ট", description: "ঐতিহ্যবাহী দুধের ফিরনি", available: true },
          { id: "7", name: "শিক কাবাব", price: 220, category: "কাবাব", description: "কাঠকয়লায় ভাজা শিক কাবাব", available: true },
          { id: "8", name: "বোরহানি", price: 80, category: "পানীয়", description: "ঐতিহ্যবাহী মশলা পানীয়", available: false },
        ];
        setMenuItems(demoItems);
        const cats = ["সব", ...new Set(demoItems.map(i => i.category))];
        setCategories(cats);
        setLoading(false);
        return;
      }

      // Fetch all items (including unavailable) to show stock status
      const [restRes, menuRes] = await Promise.all([
        supabase.from("restaurants").select("*").eq("id", restaurantId).single(),
        supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId).order("sort_order"),
      ]);

      if (restRes.data) setRestaurant(restRes.data);
      if (menuRes.data) {
        setMenuItems(menuRes.data as any);
        const cats = ["সব", ...new Set(menuRes.data.map((i: any) => i.category))];
        setCategories(cats);
      }

      if (tableId) {
        const { data: tableData } = await supabase.from("restaurant_tables").select("name").eq("id", tableId).single();
        if (tableData) setTableName(tableData.name);

        // If table QR scanned but no seat selected, check if seats exist and redirect to seat selection
        if (!seatId) {
          const { data: seatsData } = await supabase.from("table_seats").select("id").eq("table_id", tableId).limit(1);
          if (seatsData && seatsData.length > 0) {
            navigate(`/menu/${restaurantId}/select-seat?table=${tableId}`, { replace: true });
            return;
          }
        }
      }

      if (seatId) {
        const { data: seatData } = await supabase.from("table_seats").select("seat_number").eq("id", seatId).single();
        if (seatData) {
          setSeatNumber(seatData.seat_number);
        }
      }

      setLoading(false);
    };
    fetchData();
  }, [restaurantId, tableId, isDemo]);

  const filtered = menuItems
    .filter(i => activeCategory === "সব" || i.category === activeCategory)
    .filter(i => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description?.toLowerCase().includes(searchQuery.toLowerCase()));

  // Stats
  const totalMenuItems = menuItems.length;
  const inStockCount = menuItems.filter(i => i.available).length;
  const outOfStockCount = menuItems.filter(i => !i.available).length;
  const categoryItemCounts = categories.reduce<Record<string, number>>((acc, cat) => {
    if (cat === "সব") {
      acc[cat] = menuItems.length;
    } else {
      acc[cat] = menuItems.filter(i => i.category === cat).length;
    }
    return acc;
  }, {});

  const addToCart = (item: MenuItem) => {
    if (!item.available) {
      toast.error("এই আইটেমটি এখন পাওয়া যাচ্ছে না");
      return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} যোগ করা হয়েছে`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.id === id) { const nq = c.quantity + delta; return nq > 0 ? { ...c, quantity: nq } : c; }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  const submitOrder = async () => {
    if (isDemo) {
      toast.success("ডেমো অর্ডার পাঠানো হয়েছে!");
      setCart([]);
      setShowCart(false);
      return;
    }

    setSubmitting(true);
    try {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({
          restaurant_id: restaurantId!,
          table_id: tableId || null,
          seat_id: seatId || null,
          total: totalPrice,
          status: "pending",
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      const items = cart.map(c => ({
        order_id: order.id,
        menu_item_id: c.id,
        name: c.name,
        price: c.price,
        quantity: c.quantity,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(items);
      if (itemsErr) throw itemsErr;

      if (seatId) {
        await supabase.from("table_seats").update({ status: "occupied" }).eq("id", seatId);
      }

      toast.success("অর্ডার সফলভাবে পাঠানো হয়েছে!");
      setCart([]);
      setShowCart(false);
    } catch (err: any) {
      toast.error(err.message || "অর্ডার পাঠাতে সমস্যা হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">মেনু লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/20">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card/80 backdrop-blur-2xl border-b border-border/50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-foreground text-lg leading-tight">{restaurant?.name || "Restaurant"}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                টেবিল {tableName}{seatNumber ? ` • সিট ${seatNumber}` : ""} • লাইভ মেনু
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="w-11 h-11 rounded-2xl bg-secondary hover:bg-accent flex items-center justify-center transition-all"
            >
              <Search className="w-5 h-5 text-muted-foreground" />
            </button>
            <button
              onClick={() => setShowCart(true)}
              className="relative w-11 h-11 rounded-2xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95"
            >
              <ShoppingCart className="w-5 h-5 text-primary" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[22px] min-h-[22px] rounded-full gradient-primary text-primary-foreground text-[11px] flex items-center justify-center font-bold shadow-lg shadow-primary/30 animate-bounce">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="max-w-2xl mx-auto px-4 pb-3 animate-fade-in">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="খাবার খুঁজুন..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                autoFocus
              />
            </div>
          </div>
        )}
      </header>

      {/* Stats bar */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary whitespace-nowrap">
            <Package className="w-3.5 h-3.5" />
            মোট {totalMenuItems}টি
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-xs font-semibold text-success whitespace-nowrap">
            <CheckCircle className="w-3.5 h-3.5" />
            স্টকে {inStockCount}টি
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-xs font-semibold text-destructive whitespace-nowrap">
            <XCircle className="w-3.5 h-3.5" />
            স্টক আউট {outOfStockCount}টি
          </div>
        </div>
      </div>

      {/* Categories */}
      <div className="sticky top-[73px] z-10 bg-background/80 backdrop-blur-xl border-b border-border/30">
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => {
            const isAll = cat === "সব";
            const color = isAll ? null : getCategoryColor(cat);
            const isActive = activeCategory === cat;
            const count = categoryItemCounts[cat] || 0;

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300 flex items-center gap-2 ${
                  isActive
                    ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25 scale-105"
                    : isAll
                      ? "bg-card text-muted-foreground hover:text-foreground hover:bg-accent border border-border/50"
                      : `${color!.bg} ${color!.text} border ${color!.border} hover:scale-105`
                }`}
              >
                {cat}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  isActive
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-foreground/5 text-muted-foreground"
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5 pb-32">
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <UtensilsCrossed className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">কোনো আইটেম নেই</p>
          </div>
        )}
        {filtered.map((item, index) => {
          const cartItem = cart.find(c => c.id === item.id);
          const imgUrl = getImageUrl(item.image_url || null);
          const catColor = getCategoryColor(item.category);
          const isOutOfStock = !item.available;

          return (
            <div
              key={item.id}
              className={`group bg-card rounded-2xl border overflow-hidden transition-all duration-500 animate-fade-up ${
                isOutOfStock
                  ? "border-destructive/20 opacity-75"
                  : "border-border/60 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
              }`}
              style={{ animationDelay: `${index * 80}ms` }}
            >
              {/* Image Section */}
              <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-gradient-to-br from-accent via-secondary to-accent">
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={item.name}
                    className={`w-full h-full object-cover transition-transform duration-700 ease-out ${
                      isOutOfStock ? "grayscale" : "group-hover:scale-110"
                    }`}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  </div>
                )}

                {/* Price Badge */}
                <div className={`absolute top-3 right-3 px-3.5 py-1.5 rounded-xl text-sm font-bold shadow-lg backdrop-blur-sm ${
                  isOutOfStock
                    ? "bg-muted text-muted-foreground"
                    : "gradient-primary text-primary-foreground shadow-primary/30"
                }`}>
                  ৳{item.price}
                </div>

                {/* Category Badge - Colorful */}
                <div className={`absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-semibold border backdrop-blur-md ${catColor.bg} ${catColor.text} ${catColor.border}`}>
                  {item.category}
                </div>

                {/* Stock Status Badge */}
                <div className={`absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 backdrop-blur-md ${
                  isOutOfStock
                    ? "bg-destructive/90 text-destructive-foreground"
                    : "bg-success/90 text-success-foreground"
                }`}>
                  {isOutOfStock ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                  {isOutOfStock ? "স্টক আউট" : "ইন স্টক"}
                </div>

                {/* Out of stock overlay */}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px] flex items-center justify-center">
                    <span className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm shadow-lg">
                      বর্তমানে পাওয়া যাচ্ছে না
                    </span>
                  </div>
                )}

                {/* Gradient overlay at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent" />
              </div>

              {/* Content Section */}
              <div className="px-4 pb-4 -mt-4 relative z-10">
                <h3 className="font-display font-bold text-foreground text-lg leading-snug">{item.name}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{item.description}</p>

                {/* Add to Cart */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground/60">
                    <Flame className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">জনপ্রিয়</span>
                  </div>
                  {isOutOfStock ? (
                    <span className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed">
                      অপ্রাপ্য
                    </span>
                  ) : cartItem ? (
                    <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-9 h-9 rounded-lg bg-card hover:bg-accent flex items-center justify-center transition-colors border border-border/50 active:scale-90"
                      >
                        <Minus className="w-4 h-4 text-foreground" />
                      </button>
                      <span className="text-sm font-bold text-foreground w-8 text-center">{cartItem.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-md shadow-primary/20 active:scale-90 transition-transform"
                      >
                        <Plus className="w-4 h-4 text-primary-foreground" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addToCart(item)}
                      className="px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 active:scale-95 hover:scale-105"
                    >
                      <Plus className="w-4 h-4" /> যোগ করুন
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Cart Button */}
      {totalItems > 0 && !showCart && (
        <div className="fixed bottom-6 left-4 right-4 max-w-2xl mx-auto z-30 animate-fade-up">
          <button
            onClick={() => setShowCart(true)}
            className="w-full gradient-primary text-primary-foreground rounded-2xl p-4 flex items-center justify-between shadow-2xl shadow-primary/30 hover:shadow-primary/40 transition-all duration-300 active:scale-[0.98]"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="font-bold text-base">{totalItems} আইটেম</span>
                <p className="text-xs text-primary-foreground/70">কার্ট দেখুন</p>
              </div>
            </div>
            <span className="font-bold text-xl">৳{totalPrice}</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-md" onClick={() => setShowCart(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            style={{ animation: "slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)" }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="p-6 pt-3">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display font-bold text-xl text-foreground">আপনার কার্ট</h2>
                  <p className="text-sm text-muted-foreground">{totalItems} আইটেম • টেবিল {tableName}</p>
                </div>
                <button
                  onClick={() => setShowCart(false)}
                  className="w-9 h-9 rounded-xl bg-secondary hover:bg-accent flex items-center justify-center transition-colors"
                >
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium">কার্ট খালি</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-6">
                    {cart.map((item) => {
                      const catColor = getCategoryColor(item.category);
                      return (
                        <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border ${catColor.border}`}>
                          <div className="w-14 h-14 rounded-xl bg-accent overflow-hidden flex-shrink-0">
                            {item.image_url ? (
                              <img src={getImageUrl(item.image_url)!} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <ImageIcon className="w-5 h-5 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{item.name}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${catColor.bg} ${catColor.text}`}>{item.category}</span>
                              <span className="text-sm text-muted-foreground">৳{item.price} × {item.quantity}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="font-bold text-foreground text-sm">৳{item.price * item.quantity}</span>
                            <button onClick={() => removeFromCart(item.id)} className="w-7 h-7 rounded-lg bg-destructive/10 hover:bg-destructive/20 flex items-center justify-center transition-colors">
                              <X className="w-3.5 h-3.5 text-destructive" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-border pt-4 mb-6 space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>সাবটোটাল</span>
                      <span>৳{totalPrice}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-foreground">
                      <span>মোট</span>
                      <span className="text-gradient">৳{totalPrice}</span>
                    </div>
                  </div>
                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full h-14 text-base rounded-2xl shadow-lg shadow-primary/20"
                    onClick={submitOrder}
                    disabled={submitting}
                  >
                    <Send className="w-5 h-5" />
                    {submitting ? "পাঠানো হচ্ছে..." : "অর্ডার পাঠান"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CustomerMenu;