import { createAuthedSupabaseClient, supabase } from "@/integrations/supabase/client";

export type AppAuthRole = "super_admin" | "admin" | "waiter" | "kitchen";

export interface AuthContextSnapshot {
  role: string | null;
  restaurantId: string | null;
  restaurantPlan: string;
  trialExpired: boolean;
}

const DEFAULT_AUTH_CONTEXT: AuthContextSnapshot = {
  role: null,
  restaurantId: null,
  restaurantPlan: "basic",
  trialExpired: false,
};

const normalizeAuthContext = (payload: unknown): AuthContextSnapshot => {
  const value = Array.isArray(payload) ? payload[0] : payload;

  if (!value || typeof value !== "object") {
    return DEFAULT_AUTH_CONTEXT;
  }

  const record = value as Record<string, unknown>;

  return {
    role: typeof record.role === "string" ? record.role : null,
    restaurantId: typeof record.restaurant_id === "string" ? record.restaurant_id : null,
    restaurantPlan:
      typeof record.restaurant_plan === "string" && record.restaurant_plan
        ? record.restaurant_plan
        : "basic",
    trialExpired: Boolean(record.trial_expired),
  };
};

const callAuthContextRpc = async (client: typeof supabase): Promise<AuthContextSnapshot> => {
  const { data, error } = await (client.rpc as any)("get_auth_context");

  if (error) {
    throw error;
  }

  return normalizeAuthContext(data);
};

export const resolveAuthContext = async (accessToken?: string): Promise<AuthContextSnapshot> => {
  if (accessToken) {
    return callAuthContextRpc(createAuthedSupabaseClient(accessToken));
  }

  try {
    return await callAuthContextRpc(supabase);
  } catch (initialError) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw initialError;
    }

    return callAuthContextRpc(createAuthedSupabaseClient(session.access_token));
  }
};

export const isSupportedAppRole = (role: string | null): role is AppAuthRole =>
  role === "super_admin" || role === "admin" || role === "waiter" || role === "kitchen";
