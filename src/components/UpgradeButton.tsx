// UpgradeButton.tsx - Reusable upgrade CTA button
import { Button } from '@/components/ui/button';
import { Zap, Crown, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { TierName } from '@/constants/tiers';

interface UpgradeButtonProps {
  variant?: 'default' | 'hero' | 'outline';
  size?: 'sm' | 'default' | 'lg';
  currentTier?: TierName;
  feature?: string; // What feature they're trying to access
  className?: string;
}

export default function UpgradeButton({ 
  variant = 'default',
  size = 'default',
  currentTier,
  feature,
  className 
}: UpgradeButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/upgrade');
  };

  // Customize message based on current tier
  const getMessage = () => {
    if (feature) {
      return `Upgrade to unlock ${feature}`;
    }
    if (currentTier === 'medium_smart') {
      return 'Upgrade to High Smart';
    }
    return 'Upgrade Plan';
  };

  const getIcon = () => {
    if (currentTier === 'medium_smart') {
      return Crown;
    }
    return Zap;
  };

  const Icon = getIcon();

  return (
    <Button
      onClick={handleClick}
      variant={variant}
      size={size}
      className={className}
    >
      <Icon className="w-4 h-4 mr-2" />
      {getMessage()}
      {size !== 'sm' && <ArrowRight className="w-4 h-4 ml-2" />}
    </Button>
  );
}
