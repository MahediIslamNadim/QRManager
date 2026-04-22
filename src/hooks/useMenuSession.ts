import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface UseMenuSessionOptions {
  restaurantId: string | undefined;
  tableId: string | null;
  seatId: string | null;
  tokenParam: string | null;
  isDemo: boolean;
}

interface UseMenuSessionResult {
  tableName: string;
  tableIsOpen: boolean;
  seatNumber: number | null;
  tokenValid: boolean;
  tokenChecking: boolean;
  tableChecked: boolean;
  sessionToken: string | null;
  sessionStartedAt: string | null;
}

const storageKey = (restaurantId: string, tableId: string, seatId?: string | null) =>
  `qrm_session_${restaurantId}_${tableId}${seatId ? `_${seatId}` : ""}`;

const saveSession = (restaurantId: string, tableId: string, token: string, expiresAt: string, seatId?: string | null) => {
  const data = { token, expiresAt, startedAt: new Date().toISOString() };
  localStorage.setItem(storageKey(restaurantId, tableId, seatId), JSON.stringify(data));
};

const loadSession = (restaurantId: string, tableId: string, seatId?: string | null): { token: string; startedAt: string } | null => {
  try {
    const raw = localStorage.getItem(storageKey(restaurantId, tableId, seatId));
    if (!raw) return null;
    const { token, expiresAt, startedAt } = JSON.parse(raw);
    if (new Date(expiresAt) > new Date()) return { token, startedAt };
    localStorage.removeItem(storageKey(restaurantId, tableId, seatId));
    return null;
  } catch {
    return null;
  }
};

export const clearSession = (restaurantId: string, tableId: string, seatId?: string | null) => {
  localStorage.removeItem(storageKey(restaurantId, tableId, seatId));
};

export function useMenuSession({
  restaurantId,
  tableId,
  seatId,
  tokenParam,
  isDemo,
}: UseMenuSessionOptions): UseMenuSessionResult {
  const navigate = useNavigate();

  const [tableName, setTableName] = useState<string>("N/A");
  const [tableIsOpen, setTableIsOpen] = useState<boolean>(true);
  const [seatNumber, setSeatNumber] = useState<number | null>(null);
  const [tokenValid, setTokenValid] = useState<boolean>(true);
  const [tokenChecking, setTokenChecking] = useState<boolean>(false);
  const [tableChecked, setTableChecked] = useState<boolean>(false);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionStartedAt, setSessionStartedAt] = useState<string | null>(null);

  // Resolve seat number from seatId
  useEffect(() => {
    if (!seatId || isDemo) return;
    supabase
      .from("table_seats")
      .select("seat_number")
      .eq("id", seatId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSeatNumber(data.seat_number);
      });
  }, [seatId, isDemo]);

  // Token + table validation with localStorage persistence
  useEffect(() => {
    if (isDemo || !tableId || !restaurantId) return;

    const checkTokenAndTable = async () => {
      setTokenChecking(true);
      try {
        const { data: tableData } = await supabase
          .from("restaurant_tables")
          .select("name, is_open")
          .eq("id", tableId)
          .maybeSingle();

        if (!tableData) {
          setTableIsOpen(false);
          setTokenValid(false);
          setTokenChecking(false);
          setTableChecked(true);
          return;
        }

        setTableName(tableData.name);
        const isOpen = (tableData as any).is_open !== false;
        setTableIsOpen(isOpen);

        if (!isOpen) {
          setTokenValid(false);
          setTokenChecking(false);
          setTableChecked(true);
          return;
        }

        // Check localStorage first (restores session on refresh)
        const stored = loadSession(restaurantId, tableId, seatId);
        const existingToken = tokenParam ?? stored?.token ?? null;

        const { data: sessionResult, error: sessionErr } = await supabase.rpc(
          "validate_and_create_session" as any,
          {
            p_restaurant_id: restaurantId,
            p_table_id: tableId,
            p_token: existingToken,
            p_seat_id: seatId ?? null,
          } as any,
        );

        if (!sessionErr && sessionResult) {
          const token = (sessionResult as any).token as string;
          const expiresAt = (sessionResult as any).expires_at as string;
          setSessionToken(token);
          setTokenValid(true);

          // Persist session to localStorage (keyed by seat so each seat has its own token)
          const isNewSession = !stored || stored.token !== token;
          const startedAt = isNewSession ? new Date().toISOString() : (stored?.startedAt ?? new Date().toISOString());
          saveSession(restaurantId, tableId, token, expiresAt, seatId);
          setSessionStartedAt(startedAt);

          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("token", token);
          window.history.replaceState({}, "", newUrl.toString());
        } else {
          setTokenValid(false);
          clearSession(restaurantId, tableId, seatId);
        }
      } catch {
        setTokenValid(false);
      }

      setTokenChecking(false);
      setTableChecked(true);
    };

    checkTokenAndTable();
  }, [isDemo, tableId, restaurantId, tokenParam, seatId]);

  // Redirect to seat selection if table has seats but no seat is chosen yet
  useEffect(() => {
    if (!isDemo && tableId && !seatId && tableChecked && tokenValid && restaurantId) {
      supabase
        .from("table_seats")
        .select("id")
        .eq("table_id", tableId)
        .limit(1)
        .then(({ data: seatsData }) => {
          if (seatsData && seatsData.length > 0) {
            const tokenQuery = sessionToken ? `&token=${sessionToken}` : "";
            navigate(`/menu/${restaurantId}/select-seat?table=${tableId}${tokenQuery}`, { replace: true });
          }
        });
    }
  }, [isDemo, tableId, seatId, tableChecked, tokenValid, restaurantId, sessionToken, navigate]);

  return {
    tableName,
    tableIsOpen,
    seatNumber,
    tokenValid,
    tokenChecking,
    tableChecked,
    sessionToken,
    sessionStartedAt,
  };
}
