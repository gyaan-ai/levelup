-- Allow multiple cart rows per user for the same session (e.g. two children, one transaction).
ALTER TABLE public.cart_items DROP CONSTRAINT IF EXISTS cart_items_user_id_session_id_key;
