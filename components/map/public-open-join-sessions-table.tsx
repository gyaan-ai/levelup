import Link from 'next/link';
import { fetchPublicOpenJoinSummaries } from '@/lib/map/fetch-public-open-join-summaries';
import { formatEST } from '@/lib/format-date';

export async function PublicOpenJoinSessionsTable({ tenantSlug }: { tenantSlug: string }) {
  const rows = await fetchPublicOpenJoinSummaries(tenantSlug, { daysAhead: 21, maxCoaches: 40 });
  const loginWithRedirect = (path: string) =>
    `/login?redirect=${encodeURIComponent(path)}`;

  return (
    <div className="mt-10 rounded-xl border border-accent/25 bg-black/50 px-4 py-6 md:px-6">
      <h3 className="font-serif text-lg font-bold uppercase tracking-wide text-accent md:text-xl">
        Open partner &amp; small group sessions
      </h3>
      <p className="mt-2 max-w-2xl text-sm text-white/60">
        These are <span className="text-white/80">public join-in sessions</span> coaches have posted (partner = two
        athletes with the coach; small group = coach with several athletes). For your own time, book private or partner
        on the map—partner means you&apos;ll line up the second wrestler.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-white/50">
          No open partner or small group spots in the next few weeks.{' '}
          <Link href="/signup" className="text-accent underline-offset-2 hover:underline">
            Create an account
          </Link>{' '}
          or{' '}
          <Link href="/login" className="text-accent underline-offset-2 hover:underline">
            log in
          </Link>{' '}
          to start a booking with any coach.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full min-w-[640px] text-left text-sm text-white/85">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-white/45">
                <th className="px-3 py-2.5 font-medium">Coach</th>
                <th className="px-3 py-2.5 font-medium">Openings</th>
                <th className="px-3 py-2.5 font-medium">Next session</th>
                <th className="px-3 py-2.5 font-medium">Where</th>
                <th className="px-3 py-2.5 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.coachId} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-3 py-3">
                    <Link
                      href={`/athlete/${r.coachId}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {r.coachName}
                    </Link>
                  </td>
                  <td className="px-3 py-3 tabular-nums text-white/70">
                    {r.openCount} session{r.openCount !== 1 ? 's' : ''}
                  </td>
                  <td className="px-3 py-3 text-white/80">
                    <span className="text-white/55">{r.nextKind}</span>
                    <span className="mx-1.5 text-white/30">·</span>
                    {formatEST(r.nextAt, 'EEE MMM d · h:mm a')}
                  </td>
                  <td className="px-3 py-3 text-white/65">{r.facilityName}</td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={loginWithRedirect(`/sessions/${r.nextSessionId}/register`)}
                      className="text-xs font-medium text-accent hover:underline"
                    >
                      Reserve
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-white/45">
        Don&apos;t see a time that works?{' '}
        <Link href="/signup" className="text-accent/90 underline-offset-2 hover:underline">
          Sign up
        </Link>{' '}
        to start a new booking with a coach (private or partner—invite your partner for partner).
      </p>
    </div>
  );
}
