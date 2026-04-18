import { useState, useEffect } from "react";
import { Bell, Trash2, CheckCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { bn } from "date-fns/locale";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

const NotificationBell = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as Notification[];
    },
    enabled: !!user,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, queryClient]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length === 0) return;
      const { error } = await supabase
        .from("notifications" as any)
        .update({ read: true } as any)
        .in("id", unreadIds);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase
        .from("notifications" as any)
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen && unreadCount > 0) markAllRead.mutate();
  };

  const typeColors: Record<string, string> = {
    success: "bg-success/10 text-success border-success/20",
    warning: "bg-warning/10 text-warning border-warning/20",
    error:   "bg-destructive/10 text-destructive border-destructive/20",
    info:    "bg-primary/10 text-primary border-primary/20",
  };

  const typeLabel: Record<string, string> = {
    success: "সফল", warning: "সতর্কতা", error: "ত্রুটি", info: "তথ্য",
  };

  return (
    <Popover open={open} onOpenChange={handleOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0 shadow-xl" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm text-foreground">নোটিফিকেশন</h3>
            {notifications.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                {notifications.length}
              </span>
            )}
          </div>
          {notifications.length > 0 && (
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllRead.mutate()}
                  title="সব পঠিত হিসেবে চিহ্নিত করুন"
                  className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                  <CheckCheck className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                onClick={() => clearAll.mutate()}
                disabled={clearAll.isPending}
                title="সব মুছুন"
                className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Scrollable notification list */}
        <div
          className="overflow-y-auto divide-y divide-border/50"
          style={{
            height: notifications.length === 0 ? 'auto' : '320px',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
          }}
        >
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                <Bell className="w-5 h-5 text-muted-foreground/50" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">কোনো নোটিফিকেশন নেই</p>
              <p className="text-xs text-muted-foreground/60 mt-1">নতুন আপডেট আসলে এখানে দেখাবে</p>
            </div>
          ) : (
            notifications.map(n => (
              <div
                key={n.id}
                className={`group relative px-4 py-3 transition-colors ${!n.read ? "bg-primary/5" : "hover:bg-muted/30"}`}
              >
                {/* Delete single notification */}
                <button
                  onClick={(e) => { e.stopPropagation(); deleteOne.mutate(n.id); }}
                  className="absolute top-2.5 right-2.5 p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive text-muted-foreground transition-all">
                  <X className="w-3 h-3" />
                </button>

                <div className="flex items-center gap-2 mb-1.5 pr-6">
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold border ${typeColors[n.type] || typeColors.info}`}>
                    {typeLabel[n.type] || "তথ্য"}
                  </span>
                  {!n.read && (
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: bn })}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground leading-snug">{n.title}</p>
                {n.message && (
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer — only shown when there are notifications */}
        {notifications.length > 0 && (
          <div className="px-4 py-2.5 border-t border-border bg-muted/30">
            <button
              onClick={() => clearAll.mutate()}
              disabled={clearAll.isPending}
              className="w-full text-xs text-destructive hover:text-destructive/80 font-medium transition-colors flex items-center justify-center gap-1.5 py-1 rounded-lg hover:bg-destructive/5">
              <Trash2 className="w-3 h-3" />
              {clearAll.isPending ? "মুছা হচ্ছে..." : "সব নোটিফিকেশন মুছুন"}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
