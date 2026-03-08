import { ReactNode } from "react";
import DashboardSidebar from "./DashboardSidebar";

interface DashboardLayoutProps {
  children: ReactNode;
  role: "super_admin" | "admin" | "waiter";
  title: string;
}

const DashboardLayout = ({ children, role, title }: DashboardLayoutProps) => {
  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar role={role} />
      <main className="flex-1 overflow-auto">
        <header className="h-16 border-b border-border flex items-center px-8 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="text-xl font-display font-semibold text-foreground">{title}</h1>
        </header>
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default DashboardLayout;
