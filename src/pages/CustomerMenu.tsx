import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Plus, Minus, UtensilsCrossed, X, Send, Image as ImageIcon, Flame, CheckCircle, XCircle, Package, Search, QrCode, Lock, ClipboardList, ChefHat, Bell, Bike, MessageSquare, Phone, Receipt, Clock, ArrowLeft, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

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
}

interface CartItem extends MenuItem {
  quantity: number;
}

interface OrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface Order {
  id: string;
  total: number;
  status: string;
  created_at?: string;
  items: OrderItem[];
}

// ✅ FIX Bug 2: colorPalette module-level (immutable) রাখা ঠিক আছে,
// কিন্তু categoryColors Component এর ভেতরে useState এ রাখতে হবে।
const colorPalette = [
  { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30", dot: "bg-primary" },
  { bg: "bg-info/10", text: "text-info", border: "border-info/30", dot: "bg-info" },
  { bg: "bg-success/10", text: "text-success", border: "border-success/30", dot: "bg-success" },
  { bg: "bg-rose/10", text: "text-rose", border: "border-rose/30", dot: "bg-rose" },
  { bg: "bg-amber/10", text: "text-amber", border: "border-amber/30", dot: "bg-amber" },
  { bg: "bg-accent", text: "text-accent-foreground", border: "border-accent-foreground/20", dot: "bg-accent-foreground" },
];

const ACTIVE_STATUSES = ["pending", "confirmed", "preparing", "ready"];

// ✅ FIX Bug 1: Waiter call / bill request আলাদা করতে এই helper দিয়ে চেনা যাবে
const isNotificationOrder = (order: Order) =>
  order.total === 0 && order.items.length === 0;

const CustomerMenu = () => {
  const { restaurantId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tableId = searchParams.get("table");
  const seatId = searchParams.get("seat");
  const tokenParam = searchParams.get("token");
  const isDemo = !restaurantId;

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [tableName, setTableName] = useState<string>("N/A");
  const [tableIsOpen, setTableIsOpen] = useState<boolean>(true);
  const [seatNumber, setSeatNumber] = useState<number | null>(null);
  const [categories, setCategories] = useState<string[]>(["সব"]);
  const [activeCategory, setActiveCategory] = useState("সব");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [showOrderStatus, setShowOrderStatus] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [specialNote, setSpecialNote] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [lastOrderId, setLastOrderId] = useState<string | null>(null);
  const [lastOrderTotal, setLastOrderTotal] = useState(0);
  const [lastOrderItems, setLastOrderItems] = useState<CartItem[]>([]);
  const [ratingOrderId, setRatingOrderId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [ratingSubmitting, setRatingSubmitting] = useState(false);

  const [tokenValid, setTokenValid] = useState<boolean>(true);
  const [tokenChecking, setTokenChecking] = useState(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [tableChecked, setTableChecked] = useState(false);

  // ✅ FIX Bug 2: categoryColors Component এর state এ — restaurant বদলালেও reset হবে
  const [categoryColors, setCategoryColors] = useState<Record<string, { bg: string; text: string; border: string; dot: string }>>({});

  const getCategoryColor = useCallback((category: string) => {
    if (categoryColors[category]) return categoryColors[category];
    // নতুন category — index নির্ধারণ করো এবং save করো
    const idx = Object.keys(categoryColors).length % colorPalette.length;
    const color = colorPalette[idx];
    setCategoryColors(prev => ({ ...prev, [category]: color }));
    return color;
  }, [categoryColors]);

  // ✅ FIX Bug 4: fetchOrderItems useCallback এ
  const fetchOrderItems = useCallback(async (orderId: string): Promise<OrderItem[]> => {
    const { data } = await supabase
      .from("order_items")
      .select("id, name, price, quantity")
      .eq("order_id", orderId);
    return (data as OrderItem[]) || [];
  }, []);

  const fetchExistingOrders = useCallback(async () => {
    if (isDemo || !tableId || !restaurantId) return;
    setOrdersLoading(true);
    try {
      const { data: ordersData, error } = await supabase
        .from("orders")
        .select("id, total, status, created_at")
        .eq("restaurant_id", restaurantId)
        .eq("table_id", tableId)
        .in("status", ACTIVE_STATUSES)
        // ✅ FIX Bug 1: total > 0 filter — waiter call / bill request বাদ
        .gt("total", 0)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error || !ordersData) return;

      const ordersWithItems: Order[] = await Promise.all(
        ordersData.map(async (order) => {
          const items = await fetchOrderItems(order.id);
          return { ...order, items };
        })
      );

      setMyOrders(ordersWithItems);
    } catch (err) {
      // silently fail
    } finally {
      setOrdersLoading(false);
    }
  }, [isDemo, tableId, restaurantId, fetchOrderItems]);

  // ── Fetch menu data ──
  useEffect(() => {
    // ✅ FIX Bug 2: restaurant বদলালে categoryColors reset করো
    setCategoryColors({});

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
        setCategories(["সব", ...new Set(demoItems.map(i => i.category))]);
        setLoading(false);
        return;
      }

      const [restRes, menuRes] = await Promise.all([
        supabase.from("restaurants").select("*").eq("id", restaurantId!).single(),
        supabase.from("menu_items").select("*").eq("restaurant_id", restaurantId!).order("sort_order"),
      ]);

      if (restRes.data) setRestaurant(restRes.data);
      if (menuRes.data) {
        setMenuItems(menuRes.data as any);
        setCategories(["সব", ...new Set(menuRes.data.map((i: any) => i.category))]);
      }

      if (seatId) {
        const { data: seatData } = await supabase
          .from("table_seats").select("seat_number").eq("id", seatId).maybeSingle();
        if (seatData) setSeatNumber(seatData.seat_number);
      }

      setLoading(false);
    };
    fetchData();
  }, [restaurantId, seatId, isDemo]);

  // ── Token + Table check ──
  useEffect(() => {
    if (isDemo || !tableId || !restaurantId) return;

    const checkTokenAndTable = async () => {
      setTokenChecking(true);
      try {
        const { data: tableData } = await supabase
          .from("restaurant_tables")
          .select("name, is_open")
          .eq("id", tableId)
          .single();

        if (tableData) {
          setTableName(tableData.name);
          const isOpen = (tableData as any).is_open !== false;
          setTableIsOpen(isOpen);
          if (!isOpen) {
            setTokenValid(false);
            setTokenChecking(false);
            setTableChecked(true);
            return;
          }
        } else {
          // ✅ FIX Bug 3: tableData না পেলে (error/not found) safe default — closed ধরো না,
          // কিন্তু tokenValid=false করো যাতে order না দেওয়া যায়
          setTableIsOpen(false);
          setTokenValid(false);
          setTokenChecking(false);
          setTableChecked(true);
          return;
        }

        if (tokenParam) {
          const { data: session } = await supabase
            .from("table_sessions" as any)
            .select("token, expires_at")
            .eq("token", tokenParam)
            .eq("table_id", tableId)
            .maybeSingle();

          if (session && new Date((session as any).expires_at) > new Date()) {
            setSessionToken((session as any).token);
            setTokenValid(true);
            setTokenChecking(false);
            setTableChecked(true);
            return;
          }
        }

        const { data: existing } = await supabase
          .from("table_sessions" as any)
          .select("token, expires_at")
          .eq("table_id", tableId)
          .eq("restaurant_id", restaurantId)
          .gt("expires_at", new Date().toISOString())
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existing) {
          setSessionToken((existing as any).token);
          setTokenValid(true);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("token", (existing as any).token);
          window.history.replaceState({}, "", newUrl.toString());
          setTokenChecking(false);
          setTableChecked(true);
          return;
        }

        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
        const { data: newSession, error } = await supabase
          .from("table_sessions" as any)
          .insert({ restaurant_id: restaurantId, table_id: tableId, expires_at: expiresAt } as any)
          .select()
          .maybeSingle();

        if (!error && newSession) {
          setSessionToken((newSession as any).token);
          setTokenValid(true);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("token", (newSession as any).token);
          window.history.replaceState({}, "", newUrl.toString());
        } else {
          setTokenValid(true);
        }
      } catch (err) {
        // ✅ FIX Bug 3: network error হলেও tokenValid=true রাখো (session check অনুমোদন দেয়)
        // কিন্তু tableIsOpen এর default (true) পরিবর্তন করো না — table open ধরো
        setTokenValid(true);
      }

      setTokenChecking(false);
      setTableChecked(true);
    };

    checkTokenAndTable();
  }, [isDemo, tableId, restaurantId, tokenParam]);

  // ── Seat redirect ──
  useEffect(() => {
    if (!isDemo && tableId && !seatId && tableChecked && tokenValid && restaurantId) {
      const checkSeats = async () => {
        const { data: seatsData } = await supabase
          .from("table_seats").select("id").eq("table_id", tableId).limit(1);
        if (seatsData && seatsData.length > 0) {
          const tokenQuery = sessionToken ? `&token=${sessionToken}` : "";
          navigate(`/menu/${restaurantId}/select-seat?table=${tableId}${tokenQuery}`, { replace: true });
        }
      };
      checkSeats();
    }
  }, [isDemo, tableId, seatId, tableChecked, tokenValid, restaurantId, sessionToken, navigate]);

  // ── Fetch existing orders ──
  useEffect(() => {
    if (tableChecked && tokenValid) {
      fetchExistingOrders();
    }
  }, [tableChecked, tokenValid, fetchExistingOrders]);

  // ── Realtime ──
  useEffect(() => {
    if (!tableId || !restaurantId || isDemo) return;

    const channel = supabase
      .channel(`orders-realtime-${tableId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "orders",
        filter: `table_id=eq.${tableId}`,
      }, async (payload) => {
        const newOrder = payload.new as any;
        if (!ACTIVE_STATUSES.includes(newOrder.status)) return;
        // ✅ FIX Bug 1: total=0 order (waiter call / bill request) myOrders এ যোগ করবো না
        if (newOrder.total === 0) return;
        const items = await fetchOrderItems(newOrder.id);
        setMyOrders(prev => {
          if (prev.find(o => o.id === newOrder.id)) return prev;
          return [{ ...newOrder, items }, ...prev];
        });
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "orders",
        filter: `table_id=eq.${tableId}`,
      }, async (payload) => {
        const updated = payload.new as any;
        // ✅ FIX Bug 1: waiter call / bill request update ও ignore করো
        if (updated.total === 0) return;

        setMyOrders(prev => {
          const exists = prev.find(o => o.id === updated.id);
          if (exists) {
            return prev.map(o =>
              o.id === updated.id ? { ...o, status: updated.status } : o
            );
          } else if (ACTIVE_STATUSES.includes(updated.status)) {
            fetchOrderItems(updated.id).then(items => {
              setMyOrders(p => {
                if (p.find(o => o.id === updated.id)) return p;
                return [{ ...updated, items }, ...p];
              });
            });
            return prev;
          }
          return prev;
        });

        const statusMessages: Record<string, string> = {
          confirmed: "✅ রান্নাঘর অর্ডার accept করেছে!",
          preparing: "🍳 আপনার খাবার রান্না হচ্ছে...",
          ready: "🛎️ খাবার ready! ওয়েটার আসছে।",
          delivered: "🎉 খাবার পৌঁছে গেছে! ধন্যবাদ।",
          cancelled: "❌ দুঃখিত, অর্ডারটি বাতিল হয়েছে।",
        };
        if (statusMessages[updated.status]) {
          toast(statusMessages[updated.status], { duration: 5000 });
        }

        if (["confirmed", "preparing", "ready"].includes(updated.status)) {
          setShowOrderStatus(true);
        }

        if (["served", "completed"].includes(updated.status)) {
          const ratedKey = `rated_${updated.id}`;
          if (!localStorage.getItem(ratedKey)) {
            setTimeout(() => setRatingOrderId(updated.id), 1500);
          }
          setTimeout(() => {
            setMyOrders(prev => prev.filter(o => o.id !== updated.id));
          }, 60000);
        }

        if (["delivered", "cancelled"].includes(updated.status)) {
          setTimeout(() => {
            setMyOrders(prev => prev.filter(o => o.id !== updated.id));
          }, 30000);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableId, restaurantId, isDemo, fetchOrderItems]);

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

  const addToCart = (item: MenuItem) => {
    if (!item.available) { toast.error("এই আইটেমটি এখন পাওয়া যাচ্ছে না"); return; }
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        if (existing.quantity >= MAX_ITEM_QTY) {
          toast.error(`সর্বোচ্চ ${MAX_ITEM_QTY}টি যোগ করা যায়`);
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
      if (newQty > MAX_ITEM_QTY) {
        toast.error(`সর্বোচ্চ ${MAX_ITEM_QTY}টি যোগ করা যায়`);
        return c;
      }
      return { ...c, quantity: newQty };
    }).filter(c => c.quantity > 0));
  };

  const removeFromCart = (id: string) => setCart(prev => prev.filter(c => c.id !== id));

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  // ✅ FIX Bug 1: notification order (waiter call/bill) বাদ দিয়ে count করো
  const activeOrdersCount = myOrders.filter(o =>
    ACTIVE_STATUSES.includes(o.status) && !isNotificationOrder(o)
  ).length;

  const submitOrder = async () => {
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

    if (!tableIsOpen) {
      toast.error("এই টেবিলটি এখন বন্ধ আছে");
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
          notes: specialNote.trim() || null,
        })
        .select()
        .single();

      if (orderErr) throw orderErr;

      const orderItemsPayload = cart.map(c => ({
        order_id: order.id,
        menu_item_id: c.id,
        name: c.name,
        price: c.price,
        quantity: c.quantity,
      }));

      const { error: itemsErr } = await supabase.from("order_items").insert(orderItemsPayload);
      if (itemsErr) throw itemsErr;

      if (seatId) {
        await supabase.from("table_seats").update({ status: "occupied" }).eq("id", seatId);
      }

      const localItems: OrderItem[] = cart.map(c => ({
        id: c.id,
        name: c.name,
        price: c.price,
        quantity: c.quantity,
      }));

      const newOrder: Order = {
        id: order.id,
        total: totalPrice,
        status: "pending",
        created_at: order.created_at,
        items: localItems,
      };
      setMyOrders(prev => [newOrder, ...prev]);

      setLastOrderId(order.id.slice(0, 8).toUpperCase());
      setLastOrderTotal(totalPrice);
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

  // ── Call Waiter ──
  const callWaiter = async () => {
    if (isDemo) {
      toast.success("🔔 ওয়েটারকে ডাকা হয়েছে! (ডেমো)");
      return;
    }
    try {
      await supabase.from("orders").insert({
        restaurant_id: restaurantId!,
        table_id: tableId || null,
        seat_id: seatId || null,
        total: 0,
        status: "pending",
        notes: `🔔 ওয়েটার ডাকা হয়েছে — টেবিল ${tableName}${seatNumber ? `, সিট ${seatNumber}` : ""}`,
      });
      toast.success("🔔 ওয়েটারকে ডাকা হয়েছে! একটু অপেক্ষা করুন।");
    } catch {
      toast.error("ওয়েটার ডাকতে সমস্যা হয়েছে");
    }
  };

  // ── Request Bill ──
  const requestBill = async () => {
    if (isDemo) {
      toast.success("🧾 বিলের জন্য অনুরোধ পাঠানো হয়েছে! (ডেমো)");
      return;
    }
    try {
      await supabase.from("orders").insert({
        restaurant_id: restaurantId!,
        table_id: tableId || null,
        seat_id: seatId || null,
        total: 0,
        status: "pending",
        notes: `🧾 বিল চাই — টেবিল ${tableName}${seatNumber ? `, সিট ${seatNumber}` : ""}`,
      });
      toast.success("🧾 বিলের জন্য অনুরোধ পাঠানো হয়েছে!");
    } catch {
      toast.error("বিল অনুরোধ পাঠাতে সমস্যা হয়েছে");
    }
  };

  // ── LOADING ──
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

  // ── TABLE CLOSED ──
  if (!isDemo && tableId && !tableIsOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-xs">
          <div className="w-20 h-20 rounded-3xl bg-destructive/10 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-destructive" />
          </div>
          <h2 className="font-display font-bold text-2xl text-foreground mb-3">টেবিল বন্ধ আছে</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            এই টেবিলটি এখন অর্ডারের জন্য খোলা নেই।<br />
            ওয়েটারকে জানান অথবা একটু অপেক্ষা করুন।
          </p>
        </div>
      </div>
    );
  }

  // ── TOKEN EXPIRED ──
  if (!isDemo && tableId && tableChecked && !tokenValid && tableIsOpen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center max-w-xs">
          <div className="w-20 h-20 rounded-3xl bg-warning/10 flex items-center justify-center mx-auto mb-6">
            <QrCode className="w-10 h-10 text-warning" />
          </div>
          <h2 className="font-display font-bold text-2xl text-foreground mb-3">সেশন মেয়াদ শেষ</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6">
            আপনার অর্ডার সেশনের সময় শেষ হয়ে গেছে।<br />
            অর্ডার করতে টেবিলের QR কোড আবার স্ক্যান করুন।
          </p>
          <div className="flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-primary/10 border border-primary/20">
            <QrCode className="w-5 h-5 text-primary" />
            <span className="text-sm font-semibold text-primary">QR কোড স্ক্যান করুন</span>
          </div>
        </div>
      </div>
    );
  }

  // ── ORDER CONFIRMATION SCREEN ──
  if (showConfirmation) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-success/10 flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center animate-fade-up">
          {/* Success icon */}
          <div className="w-24 h-24 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6 relative">
            <CheckCircle className="w-12 h-12 text-success" />
            <div className="absolute inset-0 rounded-full border-2 border-success/30 animate-ping" />
          </div>

          <h2 className="font-display font-bold text-2xl text-foreground mb-2">অর্ডার সফল! 🎉</h2>
          <p className="text-muted-foreground text-sm mb-6">আপনার অর্ডার রান্নাঘরে পাঠানো হয়েছে</p>

          {/* Order details card */}
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

            {/* Estimated time */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-warning/10 border border-warning/20">
              <Clock className="w-5 h-5 text-warning flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">আনুমানিক ২০-৩০ মিনিট</p>
                <p className="text-xs text-muted-foreground">আপনার খাবার তৈরি হচ্ছে</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              variant="hero"
              size="lg"
              className="w-full h-12 rounded-2xl"
              onClick={() => {
                setShowConfirmation(false);
                setShowOrderStatus(true);
              }}
            >
              <ClipboardList className="w-5 h-5" />
              অর্ডার ট্র্যাক করুন
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-full h-12 rounded-2xl"
              onClick={() => setShowConfirmation(false)}
            >
              <ArrowLeft className="w-5 h-5" />
              মেনুতে ফিরুন
            </Button>
          </div>
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
            <button onClick={() => setShowSearch(!showSearch)} className="w-11 h-11 rounded-2xl bg-secondary hover:bg-accent flex items-center justify-center transition-all">
              <Search className="w-5 h-5 text-muted-foreground" />
            </button>
            {myOrders.length > 0 && (
              <button onClick={() => setShowOrderStatus(true)} className="relative w-11 h-11 rounded-2xl bg-warning/10 hover:bg-warning/20 flex items-center justify-center transition-all">
                <ClipboardList className="w-5 h-5 text-warning" />
                {activeOrdersCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-warning text-warning-foreground text-[10px] flex items-center justify-center font-bold animate-pulse">
                    {activeOrdersCount}
                  </span>
                )}
              </button>
            )}
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
              <input type="text" placeholder="খাবার খুঁজুন..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" autoFocus />
            </div>
          </div>
        )}
      </header>

      {/* Stats bar */}
      <div className="max-w-2xl mx-auto px-4 pt-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary whitespace-nowrap">
            <Package className="w-3.5 h-3.5" /> মোট {totalMenuItems}টি
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-xs font-semibold text-success whitespace-nowrap">
            <CheckCircle className="w-3.5 h-3.5" /> স্টকে {inStockCount}টি
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-xs font-semibold text-destructive whitespace-nowrap">
            <XCircle className="w-3.5 h-3.5" /> স্টক আউট {outOfStockCount}টি
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
            return (
              <button key={cat} onClick={() => setActiveCategory(cat)}
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
            <div key={item.id}
              className={`group bg-card rounded-2xl border overflow-hidden transition-all duration-500 animate-fade-up ${
                isOutOfStock ? "border-destructive/20 opacity-75" : "border-border/60 hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1"
              }`}
              style={{ animationDelay: `${index * 80}ms` }}>
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
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-muted-foreground/60">
                    <Flame className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">জনপ্রিয়</span>
                  </div>
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

      {/* Floating Action Buttons — Call Waiter & Bill */}
      {!showCart && !showOrderStatus && (
        <div className="fixed bottom-24 right-4 z-20 flex flex-col gap-2">
          <button onClick={callWaiter}
            className="w-12 h-12 rounded-full bg-info/90 text-info-foreground shadow-lg shadow-info/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            title="ওয়েটার ডাকুন">
            <Phone className="w-5 h-5" />
          </button>
          <button onClick={requestBill}
            className="w-12 h-12 rounded-full bg-warning/90 text-warning-foreground shadow-lg shadow-warning/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            title="বিল চাই">
            <Receipt className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Floating Cart Button */}
      {totalItems > 0 && !showCart && (
        <div className="fixed bottom-6 left-4 right-4 max-w-2xl mx-auto z-30 animate-fade-up">
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

      {/* ── ORDER STATUS DRAWER ── */}
      {showOrderStatus && (
        <div className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-md" onClick={() => setShowOrderStatus(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            style={{ animation: "slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)" }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
            <div className="p-6 pt-3">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display font-bold text-xl text-foreground">অর্ডার স্ট্যাটাস</h2>
                  <p className="text-sm text-muted-foreground">
                    {ordersLoading ? "লোড হচ্ছে..." : `${myOrders.length}টি অর্ডার • রিয়েলটাইম আপডেট`}
                  </p>
                </div>
                <button onClick={() => setShowOrderStatus(false)} className="w-9 h-9 rounded-xl bg-secondary hover:bg-accent flex items-center justify-center transition-colors">
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>

              {ordersLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!ordersLoading && myOrders.length === 0 && (
                <div className="text-center py-10">
                  <ClipboardList className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">এখনো কোনো অর্ডার নেই</p>
                </div>
              )}

              <div className="space-y-4">
                {myOrders.map((order, oi) => {
                  const steps = [
                    { key: "pending",   icon: ClipboardList, label: "অর্ডার দেওয়া হয়েছে",      color: "text-muted-foreground", bg: "bg-muted/30" },
                    { key: "confirmed", icon: CheckCircle,   label: "রান্নাঘর accept করেছে",  color: "text-info",             bg: "bg-info/10" },
                    { key: "preparing", icon: ChefHat,       label: "রান্না হচ্ছে",             color: "text-warning",          bg: "bg-warning/10" },
                    { key: "ready",     icon: Bell,          label: "আসছে!",                   color: "text-success",          bg: "bg-success/10" },
                    { key: "delivered", icon: Bike,          label: "পৌঁছে গেছে",              color: "text-primary",          bg: "bg-primary/10" },
                  ];
                  const currentIdx = steps.findIndex(s => s.key === order.status);
                  const isCancelled = order.status === "cancelled";
                  const isDelivered = order.status === "delivered";

                  return (
                    <div key={order.id} className={`rounded-2xl p-4 border ${
                      isCancelled ? "bg-destructive/5 border-destructive/20"
                      : isDelivered ? "bg-success/5 border-success/20"
                      : "bg-secondary/30 border-border/50"
                    }`}>
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
                                className={`flex items-center gap-3 p-2.5 rounded-xl transition-all ${
                                  isActive ? `${step.bg} border border-current/20`
                                  : isDone ? "opacity-60"
                                  : "opacity-25"
                                }`}>
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? step.bg : "bg-muted/20"}`}>
                                  <Icon className={`w-4 h-4 ${isActive ? step.color : isDone ? "text-muted-foreground" : "text-muted-foreground/40"}`} />
                                </div>
                                <p className={`text-sm font-semibold flex-1 ${isActive ? step.color : isDone ? "text-foreground" : "text-muted-foreground/40"}`}>
                                  {step.label}
                                </p>
                                {isDone && !isActive && <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />}
                                {isActive && (
                                  <div className="w-2 h-2 rounded-full animate-pulse flex-shrink-0"
                                    style={{ background: "currentColor" }} />
                                )}
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
            </div>
          </div>
        </div>
      )}

      {/* ── CART DRAWER ── */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-md" onClick={() => setShowCart(false)}>
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
            style={{ animation: "slideUp 0.35s cubic-bezier(0.32, 0.72, 0, 1)" }}>
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-border" />
            </div>
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
                  <Button
                    variant="outline"
                    className="rounded-xl"
                    onClick={() => setShowCart(false)}
                  >
                    <UtensilsCrossed className="w-4 h-4" />
                    মেনু থেকে আইটেম যোগ করুন
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

                  {/* Special Instructions */}
                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                      <MessageSquare className="w-4 h-4 text-primary" />
                      বিশেষ নির্দেশনা
                    </label>
                    <textarea
                      value={specialNote}
                      onChange={e => setSpecialNote(e.target.value)}
                      placeholder="যেমন: কম ঝাল দিন, Extra sauce, পেঁয়াজ ছাড়া..."
                      maxLength={200}
                      rows={2}
                      className="w-full rounded-xl bg-secondary/50 border border-border/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
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
                  <Button variant="hero" size="lg" className="w-full h-14 text-base rounded-2xl shadow-lg shadow-primary/20" onClick={submitOrder} disabled={submitting}>
                    <Send className="w-5 h-5" />
                    {submitting ? "পাঠানো হচ্ছে..." : "অর্ডার পাঠান"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── RATING MODAL ── */}
      {ratingOrderId && (
        <div className="fixed inset-0 z-[60] bg-foreground/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card rounded-3xl p-6 shadow-2xl animate-fade-up">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-2xl bg-warning/10 flex items-center justify-center mx-auto mb-3">
                <Star className="w-7 h-7 text-warning fill-warning" />
              </div>
              <h2 className="font-display font-bold text-xl text-foreground">আপনার অভিজ্ঞতা কেমন ছিল?</h2>
              <p className="text-sm text-muted-foreground mt-1">আপনার রেটিং আমাদের আরো ভালো করতে সাহায্য করবে</p>
            </div>

            {/* Stars */}
            <div className="flex justify-center gap-3 mb-4">
              {[1, 2, 3, 4, 5].map(star => (
                <button
                  key={star}
                  onClick={() => setRatingValue(star)}
                  className="transition-transform active:scale-90"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= ratingValue ? "text-warning fill-warning" : "text-muted-foreground/30"
                    }`}
                  />
                </button>
              ))}
            </div>
            {ratingValue > 0 && (
              <p className="text-center text-sm font-medium text-muted-foreground mb-4">
                {ratingValue === 1 ? "😞 খুব খারাপ" : ratingValue === 2 ? "😕 খারাপ" : ratingValue === 3 ? "😐 মোটামুটি" : ratingValue === 4 ? "😊 ভালো" : "😍 অসাধারণ!"}
              </p>
            )}

            {/* Comment */}
            <textarea
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 mb-4"
              rows={2}
              placeholder="কিছু বলতে চাইলে লিখুন... (ঐচ্ছিক)"
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
            />

            <div className="flex gap-2">
              <button
                onClick={() => {
                  localStorage.setItem(`rated_${ratingOrderId}`, "skipped");
                  setRatingOrderId(null);
                  setRatingValue(0);
                  setRatingComment("");
                }}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-muted-foreground hover:bg-secondary transition-colors"
              >
                এড়িয়ে যান
              </button>
              <button
                disabled={ratingValue === 0 || ratingSubmitting}
                onClick={async () => {
                  if (!ratingValue || !ratingOrderId) return;
                  setRatingSubmitting(true);
                  const { error } = await supabase
                    .from("orders")
                    .update({ rating: ratingValue, rating_comment: ratingComment || null })
                    .eq("id", ratingOrderId);
                  setRatingSubmitting(false);
                  if (!error) {
                    localStorage.setItem(`rated_${ratingOrderId}`, "done");
                    toast("🙏 ধন্যবাদ! আপনার রেটিং পেয়েছি।", { duration: 4000 });
                  }
                  setRatingOrderId(null);
                  setRatingValue(0);
                  setRatingComment("");
                }}
                className="flex-1 py-2.5 rounded-xl gradient-primary text-primary-foreground font-semibold text-sm disabled:opacity-50 transition-opacity"
              >
                {ratingSubmitting ? "পাঠানো হচ্ছে..." : "রেটিং দিন"}
              </button>
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
