
CREATE OR REPLACE FUNCTION public.check_slot_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO current_count
  FROM public.lunch_requests
  WHERE lunch_time = NEW.lunch_time
    AND shift = NEW.shift
    AND date = NEW.date
    AND status IN ('pending', 'approved');

  IF current_count >= 3 THEN
    RAISE EXCEPTION 'This time slot is full (maximum 3 people allowed)';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_slot_capacity
  BEFORE INSERT ON public.lunch_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.check_slot_capacity();
