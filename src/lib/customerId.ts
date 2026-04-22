const KEY = "qrm_cid";

export function getOrCreateCustomerId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    // Private browsing or storage blocked — return a session-only ID
    return crypto.randomUUID();
  }
}
