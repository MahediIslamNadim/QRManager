// TierSelection Component - Display tier options for upgrade
// Updated: April 25, 2026 — Added high_smart_enterprise tier
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, Zap, Crown, Building2 } from 'lucide-react';
import { TIERS, TierName, BillingCycle, formatPrice, formatTierPrice } from '@/constants/tiers';

interface TierSelectionProps {
  onSelect: (tier: TierName, billingCycle: BillingCycle) => void;
  selectedTier?: TierName;
  selectedBillingCycle?: BillingCycle;
}

const ENTERPRISE_FEATURES = [
  'হাই স্মার্টের সব ফিচার',
  'আনলিমিটেড রেস্টুরেন্ট গ্রুপ',
  'আনলিমিটেড শাখা',
  'White Label বিকল্প',
  'SLA সাপোর্ট ২৪/৭',
  'কাস্টম POS/ERP ইন্টিগ্রেশন',
  'পূর্ণ API অ্যাক্সেস',
];

const handleEnterpriseContact = () => {
  const msg = encodeURIComponent('আমি QRManager Enterprise প্যাকেজ সম্পর্কে জানতে চাই');
  window.open('https://wa.me/8801786130439?text=' + msg, '_blank');
};

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
            মাসিক
          </button>
          <button
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              billingCycle === 'yearly' ? 'bg-background shadow' : 'text-muted-foreground'
            }`}
            onClick={() => setBillingCycle('yearly')}
          >
            বার্ষিক
            <span className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">২০% সেভ</span>
          </button>
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid md:grid-cols-3 gap-6">
        {(Object.entries(TIERS) as [TierName, typeof TIERS[TierName]][]).map(([tierKey, config]) => {
          const isEnterprise = tierKey === 'high_smart_enterprise';
          const isSelected = selectedTier === tierKey;
          const isPopular = tierKey === 'medium_smart';
          const price = billingCycle === 'monthly' ? config.price_monthly : config.price_yearly;

          return (
            <Card
              key={tierKey}
              className={`relative cursor-pointer transition-all ${
                isEnterprise
                  ? 'border-amber-400/50 hover:border-amber-400'
                  : isSelected
                  ? 'border-primary border-2 shadow-lg'
                  : 'hover:border-primary/50'
              }`}
            >
              {/* Badge */}
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    সবচেয়ে জনপ্রিয়
                  </span>
                </div>
              )}
              {isEnterprise && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-amber-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    🏢 চেইন
                  </span>
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                  {tierKey === 'medium_smart' && <Zap className="w-5 h-5 text-blue-500" />}
                  {tierKey === 'high_smart' && <Crown className="w-5 h-5 text-purple-500" />}
                  {tierKey === 'high_smart_enterprise' && <Building2 className="w-5 h-5 text-amber-500" />}
                  <CardTitle className="text-lg">{config.name_bn}</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">{config.description_bn}</p>

                {/* Price */}
                <div className="mt-2">
                  {isEnterprise ? (
                    <div>
                      <span className="text-3xl font-bold text-amber-600">কাস্টম</span>
                      <p className="text-xs text-muted-foreground mt-1">যোগাযোগ করুন — আপনার চাহিদা অনুযায়ী</p>
                    </div>
                  ) : (
                    <div>
                      <span className="text-3xl font-bold">{formatPrice(price)}</span>
                      <span className="text-muted-foreground text-sm">
                        /{billingCycle === 'monthly' ? 'মাস' : 'বছর'}
                      </span>
                      {billingCycle === 'yearly' && (
                        <p className="text-xs text-green-600 mt-1">
                          {formatPrice(Math.round(config.price_yearly / 12))}/মাস (বার্ষিক বিলিং)
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="space-y-2">
                  {isEnterprise ? (
                    <>
                      {ENTERPRISE_FEATURES.map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          <span>{feature}</span>
                        </div>
                      ))}
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>{config.maxTables === -1 ? 'আনলিমিটেড টেবিল' : `সর্বোচ্চ ${config.maxTables}টি টেবিল`}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                        <span>{config.maxStaff === -1 ? 'আনলিমিটেড স্টাফ' : `সর্বোচ্চ ${config.maxStaff} জন স্টাফ`}</span>
                      </div>
                      {config.features.slice(0, 5).map((feature) => (
                        <div key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                {isEnterprise ? (
                  <Button
                    className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                    onClick={handleEnterpriseContact}
                  >
                    যোগাযোগ করুন →
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => onSelect(tierKey, billingCycle)}
                  >
                    {isSelected ? '✅ নির্বাচিত' : `${config.name_bn} বেছে নিন`}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default TierSelection;
