-- Parent home ZIP: maps, nearby coach features, and analytics (zip-level only).
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS zip_code TEXT;

COMMENT ON COLUMN public.users.zip_code IS 'Home ZIP (5 or ZIP+4). Required on new parent and youth_wrestler signup; used for maps and location-based features.';
