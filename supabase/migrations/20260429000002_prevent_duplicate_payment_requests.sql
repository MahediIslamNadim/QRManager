-- Prevent duplicate manual payment requests and normalize transaction IDs.

CREATE OR REPLACE FUNCTION public.guard_payment_request_duplicates()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  duplicate_payment_id uuid;
  pending_payment_id uuid;
BEGIN
  NEW.transaction_id := upper(trim(coalesce(NEW.transaction_id, '')));

  IF NEW.transaction_id = '' THEN
    RAISE EXCEPTION 'transaction_id is required';
  END IF;

  IF NEW.status = 'pending' THEN
    SELECT id
      INTO pending_payment_id
    FROM public.payment_requests
    WHERE restaurant_id = NEW.restaurant_id
      AND status = 'pending'
      AND id <> NEW.id
    LIMIT 1;

    IF pending_payment_id IS NOT NULL THEN
      RAISE EXCEPTION 'A pending payment request already exists for this restaurant.';
    END IF;
  END IF;

  IF NEW.status IN ('pending', 'approved') THEN
    SELECT id
      INTO duplicate_payment_id
    FROM public.payment_requests
    WHERE upper(trim(transaction_id)) = NEW.transaction_id
      AND status IN ('pending', 'approved')
      AND id <> NEW.id
    LIMIT 1;

    IF duplicate_payment_id IS NOT NULL THEN
      RAISE EXCEPTION 'This transaction ID has already been used in another payment request.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_payment_request_duplicates ON public.payment_requests;
CREATE TRIGGER trg_guard_payment_request_duplicates
  BEFORE INSERT OR UPDATE OF transaction_id, status
  ON public.payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_payment_request_duplicates();
