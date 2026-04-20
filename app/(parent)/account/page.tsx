import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getTenantByDomain } from '@/config/tenants';
import { getParentYouthWrestlerIds } from '@/lib/parent-wrestlers';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { User, Wallet, Bell, ChevronRight, Users, DollarSign } from 'lucide-react';
import { AccountSignOut } from '@/components/account-sign-out';
import { RedeemCodeCard } from './redeem-code-card';
import { AccountPhoneCard } from './account-phone-card';
import { AccountZipCard } from './account-zip-card';
import { getUserCreditBalance } from '@/lib/credits';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const tenant = getTenantByDomain(host);
  if (!tenant) redirect('/404');

  const supabase = await createClient(tenant.slug);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: userData } = await supabase.from('users').select('role, phone, email, zip_code').eq('id', user.id).single();
  if (userData?.role === 'coach') redirect('/athlete-dashboard');
  if (userData?.role !== 'parent' && userData?.role !== 'admin') redirect('/dashboard');

  // Get wrestler count
  const youthWrestlerIds = await getParentYouthWrestlerIds(supabase, user.id);
  const wrestlerCount = youthWrestlerIds.length;

  // Get credit balance
  const creditBalance = await getUserCreditBalance(user.id, tenant.slug);

  // Get spending summary
  let totalSpent = 0;
  if (youthWrestlerIds.length > 0) {
    const { data: partRows } = await supabase
      .from('session_participants')
      .select('session_id')
      .in('youth_wrestler_id', youthWrestlerIds);
    const familySessionIds = [...new Set((partRows ?? []).map((r: { session_id: string }) => r.session_id))];
    
    if (familySessionIds.length > 0) {
      const { data: paidSessions } = await supabase
        .from('sessions')
        .select('total_price, refunded_at')
        .in('id', familySessionIds)
        .in('status', ['scheduled', 'completed']);
      
      totalSpent = (paidSessions ?? [])
        .filter((s: { refunded_at?: string | null }) => !s.refunded_at)
        .reduce((sum: number, s: { total_price?: number }) => sum + Number(s.total_price ?? 0), 0);
    }
  }

  // Early adopter check
  const { data: entitlements } = await supabase
    .from('early_adopter_entitlements')
    .select('id')
    .eq('parent_id', user.id);
  const hasEarlyAdopterEntitlements = (entitlements?.length ?? 0) > 0;

  const userEmail = user.email ?? '';
  const userPhone = (userData as { phone?: string | null })?.phone;
  const userZip = (userData as { zip_code?: string | null })?.zip_code ?? null;

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-6">
        <h1 className="text-2xl font-bold text-foreground">Account</h1>
      </div>

      {/* Profile Section */}
      <div className="px-4 mb-6">
        <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8960C] flex items-center justify-center">
              <User className="h-7 w-7 text-black" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-lg truncate">{userEmail}</p>
              {userPhone && (
                <p className="text-sm text-zinc-500">{userPhone}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="px-4 mb-6">
        <div className="grid grid-cols-3 gap-3">
          <Link href="/my-wrestlers">
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 text-center hover:border-zinc-700 transition-colors">
              <Users className="h-5 w-5 mx-auto mb-2 text-[#D4AF37]" />
              <p className="text-2xl font-bold">{wrestlerCount}</p>
              <p className="text-xs text-zinc-500">Wrestlers</p>
            </div>
          </Link>
          <Link href="/wallet">
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 text-center hover:border-zinc-700 transition-colors">
              <Wallet className="h-5 w-5 mx-auto mb-2 text-[#D4AF37]" />
              <p className="text-2xl font-bold">${creditBalance.toFixed(0)}</p>
              <p className="text-xs text-zinc-500">Credit</p>
            </div>
          </Link>
          <Link href="/bookings">
            <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-4 text-center hover:border-zinc-700 transition-colors">
              <DollarSign className="h-5 w-5 mx-auto mb-2 text-[#D4AF37]" />
              <p className="text-2xl font-bold">${totalSpent.toFixed(0)}</p>
              <p className="text-xs text-zinc-500">Spent</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Menu Sections */}
      <div className="px-4 space-y-3">
        {/* Wrestlers */}
        <MenuSection title="Wrestlers">
          <MenuItem href="/my-wrestlers" icon={Users} label="My Wrestlers" />
          <MenuItem href="/wrestlers/add" icon={User} label="Add Wrestler" />
        </MenuSection>

        {/* Wallet & Payments */}
        <MenuSection title="Wallet & Payments">
          <MenuItem href="/wallet" icon={Wallet} label="My Wallet" badge={creditBalance > 0 ? `$${creditBalance.toFixed(2)}` : undefined} />
          <MenuItem href="/bookings" icon={DollarSign} label="Booking History" />
        </MenuSection>

        {/* Settings */}
        <MenuSection title="Settings">
          <AccountPhoneCard initialPhone={userPhone ?? null} compact />
          <AccountZipCard initialZip={userZip} compact />
          <MenuItem href="/notifications" icon={Bell} label="Notifications" />
        </MenuSection>

        {/* Promo & Rewards */}
        <MenuSection title="Rewards">
          <RedeemCodeCard hasEntitlements={hasEarlyAdopterEntitlements} compact />
        </MenuSection>

        {/* Sign Out */}
        <div className="pt-4">
          <AccountSignOut />
        </div>
      </div>
    </div>
  );
}

function MenuSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2 px-1">{title}</h2>
      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl overflow-hidden divide-y divide-zinc-800/50">
        {children}
      </div>
    </div>
  );
}

function MenuItem({ 
  href, 
  icon: Icon, 
  label, 
  badge 
}: { 
  href: string; 
  icon: React.ComponentType<{ className?: string }>; 
  label: string;
  badge?: string;
}) {
  return (
    <Link href={href}>
      <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-zinc-800/50 transition-colors">
        <Icon className="h-5 w-5 text-zinc-400" />
        <span className="flex-1 font-medium">{label}</span>
        {badge && (
          <span className="text-sm text-[#D4AF37] font-medium">{badge}</span>
        )}
        <ChevronRight className="h-4 w-4 text-zinc-600" />
      </div>
    </Link>
  );
}
