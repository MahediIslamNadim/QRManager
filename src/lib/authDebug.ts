const PENDING_LOGIN_REDIRECT_KEY = "qrmanager:pending-login-redirect";

type PendingLoginRedirect = {
  at: string;
  inviteId?: string | null;
  role?: string | null;
  target: string;
  userId?: string | null;
};

const canUseWindow = () => typeof window !== "undefined";

export const isAuthDebugEnabled = () => import.meta.env.DEV;

export const authDebug = (scope: string, message: string, details?: unknown) => {
  if (!isAuthDebugEnabled()) return;

  const prefix = `[auth-debug:${scope}] ${message}`;
  if (details === undefined) {
    console.info(prefix);
    return;
  }

  console.info(prefix, details);
};

export const setPendingLoginRedirect = (
  payload: Omit<PendingLoginRedirect, "at">,
) => {
  if (!canUseWindow()) return;

  window.sessionStorage.setItem(
    PENDING_LOGIN_REDIRECT_KEY,
    JSON.stringify({
      ...payload,
      at: new Date().toISOString(),
    }),
  );
};

export const getPendingLoginRedirect = (): PendingLoginRedirect | null => {
  if (!canUseWindow()) return null;

  const rawValue = window.sessionStorage.getItem(PENDING_LOGIN_REDIRECT_KEY);
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue) as PendingLoginRedirect;
  } catch (error) {
    console.warn("Failed to parse pending login redirect diagnostics:", error);
    return null;
  }
};

export const clearPendingLoginRedirect = () => {
  if (!canUseWindow()) return;
  window.sessionStorage.removeItem(PENDING_LOGIN_REDIRECT_KEY);
};
