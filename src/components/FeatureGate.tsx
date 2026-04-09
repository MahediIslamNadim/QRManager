// FeatureGate.tsx - Component to wrap features and show upgrade prompts
import { ReactNode } from 'react';
import { useFeatureGate, FeatureName } from '@/hooks/useFeatureGate';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, Zap } from 'lucide-react';
import UpgradeButton from './UpgradeButton';

interface FeatureGateProps {
  feature: FeatureName;
  children: ReactNode;
  fallback?: ReactNode; // Custom fallback UI
  showUpgradePrompt?: boolean; // Default: true
}

export default function FeatureGate({
  feature,
  children,
  fallback,
  showUpgradePrompt = true
}: FeatureGateProps) {
  const { restaurantId } = useAuth();
  const { 
    hasAccess, 
    tier,
    upgradeMessage,
    requiredTier,
    loading 
  } = useFeatureGate(feature, restaurantId);

  if (loading) {
    return (
      <div className="animate-pulse bg-muted rounded-lg h-32" />
    );
  }

  // If has access, render children
  if (hasAccess) {
    return <>{children}</>;
  }

  // If custom fallback provided, use it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default upgrade prompt
  if (showUpgradePrompt) {
    return (
      <Card className="border-2 border-dashed border-muted">
        <CardContent className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          
          <h3 className="text-lg font-semibold mb-2">
            Locked Feature
          </h3>
          
          <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
            {upgradeMessage || 'This feature is not available on your current plan.'}
          </p>

          <UpgradeButton
            variant="default"
            currentTier={tier}
          />
        </CardContent>
      </Card>
    );
  }

  // No upgrade prompt, just hide the feature
  return null;
}

// Inline feature gate (for smaller UI elements)
export function InlineFeatureGate({
  feature,
  children
}: {
  feature: FeatureName;
  children: ReactNode;
}) {
  const { restaurantId } = useAuth();
  const { hasAccess, loading } = useFeatureGate(feature, restaurantId);

  if (loading) return null;
  if (!hasAccess) return null;

  return <>{children}</>;
}

// Badge for locked features
export function FeatureBadge({ feature }: { feature: FeatureName }) {
  const { restaurantId } = useAuth();
  const { hasAccess, loading, requiredTier } = useFeatureGate(feature, restaurantId);

  if (loading || hasAccess) return null;

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary text-xs font-medium rounded-full">
      <Lock className="w-3 h-3" />
      {requiredTier === 'high_smart' ? 'High Smart' : 'Premium'}
    </span>
  );
}
