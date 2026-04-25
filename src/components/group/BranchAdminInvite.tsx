// BranchAdminInvite.tsx — Invite a branch admin from head office
// Created: April 25, 2026
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Mail, Clock, CheckCircle2, RefreshCw, Info } from 'lucide-react';
import { useInviteBranchAdmin, useBranchInvitations } from '@/hooks/useBranchInvite';

interface Props {
  restaurantId: string;
  restaurantName: string;
  groupId: string;
}

export default function BranchAdminInvite({ restaurantId, restaurantName, groupId }: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');

  const inviteMutation = useInviteBranchAdmin();
  const { data: allInvitations = [] } = useBranchInvitations(groupId);

  // Only show invitations for this specific branch
  const branchInvitations = allInvitations.filter(inv => inv.restaurant_id === restaurantId);

  const handleInvite = async () => {
    if (!email.trim() || !email.includes('@')) {
      return;
    }
    await inviteMutation.mutateAsync({ restaurantId, groupId, email: email.trim() });
    setEmail('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleInvite();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs mt-2">
          <UserPlus className="w-3.5 h-3.5" />
          Admin আমন্ত্রণ করুন
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <UserPlus className="w-4 h-4 text-primary" />
            {restaurantName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Info box */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
              <Info className="w-3.5 h-3.5 text-primary" />
              কীভাবে কাজ করে
            </div>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>ইমেইল দিন → আমন্ত্রণ পাঠান</li>
              <li>সেই ব্যক্তি ইমেইলে link পাবে</li>
              <li>link-এ click করে password set করলেই branch admin হবে</li>
              <li>সে শুধু এই branch-এর dashboard দেখতে পাবে</li>
            </ol>
          </div>

          {/* Email input */}
          <div className="space-y-1.5">
            <Label className="text-sm">ইমেইল ঠিকানা</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="admin@restaurant.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKeyDown}
                className="text-sm"
                disabled={inviteMutation.isPending}
              />
              <Button
                onClick={handleInvite}
                disabled={inviteMutation.isPending || !email.includes('@')}
                size="sm"
                className="gap-1.5 shrink-0"
              >
                {inviteMutation.isPending
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <Mail className="w-3.5 h-3.5" />}
                {inviteMutation.isPending ? '...' : 'পাঠান'}
              </Button>
            </div>
          </div>

          {/* Existing invitations for this branch */}
          {branchInvitations.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">পাঠানো আমন্ত্রণ</p>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {branchInvitations.map(inv => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40 text-xs"
                  >
                    <span className="font-medium truncate mr-2">{inv.invited_email}</span>
                    <Badge
                      className={`shrink-0 text-[10px] gap-1 ${
                        inv.status === 'accepted'
                          ? 'bg-success/15 text-success border-success/30 border'
                          : inv.status === 'expired'
                          ? 'bg-muted text-muted-foreground border'
                          : 'bg-warning/15 text-warning border-warning/30 border'
                      }`}
                    >
                      {inv.status === 'accepted' ? (
                        <><CheckCircle2 className="w-3 h-3" />গৃহীত</>
                      ) : inv.status === 'expired' ? (
                        'মেয়াদোত্তীর্ণ'
                      ) : (
                        <><Clock className="w-3 h-3" />অপেক্ষমান</>
                      )}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
