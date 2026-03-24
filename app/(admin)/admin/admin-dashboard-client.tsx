'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
  Search,
  Wallet,
  CreditCard,
  Copy,
  Check,
  Pencil,
  Plus,
  User,
  UserX,
  Loader2,
  Trash2,
  Building2,
  ExternalLink,
  Smartphone,
  LayoutDashboard,
  TrendingUp,
  TrendingDown,
  Star,
  ChevronRight,
  Menu,
  X,
  Trophy,
  ArrowUpDown,
} from 'lucide-react';
import Link from 'next/link';
import { ProfileImage } from '@/components/profile-image';
import { CapacityBadge } from '@/components/capacity-badge';
import { formatEST, APP_TIMEZONE } from '@/lib/format-date';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { CopySessionPhonesButton } from '@/components/copy-session-phones-button';
import { CoachTextGroupDialog } from '@/components/coach-text-group-dialog';
import { showSessionSmsCopyAndTextGroup } from '@/lib/session-sms-tools';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

export type AdminSession = {
  id: string;
  athlete_id: string;
  scheduled_datetime: string;
  status: string;
  total_price: number;
  athlete_payment: number;
  org_fee: number;
  stripe_fee: number;
  session_type?: string;
  session_mode?: string;
  partner_invite_code?: string | null;
  current_participants: number;
  max_participants: number;
  parent_id: string;
  parent_email: string;
  athlete_name: string;
  athlete_school: string;
  facility_name: string;
  /** Sum of session_participants.amount_paid - what parents actually paid (from Stripe) */
  participant_amount_paid_sum: number;
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
  average_rating?: number | null;
  review_count?: number;
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

type SectionId = 'overview' | 'bookings' | 'money' | 'people';
type SubSectionId = 
  | 'dashboard' 
  | 'sessions' 
  | 'payments' 
  | 'payouts' 
  | 'credits' 
  | 'coaches' 
  | 'athletes' 
  | 'parents' 
  | 'requests';

type Props = {
  sessions: AdminSession[];
  users: AdminUser[];
  billing: BillingSummary;
  athleteReports: AthleteReport[];
  coachPayouts: CoachPayout[];
  credits: CreditRecord[];
  usersError?: string | null;
};

// Sidebar Navigation Item Component
function NavItem({ 
  icon: Icon, 
  label, 
  active, 
  onClick,
  badge,
}: { 
  icon: React.ElementType; 
  label: string; 
  active: boolean; 
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all ${
        active
          ? 'bg-[#B89D60]/15 text-[#B89D60]'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#B89D60]/20 text-[#B89D60]">
          {badge}
        </span>
      )}
      {active && <ChevronRight className="h-4 w-4 shrink-0 opacity-50" />}
    </button>
  );
}

