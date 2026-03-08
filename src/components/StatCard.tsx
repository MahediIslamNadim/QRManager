import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

const StatCard = ({ title, value, icon: Icon, trend, trendUp, className }: StatCardProps) => {
  return (
    <div className={cn("stat-card", className)}>
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
          <Icon className="w-6 h-6 text-accent-foreground" />
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
