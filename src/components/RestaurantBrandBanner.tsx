import { Crown } from "lucide-react";

interface Props {
  logoUrl: string | null;
  restaurantName: string;
  brandPrimary: string | null;
  brandSecondary: string | null;
  dark?: boolean;
}

const RestaurantBrandBanner = ({ logoUrl, restaurantName, brandPrimary, brandSecondary, dark = false }: Props) => {
  if (!restaurantName) return null;

  const primary = brandPrimary || "#a855f7";
  const secondary = brandSecondary || "#7c3aed";

  if (dark) {
    return (
      <div
        className="flex items-center gap-4 px-5 py-3 border-b border-white/5"
        style={{ background: `linear-gradient(135deg, ${primary}18, ${secondary}10)` }}
      >
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 border-2"
          style={{ borderColor: `${primary}60`, background: `${primary}20` }}
        >
          {logoUrl
            ? <img src={logoUrl} alt={restaurantName} className="w-full h-full object-contain p-1" />
            : <span className="text-2xl">🍽️</span>
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-base leading-tight truncate" style={{ color: "#fff" }}>
            {restaurantName}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Crown className="w-3 h-3" style={{ color: primary }} />
            <span className="text-[11px] font-semibold" style={{ color: primary }}>High Smart</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-4 px-4 py-3 rounded-2xl border mb-1"
      style={{
        background: `linear-gradient(135deg, ${primary}12, ${secondary}08)`,
        borderColor: `${primary}30`,
      }}
    >
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 border-2 shadow-lg"
        style={{ borderColor: `${primary}50`, background: `${primary}15`, boxShadow: `0 4px 16px ${primary}25` }}
      >
        {logoUrl
          ? <img src={logoUrl} alt={restaurantName} className="w-full h-full object-contain p-1" />
          : <span className="text-3xl">🍽️</span>
        }
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-foreground text-lg leading-tight truncate">{restaurantName}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <Crown className="w-3.5 h-3.5" style={{ color: primary }} />
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: `${primary}20`, color: primary }}>
            High Smart — Custom Branding
          </span>
        </div>
      </div>
    </div>
  );
};

export default RestaurantBrandBanner;
