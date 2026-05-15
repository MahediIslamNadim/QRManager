const storageKey = (restaurantId: string, tableId: string, seatId?: string | null) =>
  `qrm_session_${restaurantId}_${tableId}${seatId ? `_${seatId}` : ""}`;

export const saveMenuSession = (
  restaurantId: string,
  tableId: string,
  token: string,
  expiresAt: string,
  seatId?: string | null,
  startedAt?: string,
) => {
  const data = {
    token,
    expiresAt,
    startedAt: startedAt ?? new Date().toISOString(),
  };

  localStorage.setItem(storageKey(restaurantId, tableId, seatId), JSON.stringify(data));
};

export const loadMenuSession = (
  restaurantId: string,
  tableId: string,
  seatId?: string | null,
): { token: string; startedAt: string } | null => {
  try {
    const raw =
      localStorage.getItem(storageKey(restaurantId, tableId, seatId)) ||
      (seatId ? localStorage.getItem(storageKey(restaurantId, tableId)) : null);

    if (!raw) return null;

    const { token, expiresAt, startedAt } = JSON.parse(raw);
    if (new Date(expiresAt) > new Date()) {
      return { token, startedAt };
    }

    localStorage.removeItem(storageKey(restaurantId, tableId, seatId));
    return null;
  } catch {
    return null;
  }
};

export const clearMenuSession = (restaurantId: string, tableId: string, seatId?: string | null) => {
  localStorage.removeItem(storageKey(restaurantId, tableId, seatId));
};
