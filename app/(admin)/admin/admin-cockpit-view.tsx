'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Users,
  UserPlus,
  Calendar,
  CreditCard,
  DollarSign,
  Wallet,
  TrendingUp,
  Loader2,
  Gauge,
  ClipboardList,
  Eye,
  Star,
} from 'lucide-react';
import { formatEST } from '@/lib/format-date';
import Link from 'next/link';

function formatRange(start: string, end: string, type: 'week' | 'month'): string {
  const s = new Date(start + 'T12:00:00.000Z');
  const e = new Date(end + 'T12:00:00.000Z');
  if (type === 'month') return formatEST(s, 'MMMM yyyy');
  return `${formatEST(s, 'MMM d')} – ${formatEST(e, 'MMM d, yyyy')}`;
}

export type CockpitData = {
  date: string;
  range?: 'today' | 'week' | 'month';
  rangeStart?: string;
  rangeEnd?: string;
  newParents: { id: string; email: string; created_at: string }[];
  newCoaches: { id: string; name: string; school: string; created_at: string }[];
  newAthletes: { id: string; name: string; parent_id: string; created_at: string }[];
  sessionsScheduled: {
    id: string;
    scheduled_datetime: string;
    status: string;
    session_type: string;
    session_mode: string;
    coach_name: string;
    facility_name: string;
    participants: string;
  }[];
  bookings: {
    id: string;
    session_id: string;
    amount_paid: number | null;
    created_at: string;
    kid_name: string;
    coach_name: string;
    facility_name: string;
    scheduled_datetime: string;
  }[];
  earlyAccess: { id: string; email: string; name: string; created_at: string }[];
  payoutsPaid: number;
  /** Sum of coach payouts marked paid, all time (any payout date) */
  payoutsPaidAllTime?: number;
  payoutsPaidList: { session_id: string; amount: number; coach_name: string }[];
  revenueThatDay: number;
  /** Per-period signup economics: count, gross from parents, session-level coach/Stripe/Guild */
  bookingEconomics?: {
    bookingCount: number;
    gross: number;
    coachPayouts: number;
    stripeFees: number;
    guildOrgFees: number;
    remainder: number;
  };
  pageViews?: number;
  visitors?: number;
  trends: {
    parents: number[];
    coaches: number[];
    athletes: number[];
    sessions: number[];
    bookings: number[];
    /** Gross parent payments (sum amount_paid) per trend bucket */
    bookingGross?: number[];
    earlyAccess: number[];
    reviews: number[];
  };
  /** All-time row counts at end of each trend bucket (same keys as trends; bookingGross = cumulative $) */
  trendCumulativeTotals?: {
    parents: number[];
    coaches: number[];
    athletes: number[];
    sessions: number[];
    bookings: number[];
    bookingGross?: number[];
    earlyAccess: number[];
    reviews: number[];
  };
  trendDays: string[];
  trendLabels?: string[];
  trendPeriod?: '7d' | '3w' | '12m';
  trendDetailParents?: { id: string; email: string; created_at: string }[];
  trendDetailCoaches?: { id: string; name: string; school: string; created_at: string }[];
  trendDetailAthletes?: { id: string; name: string; parent_id: string; created_at: string }[];
  trendDetailReviews?: { id: string; coach_name: string; reviewed_by: string; rating: number; comment: string; created_at: string }[];
  trendDetailSessions?: {
    id: string;
    scheduled_datetime: string;
    status: string;
    session_type: string;
    session_mode: string;
    coach_name: string;
    facility_name: string;
    participants: string;
  }[];
  trendDetailBookings?: {
    id: string;
    session_id: string;
    amount_paid: number | null;
    created_at: string;
    kid_name: string;
    coach_name: string;
    facility_name: string;
    scheduled_datetime: string;
  }[];
  trendDetailEarlyAccess?: { id: string; email: string; name: string; created_at: string }[];
};

const COCKPIT_TIMEZONE = 'America/New_York';

function todayInTz(tz: string): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: tz });
}

function yesterdayInTz(tz: string): string {
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const [y, m, d] = todayStr.split('-').map(Number);
  const todayNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const yesterdayNoon = new Date(todayNoon.getTime() - 24 * 60 * 60 * 1000);
  return yesterdayNoon.toLocaleDateString('en-CA', { timeZone: tz });
}

