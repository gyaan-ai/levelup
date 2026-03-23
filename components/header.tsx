'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth/use-auth';
import { useNotificationCount } from '@/lib/hooks/use-notification-count';
import { useInboxUnreadCount } from '@/lib/hooks/use-inbox-unread-count';
import { NotificationBell } from '@/components/notification-bell';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Bell, Menu, X, Mail } from 'lucide-react';
import { AddToHomeScreen } from '@/components/add-to-home-screen';
import { useTenant } from '@/components/theme-provider';
import { BrandLogo } from '@/components/brand-logo';

const navLinkClass = 'block py-3 px-4 text-white hover:text-accent hover:bg-white/10 transition-colors font-medium min-h-[44px] flex items-center';

export function Header() {
  const tenant = useTenant();
  const pathname = usePathname();
  const { user, userRole, viewAsRole, effectiveRole, setViewAsRole, loading, signOut } = useAuth();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationCount, refreshNotifications] = useNotificationCount(!!user);
  const showInboxIcon = effectiveRole === 'parent' || effectiveRole === 'coach' || effectiveRole === 'youth_wrestler';
  const [inboxUnreadCount, refreshInboxUnread] = useInboxUnreadCount(!!user && showInboxIcon);

  const handleViewAsChange = (value: string) => {
    setViewAsRole(value === 'admin' ? null : (value as 'coach' | 'parent' | 'youth_wrestler'));
    if (value === 'admin') router.push('/admin');
    else if (value === 'coach') router.push('/athlete-dashboard');
    else if (value === 'parent') router.push('/dashboard');
    else if (value === 'youth_wrestler') router.push('/youth-dashboard');
  };

  const goToAdmin = () => {
    setViewAsRole(null);
    setMobileOpen(false);
    router.push('/admin');
  };

  const isAdmin = userRole === 'admin';

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <header className="bg-primary text-white border-b border-accent/20 sticky top-0 z-50 pt-[env(safe-area-inset-top,0px)]">
      {/* Mobile logged-out only, and not on / — homepage hero already has Log in + menu has Login (avoids double gold CTAs) */}
      {!user && pathname !== '/' && (
        <div className="md:hidden bg-accent text-black">
          <Link
            href="/login"
            className="block text-center font-bold text-base py-3 px-4 min-h-[48px] flex items-center justify-center"
            onClick={() => setMobileOpen(false)}
          >
            Log in
          </Link>
        </div>
      )}
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="flex items-center group shrink-0" onClick={() => setMobileOpen(false)}>
              <BrandLogo
                src={tenant.logo}
                alt={tenant.productName}
                width={40}
                height={40}
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain"
                textFallback={tenant.productName}
              />
            </Link>
            <AddToHomeScreen variant="toolbar" />
          </div>

          {user ? (
            <>
            {/* Post-login: nav aligned to profile (athlete = coach, parent, youth_wrestler, admin) */}
            <nav className="hidden md:flex items-center gap-6">
              {effectiveRole === 'coach' && (
                <>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={goToAdmin}
                        className="text-accent font-semibold hover:text-accent/90 transition-colors"
                      >
                        Back to Admin
                      </button>
                      <Select
                        value={viewAsRole ?? 'admin'}
                        onValueChange={handleViewAsChange}
                      >
                        <SelectTrigger className="w-[120px] min-h-[44px] h-9 border-white/30 bg-white/10 text-white hover:bg-white/20 [&>span]:line-clamp-1">
                          <SelectValue placeholder="Preview as" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="coach">Coach</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="youth_wrestler">Athlete</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <Link
                    href="/athlete-dashboard"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Home
                  </Link>
                  <Link
                    href="/availability"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Schedule
                  </Link>
                  <Link
                    href="/coach-sessions"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    My sessions
                  </Link>
                  <Link
                    href="/profile"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Profile
                  </Link>
                  <Link
                    href="/rate-card"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Session types
                  </Link>
                  <Link
                    href="/inbox"
                    className="relative flex items-center justify-center min-h-[44px] min-w-[44px] p-1.5 text-white hover:text-accent transition-colors font-medium rounded hover:bg-white/10"
                    aria-label={inboxUnreadCount > 0 ? `Messages (${inboxUnreadCount} unread)` : 'Messages'}
                    title="Messages"
                  >
                    <Mail className="h-5 w-5" />
                    {inboxUnreadCount > 0 && (
                      <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-accent text-black rounded-full -translate-y-0.5 translate-x-0.5">
                        {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                      </span>
                    )}
                  </Link>
                  <NotificationBell count={notificationCount} onRefresh={refreshNotifications} />
                </>
              )}
              {effectiveRole === 'youth_wrestler' && (
                <>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={goToAdmin}
                        className="text-accent font-semibold hover:text-accent/90 transition-colors"
                      >
                        Back to Admin
                      </button>
                      <Select
                        value={viewAsRole ?? 'admin'}
                        onValueChange={handleViewAsChange}
                      >
                        <SelectTrigger className="w-[120px] min-h-[44px] h-9 border-white/30 bg-white/10 text-white hover:bg-white/20 [&>span]:line-clamp-1">
                          <SelectValue placeholder="Preview as" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="coach">Coach</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="youth_wrestler">Athlete</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <Link
                    href="/youth-dashboard"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/workspaces"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Workspaces
                  </Link>
                  <Link
                    href="/small-group-sessions"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Group & partner
                  </Link>
                  <Link
                    href="/inbox"
                    className="relative flex items-center justify-center min-h-[44px] min-w-[44px] p-1.5 text-white hover:text-accent transition-colors font-medium rounded hover:bg-white/10"
                    aria-label={inboxUnreadCount > 0 ? `Community (${inboxUnreadCount} unread)` : 'Community'}
                    title="Community"
                  >
                    <Mail className="h-5 w-5" />
                    {inboxUnreadCount > 0 && (
                      <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-accent text-black rounded-full -translate-y-0.5 translate-x-0.5">
                        {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                      </span>
                    )}
                  </Link>
                  <NotificationBell count={notificationCount} onRefresh={refreshNotifications} />
                </>
              )}
              {effectiveRole === 'admin' && (
                <>
                  <Link
                    href="/dashboard"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={goToAdmin}
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Admin
                  </button>
                  <Select
                    value={viewAsRole ?? 'admin'}
                    onValueChange={handleViewAsChange}
                  >
                    <SelectTrigger className="w-[120px] min-h-[44px] h-9 border-white/30 bg-white/10 text-white hover:bg-white/20 [&>span]:line-clamp-1">
                      <SelectValue placeholder="Preview as" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="coach">Coach</SelectItem>
                      <SelectItem value="parent">Parent</SelectItem>
                      <SelectItem value="youth_wrestler">Athlete</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              {effectiveRole === 'parent' && (
                <>
                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={goToAdmin}
                        className="text-accent font-semibold hover:text-accent/90 transition-colors"
                      >
                        Back to Admin
                      </button>
                      <Select
                        value={viewAsRole ?? 'admin'}
                        onValueChange={handleViewAsChange}
                      >
                        <SelectTrigger className="w-[120px] min-h-[44px] h-9 border-white/30 bg-white/10 text-white hover:bg-white/20 [&>span]:line-clamp-1">
                          <SelectValue placeholder="Preview as" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="coach">Coach</SelectItem>
                          <SelectItem value="parent">Parent</SelectItem>
                          <SelectItem value="youth_wrestler">Athlete</SelectItem>
                        </SelectContent>
                      </Select>
                    </>
                  )}
                  <Link href="/dashboard" className="text-white hover:text-accent transition-colors font-medium">Home</Link>
                  <Link href="/training" className="text-white hover:text-accent transition-colors font-medium">Training</Link>
                  <Link href="/bookings" className="text-white hover:text-accent transition-colors font-medium">My bookings</Link>
                  <Link
                    href="/inbox"
                    className="relative flex items-center justify-center min-h-[44px] min-w-[44px] p-1.5 text-white hover:text-accent transition-colors font-medium rounded hover:bg-white/10"
                    aria-label={inboxUnreadCount > 0 ? `Messages (${inboxUnreadCount} unread)` : 'Messages'}
                    title="Messages"
                  >
                    <Mail className="h-5 w-5" />
                    {inboxUnreadCount > 0 && (
                      <span className="absolute top-0 right-0 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold bg-accent text-black rounded-full -translate-y-0.5 translate-x-0.5">
                        {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                      </span>
                    )}
                  </Link>
                  <Link href="/account" className="text-white hover:text-accent transition-colors font-medium">Account</Link>
                  <NotificationBell count={notificationCount} onRefresh={refreshNotifications} />
                </>
              )}
              <div className="flex items-center gap-3 pl-4 border-l border-white/20">
                <span className="text-white/80 text-sm">{user.email}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:text-accent hover:bg-white/10"
                  onClick={handleSignOut}
                >
                  Sign Out
                </Button>
              </div>
            </nav>

            {/* Mobile logged-in admin: same “Preview as” as desktop (bottom nav doesn’t include role switch) */}
            {isAdmin && (
              <div className="md:hidden flex items-center justify-end shrink-0 max-w-[min(100%,11rem)]">
                <Select
                  value={viewAsRole ?? 'admin'}
                  onValueChange={(value) => {
                    handleViewAsChange(value);
                    setMobileOpen(false);
                  }}
                >
                  <SelectTrigger
                    aria-label="View site as"
                    className="w-[min(100%,11rem)] min-h-[40px] h-9 border-white/30 bg-white/10 text-white text-xs hover:bg-white/20 [&>span]:line-clamp-1"
                  >
                    <SelectValue placeholder="View as" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="coach">Coach</SelectItem>
                    <SelectItem value="parent">Parent</SelectItem>
                    <SelectItem value="youth_wrestler">Athlete</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Mobile logged-in: primary nav is bottom nav; header adds admin role switch above */}
            </>
          ) : (
            <>
            {/* Pre-login: public menu (matches signup flow: parent = Browse / Book; coach = For Coaches) */}
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/browse"
                className="text-white hover:text-accent transition-colors font-medium"
              >
                Browse Coaches
              </Link>
              <Link
                href="/signup?role=coach"
                className="text-white hover:text-accent transition-colors font-medium"
              >
                For Coaches
              </Link>
              <Link
                href="/how-it-works"
                className="text-white hover:text-accent transition-colors font-medium"
              >
                How It Works
              </Link>
              <Link
                href="/login"
                className="text-white hover:text-accent transition-colors font-medium"
              >
                Login
              </Link>
              <Button asChild variant="premium" size="default">
                <Link href="/signup">Book Training</Link>
              </Button>
            </nav>

            {/* Mobile logged-out: gold bar above has Log in; avoid duplicating Login next to the menu */}
            <div className="md:hidden flex items-center gap-2">
              <button
                type="button"
                className="p-2 -mr-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-white hover:bg-white/10 rounded"
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
            {mobileOpen && (
              <nav className="absolute left-0 right-0 top-full bg-primary border-b border-accent/20 shadow-lg md:hidden" aria-label="Mobile navigation">
                <div className="container mx-auto px-0 py-2">
                  <Link
                    href="/login"
                    className="flex items-center min-h-[48px] px-4 py-3 font-semibold text-accent bg-accent/15 hover:bg-accent/25 text-base"
                    onClick={() => setMobileOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className="flex items-center min-h-[48px] px-4 py-3 font-semibold text-accent hover:bg-white/10 text-base"
                    onClick={() => setMobileOpen(false)}
                  >
                    Sign up / Book Training
                  </Link>
                  <div className="border-t border-white/20 my-1" />
                  <Link href="/browse" className={navLinkClass} onClick={() => setMobileOpen(false)}>Browse Coaches</Link>
                  <Link href="/signup?role=coach" className={navLinkClass} onClick={() => setMobileOpen(false)}>For Coaches</Link>
                  <Link href="/how-it-works" className={navLinkClass} onClick={() => setMobileOpen(false)}>How It Works</Link>
                </div>
              </nav>
            )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}
