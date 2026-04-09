// TierSelection Component - Display tier options for upgrade
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Zap, Crown } from 'lucide-react';
import { TIERS, TierName, BillingCycle, formatPrice } from '@/constants/tiers';

interface TierSelectionProps {
  onSelect: (tier: TierName, billingCycle: BillingCycle) => void;
  selectedTier?: TierName;
  selectedBillingCycle?: BillingCycle;
}

const TierSelection = ({ onSelect, selectedTier, selectedBillingCycle = 'yearly' }: TierSelectionProps) => {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>(selectedBillingCycle);

  return (
    <div className="space-y-6">
      {/* Billing Toggle */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-lg border p-1 bg-muted">
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingCycle === 'monthly' ? 'bg-background shadow' : 'text-muted-foreground'
            }`}
            onClick={() => setBillingCycle('monthly')}
          >
            Monthly
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingCycle === 'yearly' ? 'bg-background shadow' : 'text-muted-foreground'
            }`}
            onClick={() => setBillingCycle('yearly')}
          >
            Yearly
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">Save 20%</span>
          </button>
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {(Object.entries(TIERS) as [TierName, typeof TIERS[TierName]][]).map(([tierKey, config]) => {
          const price = billingCycle === 'monthly' ? config.price_monthly : config.price_yearly;
          const isSelected = selectedTier === tierKey;
          const isPopular = tierKey === 'medium_smart';

          return (
            <Card
              key={tierKey}
              className={`relative cursor-pointer transition-all ${
                isSelected ? 'border-primary border-2 shadow-lg' : 'hover:border-primary/50'
              }`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  {tierKey === 'medium_smart' ? (
                    <Zap className="w-5 h-5 text-blue-500" />
                  ) : (
                    <Crown className="w-5 h-5 text-purple-500" />
                  )}
                  <CardTitle className="text-lg">{config.name}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">{config.description}</p>
                <div className="mt-2">
                  <span className="text-3xl font-bold">{formatPrice(price)}</span>
                  <span className="text-muted-foreground text-sm">
                    {billingCycle === 'monthly' ? '/month' : '/year'}
                  </span>
                  {billingCycle === 'yearly' && (
                    <p className="text-xs text-green-600 mt-1">
                      {formatPrice(Math.round(config.price_yearly / 12))}/month (billed yearly)
                    </p>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{config.maxTables === -1 ? 'Unlimited tables' : `Up to ${config.maxTables} tables`}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <span>{config.maxStaff === -1 ? 'Unlimited staff' : `Up to ${config.maxStaff} staff members`}</span>
                  </div>
                  {config.features.slice(0, 5).map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                      <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                    </div>
                  ))}
                </div>

                <Button
                  className="w-full"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => onSelect(tierKey, billingCycle)}
                >
                  {isSelected ? 'Selected' : `Choose ${config.name}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TierSelection;
