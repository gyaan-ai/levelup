import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Notify all parents who follow this coach that the coach has updated their availability.
 * Call after adding or removing availability. Uses admin client to insert notifications.
 */
export async function notifyAvailabilityFollowers(
  tenantSlug: string,
  coachId: string
): Promise<void> {
  try {
    const admin = createAdminClient(tenantSlug);
    const { data: follows } = await admin
      .from('coach_follows')
      .select('parent_id')
      .eq('coach_id', coachId);
    if (!follows?.length) return;

    const { data: coach } = await admin
      .from('athletes')
      .select('first_name, last_name')
      .eq('id', coachId)
      .single();
    const name = coach
      ? `${coach.first_name} ${coach.last_name}`
      : 'A coach you follow';

    const title = `New availability: ${name}`;
    const body = `${name} updated their calendar. Check their profile to book a session.`;
    const link = `/athlete/${coachId}`;

    await Promise.all(
      follows.map((f) =>
        admin.from('notifications').insert({
          user_id: f.parent_id,
          type: 'coach_new_availability',
          title,
          body,
          data: { coach_id: coachId, link },
        })
      )
    );
  } catch (e) {
    console.warn('notifyAvailabilityFollowers failed:', e);
  }
}
