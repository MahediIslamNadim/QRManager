import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { clearMenuSession, loadMenuSession, saveMenuSession } from "@/lib/menuSessionStorage";

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
export const clearSession = clearMenuSession;

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
  const [tableHasSeats, setTableHasSeats] = useState(false);

  // Token + table validation with localStorage persistence
  useEffect(() => {
    if (isDemo || !tableId || !restaurantId) return;

    const checkTokenAndTable = async () => {
      setTokenChecking(true);
      try {
        // Check localStorage first (restores session on refresh)
        const stored = loadMenuSession(restaurantId, tableId, seatId);
        const existingToken = stored?.token ?? tokenParam ?? null;

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
          const isNewSession = !stored || stored.token !== token;
          const startedAt = isNewSession ? new Date().toISOString() : (stored?.startedAt ?? new Date().toISOString());
          saveMenuSession(restaurantId, tableId, token, expiresAt, seatId, startedAt);

          const { data: tableContext, error: contextErr } = await supabase.rpc(
            "get_public_table_context" as any,
            {
              p_restaurant_id: restaurantId,
              p_table_id: tableId,
              p_token: token,
              p_seat_id: seatId ?? null,
            } as any,
          );

          if (contextErr || !tableContext) {
            setTokenValid(false);
            setTableIsOpen(false);
            clearMenuSession(restaurantId, tableId, seatId);
            setTokenChecking(false);
            setTableChecked(true);
            return;
          }

          const table = (tableContext as any).table ?? {};
          setTableName(table.name ?? "N/A");
          setTableIsOpen(table.is_open !== false);
          setTableHasSeats(Boolean(table.has_seats));
          setSeatNumber((tableContext as any).seat_number ?? null);
          setSessionToken(token);
          setTokenValid(table.is_open !== false);
          setSessionStartedAt(startedAt);

          if (tokenParam) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete("token");
            window.history.replaceState({}, "", newUrl.toString());
          }
        } else {
          setTokenValid(false);
          setTableIsOpen(false);
          clearMenuSession(restaurantId, tableId, seatId);
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
    if (!isDemo && tableId && !seatId && tableChecked && tokenValid && restaurantId && tableHasSeats) {
      navigate(`/menu/${restaurantId}/select-seat?table=${tableId}`, { replace: true });
    }
  }, [isDemo, tableId, seatId, tableChecked, tokenValid, restaurantId, tableHasSeats, navigate]);

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
