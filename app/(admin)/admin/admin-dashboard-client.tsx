'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Calendar,
  Users,
  DollarSign,
  BarChart3,
  Search,
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export type AdminSession = {
  id: string;
  scheduled_datetime: string;
  status: string;
  total_price: number;
  athlete_payment: number;
  org_fee: number;
  stripe_fee: number;
  session_type?: string;
  session_mode?: string;
  parent_id: string;
  parent_email: string;
  athlete_name: string;
  athlete_school: string;
  facility_name: string;
};

export type AdminUser = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_login_at: string | null;
};

export type BillingSummary = {
  totalRevenue: number;
  totalOrgFees: number;
  totalStripeFees: number;
  totalAthletePayments: number;
  sessionCount: number;
  completedCount: number;
  pendingPaymentCount: number;
};

export type AthleteReport = {
  athlete_id: string;
  athlete_name: string;
  school: string;
  session_count: number;
  total_earnings: number;
  completed_count: number;
};

type TabId = 'sessions' | 'users' | 'billing' | 'athletes';

type Props = {
  sessions: AdminSession[];
  users: AdminUser[];
  billing: BillingSummary;
  athleteReports: AthleteReport[];
  usersError?: string | null;
};

export function AdminDashboardClient({
  sessions,
  users,
  billing,
  athleteReports,
  usersError,
}: Props) {
  const [tab, setTab] = useState<TabId>('sessions');
  const [sessionDateFrom, setSessionDateFrom] = useState('');
  const [sessionDateTo, setSessionDateTo] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');
  const [athleteSearch, setAthleteSearch] = useState('');

  const filteredSessions = sessions.filter((s) => {
    const d = s.scheduled_datetime.slice(0, 10);
    if (sessionDateFrom && d < sessionDateFrom) return false;
    if (sessionDateTo && d > sessionDateTo) return false;
    return true;
  });

  const filteredUsers = users.filter((u) => {
    if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
    if (userSearch) {
      const q = userSearch.toLowerCase();
      if (!u.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const filteredAthletes = athleteReports.filter((a) => {
    if (!athleteSearch) return true;
    const q = athleteSearch.toLowerCase();
    return (
      a.athlete_name.toLowerCase().includes(q) ||
      a.school.toLowerCase().includes(q)
    );
  });

  const statusBadge = (status: string) => {
    const v: Record<string, 'default' | 'secondary' | 'outline'> = {
      scheduled: 'default',
      pending_payment: 'secondary',
      completed: 'default',
      cancelled: 'secondary',
      'no-show': 'secondary',
    };
    return (
      <Badge variant={v[status] ?? 'outline'}>
        {status === 'pending_payment' ? 'Pending payment' : status}
      </Badge>
    );
  };

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'sessions', label: 'Sessions', icon: <Calendar className="h-4 w-4" /> },
    { id: 'users', label: 'Users', icon: <Users className="h-4 w-4" /> },
    { id: 'billing', label: 'Billing', icon: <DollarSign className="h-4 w-4" /> },
    { id: 'athletes', label: 'Athlete reports', icon: <BarChart3 className="h-4 w-4" /> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-border pb-4">
        {tabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTab(t.id)}
            className="gap-2"
          >
            {t.icon}
            {t.label}
          </Button>
        ))}
      </div>

      {tab === 'sessions' && (
        <Card>
          <CardHeader>
            <CardTitle>All privates by date</CardTitle>
            <CardDescription>
              All scheduled sessions across athletes. Filter by date range.
            </CardDescription>
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">From</label>
                <Input
                  type="date"
                  value={sessionDateFrom}
                  onChange={(e) => setSessionDateFrom(e.target.value)}
                  className="w-40"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-muted-foreground">To</label>
                <Input
                  type="date"
                  value={sessionDateTo}
                  onChange={(e) => setSessionDateTo(e.target.value)}
                  className="w-40"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                Showing {filteredSessions.length} of {sessions.length} sessions
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Date / Time</th>
                    <th className="text-left py-2 font-medium">Coach</th>
                    <th className="text-left py-2 font-medium">Parent</th>
                    <th className="text-left py-2 font-medium">Facility</th>
                    <th className="text-left py-2 font-medium">Status</th>
                    <th className="text-right py-2 font-medium">Total</th>
                    <th className="text-right py-2 font-medium">Coach $</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-muted-foreground">
                        No sessions match filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2">
                          {format(new Date(s.scheduled_datetime), 'MMM d, yyyy')}
                          <br />
                          <span className="text-muted-foreground">
                            {format(new Date(s.scheduled_datetime), 'h:mm a')}
                          </span>
                        </td>
                        <td className="py-2">
                          <div>{s.athlete_name}</div>
                          <div className="text-muted-foreground">{s.athlete_school}</div>
                        </td>
                        <td className="py-2">
                          <a
                            href={`mailto:${s.parent_email}`}
                            className="text-primary hover:underline"
                          >
                            {s.parent_email}
                          </a>
                        </td>
                        <td className="py-2">{s.facility_name}</td>
                        <td className="py-2">{statusBadge(s.status)}</td>
                        <td className="py-2 text-right">${Number(s.total_price).toFixed(2)}</td>
                        <td className="py-2 text-right">${Number(s.athlete_payment).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>Users by role</CardTitle>
            <CardDescription>
              All users with role, created date, and last login.
            </CardDescription>
            <div className="flex flex-wrap gap-4 pt-2">
              <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="parent">Parent</SelectItem>
                  <SelectItem value="athlete">Athlete</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="youth_wrestler">Youth wrestler</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {filteredUsers.length} users
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Email</th>
                    <th className="text-left py-2 font-medium">Role</th>
                    <th className="text-left py-2 font-medium">Created</th>
                    <th className="text-left py-2 font-medium">Last login</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center">
                        {usersError ? (
                          <span className="text-destructive">{usersError}</span>
                        ) : users.length === 0 ? (
                          <span className="text-muted-foreground">No users in database.</span>
                        ) : (
                          <span className="text-muted-foreground">No users match filters.</span>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="py-2">
                          <a
                            href={`mailto:${u.email}`}
                            className="text-primary hover:underline"
                          >
                            {u.email}
                          </a>
                        </td>
                        <td className="py-2">
                          <Badge variant="outline">{u.role}</Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {format(new Date(u.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {u.last_login_at
                            ? format(new Date(u.last_login_at), 'MMM d, yyyy h:mm a')
                            : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'billing' && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total revenue</CardDescription>
              <CardTitle className="text-2xl">
                ${billing.totalRevenue.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Org fees</CardDescription>
              <CardTitle className="text-2xl">
                ${billing.totalOrgFees.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Stripe fees</CardDescription>
              <CardTitle className="text-2xl">
                ${billing.totalStripeFees.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Coach payouts</CardDescription>
              <CardTitle className="text-2xl">
                ${billing.totalAthletePayments.toFixed(2)}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardDescription>Sessions</CardDescription>
              <CardTitle className="text-2xl">{billing.sessionCount} total</CardTitle>
              <p className="text-sm text-muted-foreground pt-1">
                {billing.completedCount} completed · {billing.pendingPaymentCount} pending payment
              </p>
            </CardHeader>
          </Card>
        </div>
      )}

      {tab === 'athletes' && (
        <Card>
          <CardHeader>
            <CardTitle>Reporting by athlete</CardTitle>
            <CardDescription>
              Sessions and earnings per coach.
            </CardDescription>
            <div className="flex flex-wrap gap-4 pt-2">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or school..."
                  value={athleteSearch}
                  onChange={(e) => setAthleteSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <span className="text-sm text-muted-foreground">
                {filteredAthletes.length} athletes
              </span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Coach</th>
                    <th className="text-left py-2 font-medium">School</th>
                    <th className="text-right py-2 font-medium">Sessions</th>
                    <th className="text-right py-2 font-medium">Completed</th>
                    <th className="text-right py-2 font-medium">Total earnings</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAthletes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-muted-foreground">
                        No athletes match filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAthletes.map((a) => (
                      <tr key={a.athlete_id} className="border-b last:border-0">
                        <td className="py-2">
                          <Link
                            href={`/athlete/${a.athlete_id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {a.athlete_name}
                          </Link>
                        </td>
                        <td className="py-2 text-muted-foreground">{a.school}</td>
                        <td className="py-2 text-right">{a.session_count}</td>
                        <td className="py-2 text-right">{a.completed_count}</td>
                        <td className="py-2 text-right font-medium">
                          ${a.total_earnings.toFixed(2)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