// KPI Card Component
function KpiCard({
  title,
  value,
  change,
  trend,
  icon: Icon,
  prefix = '',
  chartData,
}: {
  title: string;
  value: string | number;
  change?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  prefix?: string;
  chartData?: { value: number }[];
}) {
  const chartColor = trend === 'down' ? '#ef4444' : '#B89D60';
  
  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-semibold tabular-nums">
              {prefix}{typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {change && (
              <div className={`flex items-center gap-1 text-xs font-medium ${
                trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
              }`}>
                {trend === 'up' && <TrendingUp className="h-3 w-3" />}
                {trend === 'down' && <TrendingDown className="h-3 w-3" />}
                {change}
              </div>
            )}
          </div>
          <div className="p-2 rounded-lg bg-[#B89D60]/10">
            <Icon className="h-5 w-5 text-[#B89D60]" />
          </div>
        </div>
        {chartData && chartData.length > 0 && (
          <div className="mt-3 h-10 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id={`gradient-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={chartColor} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={chartColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={1.5}
                  fill={`url(#gradient-${title})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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
  const sectionParam = searchParams.get('section') as SectionId | null;
  const subParam = searchParams.get('sub') as SubSectionId | null;
  const editAthleteId = searchParams.get('edit');
  
  const [section, setSection] = useState<SectionId>(sectionParam || 'overview');
  const [subSection, setSubSection] = useState<SubSectionId>(subParam || 'dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const [markingAthleteId, setMarkingAthleteId] = useState<string | null>(null);
  const [recordingAthleteId, setRecordingAthleteId] = useState<string | null>(null);
  const [customPayoutAmount, setCustomPayoutAmount] = useState('');
  const [payoutTotalByAthlete, setPayoutTotalByAthlete] = useState<Record<string, string>>({});
  const payoutListKey = coachPayouts.map((p) => `${p.athlete_id}:${p.amount}`).join('|');
  
  useEffect(() => {
    setPayoutTotalByAthlete(
      Object.fromEntries(coachPayouts.map((p) => [p.athlete_id, p.amount.toFixed(2)]))
    );
  }, [payoutListKey]);
  
  const [sessionDateFrom, setSessionDateFrom] = useState('');
  const [sessionDateTo, setSessionDateTo] = useState('');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<'all' | 'open' | 'completed' | 'cancelled_other'>('all');
  const [sessionTypeFilter, setSessionTypeFilter] = useState<string>('all');
  const [sessionCoachFilter, setSessionCoachFilter] = useState<string>('all');
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [sessionDeleteLoading, setSessionDeleteLoading] = useState(false);
  const [sessionCompletingId, setSessionCompletingId] = useState<string | null>(null);
  const [textGroupAdminSession, setTextGroupAdminSession] = useState<AdminSession | null>(null);
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [userSearch, setUserSearch] = useState('');
  const [athleteSearch, setAthleteSearch] = useState('');
  const [leaderboardTimeFilter, setLeaderboardTimeFilter] = useState<'all' | '7d' | '30d' | '90d'>('all');
  const [leaderboardTypeFilter, setLeaderboardTypeFilter] = useState<string>('all');
  const [leaderboardSchoolFilter, setLeaderboardSchoolFilter] = useState<string>('all');
  const [leaderboardSort, setLeaderboardSort] = useState<'earnings' | 'sessions' | 'rating' | 'open'>('earnings');
  
  // Financial filters
  const [financeTimeFilter, setFinanceTimeFilter] = useState<'all' | '7d' | '30d' | '90d' | 'ytd'>('all');
  const [financeTypeFilter, setFinanceTypeFilter] = useState<string>('all');
  const [financeSchoolFilter, setFinanceSchoolFilter] = useState<string>('all');
  
  // Manual payment entry
  const [showManualPaymentDialog, setShowManualPaymentDialog] = useState(false);
  const [manualPaymentForm, setManualPaymentForm] = useState({
    sessionId: '',
    amount: '',
    paymentMethod: 'cash' as 'cash' | 'check' | 'venmo' | 'other',
    notes: '',
  });
  const [savingManualPayment, setSavingManualPayment] = useState(false);
  const [editingAthleteId, setEditingAthleteId] = useState<string | null>(null);
  const hasOpenedEditFromUrl = useRef(false);
  
  useEffect(() => {
    if (editAthleteId && section === 'people' && subSection === 'coaches' && !hasOpenedEditFromUrl.current) {
      hasOpenedEditFromUrl.current = true;
      openAthleteEdit(editAthleteId);
    }
  }, [editAthleteId, section, subSection]);
  
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
    photo_focus_x?: number;
    photo_focus_y?: number;
    created_at: string;
  }>>([]);
  const [kidsLoading, setKidsLoading] = useState(false);
  const [linkingKidId, setLinkingKidId] = useState<string | null>(null);

  // Navigation change handler
  const handleNavChange = (newSection: SectionId, newSubSection?: SubSectionId) => {
    setSection(newSection);
    if (newSubSection) {
      setSubSection(newSubSection);
    } else {
      // Set default sub-section for each section
      switch (newSection) {
        case 'overview': setSubSection('dashboard'); break;
        case 'bookings': setSubSection('sessions'); break;
        case 'money': setSubSection('payments'); break;
        case 'people': setSubSection('coaches'); break;
      }
    }
    setMobileMenuOpen(false);
  };

  const setPresetThisWeek = () => {
    const z = toZonedTime(new Date(), APP_TIMEZONE);
    const start = startOfWeek(z, { weekStartsOn: 0 });
    const end = endOfWeek(z, { weekStartsOn: 0 });
    setSessionDateFrom(formatInTimeZone(start, APP_TIMEZONE, 'yyyy-MM-dd'));
    setSessionDateTo(formatInTimeZone(end, APP_TIMEZONE, 'yyyy-MM-dd'));
  };

  const setPresetNextWeek = () => {
    const z = toZonedTime(addWeeks(new Date(), 1), APP_TIMEZONE);
    const start = startOfWeek(z, { weekStartsOn: 0 });
    const end = endOfWeek(z, { weekStartsOn: 0 });
    setSessionDateFrom(formatInTimeZone(start, APP_TIMEZONE, 'yyyy-MM-dd'));
    setSessionDateTo(formatInTimeZone(end, APP_TIMEZONE, 'yyyy-MM-dd'));
  };

  const clearSessionFilters = () => {
    setSessionDateFrom('');
    setSessionDateTo('');
    setSessionStatusFilter('all');
    setSessionTypeFilter('all');
    setSessionCoachFilter('all');
  };

  const sessionTypesForFilter = useMemo(() => {
    const set = new Set<string>();
    for (const s of sessions) {
      const t = s.session_type?.trim();
      if (t) set.add(t);
    }
    return [...set].sort();
  }, [sessions]);

  const coachesForFilter = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sessions) {
      const id = s.athlete_id?.trim();
      if (id) map.set(id, s.athlete_name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    const sessionDateKeyLocal = (iso: string) =>
      formatInTimeZone(new Date(iso), APP_TIMEZONE, 'yyyy-MM-dd');
    return sessions.filter((s) => {
      const d = sessionDateKeyLocal(s.scheduled_datetime);
      if (sessionDateFrom && d < sessionDateFrom) return false;
      if (sessionDateTo && d > sessionDateTo) return false;

      if (sessionStatusFilter === 'open') {
        if (s.status !== 'scheduled' && s.status !== 'pending_payment') return false;
      } else if (sessionStatusFilter === 'completed') {
        if (s.status !== 'completed') return false;
      } else if (sessionStatusFilter === 'cancelled_other') {
        if (s.status === 'scheduled' || s.status === 'pending_payment' || s.status === 'completed') return false;
      }

      if (sessionTypeFilter !== 'all' && (s.session_type ?? '') !== sessionTypeFilter) return false;
      if (sessionCoachFilter !== 'all' && s.athlete_id !== sessionCoachFilter) return false;

      return true;
    });
  }, [
    sessions,
    sessionDateFrom,
    sessionDateTo,
    sessionStatusFilter,
    sessionTypeFilter,
    sessionCoachFilter,
  ]);

  const filteredUsers = users.filter((u) => {
    if (userRoleFilter !== 'all' && u.role !== userRoleFilter) return false;
    if (userSearch) {
      const q = userSearch.toLowerCase();
      if (!u.email.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Compute leaderboard data from sessions
  const leaderboardData = useMemo(() => {
    const now = new Date();
    const cutoff = leaderboardTimeFilter === '7d' 
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : leaderboardTimeFilter === '30d'
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      : leaderboardTimeFilter === '90d'
      ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      : null;

    // Filter sessions by time and type
    const filteredSess = sessions.filter(s => {
      if (cutoff && new Date(s.scheduled_datetime) < cutoff) return false;
      if (leaderboardTypeFilter !== 'all' && s.session_type !== leaderboardTypeFilter) return false;
      return true;
    });

    // Aggregate by coach
    const coachMap = new Map<string, {
      athlete_id: string;
      athlete_name: string;
      school: string;
      total_earnings: number;
      session_count: number;
      completed_count: number;
      open_count: number;
      pending_payment_count: number;
      average_rating: number | null;
      review_count: number;
    }>();

    for (const s of filteredSess) {
      const existing = coachMap.get(s.athlete_id) || {
        athlete_id: s.athlete_id,
        athlete_name: s.athlete_name,
        school: s.athlete_school,
        total_earnings: 0,
        session_count: 0,
        completed_count: 0,
        open_count: 0,
        pending_payment_count: 0,
        average_rating: null,
        review_count: 0,
      };
      
      existing.session_count += 1;
      existing.total_earnings += Number(s.athlete_payment) || 0;
      
      if (s.status === 'completed') existing.completed_count += 1;
      if (s.status === 'scheduled') existing.open_count += 1;
      if (s.status === 'pending_payment') existing.pending_payment_count += 1;
      
      coachMap.set(s.athlete_id, existing);
    }

    // Merge with athlete reports for ratings
    for (const report of athleteReports) {
      const existing = coachMap.get(report.athlete_id);
      if (existing) {
        existing.average_rating = report.average_rating ?? null;
        existing.review_count = report.review_count ?? 0;
      } else if (leaderboardTimeFilter === 'all') {
        // Include coaches with no sessions in this period only for 'all'
        coachMap.set(report.athlete_id, {
          athlete_id: report.athlete_id,
          athlete_name: report.athlete_name,
          school: report.school,
          total_earnings: report.total_earnings,
          session_count: report.session_count,
          completed_count: report.completed_count,
          open_count: 0,
          pending_payment_count: 0,
          average_rating: report.average_rating ?? null,
          review_count: report.review_count ?? 0,
        });
      }
    }

    // Convert to array
    let result = Array.from(coachMap.values());

    // Apply school filter
    if (leaderboardSchoolFilter !== 'all') {
      if (leaderboardSchoolFilter === 'non-affiliated') {
        // Non-affiliated = empty school or common non-NCAA indicators
        result = result.filter(a => 
          !a.school || 
          a.school.trim() === '' || 
          a.school.toLowerCase() === 'non-affiliated' ||
          a.school.toLowerCase() === 'independent' ||
          a.school.toLowerCase() === 'n/a'
        );
      } else {
        result = result.filter(a => a.school === leaderboardSchoolFilter);
      }
    }

    // Apply search filter
    if (athleteSearch) {
      const q = athleteSearch.toLowerCase();
      result = result.filter(a => 
        a.athlete_name.toLowerCase().includes(q) ||
        a.school.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (leaderboardSort) {
        case 'earnings': return b.total_earnings - a.total_earnings;
        case 'sessions': return b.session_count - a.session_count;
        case 'rating': return (b.average_rating ?? 0) - (a.average_rating ?? 0);
        case 'open': return b.open_count - a.open_count;
        default: return 0;
      }
    });

    return result;
  }, [sessions, athleteReports, leaderboardTimeFilter, leaderboardTypeFilter, leaderboardSchoolFilter, leaderboardSort, athleteSearch]);
  
  // Get unique schools for the filter dropdown
  const uniqueSchools = useMemo(() => {
    const schools = new Set<string>();
    for (const report of athleteReports) {
      if (report.school && report.school.trim() !== '') {
        schools.add(report.school);
      }
    }
    return Array.from(schools).sort();
  }, [athleteReports]);

  // Computed financial data with filters
  const financeData = useMemo(() => {
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const cutoff = financeTimeFilter === '7d' 
      ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      : financeTimeFilter === '30d'
      ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      : financeTimeFilter === '90d'
      ? new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      : financeTimeFilter === 'ytd'
      ? yearStart
      : null;

    // Filter sessions by time and type
    const filteredSess = sessions.filter(s => {
      if (cutoff && new Date(s.scheduled_datetime) < cutoff) return false;
      if (financeTypeFilter !== 'all' && s.session_type !== financeTypeFilter) return false;
      if (financeSchoolFilter !== 'all') {
        if (financeSchoolFilter === 'non-affiliated') {
          if (s.athlete_school && s.athlete_school.trim() !== '' && 
              s.athlete_school.toLowerCase() !== 'non-affiliated' &&
              s.athlete_school.toLowerCase() !== 'independent' &&
              s.athlete_school.toLowerCase() !== 'n/a') return false;
        } else {
          if (s.athlete_school !== financeSchoolFilter) return false;
        }
      }
      return true;
    });

    // Debug: log financeData filter results
    console.log('[v0] financeData - sessions after filter:', filteredSess.length);
    console.log('[v0] financeData - sum of participant_amount_paid_sum:', filteredSess.reduce((sum, s) => sum + (Number(s.participant_amount_paid_sum) || 0), 0));
    console.log('[v0] financeData - financeTimeFilter:', financeTimeFilter);
    console.log('[v0] financeData - financeTypeFilter:', financeTypeFilter);

    // Calculate aggregates
    // athlete_payment is the SOURCE OF TRUTH for what goes to coaches
    // (already accounts for discounts, family codes, special deals, etc.)
    let stripeRevenue = 0; // Total collected via Stripe
    let cashRevenue = 0; // Manual/cash payments
    let coachPayoutsTotal = 0; // Sum of athlete_payment (the "bible")
    let stripeTransactionCount = 0; // For calculating Stripe fees
    let openBookings = 0;
    let completedSessions = 0;
    let pendingPayment = 0;
    let cancelledSessions = 0;

    // Group by coach for breakdown
    const coachBreakdown = new Map<string, { name: string; school: string; revenue: number; payout: number; sessions: number; open: number }>();

    for (const s of filteredSess) {
      // participant_amount_paid_sum = what parents ACTUALLY paid (from Stripe checkout)
      // athlete_payment = what you RECORDED paying the coach (the "bible" for payouts)
      const parentsPaid = Number(s.participant_amount_paid_sum) || 0;
      const coachPaid = Number(s.athlete_payment) || 0;
      
      if (s.status === 'completed' || s.status === 'pending_payment' || s.status === 'scheduled') {
        // Revenue = what parents paid (captured from Stripe)
        stripeRevenue += parentsPaid;
        if (parentsPaid > 0) stripeTransactionCount += s.current_participants || 1;
        // Coach payouts = what you recorded paying them
        coachPayoutsTotal += coachPaid;
      }

      if (s.status === 'scheduled') openBookings += 1;
      if (s.status === 'completed') completedSessions += 1;
      if (s.status === 'pending_payment') pendingPayment += 1;
      if (s.status === 'cancelled') cancelledSessions += 1;

      // Coach breakdown
      const existing = coachBreakdown.get(s.athlete_id) || {
        name: s.athlete_name,
        school: s.athlete_school,
        revenue: 0,
        payout: 0,
        sessions: 0,
        open: 0,
      };
      if (s.status === 'completed' || s.status === 'pending_payment' || s.status === 'scheduled') {
        existing.revenue += parentsPaid;
        existing.payout += coachPaid;
        existing.sessions += 1;
      }
      if (s.status === 'scheduled') existing.open += 1;
      coachBreakdown.set(s.athlete_id, existing);
    }

    const grossRevenue = stripeRevenue + cashRevenue;
    // Guild Net = what's left after paying coaches (Gross - Coach Payouts)
    const guildNet = grossRevenue - coachPayoutsTotal;
    // Stripe fees only apply to Stripe transactions (~2.9% + $0.30 per transaction)
    const stripeFees = stripeRevenue > 0 ? (stripeRevenue * 0.029) + (stripeTransactionCount * 0.30) : 0;
    // Guild Profit = Guild Net after paying Stripe fees
    const guildProfit = guildNet - stripeFees;

    // Sort coach breakdown by revenue
    const coachBreakdownArray = Array.from(coachBreakdown.entries())
      .map(([id, data]) => ({ athlete_id: id, ...data }))
      .sort((a, b) => b.revenue - a.revenue);

    return {
      grossRevenue,
      stripeRevenue,
      cashRevenue,
      coachPayouts: coachPayoutsTotal,
      guildNet,
      stripeFees,
      guildProfit,
      openBookings,
      completedSessions,
      pendingPayment,
      cancelledSessions,
      totalSessions: filteredSess.length,
      coachBreakdown: coachBreakdownArray,
    };
  }, [sessions, financeTimeFilter, financeTypeFilter, financeSchoolFilter]);

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
        photo_focus_y: typeof a.photo_focus_y === 'number' ? a.photo_focus_y : 15,
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
    if (!confirm('Permanently delete this coach? This cannot be undone.')) return;
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
    const isOpen = status === 'scheduled' || status === 'pending_payment';
    const isClosed = status === 'completed' || status === 'cancelled' || status === 'no-show';
    const label = status === 'pending_payment' ? 'Pending payment' : status;
    return (
      <Badge
        variant={isClosed ? 'destructive' : 'outline'}
        className={isOpen ? 'border-emerald-600 bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/20 hover:text-emerald-400' : undefined}
      >
        {label}
      </Badge>
    );
  };

  // Fetch kids when People > Athletes is selected
  useEffect(() => {
    if (section !== 'people' || subSection !== 'athletes') return;
    setKidsLoading(true);
    fetch('/api/admin/youth-wrestlers')
      .then((r) => r.json())
      .then((data) => {
        setKidsList(data.youthWrestlers ?? []);
      })
      .catch(() => setKidsList([]))
      .finally(() => setKidsLoading(false));
  }, [section, subSection]);

  // Fetch facility requests when People > Requests is selected
  useEffect(() => {
    if (section !== 'people' || subSection !== 'requests') return;
    setFacilityRequestsLoading(true);
    fetch('/api/admin/facility-requests')
      .then((r) => r.json())
      .then((data) => {
        setFacilityRequests(data.requests ?? []);
      })
      .catch(() => setFacilityRequests([]))
      .finally(() => setFacilityRequestsLoading(false));
  }, [section, subSection]);

  // Calculate metrics
  const openSessions = sessions.filter(s => s.status === 'scheduled' || s.status === 'pending_payment').length;
  const pendingPayments = sessions.filter(s => s.status === 'pending_payment').length;
  const totalCoachPayoutsDue = coachPayouts.reduce((sum, p) => sum + p.amount, 0);
  const pendingFacilityRequests = facilityRequests.filter(r => r.status === 'pending').length;

  // Generate chart data from sessions
  const revenueChartData = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return formatInTimeZone(d, APP_TIMEZONE, 'yyyy-MM-dd');
    });
    return last7Days.map(date => {
      const dayRevenue = sessions
        .filter(s => formatInTimeZone(new Date(s.scheduled_datetime), APP_TIMEZONE, 'yyyy-MM-dd') === date && s.status === 'completed')
        .reduce((sum, s) => sum + s.total_price, 0);
      return { value: dayRevenue };
    });
  }, [sessions]);

  const bookingsChartData = useMemo(() => {
    const last7Days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return formatInTimeZone(d, APP_TIMEZONE, 'yyyy-MM-dd');
    });
    return last7Days.map(date => {
      const dayBookings = sessions
        .filter(s => formatInTimeZone(new Date(s.scheduled_datetime), APP_TIMEZONE, 'yyyy-MM-dd') === date)
        .length;
      return { value: dayBookings };
    });
  }, [sessions]);

  // Render section content
  const renderContent = () => {
    // OVERVIEW SECTION
    if (section === 'overview') {
      return (
        <div className="space-y-6">
          {/* Hero KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="Total Revenue"
              value={billing.totalRevenue.toFixed(2)}
              prefix="$"
              icon={DollarSign}
              trend="up"
              change="All time"
              chartData={revenueChartData}
            />
            <KpiCard
              title="App Net Profit"
              value={billing.totalOrgFees.toFixed(2)}
              prefix="$"
              icon={TrendingUp}
              trend="up"
              change={`${((billing.totalOrgFees / billing.totalRevenue) * 100 || 0).toFixed(1)}% margin`}
            />
            <KpiCard
              title="Coach Payouts"
              value={billing.totalAthletePayments.toFixed(2)}
              prefix="$"
              icon={Wallet}
              trend="neutral"
              change={`${coachPayouts.length} coaches`}
            />
            <KpiCard
              title="Open Bookings"
              value={openSessions}
              icon={Calendar}
              trend={openSessions > 0 ? 'up' : 'neutral'}
              change={`${pendingPayments} pending payment`}
              chartData={bookingsChartData}
            />
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Users className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Coaches</p>
                  <p className="text-lg font-semibold">{athleteReports.length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <User className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Parents</p>
                  <p className="text-lg font-semibold">{users.filter(u => u.role === 'parent').length}</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Star className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Avg Rating</p>
                  <p className="text-lg font-semibold">
                    {(athleteReports.reduce((sum, a) => sum + (a.average_rating || 0), 0) / athleteReports.filter(a => a.average_rating).length || 0).toFixed(1)}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <CreditCard className="h-4 w-4 text-purple-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Active Credits</p>
                  <p className="text-lg font-semibold">{credits.filter(c => c.remaining > 0).length}</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Revenue Breakdown & Payouts Due */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Revenue Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Gross Revenue</span>
                    <span className="text-sm font-medium">${billing.totalRevenue.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Coach Payments</span>
                    <span className="text-sm font-medium text-red-400">-${billing.totalAthletePayments.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-border">
                    <span className="text-sm text-muted-foreground">Stripe Fees</span>
                    <span className="text-sm font-medium text-red-400">-${billing.totalStripeFees.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm font-medium">Net Profit</span>
                    <span className="text-lg font-semibold text-[#B89D60]">${billing.totalOrgFees.toFixed(2)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Payouts Due</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#B89D60] hover:text-[#B89D60]"
                  onClick={() => handleNavChange('money', 'payouts')}
                >
                  View all
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {totalCoachPayoutsDue > 0 ? (
                  <div className="space-y-3">
                    {coachPayouts.slice(0, 4).map((p) => (
                      <div key={p.athlete_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.school}</p>
                        </div>
                        <span className="text-sm font-medium text-[#B89D60]">${p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-border">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Total Due</span>
                        <span className="text-lg font-semibold text-[#B89D60]">${totalCoachPayoutsDue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4 text-center">No payouts due</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Sessions */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-medium">Recent Bookings</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#B89D60] hover:text-[#B89D60]"
                onClick={() => handleNavChange('bookings', 'sessions')}
              >
                View all
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Coach</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {sessions.slice(0, 5).map((s) => (
                      <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium">{formatEST(new Date(s.scheduled_datetime), 'MMM d')}</div>
                          <div className="text-xs text-muted-foreground">{formatEST(new Date(s.scheduled_datetime), 'h:mm a')}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium">{s.athlete_name}</div>
                        </td>
                        <td className="py-3 px-4">{statusBadge(s.status)}</td>
                        <td className="py-3 px-4 text-right font-medium tabular-nums">${s.total_price.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // BOOKINGS SECTION
    if (section === 'bookings') {
      return (
        <div className="space-y-6">
          {/* Header with Create Button */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Sessions</h2>
              <p className="text-sm text-muted-foreground">{filteredSessions.length} sessions found</p>
            </div>
            <Link href="/admin/sessions/create">
              <Button className="bg-[#B89D60] hover:bg-[#9A8550] text-black">
                <Plus className="h-4 w-4 mr-2" />
                Create Session
              </Button>
            </Link>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={sessionDateFrom}
                  onChange={(e) => setSessionDateFrom(e.target.value)}
                  className="w-36 h-9 text-sm"
                  placeholder="From"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={sessionDateTo}
                  onChange={(e) => setSessionDateTo(e.target.value)}
                  className="w-36 h-9 text-sm"
                  placeholder="To"
                />
              </div>
              
              <Select value={sessionStatusFilter} onValueChange={(v) => setSessionStatusFilter(v as typeof sessionStatusFilter)}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled_other">Cancelled/Other</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sessionCoachFilter} onValueChange={setSessionCoachFilter}>
                <SelectTrigger className="w-40 h-9">
                  <SelectValue placeholder="Coach" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All coaches</SelectItem>
                  {coachesForFilter.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={setPresetThisWeek}>This week</Button>
                <Button variant="outline" size="sm" onClick={setPresetNextWeek}>Next week</Button>
                <Button variant="ghost" size="sm" onClick={clearSessionFilters}>Clear</Button>
              </div>
            </div>
          </Card>

          {/* Sessions Table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Date / Time</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Coach</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Facility</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Spots</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Revenue</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredSessions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Calendar className="h-8 w-8 text-muted-foreground/50" />
                          <p>No sessions found</p>
                          <p className="text-xs">Try adjusting your filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSessions.map((s) => {
                      const shareUrl = s.partner_invite_code
                        ? `${typeof window !== 'undefined' ? window.location.origin : ''}/join/${s.partner_invite_code}`
                        : null;
                      const handleCopy = () => {
                        if (!shareUrl) return;
                        navigator.clipboard.writeText(shareUrl);
                        setCopiedSessionId(s.id);
                        setTimeout(() => setCopiedSessionId(null), 2000);
                      };
                      return (
                        <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium">{formatEST(new Date(s.scheduled_datetime), 'MMM d, yyyy')}</div>
                            <div className="text-xs text-muted-foreground">{formatEST(new Date(s.scheduled_datetime), 'h:mm a')}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{s.athlete_name}</div>
                            <div className="text-xs text-muted-foreground">{s.athlete_school}</div>
                          </td>
                          <td className="py-3 px-4 text-sm">{s.facility_name}</td>
                          <td className="py-3 px-4">{statusBadge(s.status)}</td>
                          <td className="py-3 px-4 text-right">
                            <CapacityBadge current={s.current_participants} max={s.max_participants ?? 1} label="" />
                          </td>
                          <td className="py-3 px-4 text-right font-medium tabular-nums">${s.total_price.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {shareUrl && (
                                <Button variant="ghost" size="sm" className="h-8" onClick={handleCopy}>
                                  {copiedSessionId === s.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                              {showSessionSmsCopyAndTextGroup(s) && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => setTextGroupAdminSession(s)}
                                >
                                  <Smartphone className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Link href={`/admin/sessions/${s.id}/edit`}>
                                <Button variant="ghost" size="sm" className="h-8 text-[#B89D60]">
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      );
    }

    // MONEY SECTION
    if (section === 'money') {
      // Payouts sub-section
      if (subSection === 'payouts') {
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Coach Payouts</h2>
              <p className="text-sm text-muted-foreground">Manage pending payments to coaches</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Due</p>
                <p className="text-2xl font-semibold text-[#B89D60]">${totalCoachPayoutsDue.toFixed(2)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Coaches to Pay</p>
                <p className="text-2xl font-semibold">{coachPayouts.filter(p => p.amount > 0).length}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed Sessions</p>
                <p className="text-2xl font-semibold">{billing.completedCount}</p>
              </Card>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Coach</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">School</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Payment Info</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Amount</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {coachPayouts.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No payouts due</p>
                        </td>
                      </tr>
                    ) : (
                      coachPayouts.map((p) => (
                        <tr key={p.athlete_id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-medium">{p.name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{p.school}</td>
                          <td className="py-3 px-4">
                            {p.venmo_handle && (
                              <div className="flex items-center gap-1 text-sm">
                                <span className="text-muted-foreground">Venmo:</span>
                                <span className="font-medium">{p.venmo_handle}</span>
                              </div>
                            )}
                            {p.zelle_email && (
                              <div className="flex items-center gap-1 text-sm">
                                <span className="text-muted-foreground">Zelle:</span>
                                <span className="font-medium">{p.zelle_email}</span>
                              </div>
                            )}
                            {!p.venmo_handle && !p.zelle_email && (
                              <span className="text-muted-foreground text-xs">No payment info</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              className="w-24 h-8 text-right ml-auto"
                              value={payoutTotalByAthlete[p.athlete_id] ?? p.amount.toFixed(2)}
                              onChange={(e) => setPayoutTotalByAthlete(prev => ({ ...prev, [p.athlete_id]: e.target.value }))}
                            />
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              className="bg-[#B89D60] hover:bg-[#9A8550] text-black h-8"
                              disabled={markingAthleteId === p.athlete_id}
                              onClick={async () => {
                                setMarkingAthleteId(p.athlete_id);
                                const amount = parseFloat(payoutTotalByAthlete[p.athlete_id] || p.amount.toString());
                                try {
                                  const res = await fetch('/api/admin/payout-log', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ athlete_id: p.athlete_id, amount }),
                                  });
                                  if (res.ok) router.refresh();
                                } finally {
                                  setMarkingAthleteId(null);
                                }
                              }}
                            >
                              {markingAthleteId === p.athlete_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Mark Paid'}
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      }

      // Credits sub-section
      if (subSection === 'credits') {
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Parent Credits</h2>
              <p className="text-sm text-muted-foreground">View and manage credit balances</p>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Parent</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Source</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Original</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Remaining</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {credits.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          <CreditCard className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No credits found</p>
                        </td>
                      </tr>
                    ) : (
                      credits.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-medium">{c.parent_email}</td>
                          <td className="py-3 px-4">
                            <Badge variant="outline">{c.source}</Badge>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">${c.amount.toFixed(2)}</td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium text-[#B89D60]">${c.remaining.toFixed(2)}</td>
                          <td className="py-3 px-4 text-muted-foreground">{formatEST(new Date(c.created_at), 'MMM d, yyyy')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      }

      // Default: Payments overview with filters
      return (
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-[#B89D60]/10">
                <DollarSign className="h-5 w-5 text-[#B89D60]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Financial Overview</h2>
                <p className="text-sm text-muted-foreground">Guild revenue, coach payouts, and open bookings</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSubSection('payouts')}
              >
                <Wallet className="h-4 w-4 mr-2" />
                Process Payouts
                {totalCoachPayoutsDue > 0 && (
                  <Badge className="ml-2 bg-[#B89D60]/20 text-[#B89D60]">${totalCoachPayoutsDue.toFixed(0)}</Badge>
                )}
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">Time:</span>
                <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1">
                  {(['all', '7d', '30d', '90d', 'ytd'] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setFinanceTimeFilter(period)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                        financeTimeFilter === period
                          ? 'bg-[#B89D60] text-black'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {period === 'all' ? 'All Time' : period === 'ytd' ? 'YTD' : period}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">Type:</span>
                <Select value={financeTypeFilter} onValueChange={setFinanceTypeFilter}>
                  <SelectTrigger className="w-36 h-9">
                    <SelectValue placeholder="All types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {sessionTypesForFilter.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground uppercase">School:</span>
                <Select value={financeSchoolFilter} onValueChange={setFinanceSchoolFilter}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue placeholder="All schools" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Schools</SelectItem>
                    <SelectItem value="non-affiliated">Non-Affiliated</SelectItem>
                    {uniqueSchools.map((school) => (
                      <SelectItem key={school} value={school}>{school}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {(financeTimeFilter !== 'all' || financeTypeFilter !== 'all' || financeSchoolFilter !== 'all') && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    setFinanceTimeFilter('all');
                    setFinanceTypeFilter('all');
                    setFinanceSchoolFilter('all');
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          </Card>

          {/* Financial Summary */}
          <Card className="p-6">
            <h3 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">Revenue Breakdown</h3>
            <div className="space-y-4">
              {/* Gross Revenue */}
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="flex items-center gap-3">
                  <DollarSign className="h-5 w-5 text-[#B89D60]" />
                  <div>
                    <p className="font-medium">Gross Revenue</p>
                    <p className="text-xs text-muted-foreground">Total collected from parents (Stripe + Cash)</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold">${financeData.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  <div className="flex gap-2 text-xs text-muted-foreground">
                    <span>Stripe: ${financeData.stripeRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    {financeData.cashRevenue > 0 && (
                      <span className="text-emerald-500">Cash: ${financeData.cashRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Coach Payouts */}
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="flex items-center gap-3">
                  <Wallet className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="font-medium">Coach Payouts</p>
                    <p className="text-xs text-muted-foreground">Recorded payments to coaches (athlete_payment)</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-blue-400">-${financeData.coachPayouts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>

              {/* Guild Net */}
              <div className="flex items-center justify-between py-2 border-b border-border bg-emerald-500/5 -mx-6 px-6">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                  <div>
                    <p className="font-medium">Guild Net</p>
                    <p className="text-xs text-muted-foreground">Gross Revenue - Coach Payouts</p>
                  </div>
                </div>
                <p className={`text-xl font-bold ${financeData.guildNet >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                  ${financeData.guildNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>

              {/* Stripe Fees (Estimated) */}
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div className="flex items-center gap-3">
                  <CreditCard className="h-5 w-5 text-red-400" />
                  <div>
                    <p className="font-medium">Stripe Fees <span className="text-xs text-amber-500 ml-1">(estimated)</span></p>
                    <p className="text-xs text-muted-foreground">~2.9% + $0.30 per transaction on Stripe payments</p>
                  </div>
                </div>
                <p className="text-xl font-bold text-red-400">-${financeData.stripeFees.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>

              {/* Guild Profit */}
              <div className="flex items-center justify-between py-3 bg-[#B89D60]/10 -mx-6 px-6 rounded-b-lg">
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-[#B89D60]" />
                  <div>
                    <p className="font-semibold">Guild Profit</p>
                    <p className="text-xs text-muted-foreground">Guild Net - Stripe Fees (estimated)</p>
                  </div>
                </div>
                <p className={`text-2xl font-bold ${financeData.guildProfit >= 0 ? 'text-[#B89D60]' : 'text-red-500'}`}>
                  ${financeData.guildProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </Card>

          {/* Bookings Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Bookings</p>
              <p className="text-xl font-semibold mt-1 text-emerald-500">{financeData.openBookings}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Completed</p>
              <p className="text-xl font-semibold mt-1">{financeData.completedSessions}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Payment</p>
              <p className="text-xl font-semibold mt-1 text-amber-500">{financeData.pendingPayment}</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cancelled</p>
              <p className="text-xl font-semibold mt-1 text-muted-foreground">{financeData.cancelledSessions}</p>
            </Card>
          </div>

          {/* Revenue Breakdown by Coach */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Revenue by Coach</CardTitle>
              <CardDescription>Top performers based on current filters</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Coach</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">School</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Sessions</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Open</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Revenue</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Coach Payout</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Guild Net</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {financeData.coachBreakdown.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-muted-foreground">
                          <DollarSign className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No financial data for selected filters</p>
                        </td>
                      </tr>
                    ) : (
                      financeData.coachBreakdown.slice(0, 10).map((coach, idx) => (
                        <tr key={coach.athlete_id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              {idx < 3 && (
                                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                                  idx === 0 ? 'bg-[#B89D60] text-black' :
                                  idx === 1 ? 'bg-gray-400 text-black' :
                                  'bg-amber-700 text-white'
                                }`}>
                                  {idx + 1}
                                </div>
                              )}
                              <span className="font-medium">{coach.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{coach.school}</td>
                          <td className="py-3 px-4 text-center tabular-nums">{coach.sessions}</td>
                          <td className="py-3 px-4 text-center">
                            {coach.open > 0 ? (
                              <Badge variant="outline" className="border-emerald-600 bg-emerald-600/20 text-emerald-400">{coach.open}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-medium">
                            ${coach.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums text-blue-400">
                            ${coach.payout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-semibold text-[#B89D60]">
                            ${(coach.revenue - coach.payout).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {financeData.coachBreakdown.length > 0 && (
                    <tfoot className="border-t-2 border-border bg-muted/30">
                      <tr className="font-semibold">
                        <td className="py-3 px-4" colSpan={2}>Total ({financeData.coachBreakdown.length} coaches)</td>
                        <td className="py-3 px-4 text-center tabular-nums">{financeData.completedSessions + financeData.pendingPayment}</td>
                        <td className="py-3 px-4 text-center tabular-nums">{financeData.openBookings}</td>
                        <td className="py-3 px-4 text-right tabular-nums">${financeData.grossRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-blue-400">${financeData.coachPayouts.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right tabular-nums text-[#B89D60]">${financeData.guildNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Button 
              variant="outline" 
              className="h-auto p-4 justify-start"
              onClick={() => setSubSection('payouts')}
            >
              <Wallet className="h-5 w-5 mr-3 text-[#B89D60]" />
              <div className="text-left">
                <div className="font-medium">Process Coach Payouts</div>
                <div className="text-xs text-muted-foreground">{coachPayouts.filter(p => p.amount > 0).length} coaches awaiting payment</div>
              </div>
              {totalCoachPayoutsDue > 0 && (
                <Badge className="ml-auto bg-[#B89D60]/20 text-[#B89D60]">${totalCoachPayoutsDue.toFixed(0)}</Badge>
              )}
            </Button>
            <Button 
              variant="outline" 
              className="h-auto p-4 justify-start"
              onClick={() => setSubSection('credits')}
            >
              <CreditCard className="h-5 w-5 mr-3 text-blue-500" />
              <div className="text-left">
                <div className="font-medium">Parent Credits</div>
                <div className="text-xs text-muted-foreground">{credits.filter(c => c.remaining > 0).length} active credits</div>
              </div>
            </Button>
          </div>
        </div>
      );
    }

    // PEOPLE SECTION
    if (section === 'people') {
      // Coaches Leaderboard sub-section
      if (subSection === 'coaches') {
        const totalOpenBookings = leaderboardData.reduce((sum, c) => sum + c.open_count, 0);
        const totalPendingPayment = leaderboardData.reduce((sum, c) => sum + c.pending_payment_count, 0);
        const totalEarnings = leaderboardData.reduce((sum, c) => sum + c.total_earnings, 0);

        return (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-[#B89D60]/10">
                  <Trophy className="h-5 w-5 text-[#B89D60]" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Coach Leaderboard</h2>
                  <p className="text-sm text-muted-foreground">{leaderboardData.length} coaches</p>
                </div>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Earnings</p>
                <p className="text-xl font-semibold mt-1 text-[#B89D60]">${totalEarnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Open Bookings</p>
                <p className="text-xl font-semibold mt-1">{totalOpenBookings}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Payment</p>
                <p className="text-xl font-semibold mt-1 text-amber-500">{totalPendingPayment}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Active Coaches</p>
                <p className="text-xl font-semibold mt-1">{leaderboardData.filter(c => c.open_count > 0).length}</p>
              </Card>
            </div>

            {/* Filters */}
            <Card className="p-4">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase">Time:</span>
                  <div className="flex items-center rounded-lg border border-border bg-muted/30 p-1">
                    {(['all', '7d', '30d', '90d'] as const).map((period) => (
                      <button
                        key={period}
                        onClick={() => setLeaderboardTimeFilter(period)}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                          leaderboardTimeFilter === period
                            ? 'bg-[#B89D60] text-black'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {period === 'all' ? 'All Time' : period}
                      </button>
                    ))}
                  </div>
                </div>

<div className="flex items-center gap-2">
  <span className="text-xs font-medium text-muted-foreground uppercase">Type:</span>
  <Select value={leaderboardTypeFilter} onValueChange={setLeaderboardTypeFilter}>
  <SelectTrigger className="w-36 h-9">
  <SelectValue placeholder="All types" />
  </SelectTrigger>
  <SelectContent>
  <SelectItem value="all">All Types</SelectItem>
  {sessionTypesForFilter.map((t) => (
  <SelectItem key={t} value={t}>{t}</SelectItem>
  ))}
  </SelectContent>
  </Select>
  </div>

  <div className="flex items-center gap-2">
  <span className="text-xs font-medium text-muted-foreground uppercase">School:</span>
  <Select value={leaderboardSchoolFilter} onValueChange={setLeaderboardSchoolFilter}>
  <SelectTrigger className="w-40 h-9">
  <SelectValue placeholder="All schools" />
  </SelectTrigger>
  <SelectContent>
  <SelectItem value="all">All Schools</SelectItem>
  <SelectItem value="non-affiliated">Non-Affiliated</SelectItem>
  {uniqueSchools.map((school) => (
  <SelectItem key={school} value={school}>{school}</SelectItem>
  ))}
  </SelectContent>
  </Select>
  </div>
  
  <div className="flex items-center gap-2">
  <span className="text-xs font-medium text-muted-foreground uppercase">Sort:</span>
                  <Select value={leaderboardSort} onValueChange={(v) => setLeaderboardSort(v as typeof leaderboardSort)}>
                    <SelectTrigger className="w-36 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="earnings">Earnings</SelectItem>
                      <SelectItem value="sessions">Sessions</SelectItem>
                      <SelectItem value="rating">Rating</SelectItem>
                      <SelectItem value="open">Open Bookings</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search coaches..."
                    className="pl-9"
                    value={athleteSearch}
                    onChange={(e) => setAthleteSearch(e.target.value)}
                  />
                </div>
              </div>
            </Card>

            {/* Leaderboard Table */}
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider w-10">#</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Coach</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">School</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Rating</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Open</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Completed</th>
                      <th className="text-center py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Pending $</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Earnings</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leaderboardData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-muted-foreground">
                          <Trophy className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No coaches found</p>
                        </td>
                      </tr>
                    ) : (
                      leaderboardData.map((a, idx) => (
                        <tr key={a.athlete_id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            {idx < 3 ? (
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                idx === 0 ? 'bg-[#B89D60] text-black' :
                                idx === 1 ? 'bg-gray-400 text-black' :
                                'bg-amber-700 text-white'
                              }`}>
                                {idx + 1}
                              </div>
                            ) : (
                              <span className="text-muted-foreground pl-1.5">{idx + 1}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 font-medium">{a.athlete_name}</td>
                          <td className="py-3 px-4 text-muted-foreground">{a.school}</td>
                          <td className="py-3 px-4 text-center">
                            {a.average_rating ? (
                              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10">
                                <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                                <span className="font-medium">{a.average_rating.toFixed(1)}</span>
                                <span className="text-muted-foreground text-xs">({a.review_count})</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {a.open_count > 0 ? (
                              <Badge variant="outline" className="border-emerald-600 bg-emerald-600/20 text-emerald-400">{a.open_count}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center tabular-nums">{a.completed_count}</td>
                          <td className="py-3 px-4 text-center">
                            {a.pending_payment_count > 0 ? (
                              <Badge variant="outline" className="border-amber-500 bg-amber-500/20 text-amber-400">{a.pending_payment_count}</Badge>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums font-semibold text-[#B89D60]">
                            ${a.total_earnings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="sm" className="h-8" onClick={() => openAthleteEdit(a.athlete_id)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Link href={`/coaches/${a.athlete_id}`} target="_blank">
                                <Button variant="ghost" size="sm" className="h-8">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 text-red-500 hover:text-red-400"
                                disabled={deactivatingId === a.athlete_id}
                                onClick={() => handleDeactivateAthlete(a.athlete_id)}
                              >
                                {deactivatingId === a.athlete_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserX className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      }

      // Athletes (Youth Wrestlers) sub-section
      if (subSection === 'athletes') {
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Youth Athletes</h2>
              <p className="text-sm text-muted-foreground">Kids registered by parents</p>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Name</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">School</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Parent</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Level</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Joined</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {kidsLoading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </td>
                      </tr>
                    ) : kidsList.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          <User className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No athletes found</p>
                        </td>
                      </tr>
                    ) : (
                      kidsList.map((k) => (
                        <tr key={k.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <ProfileImage
                                src={k.photo_url}
                                focusX={k.photo_focus_x}
                                focusY={k.photo_focus_y}
                                alt={`${k.first_name} ${k.last_name}`}
                                className="h-8 w-8 rounded-full"
                              />
                              <span className="font-medium">{k.first_name} {k.last_name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{k.school || '-'}</td>
                          <td className="py-3 px-4 text-muted-foreground">{k.parent_email}</td>
                          <td className="py-3 px-4">
                            {k.skill_level && <Badge variant="outline">{k.skill_level}</Badge>}
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{formatEST(new Date(k.created_at), 'MMM d, yyyy')}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      }

      // Parents sub-section
      if (subSection === 'parents') {
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Users</h2>
                <p className="text-sm text-muted-foreground">{filteredUsers.length} users</p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search users..."
                    className="pl-9 w-64"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Email</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Role</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Created</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Last Login</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {usersError ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-red-500">{usersError}</td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No users found</p>
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4 font-medium">{u.email}</td>
                          <td className="py-3 px-4">
                            <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>{u.role}</Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{formatEST(new Date(u.created_at), 'MMM d, yyyy')}</td>
                          <td className="py-3 px-4 text-muted-foreground">
                            {u.last_login_at ? formatEST(new Date(u.last_login_at), 'MMM d, yyyy') : '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      }

      // Facility Requests sub-section
      if (subSection === 'requests') {
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Facility Requests</h2>
              <p className="text-sm text-muted-foreground">Review and approve new facility requests</p>
            </div>

            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Facility</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Requested By</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Date</th>
                      <th className="text-right py-3 px-4 font-medium text-muted-foreground text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {facilityRequestsLoading ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </td>
                      </tr>
                    ) : facilityRequests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-muted-foreground">
                          <Building2 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
                          <p>No facility requests</p>
                        </td>
                      </tr>
                    ) : (
                      facilityRequests.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground">{r.school}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{r.coach_name}</div>
                            <div className="text-xs text-muted-foreground">{r.coach_school}</div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={r.status === 'pending' ? 'outline' : r.status === 'approved' ? 'default' : 'destructive'}>
                              {r.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground">{formatEST(new Date(r.created_at), 'MMM d, yyyy')}</td>
                          <td className="py-3 px-4 text-right">
                            {r.status === 'pending' && (
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  size="sm"
                                  className="h-8 bg-emerald-600 hover:bg-emerald-700"
                                  disabled={facilityRequestActionId === r.id}
                                  onClick={async () => {
                                    setFacilityRequestActionId(r.id);
                                    try {
                                      await fetch(`/api/admin/facility-requests/${r.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ status: 'approved' }),
                                      });
                                      setFacilityRequests(prev => prev.map(req => req.id === r.id ? { ...req, status: 'approved' } : req));
                                    } finally {
                                      setFacilityRequestActionId(null);
                                    }
                                  }}
                                >
                                  {facilityRequestActionId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Approve'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-red-500/50 text-red-500"
                                  disabled={facilityRequestActionId === r.id}
                                  onClick={async () => {
                                    setFacilityRequestActionId(r.id);
                                    try {
                                      await fetch(`/api/admin/facility-requests/${r.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ status: 'rejected' }),
                                      });
                                      setFacilityRequests(prev => prev.map(req => req.id === r.id ? { ...req, status: 'rejected' } : req));
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        );
      }
    }

    return null;
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      {/* Mobile Menu Toggle */}
      <button
        className="lg:hidden fixed bottom-4 right-4 z-50 p-3 rounded-full bg-[#B89D60] text-black shadow-lg"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {/* Sidebar Navigation */}
      <aside className={`
        fixed lg:sticky top-0 left-0 z-40 h-screen lg:h-auto
        w-64 bg-card border-r border-border
        transform transition-transform duration-200 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 space-y-6 h-full overflow-y-auto">
          {/* Create Session Button */}
          <Link href="/admin/sessions/create" className="block">
            <Button className="w-full bg-[#B89D60] hover:bg-[#9A8550] text-black">
              <Plus className="h-4 w-4 mr-2" />
              Create Session
            </Button>
          </Link>

          {/* Overview Section */}
          <div className="space-y-1">
            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Overview</p>
            <NavItem
              icon={LayoutDashboard}
              label="Dashboard"
              active={section === 'overview'}
              onClick={() => handleNavChange('overview')}
            />
          </div>

          {/* Bookings Section */}
          <div className="space-y-1">
            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Bookings</p>
            <NavItem
              icon={Calendar}
              label="Sessions"
              active={section === 'bookings'}
              onClick={() => handleNavChange('bookings')}
              badge={openSessions}
            />
          </div>

          {/* Money Section */}
          <div className="space-y-1">
            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Money</p>
            <NavItem
              icon={DollarSign}
              label="Overview"
              active={section === 'money' && subSection === 'payments'}
              onClick={() => handleNavChange('money', 'payments')}
            />
            <NavItem
              icon={Wallet}
              label="Payouts"
              active={section === 'money' && subSection === 'payouts'}
              onClick={() => handleNavChange('money', 'payouts')}
              badge={coachPayouts.filter(p => p.amount > 0).length}
            />
            <NavItem
              icon={CreditCard}
              label="Credits"
              active={section === 'money' && subSection === 'credits'}
              onClick={() => handleNavChange('money', 'credits')}
            />
          </div>

          {/* People Section */}
          <div className="space-y-1">
            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">People</p>
            <NavItem
              icon={Star}
              label="Coaches"
              active={section === 'people' && subSection === 'coaches'}
              onClick={() => handleNavChange('people', 'coaches')}
            />
            <NavItem
              icon={User}
              label="Athletes"
              active={section === 'people' && subSection === 'athletes'}
              onClick={() => handleNavChange('people', 'athletes')}
            />
            <NavItem
              icon={Users}
              label="Users"
              active={section === 'people' && subSection === 'parents'}
              onClick={() => handleNavChange('people', 'parents')}
            />
            <NavItem
              icon={Building2}
              label="Facility Requests"
              active={section === 'people' && subSection === 'requests'}
              onClick={() => handleNavChange('people', 'requests')}
              badge={pendingFacilityRequests}
            />
          </div>

          {/* Quick Links */}
          <div className="space-y-1 pt-4 border-t border-border">
            <p className="px-3 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Quick Links</p>
            <Link href="/admin/facilities" className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Facilities
            </Link>
            <Link href="/admin/products" className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Products
            </Link>
            <Link href="/admin/discount-codes" className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Discount Codes
            </Link>
            <Link href="/admin/focus-areas" className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Session Topics
            </Link>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
        {textGroupAdminSession && (
          <CoachTextGroupDialog
            sessionId={textGroupAdminSession.id}
            open={!!textGroupAdminSession}
            onOpenChange={(open) => {
              if (!open) setTextGroupAdminSession(null);
            }}
            sessionLabel={`${formatEST(new Date(textGroupAdminSession.scheduled_datetime), 'EEE, MMM d · h:mm a')} · ${textGroupAdminSession.facility_name}`}
            onSent={() => router.refresh()}
          />
        )}
        
        {renderContent()}
      </main>

      {/* Coach Edit Dialog */}
      <Dialog open={!!editingAthleteId} onOpenChange={(open) => !open && setEditingAthleteId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Coach</DialogTitle>
            <DialogDescription>Update coach profile information</DialogDescription>
          </DialogHeader>
          {!athleteEditForm ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={saveAthleteEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={athleteEditForm.first_name}
                    onChange={(e) => setAthleteEditForm({ ...athleteEditForm, first_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={athleteEditForm.last_name}
                    onChange={(e) => setAthleteEditForm({ ...athleteEditForm, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="school">School</Label>
                <Input
                  id="school"
                  value={athleteEditForm.school}
                  onChange={(e) => setAthleteEditForm({ ...athleteEditForm, school: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="venmo">Venmo Handle</Label>
                  <Input
                    id="venmo"
                    value={athleteEditForm.venmo_handle || ''}
                    onChange={(e) => setAthleteEditForm({ ...athleteEditForm, venmo_handle: e.target.value })}
                    placeholder="@username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zelle">Zelle Email</Label>
                  <Input
                    id="zelle"
                    value={athleteEditForm.zelle_email || ''}
                    onChange={(e) => setAthleteEditForm({ ...athleteEditForm, zelle_email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="facility">Primary Facility</Label>
                <Select
                  value={athleteEditForm.facility_id || ''}
                  onValueChange={(v) => setAthleteEditForm({ ...athleteEditForm, facility_id: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select facility" />
                  </SelectTrigger>
                  <SelectContent>
                    {facilities.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name} ({f.school})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={athleteEditForm.active}
                  onChange={(e) => setAthleteEditForm({ ...athleteEditForm, active: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="active">Active (visible on browse page)</Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingAthleteId(null)}>Cancel</Button>
                <Button type="submit" className="bg-[#B89D60] hover:bg-[#9A8550] text-black" disabled={athleteEditSaving}>
                  {athleteEditSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
