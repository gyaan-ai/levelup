-- Lock admin rewards SECURITY DEFINER RPCs to service_role only.
-- Without this, PostgREST may expose them to authenticated/anon clients,
-- allowing arbitrary parent_id / date-range reads of credits activity.

REVOKE ALL ON FUNCTION public.admin_rewards_parent_ledger(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rewards_parent_ledger(uuid, integer, integer) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_rewards_parent_ledger(uuid, integer, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_rewards_parent_ledger(uuid, integer, integer) TO service_role;

REVOKE ALL ON FUNCTION public.admin_rewards_parent_directory() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rewards_parent_directory() FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_rewards_parent_directory() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_rewards_parent_directory() TO service_role;

REVOKE ALL ON FUNCTION public.admin_rewards_outstanding_liability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rewards_outstanding_liability() FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_rewards_outstanding_liability() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_rewards_outstanding_liability() TO service_role;

REVOKE ALL ON FUNCTION public.admin_rewards_issued_in_range(timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rewards_issued_in_range(timestamp with time zone, timestamp with time zone) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_rewards_issued_in_range(timestamp with time zone, timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_rewards_issued_in_range(timestamp with time zone, timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.admin_rewards_redeemed_in_range(timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rewards_redeemed_in_range(timestamp with time zone, timestamp with time zone) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_rewards_redeemed_in_range(timestamp with time zone, timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_rewards_redeemed_in_range(timestamp with time zone, timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.admin_rewards_pending_referrals_hold() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rewards_pending_referrals_hold() FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_rewards_pending_referrals_hold() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_rewards_pending_referrals_hold() TO service_role;

REVOKE ALL ON FUNCTION public.admin_rewards_by_type_month(timestamp with time zone, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_rewards_by_type_month(timestamp with time zone, timestamp with time zone) FROM authenticated;
REVOKE ALL ON FUNCTION public.admin_rewards_by_type_month(timestamp with time zone, timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_rewards_by_type_month(timestamp with time zone, timestamp with time zone) TO service_role;
