import { ReactNode, useState } from "react";
import DashboardSidebar from "./DashboardSidebar";
import NotificationBell from "./NotificationBell";
import { Menu } from "lucide-react";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "super_admin" | "admin" | "waiter";
  title: string;
}

const DashboardLayout = ({ children, role, title }: DashboardLayoutProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      <main className="flex-1 overflow-auto min-w-0">
        {/* ✅ Header — hamburger on mobile */}
        <header className="h-14 sm:h-16 border-b border-border flex items-center px-3 sm:px-6 bg-card/50 backdrop-blur-sm sticky top-0 z-10 gap-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 rounded-lg hover:bg-accent transition-colors flex-shrink-0"
            aria-label="মেনু খুলুন"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>

          <h1 className="text-base sm:text-xl font-display font-semibold text-foreground truncate flex-1">
            {title}
          </h1>

          <div className="ml-auto flex-shrink-0">
            <NotificationBell />
          </div>
        </header>

        {/* ✅ Content — less padding on mobile */}
        <div className="p-3 sm:p-5 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
