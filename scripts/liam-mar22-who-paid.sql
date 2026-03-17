-- Liam's March 22 session (invite code Z8MQDWSL): who paid and how much.
-- Run in Supabase SQL editor.
-- Note: amount_paid can be backfilled. The only source of truth for "actually paid" is Stripe (checkout.session.completed with amount_total > 0 for this session_id).

-- 1) Session id — use this in Stripe to verify real payments (Payments or Events: metadata.session_id = this id)
SELECT s.id AS session_id
FROM public.sessions s
WHERE s.partner_invite_code = 'Z8MQDWSL'
LIMIT 1;

-- 2) Per participant: exact amount_paid and when they were added (free path often creates rows with amount_paid 0; Stripe webhook sets real amount)
SELECT
  yw.first_name,
  yw.last_name,
  sp.amount_paid,
  sp.created_at AS added_at,
  CASE WHEN (sp.amount_paid IS NOT NULL AND sp.amount_paid > 0) THEN 'DB says PAID' ELSE 'DB says FREE/0' END AS status
FROM public.sessions s
JOIN public.session_participants sp ON sp.session_id = s.id
JOIN public.youth_wrestlers yw ON yw.id = sp.youth_wrestler_id
WHERE s.partner_invite_code = 'Z8MQDWSL'
ORDER BY sp.created_at;

-- 3) Summary from DB only (not proof of Stripe payments)
SELECT
  COUNT(*) FILTER (WHERE sp.amount_paid IS NOT NULL AND sp.amount_paid > 0) AS paid_count,
  COUNT(*) FILTER (WHERE sp.amount_paid IS NULL OR sp.amount_paid <= 0) AS did_not_pay_count,
  COUNT(*) AS total
FROM public.sessions s
JOIN public.session_participants sp ON sp.session_id = s.id
WHERE s.partner_invite_code = 'Z8MQDWSL';
