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
    coach_name: string;
    facility_name: string;
    scheduled_datetime: string;
  }[];
  earlyAccess: { id: string; email: string; name: string; created_at: string }[];
  payoutsPaid: number;
  payoutsPaidList: { session_id: string; amount: number; coach_name: string }[];
  revenueThatDay: number;
  pageViews?: number;
  visitors?: number;
  trends: {
    parents: number[];
    coaches: number[];
    athletes: number[];
    sessions: number[];
    bookings: number[];
    earlyAccess: number[];
  };
  trendDays: string[];
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

export function AdminCockpitView() {
  const today = todayInTz(COCKPIT_TIMEZONE);
  const [date, setDate] = useState(today);
  const [range, setRange] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/admin/cockpit?date=${range === 'yesterday' ? yesterdayInTz(COCKPIT_TIMEZONE) : date}&range=${range === 'yesterday' ? 'today' : range}&timezone=${encodeURIComponent(COCKPIT_TIMEZONE)}`)
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
  }, [date, range]);

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
    parents: [], coaches: [], athletes: [], sessions: [], bookings: [], earlyAccess: [],
  };
  const trendDays = (d.trendDays ?? []).slice(0, 7);
  const maxTrend = Math.max(
    1,
    ...(trends.parents ?? []),
    ...(trends.coaches ?? []),
    ...(trends.athletes ?? []),
    ...(trends.sessions ?? []),
    ...(trends.bookings ?? []),
    ...(trends.earlyAccess ?? [])
  );

  const TrendBar = ({ values, label }: { values: number[]; label: string }) => {
    const vals = values.slice(0, trendDays.length);
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <div className="flex gap-1.5 items-end h-14 min-h-[56px]">
          {vals.map((v, i) => {
            const pct = maxTrend > 0 ? Math.max(8, (v / maxTrend) * 100) : 8;
            const dayStr = trendDays[i] ? formatEST(new Date(trendDays[i] + 'T12:00:00'), 'M/d') : '—';
            return (
              <div key={i} className="flex-1 min-w-0 flex flex-col items-center gap-1">
                <span className="text-xs font-semibold tabular-nums text-foreground" title={`${dayStr}: ${v}`}>
                  {v}
                </span>
                <div
                  className="w-full min-w-[8px] max-w-[24px] rounded-t bg-accent/40 hover:bg-accent/70 transition-colors flex-shrink-0"
                  style={{ height: `${pct}%`, minHeight: 6 }}
                  title={`${dayStr}: ${v}`}
                />
                <span className="text-[10px] font-medium text-muted-foreground tabular-nums truncate w-full text-center">
                  {dayStr}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const summaryCards = [
    { label: 'Revenue booked', value: `$${d.revenueThatDay.toFixed(0)}`, icon: DollarSign },
    { label: 'Bookings (signups)', value: d.bookings.length, icon: CreditCard },
    { label: 'New parents', value: d.newParents.length, icon: UserPlus },
    { label: 'New coaches', value: d.newCoaches.length, icon: Users },
    { label: 'New athletes', value: d.newAthletes.length, icon: Users },
    { label: 'Sessions created', value: d.sessionsScheduled.length, icon: Calendar },
    { label: 'Early access', value: d.earlyAccess.length, icon: ClipboardList },
    { label: 'Payouts paid', value: `$${d.payoutsPaid.toFixed(0)}`, icon: Wallet },
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
          <span className="font-semibold text-foreground tabular-nums">{d.bookings.length} bookings</span>
          <span className="font-bold text-2xl tabular-nums">
            ${d.revenueThatDay.toFixed(0)} total
          </span>
          {d.bookings.length > 0 && d.revenueThatDay > 0 && (
            <span className="text-muted-foreground">(~${(d.revenueThatDay / d.bookings.length).toFixed(0)} each)</span>
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

      {/* Trends */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Last 7 days
          </CardTitle>
          <CardDescription>
            Counts by day (oldest → newest). Date and value shown on each bar.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <TrendBar values={trends.parents} label="Parents" />
          <TrendBar values={trends.coaches} label="Coaches" />
          <TrendBar values={trends.athletes} label="Athletes" />
          <TrendBar values={trends.sessions} label="Sessions" />
          <TrendBar values={trends.bookings} label="Bookings" />
          <TrendBar values={trends.earlyAccess} label="Early access" />
        </CardContent>
      </Card>

      {/* Detail lists */}
      <div className="grid gap-6 lg:grid-cols-2">
        {d.newParents.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                New parents
              </CardTitle>
              <CardDescription>Accounts created on this day</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {d.newParents.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2">
                    <a href={`mailto:${p.email}`} className="text-accent hover:underline truncate">
                      {p.email}
                    </a>
                    <span className="text-muted-foreground shrink-0">
                      {formatEST(new Date(p.created_at), 'h:mm a')}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {d.newCoaches.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                New coaches
              </CardTitle>
              <CardDescription>Coaches onboarded this day</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {d.newCoaches.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2">
                    <Link href={`/athlete/${c.id}`} className="text-accent hover:underline">
                      {c.name}
                    </Link>
                    <span className="text-muted-foreground shrink-0">{c.school}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {d.newAthletes.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                New youth athletes
              </CardTitle>
              <CardDescription>Youth wrestlers added this day</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {d.newAthletes.map((y) => (
                  <li key={y.id} className="flex items-center justify-between gap-2">
                    <Link href={`/wrestlers/${y.id}`} className="text-accent hover:underline">
                      {y.name}
                    </Link>
                    <span className="text-muted-foreground shrink-0">
                      {formatEST(new Date(y.created_at), 'h:mm a')}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {d.sessionsScheduled.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Sessions created
              </CardTitle>
              <CardDescription>Sessions created this day</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {d.sessionsScheduled.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/admin/sessions/${s.id}/edit`} className="text-accent hover:underline">
                      {s.coach_name} · {s.facility_name}
                    </Link>
                    <span className="text-muted-foreground">
                      {formatEST(new Date(s.scheduled_datetime), 'MMM d h:mm a')} · {s.participants}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {d.bookings.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                Bookings
              </CardTitle>
              <CardDescription>Signups created on this date. Count = registrations that day.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {d.bookings.map((b) => (
                  <li key={b.id} className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {b.coach_name} · {b.facility_name}
                    </span>
                    <span className="text-muted-foreground">
                      {b.amount_paid != null ? `$${b.amount_paid.toFixed(2)}` : '—'}
                      {b.created_at ? ` · Signed up ${formatEST(new Date(b.created_at), 'MMM d')}` : ''}
                      {b.scheduled_datetime && b.scheduled_datetime !== '—' ? ` · Session ${formatEST(new Date(b.scheduled_datetime), 'MMM d')}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {d.earlyAccess.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4" />
                Early access signups
              </CardTitle>
              <CardDescription>Leads from website this day</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {d.earlyAccess.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <a href={`mailto:${e.email}`} className="text-accent hover:underline truncate">
                      {e.email}
                    </a>
                    {e.name !== '—' && <span className="text-muted-foreground truncate">{e.name}</span>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {(d.payoutsPaidList.length > 0 || d.payoutsPaid > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Payouts paid this day
              </CardTitle>
              <CardDescription>Total: ${d.payoutsPaid.toFixed(2)}</CardDescription>
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
