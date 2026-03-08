import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Plus, Minus, UtensilsCrossed, X, Send, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

interface MenuItem {
  id: number;
  name: string;
  price: number;
  category: string;
  description: string;
  available: boolean;
}

const menuData: MenuItem[] = [
  { id: 1, name: "চিকেন বিরিয়ানি", price: 350, category: "বিরিয়ানি", description: "সুগন্ধি বাসমতি চালে রান্না করা মুরগির বিরিয়ানি", available: true },
  { id: 2, name: "বটি কাবাব", price: 180, category: "কাবাব", description: "মশলাযুক্ত গরুর মাংসের কাবাব", available: true },
  { id: 3, name: "মটন বিরিয়ানি", price: 450, category: "বিরিয়ানি", description: "খাসির মাংস দিয়ে তৈরি বিরিয়ানি", available: true },
  { id: 4, name: "প্লেইন ভাত", price: 60, category: "ভাত", description: "সাদা ভাত", available: true },
  { id: 5, name: "মাংগো লাচ্ছি", price: 120, category: "পানীয়", description: "তাজা আমের লাচ্ছি", available: true },
  { id: 6, name: "ফিরনি", price: 100, category: "ডেজার্ট", description: "ঐতিহ্যবাহী দুধের ফিরনি", available: true },
  { id: 7, name: "শিক কাবাব", price: 220, category: "কাবাব", description: "কাঠকয়লায় ভাজা শিক কাবাব", available: true },
  { id: 8, name: "বোরহানি", price: 80, category: "পানীয়", description: "ঐতিহ্যবাহী মশলা পানীয়", available: true },
];

const categories = ["সব", "বিরিয়ানি", "কাবাব", "ভাত", "পানীয়", "ডেজার্ট"];

interface CartItem extends MenuItem {
  quantity: number;
}

const CustomerMenu = () => {
  const [activeCategory, setActiveCategory] = useState("সব");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);

  const filtered = activeCategory === "সব" ? menuData : menuData.filter(i => i.category === activeCategory);

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(c => c.id === item.id);
      if (existing) {
        return prev.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
    toast.success(`${item.name} যোগ করা হয়েছে`);
  };

  const updateQuantity = (id: number, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.id === id) {
        const newQty = c.quantity + delta;
        return newQty > 0 ? { ...c, quantity: newQty } : c;
      }
      return c;
    }).filter(c => c.quantity > 0));
  };

  const removeFromCart = (id: number) => {
    setCart(prev => prev.filter(c => c.id !== id));
  };

  const totalItems = cart.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = cart.reduce((sum, c) => sum + c.price * c.quantity, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display font-bold text-foreground text-lg">Spice Garden</h1>
              <p className="text-xs text-muted-foreground">টেবিল T-5 • QR মেনু</p>
            </div>
          </div>
          <button
            onClick={() => setShowCart(true)}
            className="relative w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"
          >
            <ShoppingCart className="w-5 h-5 text-primary" />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full gradient-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Categories */}
      <div className="sticky top-[73px] z-10 bg-background/90 backdrop-blur-sm border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex gap-2 overflow-x-auto scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeCategory === cat
                  ? "gradient-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Items */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {filtered.map((item) => {
          const cartItem = cart.find(c => c.id === item.id);
          return (
            <div key={item.id} className="menu-item-card flex overflow-hidden">
              <div className="w-28 sm:w-36 bg-gradient-to-br from-accent to-secondary flex items-center justify-center flex-shrink-0">
                <ImageIcon className="w-8 h-8 text-muted-foreground/20" />
              </div>
              <div className="flex-1 p-4 flex flex-col justify-between">
                <div>
                  <h3 className="font-display font-semibold text-foreground">{item.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-lg font-bold text-primary">৳{item.price}</span>
                  {cartItem ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQuantity(item.id, -1)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                        <Minus className="w-4 h-4 text-foreground" />
                      </button>
                      <span className="text-sm font-bold text-foreground w-6 text-center">{cartItem.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, 1)} className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
                        <Plus className="w-4 h-4 text-primary-foreground" />
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item)} className="px-4 py-2 rounded-lg gradient-primary text-primary-foreground text-sm font-medium flex items-center gap-1">
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
        <div className="fixed bottom-6 left-4 right-4 max-w-2xl mx-auto z-30">
          <button
            onClick={() => setShowCart(true)}
            className="w-full gradient-primary text-primary-foreground rounded-2xl p-4 flex items-center justify-between shadow-xl"
          >
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-5 h-5" />
              <span className="font-medium">{totalItems} আইটেম</span>
            </div>
            <span className="font-bold text-lg">৳{totalPrice}</span>
          </button>
        </div>
      )}

      {/* Cart Drawer */}
      {showCart && (
        <div className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm" onClick={() => setShowCart(false)}>
          <div
            className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl max-h-[80vh] overflow-y-auto animate-slide-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-display font-bold text-xl text-foreground">আপনার কার্ট</h2>
                <button onClick={() => setShowCart(false)} className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                  <X className="w-4 h-4 text-foreground" />
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">কার্ট খালি</p>
              ) : (
                <>
                  <div className="space-y-4 mb-6">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/50">
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{item.name}</p>
                          <p className="text-sm text-muted-foreground">৳{item.price} x {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-foreground">৳{item.price * item.quantity}</span>
                          <button onClick={() => removeFromCart(item.id)} className="text-destructive">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-border pt-4 mb-6">
                    <div className="flex justify-between text-lg font-bold text-foreground">
                      <span>মোট</span>
                      <span>৳{totalPrice}</span>
                    </div>
                  </div>

                  <Button
                    variant="hero"
                    size="lg"
                    className="w-full h-14 text-base rounded-2xl"
                    onClick={() => {
                      toast.success("অর্ডার সফলভাবে পাঠানো হয়েছে!");
                      setCart([]);
                      setShowCart(false);
                    }}
                  >
                    <Send className="w-5 h-5" />
                    অর্ডার পাঠান
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerMenu;
