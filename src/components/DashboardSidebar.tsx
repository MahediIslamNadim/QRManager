import { NavLink, useLocation } from "react-router-dom";
import { APP_NAME } from "@/constants/app";
import {
  LayoutDashboard, UtensilsCrossed, Store, Users, BarChart3,
  CreditCard, Menu, QrCode, ShoppingCart, UserCheck, Bell,
  Settings, LogOut, ChevronLeft, X, ChefHat, Sparkles, Receipt, FileText, MessageSquare, Headphones
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

type Role = "super_admin" | "admin" | "waiter";
interface SidebarProps {
  role: Role;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
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
    { title: "কিচেন ডিসপ্লে", href: "/admin/kitchen", icon: ChefHat },
    { title: "কর্মী ম্যানেজমেন্ট", href: "/admin/staff", icon: UserCheck },
    { title: "অ্যানালিটিক্স", href: "/admin/analytics", icon: BarChart3 },
    { title: "AI Insights", href: "/admin/ai-insights", icon: Sparkles },
    { title: "কাস্টম রিপোর্ট", href: "/admin/reports", icon: FileText },
    { title: "কাস্টমার ফিডব্যাক", href: "/admin/feedback", icon: MessageSquare },
    { title: "প্রায়োরিটি সাপোর্ট", href: "/admin/support", icon: Headphones },
    { title: "প্ল্যান ও বিলিং", href: "/billing", icon: Receipt },
    { title: "সেটিংস", href: "/admin/settings", icon: Settings },
  ],
  waiter: [
    { title: "অ্যাক্টিভ অর্ডার", href: "/waiter", icon: ShoppingCart },
    { title: "সিট রিকোয়েস্ট", href: "/waiter/seats", icon: UserCheck },
    { title: "কিচেন ডিসপ্লে", href: "/admin/kitchen", icon: ChefHat },     
    { title: "নোটিফিকেশন", href: "/waiter/notifications", icon: Bell },
  ],
};

const SidebarContent = ({
  role, collapsed, setCollapsed, onMobileClose, isMobile,
}: {
  role: Role;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  onMobileClose?: () => void;
  isMobile?: boolean;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const items = navItems[role];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleNavClick = () => {
    if (isMobile && onMobileClose) onMobileClose();
  };

  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 border-b border-sidebar-border flex-shrink-0">
        <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center flex-shrink-0">
          <UtensilsCrossed className="w-5 h-5 text-primary-foreground" />
        </div>
        {(!collapsed || isMobile) && (
          <span className="font-display font-bold text-sidebar-foreground text-base">
            {APP_NAME}
          </span>
        )}
        {isMobile ? (
          <button onClick={onMobileClose} className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground p-1">
            <X className="w-5 h-5" />
          </button>
        ) : (
          <button onClick={() => setCollapsed(!collapsed)} className="ml-auto text-sidebar-foreground/50 hover:text-sidebar-foreground p-1">
            <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={handleNavClick}
              className={cn("sidebar-nav-item", isActive && "active")}
              title={item.title}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {(!collapsed || isMobile) && <span className="font-body text-sm">{item.title}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-2 border-t border-sidebar-border flex-shrink-0">
        <button
          onClick={handleLogout}
          className="sidebar-nav-item w-full text-destructive/80 hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {(!collapsed || isMobile) && <span className="font-body text-sm">লগআউট</span>}
        </button>
      </div>
    </>
  );
};

const DashboardSidebar = ({ role, mobileOpen, onMobileClose }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* ✅ MOBILE: Overlay + slide-in drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          {/* Drawer */}
          <aside className="absolute left-0 top-0 h-full w-[260px] bg-sidebar border-r border-sidebar-border flex flex-col shadow-2xl animate-slide-in-left">
            <SidebarContent
              role={role}
              collapsed={false}
              setCollapsed={() => {}}
              onMobileClose={onMobileClose}
              isMobile={true}
            />
          </aside>
        </div>
      )}

      {/* ✅ DESKTOP: Sticky sidebar */}
      <aside
        className={cn(
          "hidden md:flex h-screen sticky top-0 flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-[72px]" : "w-[240px]"
        )}
      >
        <SidebarContent
          role={role}
          collapsed={collapsed}
          setCollapsed={setCollapsed}
        />
      </aside>
    </>
  );
};

export default DashboardSidebar;
