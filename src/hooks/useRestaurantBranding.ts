import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RestaurantBranding {
  logoUrl: string | null;
  brandPrimary: string | null;
  brandSecondary: string | null;
  brandFont: string;
  restaurantName: string;
  isHighSmart: boolean;
}

export function useRestaurantBranding(restaurantId: string | null | undefined): RestaurantBranding {
  const { data } = useQuery({
    queryKey: ["restaurant-branding", restaurantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("restaurants")
        .select("name, logo_url, brand_primary, brand_secondary, brand_font, tier")
        .eq("id", restaurantId!)
        .maybeSingle();
      return data;
    },
    enabled: !!restaurantId,
    staleTime: 5 * 60 * 1000,
  });

  const isHighSmart = data?.tier === "high_smart" || data?.tier === "high_smart_enterprise";
  return {
    logoUrl: isHighSmart ? (data?.logo_url || null) : null,
    brandPrimary: isHighSmart ? (data?.brand_primary || null) : null,
    brandSecondary: isHighSmart ? (data?.brand_secondary || null) : null,
    brandFont: isHighSmart ? (data?.brand_font || "default") : "default",
    restaurantName: data?.name || "",
    isHighSmart,
  };
}