function formatChartCurrency(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `$${Math.round(n / 1000)}k`;
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

function niceYMax(max: number): number {
  if (max <= 0) return 5;
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const n = Math.ceil(max / step);
  if (n <= 1) return Math.max(5, step);
  return n * step;
}

/** Additive series: month 1 + month 3 → second point shows 4 */
function runningSum(values: number[]): number[] {
  let s = 0;
  return values.map((v) => {
    s += v;
    return s;
  });
}

/** Line + points: visible on dark backgrounds */
const ACTIVITY_LINE_STROKE = '#38bdf8';
const ACTIVITY_LINE_POINT_FILL = '#38bdf8';
const ACTIVITY_BAR_CLASS = 'bg-sky-500/90 hover:bg-sky-400';

function TrendLineChart({
  values,
  labels,
  metricLabel,
  mode,
  valueFormat = 'number',
}: {
  values: number[];
  labels: string[];
  metricLabel: string;
  /** runningTotal = 1+3+… additive; perPeriod = each bucket alone */
  mode: 'runningTotal' | 'perPeriod';
  valueFormat?: 'number' | 'currency';
}) {
  const raw = values.slice(0, labels.length);
  const vals = mode === 'runningTotal' ? runningSum(raw) : raw;
  const maxVal = Math.max(0, ...vals, 0);
  const yMax = niceYMax(maxVal);
  const chartHeight = 240;
  const chartWidth = 720;
  const padL = 44;
  const padR = 12;
  const padT = 12;
  const padB = 36;
  const innerW = chartWidth - padL - padR;
  const innerH = chartHeight - padT - padB;
  const n = vals.length;
  const yTicks = yMax <= 0 ? [0] : [0, ...(yMax <= 5 ? [yMax] : [Math.floor(yMax / 2), yMax])];

  const xPos = (i: number) => {
    if (n <= 1) return padL + innerW / 2;
    return padL + (i / (n - 1)) * innerW;
  };
  const yPos = (v: number) => {
    if (yMax <= 0) return padT + innerH;
    return padT + innerH - (v / yMax) * innerH;
  };

  const points = vals.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {metricLabel} ·{' '}
        {mode === 'runningTotal'
          ? 'running total in this window (each period adds to the last)'
          : 'new in each period only'}
      </p>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[320px] h-[240px]"
          role="img"
          aria-label={`${metricLabel} trend`}
        >
          {/* grid */}
          {yTicks.map((t) => {
            const y = yPos(t);
            return (
              <line
                key={t}
                x1={padL}
                y1={y}
                x2={chartWidth - padR}
                y2={y}
                className="stroke-muted"
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            );
          })}
          {/* Y-axis labels */}
          {[...yTicks].reverse().map((t) => (
            <text
              key={`y-${t}`}
              x={padL - 4}
              y={yPos(t) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px] font-medium tabular-nums"
            >
              {valueFormat === 'currency' ? formatChartCurrency(t) : t}
            </text>
          ))}
          {/* Line */}
          {n > 0 && yMax > 0 && (
            <polyline
              fill="none"
              stroke={ACTIVITY_LINE_STROKE}
              strokeWidth={2.5}
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points}
            />
          )}
          {/* Points */}
          {vals.map((v, i) => (
            <circle
              key={i}
              cx={xPos(i)}
              cy={yPos(v)}
              r={4}
              fill={ACTIVITY_LINE_POINT_FILL}
              stroke="#0369a1"
              strokeWidth={1.5}
            />
          ))}
          {/* X labels */}
          {labels.map((l, i) => (
            <text
              key={i}
              x={xPos(i)}
              y={chartHeight - 8}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-medium"
            >
              {l.length > 12 ? `${l.slice(0, 10)}…` : l}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

function StandardBarChart({
  values,
  labels,
  metricLabel,
  mode,
  valueFormat = 'number',
}: {
  values: number[];
  labels: string[];
  metricLabel: string;
  mode: 'runningTotal' | 'perPeriod';
  valueFormat?: 'number' | 'currency';
}) {
  const raw = values.slice(0, labels.length);
  const vals = mode === 'runningTotal' ? runningSum(raw) : raw;
  const maxVal = Math.max(0, ...vals);
  const yMax = niceYMax(maxVal);
  const chartHeight = 240;
  const yTicks = yMax <= 0 ? [0] : [0, ...(yMax <= 5 ? [yMax] : [Math.floor(yMax / 2), yMax])];

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {metricLabel} ·{' '}
        {mode === 'runningTotal'
          ? 'running total in this window (each period adds to the last)'
          : 'new in each period only'}
      </p>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {/* Y-axis */}
        <div className="flex flex-col justify-between shrink-0 text-right pr-2 border-r border-border" style={{ height: chartHeight }}>
          {[...yTicks].reverse().map((t) => (
            <span key={t} className="text-xs font-medium tabular-nums text-muted-foreground">
              {valueFormat === 'currency' ? formatChartCurrency(t) : t}
            </span>
          ))}
        </div>
        {/* Chart + X-axis */}
        <div className="flex-1 min-w-0">
          <div className="flex gap-1 items-end" style={{ height: chartHeight }}>
            {vals.map((v, i) => {
              const barHeightPx = yMax > 0 ? Math.max(2, (v / yMax) * chartHeight) : 0;
              return (
                <div
                  key={i}
                  className="flex-1 min-w-[20px] max-w-[48px] flex flex-col items-center justify-end gap-0.5"
                  style={{ height: chartHeight }}
                  title={`${labels[i] ?? '—'}: ${valueFormat === 'currency' ? formatChartCurrency(v) : v}`}
                >
                  <div
                    className={`w-full rounded-t transition-colors min-h-[2px] flex-shrink-0 ${ACTIVITY_BAR_CLASS}`}
                    style={{ height: barHeightPx }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex gap-1 mt-1">
            {labels.map((l, i) => (
              <div key={i} className="flex-1 min-w-[20px] max-w-[48px] text-center">
                <span className="text-[10px] font-medium text-muted-foreground truncate block">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const GROWTH_LINE_SPECS: { id: keyof NonNullable<CockpitData['trendCumulativeTotals']>; label: string; color: string }[] = [
  { id: 'bookings', label: 'Bookings', color: '#dc2626' },
  { id: 'bookingGross', label: 'Gross booked ($)', color: '#059669' },
  { id: 'athletes', label: 'Athletes (kids)', color: '#16a34a' },
  { id: 'coaches', label: 'Coaches', color: '#7c3aed' },
  { id: 'parents', label: 'Parents', color: '#2563eb' },
  { id: 'sessions', label: 'Sessions', color: '#ea580c' },
  { id: 'earlyAccess', label: 'Early access', color: '#64748b' },
  { id: 'reviews', label: 'Reviews', color: '#c026d3' },
];

function MultiLineGrowthChart({
  labels,
  cumulative,
  visible,
  onToggle,
}: {
  labels: string[];
  cumulative: NonNullable<CockpitData['trendCumulativeTotals']>;
  visible: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const chartHeight = 280;
  const chartWidth = 800;
  const padL = 52;
  const padR = 16;
  const padT = 16;
  const padB = 52;
  const innerW = chartWidth - padL - padR;
  const innerH = chartHeight - padT - padB;
  const n = labels.length;

  const series = GROWTH_LINE_SPECS.map((spec) => ({
    ...spec,
    values: (cumulative[spec.id] ?? []).slice(0, n),
  })).filter((s) => s.values.length > 0);

  const active = series.filter((s) => visible[s.id] !== false);
  const allVals = active.flatMap((s) => s.values);
  const maxVal = Math.max(0, ...allVals, 0);
  const yMax = niceYMax(maxVal);
  const yTicks = yMax <= 0 ? [0] : [0, ...(yMax <= 5 ? [yMax] : [Math.floor(yMax / 2), yMax])];
  const yAxisIsMoney = active.length > 0 && active.every((s) => s.id === 'bookingGross');

  const xPos = (i: number) => {
    if (n <= 1) return padL + innerW / 2;
    return padL + (i / (n - 1)) * innerW;
  };
  const yPos = (v: number) => {
    if (yMax <= 0) return padT + innerH;
    return padT + innerH - (v / yMax) * innerH;
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Total records in the database at each period end (all-time growth — lines rise left → right). Athletes (kids) includes legacy rows with no <code className="text-xs bg-muted px-1 rounded">created_at</code>.{' '}
        <strong className="text-foreground">Gross booked ($)</strong> uses dollars — toggle it alone for a readable scale (it does not share the count axis).
      </p>
      <div className="flex flex-wrap gap-2">
        {GROWTH_LINE_SPECS.map((spec) => (
          <button
            key={spec.id}
            type="button"
            onClick={() => onToggle(spec.id)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
              visible[spec.id] !== false ? 'border-primary bg-primary/10' : 'border-border bg-muted/50 opacity-60'
            }`}
          >
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: spec.color }} />
            {spec.label}
          </button>
        ))}
      </div>
      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full min-w-[360px] h-[280px]"
          role="img"
          aria-label="Platform growth over time"
        >
          {yTicks.map((t) => {
            const y = yPos(t);
            return (
              <line
                key={t}
                x1={padL}
                y1={y}
                x2={chartWidth - padR}
                y2={y}
                className="stroke-muted"
                strokeOpacity={0.35}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            );
          })}
          {[...yTicks].reverse().map((t) => (
            <text
              key={`gy-${t}`}
              x={padL - 4}
              y={yPos(t) + 4}
              textAnchor="end"
              className="fill-muted-foreground text-[11px] font-medium tabular-nums"
            >
              {yAxisIsMoney ? formatChartCurrency(t) : t}
            </text>
          ))}
          {active.map((s) => {
            const pts = s.values.map((v, i) => `${xPos(i)},${yPos(v)}`).join(' ');
            return (
              <polyline
                key={s.id}
                fill="none"
                stroke={s.color}
                strokeWidth={2.25}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={pts}
              />
            );
          })}
          {active.map((s) =>
            s.values.map((v, i) => (
              <circle key={`${s.id}-${i}`} cx={xPos(i)} cy={yPos(v)} r={3} fill={s.color} stroke="#fff" strokeWidth={1} />
            ))
          )}
          {labels.map((l, i) => (
            <text
              key={i}
              x={xPos(i)}
              y={chartHeight - 12}
              textAnchor="middle"
              className="fill-muted-foreground text-[10px] font-medium"
            >
              {l.length > 14 ? `${l.slice(0, 12)}…` : l}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function AdminCockpitView() {
  const today = todayInTz(COCKPIT_TIMEZONE);
  const [date, setDate] = useState(today);
  const [range, setRange] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');
  const [trendPeriod, setTrendPeriod] = useState<'7d' | '3w' | '12m'>('7d');
  const [trendMetric, setTrendMetric] = useState<
    'parents' | 'coaches' | 'athletes' | 'sessions' | 'bookings' | 'bookingGross' | 'earlyAccess' | 'reviews'
  >('bookings');
  /** Period activity: bar (default) or line */
  const [trendChartStyle, setTrendChartStyle] = useState<'line' | 'bar'>('bar');
  /** Additive running total in the selected window (default) vs raw per bucket */
  const [activityMode, setActivityMode] = useState<'runningTotal' | 'perPeriod'>('runningTotal');
  const [growthLineVisible, setGrowthLineVisible] = useState<Record<string, boolean>>(() => {
    const o = Object.fromEntries(GROWTH_LINE_SPECS.map((s) => [s.id, true])) as Record<string, boolean>;
    o.bookingGross = false;
    return o;
  });
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/cockpit?date=${range === 'yesterday' ? yesterdayInTz(COCKPIT_TIMEZONE) : date}&range=${range === 'yesterday' ? 'today' : range}&trendPeriod=${trendPeriod}&timezone=${encodeURIComponent(COCKPIT_TIMEZONE)}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
          setData(null);
        } else {
          setData(json);
        }
      })
      .catch(() => {
        setError('Failed to load cockpit data');
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [date, range, trendPeriod]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-destructive">
          {error}
        </CardContent>
      </Card>
    );
  }

  const d = data!;
  const trends = d.trends ?? {
    parents: [], coaches: [], athletes: [], sessions: [], bookings: [], bookingGross: [], earlyAccess: [], reviews: [],
  };
  const trendDays = d.trendDays ?? [];
  const trendLabels = d.trendLabels ?? trendDays.map((ds) => formatEST(new Date(ds + 'T12:00:00'), 'M/d'));

  const trendMetrics = [
    { id: 'parents' as const, label: 'Parents', values: trends.parents ?? [] },
    { id: 'coaches' as const, label: 'Coaches', values: trends.coaches ?? [] },
    { id: 'athletes' as const, label: 'Athletes', values: trends.athletes ?? [] },
    { id: 'sessions' as const, label: 'Sessions', values: trends.sessions ?? [] },
    { id: 'bookings' as const, label: 'Bookings', values: trends.bookings ?? [] },
    { id: 'bookingGross' as const, label: 'Booking $ (gross)', values: trends.bookingGross ?? [] },
    { id: 'earlyAccess' as const, label: 'Early access', values: trends.earlyAccess ?? [] },
    { id: 'reviews' as const, label: 'Reviews', values: trends.reviews ?? [] },
  ];

  const be = d.bookingEconomics;
  const bookingN = be?.bookingCount ?? d.bookings.length;

  const summaryCards = [
    { label: 'Gross (parent payments)', value: `$${d.revenueThatDay.toFixed(0)}`, icon: DollarSign },
    { label: 'Bookings (# signups)', value: bookingN, icon: CreditCard },
    { label: 'New parents', value: d.newParents.length, icon: UserPlus },
    { label: 'New coaches', value: d.newCoaches.length, icon: Users },
    { label: 'New athletes', value: d.newAthletes.length, icon: Users },
    { label: 'Sessions created', value: d.sessionsScheduled.length, icon: Calendar },
    { label: 'Early access', value: d.earlyAccess.length, icon: ClipboardList },
    {
      label: 'Payouts paid (this period)',
      value:
        d.payoutsPaidAllTime != null
          ? `$${d.payoutsPaid.toFixed(0)} · $${d.payoutsPaidAllTime.toFixed(0)} all-time`
          : `$${d.payoutsPaid.toFixed(0)}`,
      icon: Wallet,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Filter bar: aligned row */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold">Command center</h2>
        </div>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Period</span>
            <div className="flex rounded-md border border-input bg-background overflow-hidden">
              {(['today', 'yesterday', 'week', 'month'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRange(r);
                    if (r === 'today') setDate(todayInTz(COCKPIT_TIMEZONE));
                    if (r === 'yesterday') setDate(yesterdayInTz(COCKPIT_TIMEZONE));
                  }}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${range === r ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  {r === 'today' ? 'Today' : r === 'yesterday' ? 'Yesterday' : r === 'week' ? 'This week' : 'This month'}
                </button>
              ))}
            </div>
          </div>
          {(range === 'week' || range === 'month') && (
            <div className="flex items-center gap-2 shrink-0">
              <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">End date</label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-40 bg-background"
              />
            </div>
          )}
          {data && (
            <span className="text-sm text-muted-foreground">
              {range === 'today' && <><strong>{date}</strong></>}
              {range === 'yesterday' && <><strong>{date}</strong></>}
              {range === 'week' && data.rangeStart && data.rangeEnd && <><strong>{formatRange(data.rangeStart, data.rangeEnd, 'week')}</strong></>}
              {range === 'month' && data.rangeStart && data.rangeEnd && <><strong>{formatRange(data.rangeStart, data.rangeEnd, 'month')}</strong></>}
            </span>
          )}
        </div>
      </div>

      {/* At a glance: $ booked, bookings, new users, new sessions */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-muted-foreground">
            {range === 'today' ? 'Today' : range === 'yesterday' ? 'Yesterday' : range === 'week' ? 'This week' : 'This month'} — at a glance
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-baseline gap-x-6 gap-y-2 text-lg">
          <span className="font-semibold text-foreground tabular-nums">{bookingN} bookings</span>
          <span className="font-bold text-2xl tabular-nums">${d.revenueThatDay.toFixed(0)} gross</span>
          {bookingN > 0 && d.revenueThatDay > 0 && (
            <span className="text-muted-foreground">(~${(d.revenueThatDay / bookingN).toFixed(0)} / signup)</span>
          )}
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{d.newParents.length}</span> parents,{' '}
            <span className="font-semibold text-foreground tabular-nums">{d.newCoaches.length}</span> coaches,{' '}
            <span className="font-semibold text-foreground tabular-nums">{d.newAthletes.length}</span> athletes
          </span>
          <span className="text-muted-foreground">
            <span className="font-semibold text-foreground tabular-nums">{d.sessionsScheduled.length}</span> new sessions created
          </span>
        </CardContent>
      </Card>

      {be && (
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-medium text-muted-foreground">Gross vs payouts &amp; fees</CardTitle>
            <p className="text-xs text-muted-foreground mt-1 max-w-3xl leading-relaxed">
              <strong className="text-foreground">{be.bookingCount}</strong> signup rows ·{' '}
              <strong className="text-foreground tabular-nums">${be.gross.toFixed(0)}</strong> gross from parents (sum of{' '}
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">amount_paid</code>). Coach, Stripe, and Guild use each
              session&apos;s values <em>once per session</em> (shared when multiple kids book the same session).
            </p>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 text-sm">
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <dt className="text-xs font-medium text-muted-foreground">Gross (parents)</dt>
                <dd className="text-lg font-semibold tabular-nums">${be.gross.toFixed(0)}</dd>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <dt className="text-xs font-medium text-muted-foreground">Coach payouts</dt>
                <dd className="text-lg font-semibold tabular-nums">${be.coachPayouts.toFixed(0)}</dd>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <dt className="text-xs font-medium text-muted-foreground">Stripe</dt>
                <dd className="text-lg font-semibold tabular-nums">${be.stripeFees.toFixed(0)}</dd>
              </div>
              <div className="rounded-lg border border-border bg-muted/20 px-3 py-2">
                <dt className="text-xs font-medium text-muted-foreground">Guild (org fee)</dt>
                <dd className="text-lg font-semibold tabular-nums">${be.guildOrgFees.toFixed(0)}</dd>
              </div>
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 lg:col-span-2">
                <dt className="text-xs font-medium text-muted-foreground">Check (gross − coach − Stripe − Guild)</dt>
                <dd className="text-lg font-semibold tabular-nums">${be.remainder.toFixed(2)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      )}

      {/* Summary cards: consistent grid and styling */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {summaryCards.map(({ label, value, icon: Icon }) => (
          <Card key={label} className="overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <div className="flex items-center justify-between gap-2">
                <CardDescription className="text-xs font-medium text-muted-foreground">{label}</CardDescription>
                <span className="rounded-md bg-muted/50 p-1.5">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              </div>
              <CardTitle className="text-2xl font-bold tabular-nums mt-1">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
        <Card className="overflow-hidden border-dashed bg-muted/20">
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-2">
              <CardDescription className="text-xs font-medium text-muted-foreground">Website visitors</CardDescription>
              <span className="rounded-md bg-muted/50 p-1.5">
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
            </div>
            <CardTitle className="text-2xl font-bold tabular-nums mt-1">
              {typeof d.visitors === 'number' ? d.visitors : '—'}
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {typeof d.pageViews === 'number' && d.pageViews > 0 ? `${d.pageViews.toLocaleString()} page views` : 'Add a Web Analytics Drain in Vercel → Project → Drains to stream data here.'}
            </p>
          </CardHeader>
        </Card>
      </div>

      {/* Activity by period: bar + line (same per-bucket counts) */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Activity by period
              </CardTitle>
              <CardDescription>
                By default shows a <strong className="text-foreground">running total</strong> in the window (each bucket adds to the previous). Switch to “Per period only” for new-in-bucket counts.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Metric</span>
              <div className="flex rounded-md border border-input bg-background overflow-hidden flex-wrap">
                {trendMetrics.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setTrendMetric(m.id)}
                    className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${trendMetric === m.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <span className="text-sm font-medium text-muted-foreground">Window</span>
              <div className="flex rounded-md border border-input bg-background overflow-hidden">
                {(['7d', '3w', '12m'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setTrendPeriod(p)}
                    className={`px-3 py-2 text-sm font-medium transition-colors ${trendPeriod === p ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                  >
                    {p === '7d' ? 'Week' : p === '3w' ? '3 weeks' : 'Year'}
                  </button>
                ))}
              </div>
              <span className="text-sm font-medium text-muted-foreground">Chart</span>
              <div className="flex rounded-md border border-input bg-background overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTrendChartStyle('bar')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${trendChartStyle === 'bar' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  Bar
                </button>
                <button
                  type="button"
                  onClick={() => setTrendChartStyle('line')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${trendChartStyle === 'line' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  Line
                </button>
              </div>
              <span className="text-sm font-medium text-muted-foreground">Values</span>
              <div className="flex rounded-md border border-input bg-background overflow-hidden">
                <button
                  type="button"
                  onClick={() => setActivityMode('runningTotal')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${activityMode === 'runningTotal' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  Running total
                </button>
                <button
                  type="button"
                  onClick={() => setActivityMode('perPeriod')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${activityMode === 'perPeriod' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  Per period only
                </button>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {trendChartStyle === 'line' ? (
            <TrendLineChart
              values={trendMetrics.find((m) => m.id === trendMetric)?.values ?? []}
              labels={trendLabels}
              metricLabel={trendMetrics.find((m) => m.id === trendMetric)?.label ?? ''}
              mode={activityMode}
              valueFormat={trendMetric === 'bookingGross' ? 'currency' : 'number'}
            />
          ) : (
            <StandardBarChart
              values={trendMetrics.find((m) => m.id === trendMetric)?.values ?? []}
              labels={trendLabels}
              metricLabel={trendMetrics.find((m) => m.id === trendMetric)?.label ?? ''}
              mode={activityMode}
              valueFormat={trendMetric === 'bookingGross' ? 'currency' : 'number'}
            />
          )}
        </CardContent>
      </Card>

      {/* All-time growth: multiple lines on one chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Platform growth (all-time)
          </CardTitle>
          <CardDescription>
            Cumulative totals: how many parents, coaches, kids, sessions, bookings, etc. existed in the database at the end of each period below. Toggle series to compare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {d.trendCumulativeTotals ? (
            <MultiLineGrowthChart
              labels={trendLabels}
              cumulative={d.trendCumulativeTotals}
              visible={growthLineVisible}
              onToggle={(id) =>
                setGrowthLineVisible((prev) => ({
                  ...prev,
                  [id]: !(prev[id] !== false),
                }))
              }
            />
          ) : (
            <p className="text-sm text-muted-foreground">Upgrade the app — growth data loads from the latest API.</p>
          )}
        </CardContent>
      </Card>

      {/* Table below chart: rows for the selected trend metric and period */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {trendMetric === 'parents' && <UserPlus className="h-4 w-4" />}
            {trendMetric === 'coaches' && <Users className="h-4 w-4" />}
            {trendMetric === 'athletes' && <Users className="h-4 w-4" />}
            {trendMetric === 'sessions' && <Calendar className="h-4 w-4" />}
            {trendMetric === 'bookings' && <CreditCard className="h-4 w-4" />}
            {trendMetric === 'bookingGross' && <DollarSign className="h-4 w-4" />}
            {trendMetric === 'earlyAccess' && <ClipboardList className="h-4 w-4" />}
            {trendMetric === 'reviews' && <Star className="h-4 w-4" />}
            {trendMetrics.find((m) => m.id === trendMetric)?.label ?? ''} · {trendPeriod === '7d' ? 'Last 7 days' : trendPeriod === '3w' ? 'Last 3 weeks' : 'Last 12 months'}
          </CardTitle>
          <CardDescription>
            {trendMetric === 'parents' && 'Parents who signed up in this period'}
            {trendMetric === 'coaches' && 'Coaches onboarded in this period'}
            {trendMetric === 'athletes' && 'Youth wrestlers added in this period'}
            {trendMetric === 'sessions' && 'Sessions created in this period'}
            {trendMetric === 'bookings' && 'Bookings (signups) in this period'}
            {trendMetric === 'bookingGross' &&
              'Sum of parent payments (amount_paid on new signup rows) in each period — use Running total to see dollars accumulate across the window.'}
            {trendMetric === 'earlyAccess' && 'Early access signups in this period'}
            {trendMetric === 'reviews' && 'Reviews left in this period — coach, reviewer, stars, comment'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {trendMetric === 'parents' && (d.trendDetailParents ?? []).length > 0 && (
            <ul className="space-y-2 text-sm">
              {(d.trendDetailParents ?? []).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <a href={`mailto:${p.email}`} className="text-accent hover:underline truncate">{p.email}</a>
                  <span className="text-muted-foreground shrink-0">{formatEST(new Date(p.created_at), 'MMM d h:mm a')}</span>
                </li>
              ))}
            </ul>
          )}
          {trendMetric === 'coaches' && (d.trendDetailCoaches ?? []).length > 0 && (
            <ul className="space-y-2 text-sm">
              {(d.trendDetailCoaches ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <Link href={`/athlete/${c.id}`} className="text-accent hover:underline">{c.name}</Link>
                  <span className="text-muted-foreground shrink-0">{c.school} · {formatEST(new Date(c.created_at), 'MMM d')}</span>
                </li>
              ))}
            </ul>
          )}
          {trendMetric === 'athletes' && (d.trendDetailAthletes ?? []).length > 0 && (
            <ul className="space-y-2 text-sm">
              {(d.trendDetailAthletes ?? []).map((y) => (
                <li key={y.id} className="flex items-center justify-between gap-2">
                  <Link href={`/wrestlers/${y.id}`} className="text-accent hover:underline">{y.name}</Link>
                  <span className="text-muted-foreground shrink-0">{formatEST(new Date(y.created_at), 'MMM d h:mm a')}</span>
                </li>
              ))}
            </ul>
          )}
          {trendMetric === 'sessions' && (d.trendDetailSessions ?? []).length > 0 && (
            <ul className="space-y-2 text-sm">
              {(d.trendDetailSessions ?? []).map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/admin/sessions/${s.id}/edit`} className="text-accent hover:underline">{s.coach_name} · {s.facility_name}</Link>
                  <span className="text-muted-foreground">{formatEST(new Date(s.scheduled_datetime), 'MMM d h:mm a')} · {s.participants}</span>
                </li>
              ))}
            </ul>
          )}
          {trendMetric === 'bookingGross' && (
            <p className="text-sm text-muted-foreground">
              See the chart above for totals. For each signup line with amount, switch the metric to <strong className="text-foreground">Bookings</strong>.
            </p>
          )}
          {trendMetric === 'bookings' && (d.trendDetailBookings ?? []).length > 0 && (
            <ul className="space-y-2 text-sm">
              {(d.trendDetailBookings ?? []).map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{b.kid_name ?? '—'} · {b.coach_name} · {b.facility_name}</span>
                  <span className="text-muted-foreground">
                    {b.amount_paid != null ? `$${b.amount_paid.toFixed(2)}` : '—'}
                    {b.created_at ? ` · ${formatEST(new Date(b.created_at), 'MMM d')}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {trendMetric === 'earlyAccess' && (d.trendDetailEarlyAccess ?? []).length > 0 && (
            <ul className="space-y-2 text-sm">
              {(d.trendDetailEarlyAccess ?? []).map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <a href={`mailto:${e.email}`} className="text-accent hover:underline truncate">{e.email}</a>
                  {e.name !== '—' && <span className="text-muted-foreground truncate">{e.name}</span>}
                </li>
              ))}
            </ul>
          )}
          {trendMetric === 'reviews' && (d.trendDetailReviews ?? []).length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Coach</th>
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Reviewed by</th>
                    <th className="text-left py-2 pr-3 font-medium text-muted-foreground">Stars</th>
                    <th className="text-left py-2 font-medium text-muted-foreground">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {(d.trendDetailReviews ?? []).map((r) => (
                    <tr key={r.id} className="border-b border-border/50">
                      <td className="py-2 pr-3 font-medium">{r.coach_name}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{r.reviewed_by}</td>
                      <td className="py-2 pr-3">
                        <span className="inline-flex gap-0.5" aria-label={`${r.rating} stars`}>
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} className={`h-4 w-4 ${i <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'}`} />
                          ))}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground max-w-[280px] truncate" title={r.comment || undefined}>{r.comment || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(
            (trendMetric === 'parents' && (d.trendDetailParents ?? []).length === 0) ||
            (trendMetric === 'coaches' && (d.trendDetailCoaches ?? []).length === 0) ||
            (trendMetric === 'athletes' && (d.trendDetailAthletes ?? []).length === 0) ||
            (trendMetric === 'sessions' && (d.trendDetailSessions ?? []).length === 0) ||
            (trendMetric === 'bookings' && (d.trendDetailBookings ?? []).length === 0) ||
            (trendMetric === 'earlyAccess' && (d.trendDetailEarlyAccess ?? []).length === 0) ||
            (trendMetric === 'reviews' && (d.trendDetailReviews ?? []).length === 0)
          ) && (
            <p className="text-sm text-muted-foreground">No records in this period.</p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {(d.payoutsPaidList.length > 0 || d.payoutsPaid > 0 || (d.payoutsPaidAllTime ?? 0) > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Payouts recorded in this period
              </CardTitle>
              <CardDescription>
                Period total: ${d.payoutsPaid.toFixed(2)}
                {d.payoutsPaidAllTime != null && (
                  <span className="block mt-1 text-muted-foreground">
                    All-time paid out (every marked session): ${d.payoutsPaidAllTime.toFixed(2)}
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {d.payoutsPaidList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No individual session breakdown.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {d.payoutsPaidList.map((p) => (
                    <li key={p.session_id} className="flex items-center justify-between gap-2">
                      <span>{p.coach_name}</span>
                      <span className="font-medium">${p.amount.toFixed(2)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/admin?tab=payouts" className="inline-block mt-3 text-sm text-accent hover:underline">
                Manage all payouts →
              </Link>
            </CardContent>
          </Card>
        )}
      </div>

      {d.newParents.length === 0 &&
        d.newCoaches.length === 0 &&
        d.newAthletes.length === 0 &&
        d.sessionsScheduled.length === 0 &&
        d.bookings.length === 0 &&
        d.earlyAccess.length === 0 &&
        d.payoutsPaidList.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              No activity {range === 'today' ? `on ${formatEST(new Date(d.date + 'T12:00:00'), 'MMMM d, yyyy')}` : d.rangeStart && d.rangeEnd ? `for ${range === 'month' ? formatRange(d.rangeStart, d.rangeEnd, 'month') : formatRange(d.rangeStart, d.rangeEnd, 'week')}` : 'for this period'}. Change the period or check back later.
            </CardContent>
          </Card>
        )}
    </div>
  );
}
