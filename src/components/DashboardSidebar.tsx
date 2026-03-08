import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Store,
  Users,
  BarChart3,
  CreditCard,
  Menu,
  QrCode,
  ShoppingCart,
  UserCheck,
  Bell,
  Settings,
  LogOut,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type Role = "super_admin" | "admin" | "waiter";

interface SidebarProps {
  role: Role;
}

const navItems: Record<Role, { title: string; href: string; icon: any }[]> = {
  super_admin: [
    { title: "ড্যাশবোর্ড", href: "/super-admin", icon: LayoutDashboard },
    { title: "রেস্টুরেন্টসমূহ", href: "/super-admin/restaurants", icon: Store },
    { title: "পেমেন্টসমূহ", href: "/super-admin/payments", icon: CreditCard },
    { title: "ব্যবহারকারী", href: "/super-admin/users", icon: Users },
    { title: "অ্যানালিটিক্স", href: "/super-admin/analytics", icon: BarChart3 },
    { title: "সেটিংস", href: "/super-admin/settings", icon: Settings },
  ],
  admin: [
    { title: "ড্যাশবোর্ড", href: "/admin", icon: LayoutDashboard },
    { title: "মেনু ম্যানেজমেন্ট", href: "/admin/menu", icon: Menu },
    { title: "টেবিল ও QR", href: "/admin/tables", icon: QrCode },
    { title: "অর্ডারসমূহ", href: "/admin/orders", icon: ShoppingCart },
    { title: "কর্মী ম্যানেজমেন্ট", href: "/admin/staff", icon: UserCheck },
    { title: "অ্যানালিটিক্স", href: "/admin/analytics", icon: BarChart3 },
    { title: "সেটিংস", href: "/admin/settings", icon: Settings },
  ],
  waiter: [
    { title: "অ্যাক্টিভ অর্ডার", href: "/waiter", icon: ShoppingCart },
    { title: "সিট রিকোয়েস্ট", href: "/waiter/seats", icon: UserCheck },
    { title: "নোটিফিকেশন", href: "/waiter/notifications", icon: Bell },
  ],
};

const DashboardSidebar = ({ role }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const items = navItems[role];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  return (
    <aside
      className={cn(
        "h-screen sticky top-0 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
        collapsed ? "w-[72px]" : "w-[260px]"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b border-sidebar-border">
        <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
          <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
        </div>
        {!collapsed && (
          <span className="font-display font-bold text-sidebar-foreground text-lg">
            Restaurant QR
          </span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground"
        >
          <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn("sidebar-nav-item", isActive && "active")}
              title={item.title}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-body text-sm">{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="sidebar-nav-item w-full text-destructive/80 hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span className="font-body text-sm">লগআউট</span>}
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
