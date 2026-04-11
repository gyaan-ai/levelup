'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { SchoolLogo } from '@/components/school-logo';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRouter } from 'next/navigation';
import { Printer, ExternalLink } from 'lucide-react';
import type { CoachProgramAgg, ProgramReportPeriod } from '@/lib/program-report-aggregates';

const PERIODS: { value: ProgramReportPeriod; label: string }[] = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'all', label: 'All time' },
];

type Props = {
  tenantLogo: string;
  tenantName: string;
  schoolKey: string;
  schoolDisplay: string;
  period: ProgramReportPeriod;
  periodLabel: string;
  rows: CoachProgramAgg[];
  programTotal: number;
  totalEarningSessions: number;
  generatedAtLabel: string;
  schoolOptions: { value: string; label: string }[];
};

export function ProgramReportView({
  tenantLogo,
  tenantName,
  schoolKey,
  schoolDisplay,
  period,
  periodLabel,
  rows,
  programTotal,
  totalEarningSessions,
  generatedAtLabel,
  schoolOptions,
}: Props) {
  const router = useRouter();

  const navigate = (nextSchool: string, nextPeriod: ProgramReportPeriod) => {
    const q = new URLSearchParams();
    q.set('school', nextSchool);
    q.set('period', nextPeriod);
    router.push(`/admin/program-report?${q.toString()}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="print:hidden border-b border-border bg-muted/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin">← Admin</Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={schoolKey} onValueChange={(v) => navigate(v, period)}>
            <SelectTrigger className="w-[min(100vw-2rem,280px)]">
              <SelectValue placeholder="Program" />
            </SelectTrigger>
            <SelectContent>
              {schoolOptions.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={period} onValueChange={(v) => navigate(schoolKey, v as ProgramReportPeriod)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" className="bg-[#B89D60] hover:bg-[#9A8550] text-black" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-2" />
            Print / Save as PDF
          </Button>
        </div>
      </div>

      <div className="container mx-auto max-w-4xl px-4 py-8 print:py-6 print:max-w-none">
        <header className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 border-b border-border pb-6 mb-8 print:pb-4 print:mb-6">
          <div className="flex items-start gap-4">
            <div className="relative h-14 w-36 shrink-0 print:h-12 print:w-32">
              <Image
                src={tenantLogo}
                alt={tenantName}
                fill
                className="object-contain object-left"
                sizes="144px"
                priority
              />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{tenantName}</p>
              <h1 className="text-2xl font-bold text-foreground print:text-xl">Coach earnings — program leaderboard</h1>
              <p className="text-muted-foreground mt-1">
                <span className="font-medium text-foreground">{schoolDisplay}</span>
                <span className="mx-2">·</span>
                {periodLabel}
              </p>
              <p className="text-xs text-muted-foreground mt-2">Generated {generatedAtLabel} (Eastern)</p>
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0 print:mt-0">
            {schoolKey !== '__nonaffiliated__' && (
              <div className="rounded-lg border border-border bg-card p-2 print:border-0 print:bg-transparent print:p-0">
                <SchoolLogo school={schoolDisplay} size="lg" />
              </div>
            )}
          </div>
        </header>

        <section className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 print:mb-6">
          <div className="rounded-lg border border-border bg-muted/20 p-4 print:p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">Program total (est.)</p>
            <p className="text-2xl font-bold text-[#B89D60] print:text-xl">${programTotal.toFixed(0)}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4 print:p-3">
            <p className="text-xs font-medium uppercase text-muted-foreground">Sessions in scope</p>
            <p className="text-2xl font-bold print:text-xl">{totalEarningSessions}</p>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4 print:p-3 col-span-2 sm:col-span-1">
            <p className="text-xs font-medium uppercase text-muted-foreground">Coaches listed</p>
            <p className="text-2xl font-bold print:text-xl">{rows.length}</p>
          </div>
        </section>

        <div className="rounded-lg border border-border overflow-hidden print:border print:rounded-none">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-left">
                <th className="py-3 px-3 font-semibold w-12">#</th>
                <th className="py-3 px-3 font-semibold">Coach</th>
                <th className="py-3 px-3 font-semibold text-right">Est. earnings</th>
                <th className="py-3 px-3 font-semibold text-right hidden sm:table-cell">Sessions</th>
                <th className="py-3 px-3 font-semibold text-right hidden md:table-cell">Completed</th>
                <th className="py-3 px-3 font-semibold text-right hidden md:table-cell">Rating</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-muted-foreground">
                    No sessions with earnings in this period for this program.
                  </td>
                </tr>
              ) : (
                rows.map((row, idx) => (
                  <tr key={row.athlete_id} className="border-b border-border/80">
                    <td className="py-3 px-3 text-muted-foreground">{idx + 1}</td>
                    <td className="py-3 px-3 font-medium">{row.coach_name}</td>
                    <td className="py-3 px-3 text-right tabular-nums font-semibold text-[#B89D60]">
                      ${row.total_earnings.toFixed(0)}
                    </td>
                    <td className="py-3 px-3 text-right tabular-nums hidden sm:table-cell">{row.earnings_sessions}</td>
                    <td className="py-3 px-3 text-right tabular-nums hidden md:table-cell">{row.completed_sessions}</td>
                    <td className="py-3 px-3 text-right hidden md:table-cell">
                      {row.review_count > 0 && row.average_rating != null
                        ? `${row.average_rating.toFixed(1)} (${row.review_count})`
                        : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <footer className="mt-10 pt-6 border-t border-border text-xs text-muted-foreground space-y-2 print:mt-8 print:pt-4">
          <p>
            Amounts use the same rules as coach payouts: recorded coach payment when set; otherwise estimated from
            payments received or list price × participants × coach rate.
          </p>
          <p className="flex items-center gap-1 print:hidden">
            <ExternalLink className="h-3 w-3" />
            Share this view from Admin → People → Coaches → Program report, or send the PDF from Print / Save as PDF.
          </p>
        </footer>
      </div>
    </div>
  );
}
