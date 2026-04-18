import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Minus, UtensilsCrossed, X, Send, Image as ImageIcon, Flame, CheckCircle, XCircle, Package, Search, QrCode, Lock, ClipboardList, ChefHat, Bell, Bike, MessageSquare, Phone, Receipt, Clock, ArrowLeft, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMenuSession } from "@/hooks/useMenuSession";
import { useMenuOrders, isNotificationOrder, type OrderItem } from "@/hooks/useMenuOrders";
import { useAIRecommendations } from "@/hooks/useAIRecommendations";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const getImageUrl = (path: string | null) => {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/menu-images/${path}`;
};

const MAX_ITEM_QTY = 10;

interface MenuItem {
  id: string;
  name: string;
  price: number;
  category: string;
  description: string;
  available: boolean;
  image_url?: string | null;
  stock_quantity?: number | null;
}

interface CartItem extends MenuItem {
  quantity: number;
}

// Color palette assigned per category — stable index assignment via useMemo
const colorPalette = [
  { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30", dot: "bg-primary" },
  { bg: "bg-info/10", text: "text-info", border: "border-info/30", dot: "bg-info" },
  { bg: "bg-success/10", text: "text-success", border: "border-success/30", dot: "bg-success" },
  { bg: "bg-rose/10", text: "text-rose", border: "border-rose/30", dot: "bg-rose" },
  { bg: "bg-amber/10", text: "text-amber", border: "border-amber/30", dot: "bg-amber" },
  { bg: "bg-accent", text: "text-accent-foreground", border: "border-accent-foreground/20", dot: "bg-accent-foreground" },
];

const CustomerMenu = () => {
  const { restaurantId } = useParams();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get("table");
  const seatId  = searchParams.get("seat");
  const tokenParam = searchParams.get("token");
  const isDemo = !restaurantId;

  // ── Menu data ──────────────────────────────────────────────────────────────
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [categories, setCategories] = useState<string[]>(["সব"]);
  const [activeCategory, setActiveCategory] = useState("সব");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  // ── Cart ───────────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [specialNote, setSpecialNote] = useState("");

  // ── Confirmation ───────────────────────────────────────────────────────────
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrderTotal, setLastOrderTotal] = useState(0);
  const [lastOrderItems, setLastOrderItems] = useState<CartItem[]>([]);

  // ── Order status drawer ────────────────────────────────────────────────────
  const [showOrderStatus, setShowOrderStatus] = useState(false);
  const [orderStatusTab, setOrderStatusTab] = useState<"active" | "history">("active");

  // ── Header height (for dynamic sticky category bar) ───────────────────────
  const headerRef = useRef<HTMLElement>(null);
  const [headerH, setHeaderH] = useState(73);

  // ── Cart textarea ref (keyboard scroll fix) ────────────────────────────────
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Waiter/Bill cooldown ───────────────────────────────────────────────────
  const [waiterCooldown, setWaiterCooldown] = useState(false);
  const [billCooldown, setBillCooldown] = useState(false);

  // ── General feedback modal ─────────────────────────────────────────────────
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);

  // ── AI Recommendations ────────────────────────────────────────────────
  const {
    recommendations: aiRecommendations,
    explanations: aiExplanations,
    loading: aiLoading,
    trackClick: trackAIClick
  } = useAIRecommendations({
    restaurantId: restaurantId || 'demo',
    menuItems,
    strategy: 'balanced'
  });

  // ── Sanitize user text input ──────────────────────────────────────────────
  const sanitize = (text: string, maxLen = 500): string =>
    text
      .trim()
      .replace(/<[^>]*>/g, "")
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
      .slice(0, maxLen);

  // ── Item ratings from reviews table (with realtime) ───────────────────────
  const [itemRatings, setItemRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [rawReviews, setRawReviews] = useState<{ menu_item_id: string; rating: number }[]>([]);

  const buildRatings = useCallback((reviews: { menu_item_id: string; rating: number }[]) => {
    const map: Record<string, number[]> = {};
    reviews.forEach(r => {
      if (!map[r.menu_item_id]) map[r.menu_item_id] = [];
      map[r.menu_item_id].push(r.rating);
    });
    const result: Record<string, { avg: number; count: number }> = {};
    Object.entries(map).forEach(([id, ratings]) => {
      result[id] = {
        avg: Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10,
        count: ratings.length,
      };
    });
    setItemRatings(result);
  }, []);

  useEffect(() => {
    if (!restaurantId || isDemo) return;
    supabase
      .from("reviews")
      .select("menu_item_id, rating")
      .eq("restaurant_id", restaurantId)
      .not("menu_item_id", "is", null)
      .then(({ data }) => {
        if (!data) return;
        setRawReviews(data);
        buildRatings(data);
      });
  }, [restaurantId, isDemo, buildRatings]);

  // Realtime reviews subscription
  useEffect(() => {
    if (!restaurantId || isDemo) return;
    const channel = supabase
      .channel(`reviews-realtime-${restaurantId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "reviews",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        const newReview = payload.new as { menu_item_id: string; rating: number };
        if (!newReview.menu_item_id) return;
        setRawReviews(prev => {
          const updated = [...prev, newReview];
          buildRatings(updated);
          return updated;
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, isDemo, buildRatings]);

  // ── Quick inline rating (only for items this customer has ordered) ──────────
  const [quickRatingItem, setQuickRatingItem] = useState<MenuItem | null>(null);
  const [quickRatingValue, setQuickRatingValue] = useState(0);
  const [quickRatingSubmitting, setQuickRatingSubmitting] = useState(false);
  const [ratedItemIds, setRatedItemIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`rated_items_${restaurantId || "demo"}`);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch { return new Set(); }
  });

  const submitQuickRating = async (star: number) => {
    if (!quickRatingItem || !restaurantId || star < 1) return;
    setQuickRatingSubmitting(true);
    const { error } = await supabase.from("reviews").insert({
      menu_item_id: quickRatingItem.id,
      restaurant_id: restaurantId,
      rating: star,
      comment: null,
    } as any);
    setQuickRatingSubmitting(false);
    if (!error) {
      const newRated = new Set(ratedItemIds).add(quickRatingItem.id);
      setRatedItemIds(newRated);
      try { localStorage.setItem(`rated_items_${restaurantId}`, JSON.stringify([...newRated])); } catch { /* private */ }
      toast("🙏 ধন্যবাদ! রেটিং দেওয়ার জন্য।", { duration: 3000 });
      setQuickRatingItem(null);
      setQuickRatingValue(0);
    } else {
      toast.error("রেটিং দেওয়া যায়নি, আবার চেষ্টা করুন।");
    }
  };

  // ── Per-item rating (post-order modal) ────────────────────────────────────
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [ratingItems, setRatingItems] = useState<OrderItem[]>([]);
  const [perItemRatings, setPerItemRatings] = useState<Record<string, number>>({});
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  // ── Session / token (extracted hook) ──────────────────────────────────────
  const {
    tableName, tableIsOpen, seatNumber,
    tokenValid, tokenChecking, tableChecked, sessionToken, sessionStartedAt,
  } = useMenuSession({ restaurantId, tableId, seatId, tokenParam, isDemo });

  // ── Orders / realtime (extracted hook) ────────────────────────────────────
  const onRatingRequest = useCallback((orderId: string, items: OrderItem[]) => {
    setRatingOrderId(orderId);
    setRatingItems(items.filter(i => i.menu_item_id));
    setPerItemRatings({});
    setRatingComment("");
  }, []);

  const {
    myOrders, orderHistory, ordersLoading, activeOrdersCount,
    refreshOrders, submitOrder, callWaiter, requestBill,
  } = useMenuOrders({
    restaurantId, tableId, seatId, sessionToken, sessionStartedAt,
    isDemo, tokenValid, tableChecked,
    onRatingRequest,
  });

  // ── Set of menu_item_ids this customer has already ordered this session ──
  const orderedMenuItemIds = useMemo(() => {
    const ids = new Set<string>();
    [...myOrders, ...orderHistory].forEach(order =>
      order.items.forEach(item => { if (item.menu_item_id) ids.add(item.menu_item_id); })
    );
    return ids;
  }, [myOrders, orderHistory]);

  // ── Branding (custom colors/logo from DB — High Smart only) ───────────
  const isHighSmart    = restaurant?.tier === 'high_smart';
  const brandPrimary   = isHighSmart ? (restaurant?.brand_primary   || null) : null;
  const brandSecondary = isHighSmart ? (restaurant?.brand_secondary || null) : null;
  const brandFont      = isHighSmart ? (restaurant?.brand_font      || 'default') : 'default';
  const brandLogo      = isHighSmart ? (restaurant?.logo_url        || null) : null;

  const fontStyle = brandFont === 'serif'   ? { fontFamily: 'Georgia, serif' }
                  : brandFont === 'mono'    ? { fontFamily: 'monospace' }
                  : brandFont === 'rounded' ? { fontFamily: 'system-ui, sans-serif', fontWeight: 700 }
                  : {};

  // ── Category colors: computed once from categories list (no render-time setState) ──
  const categoryColors = useMemo<Record<string, typeof colorPalette[number]>>(() => {
    const map: Record<string, typeof colorPalette[number]> = {};
    categories
      .filter(c => c !== "সব")
      .forEach((cat, i) => {
        map[cat] = colorPalette[i % colorPalette.length];
      });
    return map;
  }, [categories]);

  const getCategoryColor = (cat: string) =>
    categoryColors[cat] ?? colorPalette[0];

  // ── Track header height for dynamic sticky category bar ───────────────────
  useEffect(() => {
    if (!headerRef.current) return;
    const obs = new ResizeObserver(() => setHeaderH(headerRef.current?.offsetHeight || 73));
    obs.observe(headerRef.current);
    return () => obs.disconnect();
  }, []);

  // ── Fetch menu data ────────────────────────────────────────────────────────
  const fetchMenuData = useCallback(async () => {
    if (isDemo) {
      setRestaurant({ name: "Spice Garden" });
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
      setCategories(["সব", ...new Set(demoItems.map(i => i.category))]);
      setLoading(false);
      return;
    }

    const [restRes, menuRes] = await Promise.all([
      supabase.from("restaurants").select("*").eq("id", restaurantId!).maybeSingle(),
      supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId!).order("sort_order"),
    ]);

    if (restRes.data) setRestaurant(restRes.data);
    if (menuRes.data) {
      setMenuItems(menuRes.data as any);
      setCategories(["সব", ...new Set(menuRes.data.map((i: any) => i.category))]);
    }
    setLoading(false);
  }, [restaurantId, isDemo]);

  useEffect(() => {
    fetchMenuData();
  }, [fetchMenuData]);

  // ── Auto-refresh: re-fetch on tab focus + 60s interval fallback ────────────
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchMenuData();
        refreshOrders();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchMenuData();
        refreshOrders();
      }
    }, 60000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, [fetchMenuData, refreshOrders]);

  // ── Realtime menu updates (availability, price, stock changes) ─────────────
  // NOTE: fetchMenuData is intentionally NOT in this dependency array.
  // Putting it there would cause the channel to tear down and re-subscribe every
  // time fetchMenuData's identity changes (which happens on every restaurantId
  // change), creating duplicate WebSocket connections under high traffic.
  // INSERT events are handled inline by merging the payload directly into state
  // rather than triggering a full re-fetch.
  useEffect(() => {
    if (isDemo || !restaurantId) return;

    const channel = supabase
      .channel(`menu-realtime-${restaurantId}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "menu_items",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        const updated = payload.new as MenuItem;
        setMenuItems(prev =>
          prev.map(item => item.id === updated.id ? { ...item, ...updated } : item)
        );
        // Notify if item just became unavailable
        if (!updated.available) {
          toast(`"${updated.name}" এখন পাওয়া যাচ্ছে না`, { duration: 4000 });
        }
      })
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "menu_items",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        // Merge the new item directly into state — no fetchMenuData() call here.
        // Calling fetchMenuData() from inside a realtime handler would re-create
        // the callback identity, triggering a channel re-subscribe loop.
        const inserted = payload.new as MenuItem;
        setMenuItems(prev => {
          if (prev.find(item => item.id === inserted.id)) return prev; // idempotent guard
          return [...prev, inserted];
        });
        setCategories(prev => {
          if (!inserted.category || prev.includes(inserted.category)) return prev;
          return [...prev, inserted.category];
        });
      })
      .on("postgres_changes", {
        event: "DELETE", schema: "public", table: "menu_items",
        filter: `restaurant_id=eq.${restaurantId}`,
      }, (payload) => {
        setMenuItems(prev => prev.filter(item => item.id !== (payload.old as any).id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId, isDemo]); // ← fetchMenuData deliberately excluded: see note above

  // ── Cart helpers ───────────────────────────────────────────────────────────
  const addToCart = (item: MenuItem) => {
    if (!item.available) { toast.error("এই আইটেমটি এখন পাওয়া যাচ্ছে না"); return; }
    if (item.stock_quantity !== null && item.stock_quantity !== undefined && item.stock_quantity <= 0) {
      toast.error("এই আইটেমের স্টক শেষ হয়ে গেছে"); return;
    }
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      const maxQty = item.stock_quantity !== null && item.stock_quantity !== undefined
        ? Math.min(MAX_ITEM_QTY, item.stock_quantity)
        : MAX_ITEM_QTY;
      if (existing) {
        if (existing.quantity >= maxQty) {
          toast.error(item.stock_quantity !== null && item.stock_quantity !== undefined
            ? `স্টকে মাত্র ${item.stock_quantity}টি আছে`
            : `সর্বোচ্চ ${MAX_ITEM_QTY}টি যোগ করা যায়`);
          return prev;
        }
        return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} যোগ করা হয়েছে`);
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.id !== id) return c;
      const newQty = c.quantity + delta;
      const maxQty = c.stock_quantity !== null && c.stock_quantity !== undefined
        ? Math.min(MAX_ITEM_QTY, c.stock_quantity)
        : MAX_ITEM_QTY;
      if (newQty > maxQty) {
        toast.error(c.stock_quantity !== null && c.stock_quantity !== undefined
          ? `স্টকে মাত্র ${c.stock_quantity}টি আছে`
          : `সর্বোচ্চ ${MAX_ITEM_QTY}টি যোগ করা যায়`);
        return c;
      }
      return { ...c, quantity: newQty };
    }).filter(c => c.quantity > 0));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  // ── Derived menu state ─────────────────────────────────────────────────────
  const filtered = menuItems
    .filter(i => activeCategory === "সব" || i.category === activeCategory)
    .filter(i => !searchQuery || i.name.toLowerCase().includes(searchQuery.toLowerCase()) || i.description?.toLowerCase().includes(searchQuery.toLowerCase()));

  const totalMenuItems = menuItems.length;
  const inStockCount = menuItems.filter(i => i.available).length;
  const outOfStockCount = menuItems.filter(i => !i.available).length;
  const categoryItemCounts = categories.reduce<Record<string, number>>((acc, cat) => {
    acc[cat] = cat === "সব" ? menuItems.length : menuItems.filter(i => i.category === cat).length;
    return acc;
  }, {});

  // ── Order submit ───────────────────────────────────────────────────────────
  const handleSubmitOrder = async () => {
    if (isDemo) {
      setLastOrderId("DEMO-001");
      setLastOrderTotal(totalPrice);
      setLastOrderItems([...cart]);
      setShowCart(false);
      setShowConfirmation(true);
      setCart([]);
      setSpecialNote("");
      return;
    }
    if (!tableIsOpen) { toast.error("এই টেবিলটি এখন বন্ধ আছে"); return; }
    if (!sessionToken) { toast.error("সেশন টোকেন নেই। QR কোড স্ক্যান করুন।"); return; }
    if (cart.length === 0) { toast.error("কার্ট খালি"); return; }

    const cleanNote = sanitize(specialNote, 200);

    setSubmitting(true);
    try {
      const result = await submitOrder({
        restaurantId: restaurantId!,
        tableId, seatId, sessionToken,
        cart: cart.map(c => ({ id: c.id, quantity: c.quantity, name: c.name, price: c.price })),
        specialNote: cleanNote,
      });
      if (!result) return;
      setLastOrderId(result.orderId.slice(0, 8).toUpperCase());
      setLastOrderTotal(result.confirmedTotal);
      setLastOrderItems([...cart]);
      setShowCart(false);
      setShowConfirmation(true);
      setCart([]);
      setSpecialNote("");
    } catch (err: any) {
      toast.error(err.message || "অর্ডার পাঠাতে সমস্যা হয়েছে");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallWaiter = async () => {
    if (waiterCooldown) return;
    if (isDemo) { toast.success("🔔 ওয়েটারকে ডাকা হয়েছে! (ডেমো)"); setWaiterCooldown(true); setTimeout(() => setWaiterCooldown(false), 3000); return; }
    if (!sessionToken) { toast.error("সেশন টোকেন নেই। QR কোড স্ক্যান করুন।"); return; }
    try {
      await callWaiter({ restaurantId: restaurantId!, tableId, seatId, sessionToken, tableName, seatNumber });
      toast.success("🔔 ওয়েটারকে ডাকা হয়েছে! একটু অপেক্ষা করুন।");
      setWaiterCooldown(true);
      setTimeout(() => setWaiterCooldown(false), 3000);
    } catch {
      toast.error("ওয়েটার ডাকতে সমস্যা হয়েছে");
    }
  };

  const handleRequestBill = async () => {
    if (billCooldown) return;
    if (isDemo) { toast.success("🧾 বিলের জন্য অনুরোধ পাঠানো হয়েছে! (ডেমো)"); setBillCooldown(true); setTimeout(() => setBillCooldown(false), 3000); return; }
    if (!sessionToken) { toast.error("সেশন টোকেন নেই। QR কোড স্ক্যান করুন।"); return; }
    try {
      await requestBill({ restaurantId: restaurantId!, tableId, seatId, sessionToken, tableName, seatNumber });
      toast.success("🧾 বিলের জন্য অনুরোধ পাঠানো হয়েছে!");
      setBillCooldown(true);
      setTimeout(() => setBillCooldown(false), 3000);
    } catch {
      toast.error("বিল অনুরোধ পাঠাতে সমস্যা হয়েছে");
    }
  };

  // ── Early returns (gates) ──────────────────────────────────────────────────
  if (loading || tokenChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground font-medium animate-pulse">মেনু লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  if (!isDemo && tableId && !tableIsOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-xs">
          <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="font-display font-bold text-2xl text-foreground mb-3">টেবিল বন্ধ আছে</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">এই টেবিলটি এখন অর্ডারের জন্য খোলা নেই।<br />ওয়েটারকে জানান অথবা একটু অপেক্ষা করুন।</p>
        </div>
      </div>
    );
  }

  if (!isDemo && tableId && tableChecked && !tokenValid && tableIsOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-xs">
          <div className="w-20 h-20 rounded-3xl bg-warning/10 flex items-center justify-center mx-auto mb-6">
            <QrCode className="w-10 h-10 text-warning" />
          </div>
          <h2 className="font-display font-bold text-2xl text-foreground mb-3">সেশন মেয়াদ শেষ</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">আপনার অর্ডার সেশনের সময় শেষ হয়ে গেছে।<br />অর্ডার করতে টেবিলের QR কোড আবার স্ক্যান করুন।</p>
          <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20">
            <QrCode className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary">QR কোড স্ক্যান করুন</span>
          </div>
        </div>
      </div>
    );
  }

  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-success/10 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center animate-fade-up">
          <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6 relative">
            <CheckCircle className="w-12 h-12 text-success" />
            <div className="absolute inset-0 rounded-full border-2 border-success/30 animate-ping" />
          </div>
          <h2 className="font-display font-bold text-2xl text-foreground mb-2">অর্ডার সফল! 🎉</h2>
          <p className="text-muted-foreground text-sm mb-6">আপনার অর্ডার রান্নাঘরে পাঠানো হয়েছে</p>
          <div className="bg-card rounded-2xl border border-border/60 p-5 mb-6 text-left">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs text-muted-foreground">অর্ডার নম্বর</p>
                <p className="font-display font-bold text-lg text-foreground">#{lastOrderId}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">মোট</p>
                <p className="font-bold text-lg text-primary">৳{lastOrderTotal}</p>
              </div>
            </div>
            <div className="border-t border-border/30 pt-3 mb-3">
              <p className="text-xs text-muted-foreground mb-2">আইটেম সমূহ:</p>
              <div className="space-y-1.5">
                {lastOrderItems.map(item => (
                  <div key={item.id} className="flex justify-between text-sm">
                    <span className="text-foreground">{item.name} ×{item.quantity}</span>
                    <span className="text-muted-foreground">৳{item.price * item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-warning/10 border border-warning/20">
              <Clock className="w-5 h-5 text-warning flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">আনুমানিক ২০-৩০ মিনিট</p>
                <p className="text-xs text-muted-foreground">আপনার খাবার তৈরি হচ্ছে</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <Button variant="hero" size="lg" className="w-full h-12 rounded-2xl"
              onClick={() => { setShowConfirmation(false); setShowOrderStatus(true); }}>
              <ClipboardList className="w-5 h-5" /> অর্ডার ট্র্যাক করুন
            </Button>
            <Button variant="outline" size="lg" className="w-full h-12 rounded-2xl"
              onClick={() => setShowConfirmation(false)}>
              <ArrowLeft className="w-5 h-5" /> মেনুতে ফিরুন
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main menu UI ───────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-accent/20">
      {/* Header */}
      <header ref={headerRef} className="sticky top-0 z-20 bg-card/80 backdrop-blur-2xl border-b border-border/50 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0 ${!brandPrimary ? 'gradient-primary shadow-primary/20' : ''}`}
              style={brandPrimary
                ? { background: `linear-gradient(135deg, ${brandPrimary}, ${brandSecondary || brandPrimary})`, boxShadow: `0 4px 14px ${brandPrimary}40` }
                : undefined}>
              {brandLogo
                ? <img src={brandLogo} alt="logo" className="w-full h-full object-contain p-1" />
                : <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />}
            </div>
            <div>
              <h1 className="font-bold text-foreground text-lg leading-tight" style={fontStyle}>{restaurant?.name || "Restaurant"}</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                টেবিল {tableName}{seatNumber ? ` • সিট ${seatNumber}` : ""} • লাইভ মেনু
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowSearch(!showSearch)} className="w-11 h-11 rounded-2xl bg-secondary hover:bg-accent flex items-center justify-center transition-all">
              <Search className="w-5 h-5 text-muted-foreground" />
            </button>
            <button onClick={() => setShowOrderStatus(true)} className="relative w-11 h-11 rounded-2xl bg-warning/10 hover:bg-warning/20 flex items-center justify-center transition-all">
              <ClipboardList className="w-5 h-5 text-warning" />
              {activeOrdersCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-warning text-warning-foreground text-[10px] flex items-center justify-center font-bold animate-pulse">
                  {activeOrdersCount}
                </span>
              )}
            </button>
            <button onClick={() => setShowCart(true)} className="relative w-11 h-11 rounded-2xl bg-primary/10 hover:bg-primary/20 flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95">
              <ShoppingCart className="w-5 h-5 text-primary" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[22px] min-h-[22px] rounded-full gradient-primary text-primary-foreground text-[11px] flex items-center justify-center font-bold shadow-lg shadow-primary/30 animate-bounce">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>
        {showSearch && (
          <div className="max-w-2xl mx-auto px-4 pb-3 animate-fade-in">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type="text" placeholder="খাবার খুঁজুন..." value={searchQuery} onChange={e => setSearchQuery(e.target.value.slice(0, 100))} maxLength={100}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" autoFocus />
            </div>
          </div>
        )}
      </header>

      {/* AI Recommendations Section */}
      {aiRecommendations.length > 0 && (
        <div className="max-w-2xl mx-auto px-4 pt-4">
          <div className="bg-primary/5 rounded-2xl border border-primary/20 p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Flame className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm">🤖 AI Recommended for You</h3>
                  <p className="text-xs text-muted-foreground">আপনার পছন্দ অনুযায়ী বাছাই করা</p>
                </div>
              </div>
            </div>
            <div className="flex gap-3 overflow-x-auto scrollbar-hide">
              {aiRecommendations.slice(0, 4).map((item) => {
                const explanation = aiExplanations[item.id] || '⭐ জনপ্রিয়';
                const cartItem = cart.find(c => c.id === item.id);
                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      trackAIClick(item.id);
                      if (item.available && !cartItem) addToCart(item);
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { trackAIClick(item.id); if (item.available && !cartItem) addToCart(item); } }}
                    className="flex-shrink-0 w-36 bg-card/50 backdrop-blur-sm rounded-xl border border-border/30 overflow-hidden cursor-pointer hover:shadow-lg transition-all hover:-translate-y-1"
                  >
                    <div className="h-24 relative overflow-hidden bg-gradient-to-br from-accent to-secondary">
                      {getImageUrl(item.image_url || null) ? (
                        <img
                          src={getImageUrl(item.image_url || null)!}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                        </div>
                      )}
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-xs font-bold">
                        ৳{item.price}
                      </div>
                      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-bold max-w-[80px] truncate">
                        {explanation}
                      </div>
                    </div>
                    <div className="p-2">
                      <p className="font-semibold text-xs text-foreground truncate">{item.name}</p>
                      {cartItem ? (
                        <span className="text-[10px] text-success font-medium">✓ Added</span>
                      ) : (
                        <span className="text-[10px] text-primary font-medium">+ Add</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary whitespace-nowrap">
            <Package className="w-3.5 h-3.5" /> মোট {totalMenuItems}টি
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-xs font-semibold text-success whitespace-nowrap">
            <CheckCircle className="w-3.5 h-3.5" /> স্টকে {inStockCount}টি
          </div>
          {outOfStockCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-xs font-semibold text-destructive whitespace-nowrap">
              <XCircle className="w-3.5 h-3.5" /> স্টক আউট {outOfStockCount}টি
            </div>
          )}
        </div>
      </div>

      {/* Categories */}
      <div className="sticky z-10 bg-background/80 backdrop-blur-xl border-b border-border/30" style={{ top: headerH }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => {
            const isAll = cat === "সব";
            const color = isAll ? null : getCategoryColor(cat);
            const isActive = activeCategory === cat;
            return (
              <button key={cat} onClick={() => { setActiveCategory(cat); setSearchQuery(""); }}
                className={`px-4 py-2.5 rounded-full text-sm font-semibold whitespace-nowrap transition-all duration-300 flex items-center gap-2 ${
                  isActive ? "gradient-primary text-primary-foreground shadow-md shadow-primary/25 scale-105"
                  : isAll ? "bg-card text-muted-foreground hover:text-foreground hover:bg-accent border border-border/50"
                  : `${color!.bg} ${color!.text} border ${color!.border} hover:scale-105`
                }`}>
                {cat}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-foreground/5 text-muted-foreground"}`}>
                  {categoryItemCounts[cat] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Menu Items */}
      <div className={`max-w-2xl mx-auto px-4 py-6 space-y-5 ${totalItems > 0 ? 'pb-52' : 'pb-28'}`}>
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
          const isOutOfStock = !item.available || (item.stock_quantity !== null && item.stock_quantity !== undefined && item.stock_quantity <= 0);
          return (
            <div key={item.id}
              className={`group bg-card rounded-2xl border overflow-hidden transition-all duration-500 animate-fade-up ${
                isOutOfStock ? "border-destructive/20 opacity-75 cursor-not-allowed" : "border-border/60 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 cursor-pointer"
              }`}
              style={{ animationDelay: `${Math.min(index * 80, 400)}ms` }}>
              <div className="relative h-44 sm:h-52 w-full overflow-hidden bg-gradient-to-br from-accent via-secondary to-accent">
                {imgUrl ? (
                  <img src={imgUrl} alt={item.name} className={`w-full h-full object-cover transition-transform duration-700 ease-out ${isOutOfStock ? "grayscale" : "group-hover:scale-110"}`} />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                    </div>
                  </div>
                )}
                <div className={`absolute top-3 right-3 px-3.5 py-1.5 rounded-xl text-sm font-bold shadow-lg backdrop-blur-sm ${isOutOfStock ? "bg-muted text-muted-foreground" : "gradient-primary text-primary-foreground shadow-primary/30"}`}>
                  ৳{item.price}
                </div>
                <div className={`absolute top-3 left-3 px-3 py-1 rounded-lg text-xs font-semibold border backdrop-blur-md ${catColor.bg} ${catColor.text} ${catColor.border}`}>
                  {item.category}
                </div>
                <div className={`absolute bottom-3 left-3 px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 backdrop-blur-md ${isOutOfStock ? "bg-destructive/90 text-destructive-foreground" : "bg-success/90 text-success-foreground"}`}>
                  {isOutOfStock ? <XCircle className="w-3 h-3" /> : <CheckCircle className="w-3 h-3" />}
                  {isOutOfStock ? "স্টক আউট" : "ইন স্টক"}
                </div>
                {/* Show remaining stock count if tracked and not out of stock */}
                {!isOutOfStock && item.stock_quantity !== null && item.stock_quantity !== undefined && (
                  <div className={`absolute bottom-3 right-3 px-2.5 py-1 rounded-lg text-[11px] font-bold backdrop-blur-md ${
                    item.stock_quantity <= 5
                      ? "bg-warning/90 text-warning-foreground"
                      : "bg-background/80 text-foreground"
                  }`}>
                    {item.stock_quantity <= 5 ? `⚠ মাত্র ${item.stock_quantity}টি বাকি` : `${item.stock_quantity}টি আছে`}
                  </div>
                )}
                {isOutOfStock && (
                  <div className="absolute inset-0 bg-foreground/20 backdrop-blur-[1px] flex items-center justify-center">
                    <span className="px-4 py-2 rounded-xl bg-destructive text-destructive-foreground font-bold text-sm shadow-lg">বর্তমানে পাওয়া যাচ্ছে না</span>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-card to-transparent" />
              </div>
              <div className="px-4 pb-4 -mt-4 relative z-10">
                <h3 className="font-display font-bold text-foreground text-lg leading-snug">{item.name}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">{item.description}</p>

                {/* ── Customer ratings row ── */}
                {(() => {
                  const hasOrdered = orderedMenuItemIds.has(item.id);
                  const alreadyRated = ratedItemIds.has(item.id);
                  const rating = itemRatings[item.id];

                  const starsDisplay = (
                    <div className="flex items-center gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} className={`w-4 h-4 ${rating && s <= Math.round(rating.avg) ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted-foreground/20"}`} />
                      ))}
                    </div>
                  );

                  if (hasOrdered && !alreadyRated) {
                    // Customer ordered this item and hasn't rated yet — tappable
                    return (
                      <button
                        onClick={e => { e.stopPropagation(); setQuickRatingItem(item); setQuickRatingValue(0); }}
                        className="mt-2.5 w-full flex items-center gap-2 py-1.5 px-2 rounded-xl bg-yellow-50 dark:bg-yellow-400/10 border border-yellow-200 dark:border-yellow-400/20 active:scale-95 transition-all"
                      >
                        {starsDisplay}
                        {rating ? (
                          <>
                            <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{rating.avg}</span>
                            <span className="text-xs text-muted-foreground">({rating.count} জন)</span>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">এখনো রেটিং নেই</span>
                        )}
                        <span className="text-[10px] font-semibold text-primary ml-auto">⭐ রেটিং দিন</span>
                      </button>
                    );
                  }

                  if (hasOrdered && alreadyRated) {
                    // Already rated — show with checkmark
                    return (
                      <div className="mt-2.5 flex items-center gap-2 py-1.5 px-2 rounded-xl bg-success/10 border border-success/20">
                        {starsDisplay}
                        {rating && <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{rating.avg}</span>}
                        {rating && <span className="text-xs text-muted-foreground">({rating.count} জন)</span>}
                        <span className="text-[10px] font-semibold text-success ml-auto">✓ রেটিং দেওয়া হয়েছে</span>
                      </div>
                    );
                  }

                  // Read-only — show rating for others to see, no tap
                  return (
                    <div className="mt-2.5 flex items-center gap-2 py-1 px-2">
                      {starsDisplay}
                      {rating ? (
                        <>
                          <span className="text-sm font-bold text-yellow-600 dark:text-yellow-400">{rating.avg}</span>
                          <span className="text-xs text-muted-foreground">({rating.count} জন রেটিং দিয়েছেন)</span>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">এখনো রেটিং নেই</span>
                      )}
                    </div>
                  );
                })()}

                <div className="mt-3 flex items-center justify-end">
                  {isOutOfStock ? (
                    <span className="px-4 py-2 rounded-xl bg-muted text-muted-foreground text-sm font-medium cursor-not-allowed">অপ্রাপ্য</span>
                  ) : cartItem ? (
                    <div className="flex items-center gap-1 bg-secondary rounded-xl p-1">
                      <button onClick={() => updateQuantity(item.id, -1)} className="w-9 h-9 rounded-lg bg-card hover:bg-accent flex items-center justify-center transition-colors border border-border/50 active:scale-90">
                        <Minus className="w-4 h-4 text-foreground" />
                      </button>
                      <span className="text-sm font-bold text-foreground w-8 text-center">{cartItem.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center shadow-md shadow-primary/20 active:scale-90 transition-transform">
                        <Plus className="w-4 h-4 text-primary-foreground" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item)}
                      className="px-5 py-2.5 rounded-xl gradient-primary text-primary-foreground text-sm font-semibold flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 active:scale-95 hover:scale-105">
                      <Plus className="w-4 h-4" /> যোগ করুন
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating cart button — sits above the bottom nav */}
      {totalItems > 0 && !showCart && (
        <div className="fixed bottom-[72px] left-4 right-4 max-w-2xl mx-auto z-30 animate-fade-up">
          <button onClick={() => setShowCart(true)}
            className="w-full gradient-primary text-primary-foreground rounded-2xl p-4 flex items-center justify-between shadow-2xl shadow-primary/30 hover:shadow-primary/40 transition-all duration-300 active:scale-[0.98]">
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

      {/* Bottom navigation bar */}
      {!showCart && !showOrderStatus && !showFeedback && (
        <div className="fixed bottom-0 left-0 right-0 z-20 bg-card/95 backdrop-blur-xl border-t border-border/50 safe-area-pb">
          <div className="max-w-2xl mx-auto flex items-center">
            {/* Order Track */}
            <button
              onClick={() => { setOrderStatusTab("active"); setShowOrderStatus(true); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-3 relative group">
              <div className="relative">
                <ClipboardList className="w-5 h-5 text-warning group-hover:scale-110 transition-transform" />
                {activeOrdersCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-warning text-warning-foreground text-[9px] flex items-center justify-center font-bold">
                    {activeOrdersCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold text-warning">অর্ডার ট্র্যাক</span>
            </button>

            {/* History */}
            <button
              onClick={() => { setOrderStatusTab("history"); setShowOrderStatus(true); }}
              className="flex-1 flex flex-col items-center gap-0.5 py-3 relative group">
              <div className="relative">
                <Clock className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:scale-110 transition-all" />
                {orderHistory.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-muted-foreground/30 text-foreground text-[9px] flex items-center justify-center font-bold">
                    {orderHistory.length}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-semibold text-muted-foreground">ইতিহাস</span>
            </button>

            {/* Feedback */}
            <button
              onClick={() => setShowFeedback(true)}
              className="flex-1 flex flex-col items-center gap-0.5 py-3 group">
              <MessageSquare className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all" />
              <span className="text-[10px] font-semibold text-muted-foreground">ফিডব্যাক</span>
            </button>

            {/* Waiter */}
            <button
              onClick={handleCallWaiter}
              disabled={waiterCooldown}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 group transition-opacity ${waiterCooldown ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Phone className="w-5 h-5 text-info group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-semibold text-info">{waiterCooldown ? 'পাঠানো হয়েছে' : 'ওয়েটার'}</span>
            </button>

            {/* Bill */}
            <button
              onClick={handleRequestBill}
              disabled={billCooldown}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 group transition-opacity ${billCooldown ? 'opacity-50 cursor-not-allowed' : ''}`}>
              <Receipt className="w-5 h-5 text-amber-500 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-semibold text-amber-500">{billCooldown ? 'পাঠানো হয়েছে' : 'বিল'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Order status drawer */}
      {showOrderStatus && (
        <div className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-md" onClick={() => setShowOrderStatus(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[85vh] flex flex-col"
            onClick={e => e.stopPropagation()}
            style={{ animation: "slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)" }}>
            <div className="flex justify-center pt-3 pb-1 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-border" /></div>
            {/* Header */}
            <div className="px-6 pt-2 pb-3 flex-shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-display font-bold text-xl text-foreground">আমার অর্ডার</h2>
                  <p className="text-sm text-muted-foreground">{seatNumber ? `সিট ${seatNumber} • ` : ""}রিয়েলটাইম আপডেট</p>
                </div>
                <button onClick={() => setShowOrderStatus(false)} className="w-9 h-9 rounded-xl bg-secondary hover:bg-accent flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>
              {/* Tabs */}
              <div className="flex gap-1 bg-muted rounded-xl p-1">
                <button onClick={() => setOrderStatusTab("active")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${orderStatusTab === "active" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
                  চলমান
                  {myOrders.filter(o => !isNotificationOrder(o)).length > 0 && (
                    <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                      {myOrders.filter(o => !isNotificationOrder(o)).length}
                    </span>
                  )}
                </button>
                <button onClick={() => setOrderStatusTab("history")}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-1.5 ${orderStatusTab === "history" ? "bg-card shadow text-foreground" : "text-muted-foreground"}`}>
                  ইতিহাস
                  {orderHistory.length > 0 && (
                    <span className="bg-muted-foreground/20 text-foreground text-[10px] px-1.5 py-0.5 rounded-full leading-none">
                      {orderHistory.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto px-6 pb-8 flex-1" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>

              {/* ── Active orders tab ── */}
              {orderStatusTab === "active" && (
                <>
                  {ordersLoading && (
                    <div className="flex items-center justify-center py-10">
                      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  {!ordersLoading && myOrders.filter(o => !isNotificationOrder(o)).length === 0 && (
                    <div className="text-center py-12">
                      <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">এখনো কোনো চলমান অর্ডার নেই</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">অর্ডার দিলে এখানে দেখা যাবে</p>
                    </div>
                  )}
                  <div className="space-y-4 mt-1">
                    {myOrders.filter(o => !isNotificationOrder(o)).map((order, oi) => {
                      const steps = [
                        { key: "pending",   icon: ClipboardList, label: "অর্ডার দেওয়া হয়েছে",     color: "text-muted-foreground", bg: "bg-muted/30" },
                        { key: "confirmed", icon: CheckCircle,   label: "রান্নাঘর accept করেছে", color: "text-info",             bg: "bg-info/10" },
                        { key: "preparing", icon: ChefHat,       label: "রান্না হচ্ছে",            color: "text-warning",          bg: "bg-warning/10" },
                        { key: "ready",     icon: Bell,          label: "আসছে!",                  color: "text-success",          bg: "bg-success/10" },
                        { key: "delivered", icon: Bike,          label: "পৌঁছে গেছে",             color: "text-primary",          bg: "bg-primary/10" },
                      ];
                      const currentIdx = steps.findIndex(s => s.key === order.status);
                      const isCancelled = order.status === "cancelled";
                      return (
                        <div key={order.id} className={`rounded-2xl p-4 border ${isCancelled ? "bg-destructive/5 border-destructive/20" : order.status === "delivered" ? "bg-success/5 border-success/20" : "bg-secondary/30 border-border/50"}`}>
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="font-semibold text-sm text-foreground">অর্ডার #{oi + 1}</p>
                              {order.created_at && (
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  {new Date(order.created_at).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                            </div>
                            <span className="text-sm font-bold text-foreground">৳{order.total}</span>
                          </div>
                          {isCancelled ? (
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20">
                              <XCircle className="w-5 h-5 text-destructive flex-shrink-0" />
                              <p className="text-sm font-semibold text-destructive">অর্ডারটি বাতিল হয়েছে</p>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {steps.map((step, si) => {
                                const Icon = step.icon;
                                const isDone = si <= currentIdx;
                                const isActive = si === currentIdx;
                                return (
                                  <div key={step.key}
                                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${isActive ? `${step.bg} border border-current/20` : isDone ? "opacity-60" : "opacity-25"}`}>
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? step.bg : "bg-muted/20"}`}>
                                      <Icon className={`w-4 h-4 ${isActive ? step.color : isDone ? "text-muted-foreground" : "text-muted-foreground/40"}`} />
                                    </div>
                                    <p className={`text-sm font-semibold flex-1 ${isActive ? step.color : isDone ? "text-foreground" : "text-muted-foreground/40"}`}>{step.label}</p>
                                    {isDone && !isActive && <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />}
                                    {isActive && <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0" style={{ background: "currentColor" }} />}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {order.items && order.items.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-border/30">
                              <p className="text-xs text-muted-foreground mb-1.5">আইটেম:</p>
                              <div className="flex flex-wrap gap-1.5">
                                {order.items.map((item, idx) => (
                                  <span key={`${item.id}-${idx}`} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                    {item.name} ×{item.quantity}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* ── History tab ── */}
              {orderStatusTab === "history" && (
                <div className="space-y-3 mt-1">
                  {orderHistory.length === 0 ? (
                    <div className="text-center py-12">
                      <Receipt className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                      <p className="text-muted-foreground text-sm">এই ভিজিটে কোনো সম্পন্ন অর্ডার নেই</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">অর্ডার ডেলিভারি হলে এখানে দেখা যাবে</p>
                    </div>
                  ) : (
                    <>
                      {orderHistory.map((order, hi) => {
                        const isCompleted = ["delivered", "completed", "served"].includes(order.status);
                        return (
                          <div key={order.id} className={`rounded-2xl p-4 border ${order.status === "cancelled" ? "bg-destructive/5 border-destructive/20" : "bg-success/5 border-success/20"}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {isCompleted
                                  ? <CheckCircle className="w-4 h-4 text-success" />
                                  : <XCircle className="w-4 h-4 text-destructive" />}
                                <p className="font-semibold text-sm text-foreground">
                                  অর্ডার #{order.id.slice(0, 6).toUpperCase()}
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${order.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                                  {order.status === "cancelled" ? "বাতিল" : "সম্পন্ন ✓"}
                                </span>
                                <span className="text-sm font-bold text-foreground">৳{order.total}</span>
                              </div>
                            </div>
                            {order.created_at && (
                              <p className="text-[11px] text-muted-foreground mb-2">
                                {new Date(order.created_at).toLocaleTimeString("bn-BD", { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            )}
                            {order.items && order.items.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {order.items.map((item, idx) => (
                                  <span key={`${item.id}-${idx}`} className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                                    {item.name} ×{item.quantity}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {/* Total spent this visit */}
                      <div className="mt-2 p-3 rounded-xl bg-muted/50 border border-border/40 text-center">
                        <p className="text-xs text-muted-foreground">এই ভিজিটে মোট খরচ</p>
                        <p className="text-lg font-bold text-foreground mt-0.5">
                          ৳{[...myOrders.filter(o => !isNotificationOrder(o)), ...orderHistory]
                              .filter(o => o.status !== "cancelled")
                              .reduce((s, o) => s + o.total, 0)}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cart drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-md" onClick={() => setShowCart(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            style={{ animation: "slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)", WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-border" /></div>
            <div className="p-6 pt-3">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display font-bold text-xl text-foreground">আপনার কার্ট</h2>
                  <p className="text-sm text-muted-foreground">{totalItems} আইটেম • টেবিল {tableName}</p>
                </div>
                <button onClick={() => setShowCart(false)} className="w-9 h-9 rounded-xl bg-secondary hover:bg-accent flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>
              {cart.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingCart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground font-medium mb-4">কার্ট খালি</p>
                  <Button variant="outline" className="rounded-xl" onClick={() => setShowCart(false)}>
                    <UtensilsCrossed className="w-4 h-4" /> মেনু থেকে আইটেম যোগ করুন
                  </Button>
                </div>
              ) : (
                <>
                  <div className="space-y-3 mb-4">
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
                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                      <MessageSquare className="w-4 h-4 text-primary" /> বিশেষ নির্দেশনা
                    </label>
                    <textarea ref={textareaRef} value={specialNote} onChange={e => setSpecialNote(e.target.value.replace(/<[^>]*>/g, "").slice(0, 200))}
                      onFocus={() => setTimeout(() => textareaRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300)}
                      placeholder="যেমন: কম ঝাল দিন, Extra sauce, পেঁয়াজ ছাড়া..." maxLength={200} rows={2}
                      className="w-full rounded-xl bg-secondary/50 border border-border/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
                    <p className="text-xs text-muted-foreground mt-1 text-right">{specialNote.length}/200</p>
                  </div>
                  <div className="border-t border-border pt-4 mb-6 space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>সাবটোটাল</span><span>৳{totalPrice}</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold text-foreground">
                      <span>মোট</span><span className="text-gradient">৳{totalPrice}</span>
                    </div>
                  </div>
                  <Button variant="hero" size="lg" className="w-full h-14 text-base rounded-2xl shadow-lg shadow-primary/20"
                    onClick={handleSubmitOrder} disabled={submitting}>
                    <Send className="w-5 h-5" />
                    {submitting ? "পাঠানো হচ্ছে..." : "অর্ডার পাঠান"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* General feedback modal */}
      {showFeedback && (
        <div className="fixed inset-0 z-[60] bg-foreground/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-2xl animate-fade-up">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-7 h-7 text-primary" />
              </div>
              <h2 className="font-display font-bold text-xl text-foreground">ফিডব্যাক দিন</h2>
              <p className="text-sm text-muted-foreground mt-1">আপনার মতামত আমাদের উন্নতিতে সাহায্য করে</p>
            </div>
            <div className="flex justify-center gap-3 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button key={star} onClick={() => setFeedbackRating(star)} className="transition-transform active:scale-90">
                  <Star className={`w-10 h-10 transition-colors ${star <= feedbackRating ? "text-warning fill-warning" : "text-muted-foreground/30"}`} />
                </button>
              ))}
            </div>
            {feedbackRating > 0 && (
              <p className="text-center text-sm font-medium text-muted-foreground mb-4">
                {feedbackRating === 1 ? "😞 খুব খারাপ" : feedbackRating === 2 ? "😕 খারাপ" : feedbackRating === 3 ? "😐 মোটামুটি" : feedbackRating === 4 ? "😊 ভালো" : "😍 অসাধারণ!"}
              </p>
            )}
            <textarea
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
              rows={3} placeholder="আপনার অভিজ্ঞতা বলুন... (ঐচ্ছিক)"
              value={feedbackComment}
              onChange={e => setFeedbackComment(e.target.value.replace(/<[^>]*>/g, "").slice(0, 500))}
              maxLength={500} />
            <div className="flex gap-2">
              <button
                onClick={() => { setShowFeedback(false); setFeedbackRating(0); setFeedbackComment(""); }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
                বাতিল
              </button>
              <button
                disabled={feedbackRating === 0 || feedbackSubmitting}
                onClick={async () => {
                  if (!feedbackRating || !restaurantId) return;
                  const cleanComment = feedbackComment ? sanitize(feedbackComment, 500) : null;
                  setFeedbackSubmitting(true);
                  const { error } = await supabase.from("reviews").insert({
                    restaurant_id: restaurantId,
                    menu_item_id: null,
                    rating: feedbackRating,
                    comment: cleanComment,
                  } as any);
                  setFeedbackSubmitting(false);
                  if (!error) {
                    toast("🙏 ধন্যবাদ! ফিডব্যাক পেয়েছি।", { duration: 4000 });
                  }
                  setShowFeedback(false);
                  setFeedbackRating(0);
                  setFeedbackComment("");
                }}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 transition-opacity">
                {feedbackSubmitting ? "পাঠানো হচ্ছে..." : "পাঠান"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick rating modal — tap stars on any food card */}
      {quickRatingItem && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm animate-fade-in" onClick={() => { setQuickRatingItem(null); setQuickRatingValue(0); }}>
          <div className="w-full max-w-md bg-card rounded-t-3xl p-6 pb-10 animate-fade-up shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-5" />
            <h3 className="font-display text-xl font-bold text-foreground text-center mb-1">{quickRatingItem.name}</h3>
            <p className="text-sm text-muted-foreground text-center mb-6">এই খাবারটি কেমন লাগলো?</p>

            <div className="flex items-center justify-center gap-3 mb-6">
              {[1,2,3,4,5].map(star => (
                <button
                  key={star}
                  onClick={() => setQuickRatingValue(star)}
                  disabled={quickRatingSubmitting}
                  className="transition-all active:scale-90 hover:scale-110"
                >
                  <Star className={`w-12 h-12 transition-colors ${star <= quickRatingValue ? "fill-yellow-400 text-yellow-400 drop-shadow-sm" : "text-muted-foreground/25"}`} />
                </button>
              ))}
            </div>

            <p className="text-center text-sm font-medium text-muted-foreground mb-5 h-5">
              {quickRatingValue === 1 && "😞 একদম ভালো লাগেনি"}
              {quickRatingValue === 2 && "😐 তেমন ভালো না"}
              {quickRatingValue === 3 && "🙂 মোটামুটি ঠিকআছে"}
              {quickRatingValue === 4 && "😊 বেশ ভালো!"}
              {quickRatingValue === 5 && "🤩 অসাধারণ!"}
            </p>

            <button
              onClick={() => submitQuickRating(quickRatingValue)}
              disabled={quickRatingValue === 0 || quickRatingSubmitting}
              className="w-full py-3.5 rounded-2xl gradient-primary text-primary-foreground font-bold text-base disabled:opacity-40 transition-opacity active:scale-95"
            >
              {quickRatingSubmitting ? "পাঠানো হচ্ছে..." : "রেটিং দিন ✓"}
            </button>
            <button
              onClick={() => { setQuickRatingItem(null); setQuickRatingValue(0); }}
              className="w-full mt-3 py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              বাতিল
            </button>
          </div>
        </div>
      )}

      {/* Per-item rating modal */}
      {ratingOrderId && (
        <div className="fixed inset-0 z-[60] bg-foreground/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-3xl shadow-2xl animate-fade-up flex flex-col max-h-[85vh]"
            style={{ WebkitOverflowScrolling: 'touch' }}>
            {/* Header */}
            <div className="p-6 pb-3 flex-shrink-0 text-center">
              <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-3">
                <Star className="w-7 h-7 text-warning fill-warning" />
              </div>
              <h2 className="font-display font-bold text-xl text-foreground">খাবার রেট করুন</h2>
              <p className="text-sm text-muted-foreground mt-1">প্রতিটি আইটেমে স্টার দিন — আপনার রেটিং অন্যদের সাহায্য করবে</p>
            </div>

            {/* Scrollable items */}
            <div className="overflow-y-auto px-6 flex-1" style={{ WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
              {ratingItems.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-4">এই অর্ডারে রেট করার মতো কোনো আইটেম নেই।</p>
              ) : (
                <div className="space-y-4 py-2">
                  {ratingItems.map(item => {
                    const r = perItemRatings[item.menu_item_id!] || 0;
                    return (
                      <div key={item.menu_item_id} className="bg-secondary/40 rounded-2xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div>
                            <p className="font-semibold text-sm text-foreground">{item.name}</p>
                            {item.quantity > 1 && <p className="text-xs text-muted-foreground">×{item.quantity}</p>}
                          </div>
                          {r > 0 && (
                            <span className="text-xs font-medium text-warning">
                              {r === 1 ? "😞" : r === 2 ? "😕" : r === 3 ? "😐" : r === 4 ? "😊" : "😍"}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button key={star}
                              onClick={() => setPerItemRatings(prev => ({ ...prev, [item.menu_item_id!]: star }))}
                              className="transition-transform active:scale-90 flex-1 flex justify-center">
                              <Star className={`w-7 h-7 transition-colors ${star <= r ? "text-warning fill-warning" : "text-muted-foreground/25 hover:text-warning/50"}`} />
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              <textarea
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4 mt-2"
                rows={2} placeholder="সামগ্রিক মন্তব্য... (ঐচ্ছিক)"
                value={ratingComment} onChange={e => setRatingComment(e.target.value.replace(/<[^>]*>/g, "").slice(0, 300))} maxLength={300} />
            </div>

            {/* Footer buttons */}
            <div className="flex gap-2 p-6 pt-3 flex-shrink-0">
              <button
                onClick={() => {
                  try { localStorage.setItem(`rated_${ratingOrderId}`, "skipped"); } catch { /* Safari private / iOS WebView */ }
                  setRatingOrderId(null); setRatingItems([]); setPerItemRatings({}); setRatingComment("");
                }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors">
                এড়িয়ে যান
              </button>
              <button
                disabled={Object.keys(perItemRatings).length === 0 || ratingSubmitting}
                onClick={async () => {
                  if (!ratingOrderId) return;
                  const ratingsToSubmit = Object.entries(perItemRatings)
                    .filter(([, r]) => r >= 1 && r <= 5)
                    .map(([menu_item_id, rating]) => ({ menu_item_id, restaurant_id: restaurantId, rating, comment: ratingComment ? sanitize(ratingComment, 300) : null }));
                  if (ratingsToSubmit.length === 0) return;
                  setRatingSubmitting(true);
                  const { error } = await supabase.from("reviews").insert(ratingsToSubmit as any);
                  setRatingSubmitting(false);
                  if (!error) {
                    try { localStorage.setItem(`rated_${ratingOrderId}`, "done"); } catch { /* Safari private / iOS WebView */ }
                    toast("🙏 ধন্যবাদ! রেটিং পেয়েছি।", { duration: 4000 });
                  }
                  setRatingOrderId(null); setRatingItems([]); setPerItemRatings({}); setRatingComment("");
                }}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 transition-opacity">
                {ratingSubmitting ? "পাঠানো হচ্ছে..." : `রেটিং দিন (${Object.values(perItemRatings).filter(r => r > 0).length}/${ratingItems.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default CustomerMenu;
