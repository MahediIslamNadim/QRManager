// TrialWarningBanner - Show warning when trial is ending soon
import { AlertTriangle, Clock, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TrialWarningBannerProps {
  daysRemaining: number;
  isCritical: boolean;
  tier: string;
  onUpgradeClick: () => void;
}

export default function TrialWarningBanner({ 
  daysRemaining, 
  isCritical, 
  tier,
  onUpgradeClick 
}: TrialWarningBannerProps) {
  
  if (daysRemaining <= 0) return null;

  return (
    <div className={`w-full border-b ${
      isCritical 
        ? 'bg-destructive/10 border-destructive/30' 
        : 'bg-warning/10 border-warning/30'
    }`}>
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            {isCritical ? (
              <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
            ) : (
              <Clock className="w-5 h-5 text-warning flex-shrink-0" />
            )}
            
            <div>
              <p className={`font-semibold text-sm ${
                isCritical ? 'text-destructive' : 'text-warning'
              }`}>
                {isCritical ? '⚠️ Trial Ending Soon!' : '⏰ Trial Reminder'}
              </p>
              <p className="text-xs text-muted-foreground">
                Your {tier === 'medium_smart' ? 'Medium Smart' : 'High Smart'} trial ends in{' '}
                <span className="font-bold">{daysRemaining} day{daysRemaining !== 1 ? 's' : ''}</span>.
                {' '}Upgrade now to keep all features!
              </p>
            </div>
          </div>

          <Button
            onClick={onUpgradeClick}
            variant={isCritical ? 'destructive' : 'default'}
            size="sm"
            className="flex-shrink-0"
          >
            <Zap className="w-4 h-4 mr-1" />
            Upgrade Now
          </Button>
        </div>
      </div>
    </div>
  );
}
