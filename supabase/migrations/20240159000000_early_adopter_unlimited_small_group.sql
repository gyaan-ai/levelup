-- Give all parents who have the early adopter 2-athlete entitlement "unlimited" free small group
-- (remaining = 999). You can expire by setting remaining = 0 in DB or Admin later.
UPDATE public.early_adopter_entitlements
SET remaining = 999
WHERE session_type = '2-athlete';
