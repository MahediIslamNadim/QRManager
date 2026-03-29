import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
  colorScheme?: "primary" | "info" | "success" | "rose" | "amber" | "accent";
}

const colorMap = {
  primary: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/20" },
  info: { bg: "bg-info/10", text: "text-info", border: "border-info/20" },
  success: { bg: "bg-success/10", text: "text-success", border: "border-success/20" },
  rose: { bg: "bg-rose/10", text: "text-rose", border: "border-rose/20" },
  amber: { bg: "bg-amber/10", text: "text-amber", border: "border-amber/20" },
  accent: { bg: "bg-accent", text: "text-accent-foreground", border: "border-accent/50" },
};

const StatCard = ({ title, value, icon: Icon, trend, trendUp, className, colorScheme = "primary" }: StatCardProps) => {
  const colors = colorMap[colorScheme];

  return (
    <div className={cn("stat-card border-l-4", colors.border, className)}>
      <div className="flex items-start justify-between mb-4">
        <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", colors.bg)}>
          <Icon className={cn("w-6 h-6", colors.text)} />
        </div>
        {trend && (
          <span className={cn(
            "text-sm font-medium px-2 py-1 rounded-full",
            trendUp ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"
          )}>
            {trend}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground font-body mb-1">{title}</p>
      <p className="text-3xl font-display font-bold text-foreground">{value}</p>
    </div>
  );
};

export default StatCard;