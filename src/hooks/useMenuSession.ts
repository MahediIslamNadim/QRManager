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
}

/**
 * Handles table validation, session token creation/reuse, and seat number lookup.
 * Extracted from CustomerMenu so that component is not responsible for auth logic.
 */
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

  // Token + table validation
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

        const { data: sessionResult, error: sessionErr } = await supabase.rpc(
          "validate_and_create_session" as any,
          {
            p_restaurant_id: restaurantId,
            p_table_id: tableId,
            p_token: tokenParam ?? null,
            p_seat_id: seatId ?? null,
          } as any,
        );

        if (!sessionErr && sessionResult) {
          const token = (sessionResult as any).token as string;
          setSessionToken(token);
          setTokenValid(true);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("token", token);
          window.history.replaceState({}, "", newUrl.toString());
        } else {
          setTokenValid(false);
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
  };
}
