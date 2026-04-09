// TrialExpiredModal - Block access when trial expires
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Check, Crown, Zap } from 'lucide-react';
import { TIERS, formatPrice } from '@/constants/tiers';

interface TrialExpiredModalProps {
  open: boolean;
  tier: 'medium_smart' | 'high_smart';
  onUpgradeClick: () => void;
  onLogoutClick: () => void;
}

export default function TrialExpiredModal({ 
  open, 
  tier,
  onUpgradeClick,
  onLogoutClick 
}: TrialExpiredModalProps) {
  
  const tierConfig = TIERS[tier];
  const otherTier = tier === 'medium_smart' ? 'high_smart' : 'medium_smart';
  const otherTierConfig = TIERS[otherTier];

  return (
    <Dialog open={open} onOpenChange={() => {}} modal>
      <DialogContent className="max-w-3xl" hideCloseButton>
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-2xl font-bold">Trial Expired</DialogTitle>
              <p className="text-sm text-muted-foreground">
                Your 30-day free trial has ended
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Message */}
          <div className="bg-muted/50 rounded-lg p-4 border border-border">
            <p className="text-sm text-foreground">
              Thank you for trying <strong>QR Manager</strong>! 
              To continue using all the powerful features you've enjoyed, 
              please choose a plan and complete payment.
            </p>
          </div>

          {/* Pricing Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Current Tier */}
            <div className={`border-2 rounded-xl p-6 ${
              tier === 'medium_smart' ? 'border-primary' : 'border-purple-600'
            }`}>
              <div className="flex items-center gap-2 mb-3">
                {tier === 'medium_smart' ? (
                  <Zap className="w-5 h-5 text-primary" />
                ) : (
                  <Crown className="w-5 h-5 text-purple-600" />
                )}
                <h3 className="font-bold text-lg">{tierConfig.displayName}</h3>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {formatPrice(tierConfig.priceMonthly)}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  or {formatPrice(tierConfig.priceYearly)}/year (save 20%)
                </p>
              </div>

              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span>Up to {tierConfig.maxTables === -1 ? 'Unlimited' : tierConfig.maxTables} tables</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span>Up to {tierConfig.maxStaff === -1 ? 'Unlimited' : tierConfig.maxStaff} staff</span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                  <span>All core features included</span>
                </li>
              </ul>

              <Button
                onClick={onUpgradeClick}
                className={`w-full ${
                  tier === 'medium_smart' 
                    ? 'bg-primary hover:bg-primary/90' 
                    : 'bg-purple-600 hover:bg-purple-700'
                }`}
                size="lg"
              >
                Continue with {tierConfig.displayName}
              </Button>
            </div>

            {/* Other Tier */}
            <div className="border rounded-xl p-6">
              <div className="flex items-center gap-2 mb-3">
                {otherTier === 'medium_smart' ? (
                  <Zap className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <Crown className="w-5 h-5 text-muted-foreground" />
                )}
                <h3 className="font-bold text-lg text-muted-foreground">
                  {otherTierConfig.displayName}
                </h3>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold">
                    {formatPrice(otherTierConfig.priceMonthly)}
                  </span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  or {formatPrice(otherTierConfig.priceYearly)}/year (save 20%)
                </p>
              </div>

              <ul className="space-y-2 mb-6">
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    Up to {otherTierConfig.maxTables === -1 ? 'Unlimited' : otherTierConfig.maxTables} tables
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    Up to {otherTierConfig.maxStaff === -1 ? 'Unlimited' : otherTierConfig.maxStaff} staff
                  </span>
                </li>
                <li className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <span className="text-muted-foreground">
                    {otherTier === 'high_smart' ? 'Premium features + AI' : 'Core features'}
                  </span>
                </li>
              </ul>

              <Button
                onClick={() => {
                  // TODO: Switch tier and go to payment
                  onUpgradeClick();
                }}
                variant="outline"
                className="w-full"
                size="lg"
              >
                Switch to {otherTierConfig.displayName}
              </Button>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              Need help? Contact support at <strong>support@qrmanager.com</strong>
            </p>
            <Button
              onClick={onLogoutClick}
              variant="ghost"
              size="sm"
            >
              Logout
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
