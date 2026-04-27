import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Bell,
  Building2,
  ChevronLeft,
  ChefHat,
  CreditCard,
  FileText,
  Headphones,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PlusSquare,
  QrCode,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  UserCheck,
  Users,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { APP_NAME } from "@/constants/app";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

type Role = "super_admin" | "admin" | "waiter" | "group_owner";

interface SidebarProps {
  role: Role;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navItems: Record<Role, Array<{ title: string; href: string; icon: typeof LayoutDashboard }>> = {
  super_admin: [
    { title: "ড্যাশবোর্ড",       href: "/super-admin",              icon: LayoutDashboard },
    { title: "রেস্টুরেন্টসমূহ",    href: "/super-admin/restaurants",  icon: Store },
    { title: "পেমেন্টসমূহ",        href: "/super-admin/payments",     icon: CreditCard },
    { title: "ব্যবহারকারী",        href: "/super-admin/users",        icon: Users },
    { title: "অ্যানালিটিক্স",      href: "/super-admin/analytics",    icon: BarChart3 },
    { title: "সাপোর্ট টিকেট",     href: "/super-admin/support",      icon: Headphones },
    { title: "সেটিংস",             href: "/super-admin/settings",     icon: Settings },
  ],
  admin: [
    { title: "ড্যাশবোর্ড",         href: "/admin",                 icon: LayoutDashboard },
    { title: "মেনু ম্যানেজমেন্ট",   href: "/admin/menu",            icon: Menu },
    { title: "টেবিল ও QR",          href: "/admin/tables",          icon: QrCode },
    { title: "অর্ডারসমূহ",          href: "/admin/orders",          icon: ShoppingCart },
    { title: "কিচেন ডিসপ্লে",       href: "/admin/kitchen",         icon: ChefHat },
    { title: "কর্মী ম্যানেজমেন্ট",  href: "/admin/staff",           icon: UserCheck },
    { title: "অ্যানালিটিক্স",       href: "/admin/analytics",       icon: BarChart3 },
    { title: "AI Insights",          href: "/admin/ai-insights",     icon: Building2 },
    { title: "কাস্টম রিপোর্ট",      href: "/admin/reports",         icon: FileText },
    { title: "কাস্টমার ফিডব্যাক",   href: "/admin/feedback",        icon: MessageSquare },
    { title: "প্রায়োরিটি সাপোর্ট", href: "/admin/support",         icon: Headphones },
    { title: "প্ল্যান ও বিলিং",     href: "/billing",               icon: Receipt },
    { title: "সেটিংস",              href: "/admin/settings",        icon: Settings },
  ],
  group_owner: [
    { title: "ড্যাশবোর্ড",              href: "/enterprise/dashboard",       icon: LayoutDashboard },
    { title: "সকল রেস্টুরেন্ট",         href: "/enterprise/restaurants",     icon: Store },
    { title: "রেস্টুরেন্ট অ্যানালিটিক্স", href: "/enterprise/analytics",    icon: BarChart3 },
    { title: "টপ সেলিং ফুড",            href: "/enterprise/top-selling",     icon: ShoppingCart },
    { title: "সকল মেনু",                href: "/enterprise/menus",           icon: Menu },
    { title: "রেস্টুরেন্ট যোগ করুন",    href: "/enterprise/restaurants/new", icon: PlusSquare },
    { title: "নোটিস পাঠান",             href: "/enterprise/notices",         icon: Bell },
    { title: "প্ল্যান ও বিলিং",         href: "/billing",                    icon: Receipt },
    { title: "সেটিংস",                  href: "/enterprise/settings",        icon: Settings },
  ],
  waiter: [
    { title: "অ্যাক্টিভ অর্ডার",  href: "/waiter",                icon: ShoppingCart },
    { title: "সিট রিকোয়েস্ট",     href: "/waiter/seats",          icon: UserCheck },
    { title: "কিচেন ডিসপ্লে",     href: "/admin/kitchen",         icon: ChefHat },
    { title: "নোটিফিকেশন",        href: "/waiter/notifications",  icon: Bell },
  ],
};

const SidebarContent = ({
  role,
  collapsed,
  setCollapsed,
  onMobileClose,
  isMobile,
}: {
  role: Role;
  collapsed: boolean;
  setCollapsed: (value: boolean) => void;
  onMobileClose?: () => void;
  isMobile?: boolean;
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const items = navItems[role] ?? navItems.admin;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/login");
  };

  const handleNavClick = () => {
    if (isMobile && onMobileClose) onMobileClose();
  };

  return (
    <>
      <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg gradient-primary">
          <UtensilsCrossed className="h-5 w-5 text-primary-foreground" />
        </div>
        {(!collapsed || isMobile) && (
          <span className="font-display text-base font-bold text-sidebar-foreground">
            {APP_NAME}
          </span>
        )}
        {isMobile ? (
          <button
            onClick={onMobileClose}
            className="ml-auto p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="ml-auto p-1 text-sidebar-foreground/50 hover:text-sidebar-foreground"
          >
            <ChevronLeft className={cn("h-4 w-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        )}
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {items.map((item) => {
          const isActive =
            location.pathname === item.href ||
            (item.href === "/enterprise/restaurants" &&
              location.pathname.startsWith("/enterprise/restaurants/") &&
              !location.pathname.startsWith("/enterprise/restaurants/new")) ||
            (item.href !== "/enterprise/restaurants" &&
              item.href !== "/" &&
              location.pathname.startsWith(`${item.href}/`));

          return (
            <NavLink
              key={item.href}
              to={item.href}
              onClick={handleNavClick}
              className={cn("sidebar-nav-item", isActive && "active")}
              title={item.title}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" />
              {(!collapsed || isMobile) && (
                <span className="font-body text-sm">{item.title}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="flex-shrink-0 border-t border-sidebar-border p-2">
        <button
          onClick={handleLogout}
          className="sidebar-nav-item w-full text-destructive/80 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          {(!collapsed || isMobile) && (
            <span className="font-body text-sm">লগআউট</span>
          )}
        </button>
      </div>
    </>
  );
};

const DashboardSidebar = ({ role, mobileOpen, onMobileClose }: SidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/50 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[260px] flex-col border-r border-sidebar-border bg-sidebar shadow-2xl animate-slide-in-left">
            <SidebarContent
              role={role}
              collapsed={false}
              setCollapsed={() => {}}
              onMobileClose={onMobileClose}
              isMobile
            />
          </aside>
        </div>
      )}

      <aside
        className={cn(
          "sticky top-0 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 md:flex",
          collapsed ? "w-[72px]" : "w-[240px]",
        )}
      >
        <SidebarContent role={role} collapsed={collapsed} setCollapsed={setCollapsed} />
      </aside>
    </>
  );
};

export default DashboardSidebar;
