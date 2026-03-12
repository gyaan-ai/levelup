'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Calendar,
  Users,
  DollarSign,
  BarChart3,
  Search,
  Wallet,
  CreditCard,
  MapPin,
  Package,
  ClipboardList,
  Pencil,
  User,
  UserX,
  Loader2,
  Trash2,
  UserMinus,
  Building2,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { formatEST } from '@/lib/format-date';

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

export type CoachPayout = {
  athlete_id: string;
  name: string;
  school: string;
  amount: number;
  venmo_handle?: string | null;
  zelle_email?: string | null;
};

export type CreditRecord = {
  id: string;
  parent_id: string;
  parent_email: string;
  amount: number;
  remaining: number;
  source: string;
  description?: string | null;
  created_at: string;
  expires_at?: string | null;
};

type TabId = 'sessions' | 'users' | 'billing' | 'athletes' | 'kids' | 'payouts' | 'credits' | 'facility_requests';

function ClearTestDataCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ counts: Record<string, number>; total: number } | null>(null);

  const handleClear = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/clear-test-data', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult({ counts: data.counts ?? {}, total: data.total ?? 0 });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setResult({ counts: {}, total: 0 });
      alert(e instanceof Error ? e.message : 'Failed to clear test data');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Test data
          </CardTitle>
          <CardDescription>
            Remove all sessions, join requests, session notes, coach inquiries, and notifications. Keeps users, athletes, facilities, and products.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Clear test data
          </Button>
          {result && result.total > 0 && (
            <p className="text-sm text-muted-foreground mt-2">Cleared {result.total} row(s).</p>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear test data?</DialogTitle>
            <DialogDescription>
              This will permanently delete all sessions, session participants, join requests, workspace session notes, session summaries, booking messages, coach inquiry messages, and notifications. Users, athletes, facilities, and products are not deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button variant="destructive" onClick={handleClear} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Clear all'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function RemoveTestCoachesCard() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ counts: Record<string, number>; total: number } | null>(null);

  const handleRemove = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/admin/remove-test-coaches', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setResult({ counts: data.counts ?? {}, total: data.total ?? 0 });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setResult({ counts: {}, total: 0 });
      alert(e instanceof Error ? e.message : 'Failed to remove test coaches');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Card className="border-dashed">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <UserMinus className="h-4 w-4" />
            Test coaches
          </CardTitle>
          <CardDescription>
            Remove all coaches (athletes). Run &quot;Clear test data&quot; first, then this. Use User Management to remove test parents or individual users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" size="sm" onClick={() => setOpen(true)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
            Remove test coaches
          </Button>
          {result && result.total > 0 && (
            <p className="text-sm text-muted-foreground mt-2">Removed {result.total} row(s) (e.g. coach follows, athletes).</p>
          )}
        </CardContent>
      </Card>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove all test coaches?</DialogTitle>
            <DialogDescription>
              This will permanently delete all coaches (athletes) and their coach-follow links. Run &quot;Clear test data&quot; first so there are no sessions. Workspaces and messaging groups for those coaches will be removed. You can then onboard new coaches. To remove test parents, use User Management and delete or archive users.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
            <Button variant="destructive" onClick={handleRemove} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remove all coaches'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type Props = {
  sessions: AdminSession[];
  users: AdminUser[];
  billing: BillingSummary;
  athleteReports: AthleteReport[];
  coachPayouts: CoachPayout[];
  credits: CreditRecord[];
  usersError?: string | null;
};

export function AdminDashboardClient({
  sessions,
  users,
  billing,
  athleteReports,
  coachPayouts,
  credits,
  usersError,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get('tab') as TabId | null;
  const editAthleteId = searchParams.get('edit');
  const [tab, setTab] = useState<TabId>(tabParam && ['sessions', 'users', 'billing', 'payouts', 'credits', 'facility_requests', 'athletes', 'kids'].includes(tabParam) ? tabParam : 'sessions');
  const [markingAthleteId, setMarkingAthleteId] = useState<string | null>(null);
  const [sessionDateFrom, setSessionDateFrom] = useState('');
  const [sessionDateTo, setSessionDateTo] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');
  const [athleteSearch, setAthleteSearch] = useState('');
  const [editingAthleteId, setEditingAthleteId] = useState<string | null>(null);
  const hasOpenedEditFromUrl = useRef(false);
  useEffect(() => {
    if (editAthleteId && tab === 'athletes' && !hasOpenedEditFromUrl.current) {
      hasOpenedEditFromUrl.current = true;
      openAthleteEdit(editAthleteId);
    }
  }, [editAthleteId, tab]);
  const [athleteEditForm, setAthleteEditForm] = useState<{
    first_name: string;
    last_name: string;
    school: string;
    facility_id: string | null;
    secondary_facility_id: string | null;
    year: string | null;
    weight_class: string | null;
    bio: string | null;
    credentials: Record<string, unknown> | null;
    photo_url: string | null;
    photo_focus_x: number;
    photo_focus_y: number;
    venmo_handle: string | null;
    zelle_email: string | null;
    active: boolean;
  } | null>(null);
  const [facilities, setFacilities] = useState<{ id: string; name: string; school: string }[]>([]);
  const [athleteEditSaving, setAthleteEditSaving] = useState(false);
  const [athletePhotoUploading, setAthletePhotoUploading] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);
  const [deletingAthleteId, setDeletingAthleteId] = useState<string | null>(null);
  const athletePhotoInputRef = useRef<HTMLInputElement>(null);
  const [facilityRequests, setFacilityRequests] = useState<Array<{
    id: string;
    requested_by_athlete_id: string;
    name: string;
    school: string;
    address: string | null;
    status: string;
    created_at: string;
    coach_name: string;
    coach_school: string;
  }>>([]);
  const [facilityRequestsLoading, setFacilityRequestsLoading] = useState(false);
  const [facilityRequestActionId, setFacilityRequestActionId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [syncingEmails, setSyncingEmails] = useState(false);
  const [kidsList, setKidsList] = useState<Array<{
    id: string;
    first_name: string;
    last_name: string;
    school: string | null;
    weight_class: string | null;
    skill_level: string | null;
    graduation_year: number | null;
    parent_email: string;
    photo_url: string | null;
    created_at: string;
  }>>([]);
  const [kidsLoading, setKidsLoading] = useState(false);
  const [linkingKidId, setLinkingKidId] = useState<string | null>(null);

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

  const openAthleteEdit = async (athleteId: string) => {
    setEditingAthleteId(athleteId);
    setAthleteEditForm(null);
    try {
      const [athleteRes, facilitiesRes] = await Promise.all([
        fetch(`/api/admin/athletes/${athleteId}`),
        fetch('/api/admin/facilities'),
      ]);
      const athleteData = await athleteRes.json();
      const facilitiesData = await facilitiesRes.json();
      if (!athleteRes.ok || !athleteData.athlete) {
        setEditingAthleteId(null);
        return;
      }
      const a = athleteData.athlete;
      setAthleteEditForm({
        first_name: a.first_name ?? '',
        last_name: a.last_name ?? '',
        school: a.school ?? '',
        facility_id: a.facility_id ?? null,
        secondary_facility_id: a.secondary_facility_id ?? null,
        year: a.year ?? null,
        weight_class: a.weight_class ?? null,
        bio: a.bio ?? null,
        credentials: a.credentials ?? null,
        photo_url: a.photo_url ?? null,
        photo_focus_x: typeof a.photo_focus_x === 'number' ? a.photo_focus_x : 50,
        photo_focus_y: typeof a.photo_focus_y === 'number' ? a.photo_focus_y : 50,
        venmo_handle: a.venmo_handle ?? null,
        zelle_email: a.zelle_email ?? null,
        active: a.active ?? true,
      });
      setFacilities(facilitiesData.facilities ?? []);
    } catch {
      setEditingAthleteId(null);
    }
  };

  const saveAthleteEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAthleteId || !athleteEditForm) return;
    setAthleteEditSaving(true);
    try {
      const res = await fetch(`/api/admin/athletes/${editingAthleteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: athleteEditForm.first_name.trim(),
          last_name: athleteEditForm.last_name.trim(),
          school: athleteEditForm.school.trim(),
          facility_id: athleteEditForm.facility_id || null,
          secondary_facility_id: athleteEditForm.secondary_facility_id || null,
          year: athleteEditForm.year || null,
          weight_class: athleteEditForm.weight_class || null,
          bio: athleteEditForm.bio || null,
          credentials: athleteEditForm.credentials,
          photo_url: athleteEditForm.photo_url,
          photo_focus_x: athleteEditForm.photo_focus_x,
          photo_focus_y: athleteEditForm.photo_focus_y,
          venmo_handle: athleteEditForm.venmo_handle || null,
          zelle_email: athleteEditForm.zelle_email || null,
          active: athleteEditForm.active,
        }),
      });
      if (!res.ok) {
        setAthleteEditSaving(false);
        return;
      }
      setEditingAthleteId(null);
      setAthleteEditForm(null);
      router.refresh();
    } finally {
      setAthleteEditSaving(false);
    }
  };

  const handleDeactivateAthlete = async (athleteId: string) => {
    if (!confirm('Deactivate this coach? They will be hidden from Browse and cannot receive new bookings.')) return;
    setDeactivatingId(athleteId);
    try {
      const res = await fetch(`/api/admin/athletes/${athleteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      });
      if (res.ok) router.refresh();
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleDeleteAthlete = async (athleteId: string) => {
    if (!confirm('Permanently delete this coach? Run "Clear test data" first if they have sessions. This cannot be undone.')) return;
    setDeletingAthleteId(athleteId);
    try {
      const res = await fetch(`/api/admin/athletes/${athleteId}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error || 'Delete failed');
        return;
      }
      router.refresh();
    } finally {
      setDeletingAthleteId(null);
    }
  };

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
    { id: 'payouts', label: 'Coach payouts', icon: <Wallet className="h-4 w-4" /> },
    { id: 'credits', label: 'Credits', icon: <CreditCard className="h-4 w-4" /> },
    { id: 'facility_requests', label: 'Facility requests', icon: <Building2 className="h-4 w-4" /> },
    { id: 'athletes', label: 'Coaches', icon: <BarChart3 className="h-4 w-4" /> },
    { id: 'kids', label: 'Athletes', icon: <User className="h-4 w-4" /> },
  ];

  // Fetch kids when tab is selected
  useEffect(() => {
    if (tab !== 'kids') return;
    setKidsLoading(true);
    fetch('/api/admin/youth-wrestlers')
      .then((r) => r.json())
      .then((data) => {
        setKidsList(data.youthWrestlers ?? []);
      })
      .catch(() => setKidsList([]))
      .finally(() => setKidsLoading(false));
  }, [tab]);

  // Fetch facility requests when tab is selected
  useEffect(() => {
    if (tab !== 'facility_requests') return;
    setFacilityRequestsLoading(true);
    fetch('/api/admin/facility-requests')
      .then((r) => r.json())
      .then((data) => {
        setFacilityRequests(data.requests ?? []);
      })
      .catch(() => setFacilityRequests([]))
      .finally(() => setFacilityRequestsLoading(false));
  }, [tab]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <div className="flex flex-wrap gap-2 mr-4">
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
        <Link href="/admin/facilities" className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted/50">
          <MapPin className="h-4 w-4" />
          Facilities
        </Link>
        <Link href="/admin/products" className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted/50">
          <Package className="h-4 w-4" />
          Products
        </Link>
        <Link href="/admin/early-access" className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted/50">
          <ClipboardList className="h-4 w-4" />
          Early Access
        </Link>
        <Link href="/admin/users" className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted/50">
          <Users className="h-4 w-4" />
          User Management
        </Link>
        <Link href="/admin/sessions/create" className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted/50">
          <Calendar className="h-4 w-4" />
          Create small group session
        </Link>
        <Link href="/admin/focus-areas" className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted/50">
          Session topics
        </Link>
      </div>

      <ClearTestDataCard />
      <RemoveTestCoachesCard />

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
                    <th className="text-right py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-muted-foreground">
                        No sessions match filters.
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((s) => (
                      <tr key={s.id} className="border-b last:border-0">
                        <td className="py-2">
                          {formatEST(new Date(s.scheduled_datetime), 'MMM d, yyyy')}
                          <br />
                          <span className="text-muted-foreground">
                            {formatEST(new Date(s.scheduled_datetime), 'h:mm a')}
                          </span>
                        </td>
                        <td className="py-2">
                          <div>{s.athlete_name}</div>
                          <div className="text-muted-foreground">{s.athlete_school}</div>
                        </td>
                        <td className="py-2">
                          <a
                            href={`mailto:${s.parent_email}`}
                            className="text-accent hover:underline"
                          >
                            {s.parent_email}
                          </a>
                        </td>
                        <td className="py-2">{s.facility_name}</td>
                        <td className="py-2">{statusBadge(s.status)}</td>
                        <td className="py-2 text-right">${Number(s.total_price).toFixed(2)}</td>
                        <td className="py-2 text-right">${Number(s.athlete_payment).toFixed(2)}</td>
                        <td className="py-2 text-right">
                          <Link href={`/admin/sessions/${s.id}/edit`} className="text-accent hover:underline text-sm">
                            Edit
                          </Link>
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

      {tab === 'users' && (
        <Card>
          <CardHeader>
            <CardTitle>Users by role</CardTitle>
            <CardDescription>
              All users with role, created date, and last login. Use User Management to edit role, archive, or sync emails from Auth.
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
                  <SelectItem value="youth_wrestler">Athlete</SelectItem>
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
              <Button
                variant="outline"
                size="sm"
                disabled={syncingEmails}
                onClick={async () => {
                  setSyncingEmails(true);
                  try {
                    const res = await fetch('/api/admin/users/sync-emails', { method: 'POST' });
                    const data = await res.json().catch(() => ({}));
                    if (res.ok && data.success) {
                      router.refresh();
                      if (data.updated > 0) alert(`Synced ${data.updated} email(s) from Auth.`);
                      else alert('Emails already in sync.');
                    } else {
                      alert(data.error || 'Sync failed');
                    }
                  } finally {
                    setSyncingEmails(false);
                  }
                }}
              >
                {syncingEmails ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Sync emails from Auth'}
              </Button>
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
                    <th className="text-right py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center">
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
                            className="text-accent hover:underline"
                          >
                            {u.email}
                          </a>
                        </td>
                        <td className="py-2">
                          <Badge variant="outline">{u.role}</Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {formatEST(new Date(u.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {u.last_login_at
                            ? formatEST(new Date(u.last_login_at), 'MMM d, yyyy h:mm a')
                            : '—'}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href="/admin/users">
                              <Button variant="ghost" size="sm" className="text-xs">
                                Manage
                              </Button>
                            </Link>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Delete user"
                              disabled={deletingUserId === u.id}
                              onClick={async () => {
                                if (!confirm(`Delete ${u.email}? This removes their account and related data. You cannot delete your own account.`)) return;
                                setDeletingUserId(u.id);
                                try {
                                  const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
                                  const data = await res.json().catch(() => ({}));
                                  if (res.ok) {
                                    router.refresh();
                                  } else {
                                    alert(data.error || 'Delete failed');
                                  }
                                } finally {
                                  setDeletingUserId(null);
                                }
                              }}
                            >
                              {deletingUserId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                            </Button>
                          </div>
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

      {tab === 'payouts' && (
        <Card>
          <CardHeader>
            <CardTitle>Coach payouts (manual)</CardTitle>
            <CardDescription>
              Completed sessions not yet paid. Pay via Venmo or Zelle, then click Mark paid.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Coach</th>
                    <th className="text-left py-2 font-medium">School</th>
                    <th className="text-right py-2 font-medium">Amount owed</th>
                    <th className="text-left py-2 font-medium">Venmo</th>
                    <th className="text-left py-2 font-medium">Zelle</th>
                    <th className="text-right py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {coachPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No unpaid completed sessions.
                      </td>
                    </tr>
                  ) : (
                    coachPayouts.map((p) => (
                      <tr key={p.athlete_id} className="border-b last:border-0">
                        <td className="py-2">
                          <Link
                            href={`/athlete/${p.athlete_id}`}
                            className="text-accent hover:underline font-medium"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-2 text-muted-foreground">{p.school}</td>
                        <td className="py-2 text-right font-medium">
                          ${p.amount.toFixed(2)}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {p.venmo_handle ? `@${p.venmo_handle}` : '—'}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {p.zelle_email ?? '—'}
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={markingAthleteId === p.athlete_id}
                            onClick={async () => {
                              setMarkingAthleteId(p.athlete_id);
                              try {
                                const r = await fetch('/api/admin/mark-payout-paid', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({ athleteId: p.athlete_id }),
                                });
                                const data = await r.json().catch(() => ({}));
                                if (r.ok && data.success) {
                                  router.refresh();
                                } else {
                                  console.error('Mark paid failed:', data.error ?? r.statusText);
                                }
                              } finally {
                                setMarkingAthleteId(null);
                              }
                            }}
                          >
                            {markingAthleteId === p.athlete_id ? 'Marking…' : 'Mark paid'}
                          </Button>
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

      {tab === 'credits' && (
        <Card>
          <CardHeader>
            <CardTitle>Account Credits</CardTitle>
            <CardDescription>
              Credits issued from cancellations or promotions. Parents can use these for future bookings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-medium">Parent</th>
                    <th className="text-left py-2 font-medium">Source</th>
                    <th className="text-right py-2 font-medium">Original</th>
                    <th className="text-right py-2 font-medium">Remaining</th>
                    <th className="text-left py-2 font-medium">Created</th>
                    <th className="text-left py-2 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {credits.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No credits issued yet.
                      </td>
                    </tr>
                  ) : (
                    credits.map((c) => (
                      <tr key={c.id} className="border-b last:border-0">
                        <td className="py-2">
                          <a
                            href={`mailto:${c.parent_email}`}
                            className="text-accent hover:underline"
                          >
                            {c.parent_email}
                          </a>
                        </td>
                        <td className="py-2">
                          <Badge variant="outline">
                            {c.source === 'cancellation' && 'Cancellation'}
                            {c.source === 'coach_cancellation' && 'Coach cancelled'}
                            {c.source === 'admin_grant' && 'Admin grant'}
                            {c.source === 'promotion' && 'Promotion'}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">${Number(c.amount).toFixed(2)}</td>
                        <td className="py-2 text-right font-medium">
                          ${Number(c.remaining).toFixed(2)}
                          {c.remaining === 0 && (
                            <span className="text-muted-foreground ml-1">(used)</span>
                          )}
                        </td>
                        <td className="py-2 text-muted-foreground">
                          {formatEST(new Date(c.created_at), 'MMM d, yyyy')}
                        </td>
                        <td className="py-2 text-muted-foreground text-xs max-w-xs truncate">
                          {c.description ?? '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {credits.length > 0 && (
              <div className="mt-4 pt-4 border-t flex gap-8">
                <div>
                  <p className="text-sm text-muted-foreground">Total issued</p>
                  <p className="text-xl font-bold">
                    ${credits.reduce((sum, c) => sum + Number(c.amount), 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                  <p className="text-xl font-bold text-accent">
                    ${credits.reduce((sum, c) => sum + Number(c.remaining), 0).toFixed(2)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'facility_requests' && (
        <Card>
          <CardHeader>
            <CardTitle>Facility requests</CardTitle>
            <CardDescription>
              Coaches can request facilities not on the list. Approve to create the facility and assign it to the coach.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {facilityRequestsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : facilityRequests.length === 0 ? (
              <p className="text-muted-foreground py-4">No facility requests.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 font-medium">Requested facility</th>
                      <th className="text-left py-2 font-medium">School</th>
                      <th className="text-left py-2 font-medium">Requested by</th>
                      <th className="text-left py-2 font-medium">Status</th>
                      <th className="text-left py-2 font-medium">Created</th>
                      <th className="text-right py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facilityRequests.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 font-medium">{r.name}</td>
                        <td className="py-2 text-muted-foreground">{r.school}</td>
                        <td className="py-2">
                          <Link href={`/athlete/${r.requested_by_athlete_id}`} className="text-accent hover:underline">
                            {r.coach_name}
                          </Link>
                          {r.coach_school && <span className="text-muted-foreground ml-1">({r.coach_school})</span>}
                        </td>
                        <td className="py-2">
                          <Badge variant={r.status === 'pending' ? 'secondary' : r.status === 'approved' ? 'default' : 'outline'}>
                            {r.status}
                          </Badge>
                        </td>
                        <td className="py-2 text-muted-foreground">{formatEST(new Date(r.created_at), 'MMM d, yyyy')}</td>
                        <td className="py-2 text-right">
                          {r.status === 'pending' && (
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="default"
                                disabled={facilityRequestActionId === r.id}
                                onClick={async () => {
                                  setFacilityRequestActionId(r.id);
                                  try {
                                    const res = await fetch(`/api/admin/facility-requests/${r.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'approve' }),
                                    });
                                    const data = await res.json().catch(() => ({}));
                                    if (res.ok) {
                                      setFacilityRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'approved' } : x)));
                                      router.refresh();
                                    } else {
                                      alert(data.error || 'Approve failed');
                                    }
                                  } finally {
                                    setFacilityRequestActionId(null);
                                  }
                                }}
                              >
                                {facilityRequestActionId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={facilityRequestActionId === r.id}
                                onClick={async () => {
                                  setFacilityRequestActionId(r.id);
                                  try {
                                    const res = await fetch(`/api/admin/facility-requests/${r.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'reject' }),
                                    });
                                    if (res.ok) {
                                      setFacilityRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, status: 'rejected' } : x)));
                                      router.refresh();
                                    }
                                  } finally {
                                    setFacilityRequestActionId(null);
                                  }
                                }}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'athletes' && (
        <Card>
          <CardHeader>
            <CardTitle>Coaches</CardTitle>
            <CardDescription>
              Same coaches as on Browse Coaches. Edit profiles, visibility (show/hide on browse), and view sessions and earnings.
            </CardDescription>
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/browse">View Browse Coaches page</Link>
              </Button>
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
                {filteredAthletes.length} coaches
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
                    <th className="text-right py-2 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAthletes.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-muted-foreground">
                        No athletes match filters.
                      </td>
                    </tr>
                  ) : (
                    filteredAthletes.map((a) => (
                      <tr key={a.athlete_id} className="border-b last:border-0">
                        <td className="py-2">
                          <Link
                            href={`/athlete/${a.athlete_id}`}
                            className="text-accent hover:underline font-medium"
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
                        <td className="py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openAthleteEdit(a.athlete_id)} title="Edit coach">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeactivateAthlete(a.athlete_id)} disabled={deactivatingId === a.athlete_id} title="Deactivate (hide from Browse)">
                              {deactivatingId === a.athlete_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserX className="h-4 w-4 text-destructive" />}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDeleteAthlete(a.athlete_id)} disabled={deletingAthleteId === a.athlete_id} title="Delete coach (admin only)">
                              {deletingAthleteId === a.athlete_id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 text-destructive" />}
                            </Button>
                          </div>
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

      {tab === 'kids' && (
        <Card>
          <CardHeader>
            <CardTitle>Athletes</CardTitle>
            <CardDescription>
              Youth athletes on the platform. Same card view as My Coaches.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {kidsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : kidsList.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                No athletes yet.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {kidsList.map((k) => (
                  <Card key={k.id}>
                    <CardContent className="p-4 flex items-center gap-4">
                      {k.photo_url ? (
                        <img
                          src={k.photo_url}
                          alt={`${k.first_name} ${k.last_name}`}
                          className="w-14 h-14 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-7 w-7 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">
                          {k.first_name} {k.last_name}
                        </p>
                        {(k.school || k.weight_class) && (
                          <p className="text-sm text-muted-foreground truncate">
                            {[k.school, k.weight_class].filter(Boolean).join(' · ') || '—'}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground truncate" title={k.parent_email}>
                          {k.parent_email}
                        </p>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/wrestlers/${k.id}`}>
                            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                            Profile
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/wrestlers/${k.id}/edit`}>Edit</Link>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={linkingKidId === k.id}
                          onClick={async () => {
                            setLinkingKidId(k.id);
                            try {
                              const res = await fetch(`/api/admin/youth-wrestlers/${k.id}/link-parent`, { method: 'POST' });
                              const data = await res.json();
                              if (!res.ok) {
                                alert(data.error || 'Failed to link');
                                return;
                              }
                              alert(data.message ?? 'Linked to your account. Use “View as Parent” to see them in My Wrestlers.');
                            } catch {
                              alert('Something went wrong');
                            } finally {
                              setLinkingKidId(null);
                            }
                          }}
                        >
                          {linkingKidId === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Link to my account'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editingAthleteId} onOpenChange={(open) => { if (!open) { setEditingAthleteId(null); setAthleteEditForm(null); } }}>
        <DialogContent className="max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle>Edit coach</DialogTitle>
            <DialogDescription>Edit every aspect of this coach profile. Deactivated coaches are hidden from Browse.</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 overflow-y-auto pr-2 -mr-2">
          {athleteEditForm ? (
            <form onSubmit={saveAthleteEdit} className="space-y-4">
              {/* Admin: change coach photo */}
              {editingAthleteId && (
                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-full border-2 border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                    {athleteEditForm.photo_url ? (
                      <img
                        src={athleteEditForm.photo_url}
                        alt="Coach"
                        className="w-full h-full object-cover"
                        style={{ objectPosition: `${athleteEditForm.photo_focus_x}% ${athleteEditForm.photo_focus_y}%` }}
                      />
                    ) : (
                      <User className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium mb-1">Profile photo</p>
                    <input
                      ref={athletePhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !editingAthleteId) return;
                        setAthletePhotoUploading(true);
                        try {
                          const formData = new FormData();
                          formData.append('file', file);
                          const res = await fetch(`/api/admin/athletes/${editingAthleteId}/upload-photo`, {
                            method: 'POST',
                            body: formData,
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.ok && data.photoUrl) {
                            setAthleteEditForm((p) => p ? { ...p, photo_url: data.photoUrl } : null);
                            router.refresh();
                          } else {
                            console.error('Photo upload failed:', data.error ?? res.statusText);
                          }
                        } finally {
                          setAthletePhotoUploading(false);
                          e.target.value = '';
                        }
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={athletePhotoUploading}
                      onClick={() => athletePhotoInputRef.current?.click()}
                    >
                      {athletePhotoUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Change photo'}
                    </Button>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First name</Label>
                  <Input value={athleteEditForm.first_name} onChange={(e) => setAthleteEditForm((p) => p ? { ...p, first_name: e.target.value } : null)} />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input value={athleteEditForm.last_name} onChange={(e) => setAthleteEditForm((p) => p ? { ...p, last_name: e.target.value } : null)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>School</Label>
                <Input value={athleteEditForm.school} onChange={(e) => setAthleteEditForm((p) => p ? { ...p, school: e.target.value } : null)} placeholder="e.g. NC State" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Photo focus X (0–100)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={athleteEditForm.photo_focus_x}
                    onChange={(e) => setAthleteEditForm((p) => p ? { ...p, photo_focus_x: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 50)) } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Photo focus Y (0–100)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={athleteEditForm.photo_focus_y}
                    onChange={(e) => setAthleteEditForm((p) => p ? { ...p, photo_focus_y: Math.min(100, Math.max(0, parseInt(e.target.value, 10) || 50)) } : null)}
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Lower Y = face higher in frame (fix head cut off). 50,50 = center.</p>
              <div className="space-y-2">
                <Label>Weight class</Label>
                <Input value={athleteEditForm.weight_class ?? ''} onChange={(e) => setAthleteEditForm((p) => p ? { ...p, weight_class: e.target.value || null } : null)} placeholder="e.g. 157 lbs" />
              </div>
              <div className="space-y-2">
                <Label>Bio</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={athleteEditForm.bio ?? ''}
                  onChange={(e) => setAthleteEditForm((p) => p ? { ...p, bio: e.target.value || null } : null)}
                  placeholder="Coach bio..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Primary facility</Label>
                <Select
                  value={athleteEditForm.facility_id ?? 'none'}
                  onValueChange={(v) => setAthleteEditForm((p) => p ? { ...p, facility_id: v === 'none' ? null : v } : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select facility" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {facilities.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name} — {f.school}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Secondary facility</Label>
                <Select
                  value={athleteEditForm.secondary_facility_id ?? 'none'}
                  onValueChange={(v) => setAthleteEditForm((p) => p ? { ...p, secondary_facility_id: v === 'none' ? null : v } : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {facilities.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name} — {f.school}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Year (e.g. Senior)</Label>
                <Select
                  value={athleteEditForm.year ?? 'none'}
                  onValueChange={(v) => setAthleteEditForm((p) => p ? { ...p, year: v === 'none' ? null : v } : null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="Freshman">Freshman</SelectItem>
                    <SelectItem value="Sophomore">Sophomore</SelectItem>
                    <SelectItem value="Junior">Junior</SelectItem>
                    <SelectItem value="Senior">Senior</SelectItem>
                    <SelectItem value="5th Year">5th Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="athlete-active"
                  checked={athleteEditForm.active}
                  onChange={(e) => setAthleteEditForm((p) => p ? { ...p, active: e.target.checked } : null)}
                  className="rounded border-input"
                />
                <Label htmlFor="athlete-active">Active (visible in Browse)</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setEditingAthleteId(null); setAthleteEditForm(null); }}>Cancel</Button>
                <Button type="submit" disabled={athleteEditSaving}>{athleteEditSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}</Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
