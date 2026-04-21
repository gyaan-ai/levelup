import Link from 'next/link';
import { fetchPublicOpenJoinSummaries } from '@/lib/map/fetch-public-open-join-summaries';
import { formatEST } from '@/lib/format-date';
import { Badge } from '@/components/ui/badge';

export async function PublicOpenJoinSessionsTable({
  tenantSlug,
  rowKindFilter = 'all',
  isLoggedIn,
}: {
  tenantSlug: string;
  rowKindFilter?: 'all' | 'partner' | 'small_group';
  isLoggedIn: boolean;
}) {
  const rowsAll = await fetchPublicOpenJoinSummaries(tenantSlug, { daysAhead: 21, maxCoaches: 40 });
  const rows =
    rowKindFilter === 'all'
      ? rowsAll
      : rowKindFilter === 'partner'
        ? rowsAll.filter((r) => r.nextKind === 'Partner')
        : rowsAll.filter((r) => r.nextKind === 'Small group');

  const loginWithRedirect = (path: string) => `/login?redirect=${encodeURIComponent(path)}`;

  return (
    <div
      id="open-sessions"
      className="mt-10 scroll-mt-24 rounded-xl border border-accent/25 bg-black/50 px-4 py-6 md:px-6"
    >
      <h3 className="font-serif text-lg font-bold uppercase tracking-wide text-accent md:text-xl">
        Open sessions — join now
      </h3>
      <p className="mt-2 max-w-2xl text-sm text-white/60">
        Coach-posted join-ins: partner sessions (two athletes with the coach) and small groups. For your own time, book
        private or partner with a coach from the map.
      </p>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-white/50">
          No matching open spots in the next few weeks.{' '}
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
          <table className="w-full min-w-[720px] text-left text-sm text-white/85">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wide text-white/45">
                <th className="px-3 py-2.5 font-medium">Coach</th>
                <th className="px-3 py-2.5 font-medium">Type</th>
                <th className="px-3 py-2.5 font-medium">Openings</th>
                <th className="px-3 py-2.5 font-medium">Next session</th>
                <th className="px-3 py-2.5 font-medium">Where</th>
                <th className="px-3 py-2.5 font-medium"> </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const isPartner = r.nextKind === 'Partner';
                const registerPath = `/sessions/${r.nextSessionId}/register`;
                const actionHref = isLoggedIn ? registerPath : loginWithRedirect(registerPath);
                const actionLabel = isLoggedIn ? 'Add to cart' : 'Reserve';
                return (
                  <tr key={r.coachId} className="border-b border-white/[0.06] last:border-0">
                    <td className="px-3 py-3">
                      <Link
                        href={`/athlete/${r.coachId}`}
                        className="font-medium text-accent hover:underline"
                      >
                        {r.coachName}
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <Badge
                        variant="outline"
                        className={
                          isPartner
                            ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'
                            : 'border-violet-500/50 bg-violet-500/10 text-violet-200'
                        }
                      >
                        {isPartner ? 'Partner' : 'Small group'}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-white/70">
                      {r.openCount} session{r.openCount !== 1 ? 's' : ''}
                    </td>
                    <td className="px-3 py-3 text-white/80">{formatEST(r.nextAt, 'EEE MMM d · h:mm a')}</td>
                    <td className="px-3 py-3 text-white/65">{r.facilityName}</td>
                    <td className="px-3 py-3 text-right">
                      <Link href={actionHref} className="text-xs font-medium text-accent hover:underline">
                        {actionLabel}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-6 text-center text-xs text-white/45">
        Want private training on your schedule?{' '}
        <Link
          href={isLoggedIn ? '/training?tab=coaches&type=private' : loginWithRedirect('/training?tab=coaches&type=private')}
          className="text-accent/90 underline-offset-2 hover:underline"
        >
          Browse coaches for private sessions
        </Link>
        .
      </p>
    </div>
  );
}
