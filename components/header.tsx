'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
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

const navLinkClass = 'block py-3 px-4 text-white hover:text-accent hover:bg-white/10 transition-colors font-medium min-h-[44px] flex items-center';

export function Header() {
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
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/" className="flex items-center group shrink-0" onClick={() => setMobileOpen(false)}>
              <Image
                src="/logos/guild-g.png"
                alt="The Guild"
                width={40}
                height={40}
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain"
              />
            </Link>
            <AddToHomeScreen variant="toolbar" />
          </div>

          {loading ? (
            <div className="text-sm text-white/70">Loading...</div>
          ) : user ? (
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
                    Sessions
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
                  <Link href="/bookings" className="text-white hover:text-accent transition-colors font-medium">Sessions</Link>
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

            {/* Mobile menu: hidden for parents (they use bottom nav only per PRD) */}
            {effectiveRole !== 'parent' && (
              <div className="md:hidden flex items-center">
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
            )}
            {mobileOpen && (
              <nav
                className="absolute left-0 right-0 top-full bg-primary border-b border-accent/20 shadow-lg md:hidden"
                aria-label="Mobile navigation"
              >
                <div className="container mx-auto px-0 py-2">
                  {effectiveRole === 'coach' && (
                    <>
                      {isAdmin && (
                    <>
                      <button type="button" className="block py-3 px-4 text-accent font-semibold hover:bg-white/10 min-h-[44px] w-full text-left" onClick={goToAdmin}>Back to Admin</button>
                      <div className="px-4 py-2 border-b border-white/10">
                        <label className="text-xs text-white/70 uppercase tracking-wide">Preview as</label>
                        <Select value={viewAsRole ?? 'admin'} onValueChange={(v) => { handleViewAsChange(v); setMobileOpen(false); }}>
                          <SelectTrigger className="mt-1.5 w-full border-white/30 bg-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="coach">Coach</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="youth_wrestler">Athlete</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                      <Link href="/athlete-dashboard" className={navLinkClass} onClick={() => setMobileOpen(false)}>Dashboard</Link>
                      <Link href="/profile" className={navLinkClass} onClick={() => setMobileOpen(false)}>Profile</Link>
                      <Link href="/availability" className={navLinkClass} onClick={() => setMobileOpen(false)}>Availability</Link>
                      <Link href="/rate-card" className={navLinkClass} onClick={() => setMobileOpen(false)}>Session types</Link>
                      <Link href="/inbox" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                        <span className="flex items-center gap-2">
                          <Mail className="h-5 w-5 shrink-0" />
                          Community
                          {inboxUnreadCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold bg-accent text-black rounded-full">
                              {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                            </span>
                          )}
                        </span>
                      </Link>
                      <Link href="/notifications" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                        <span className="flex items-center gap-2">
                          <Bell className="h-5 w-5 shrink-0" />
                          Notifications
                          {notificationCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold bg-accent text-black rounded-full">
                              {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                          )}
                        </span>
                      </Link>
                    </>
                  )}
                  {effectiveRole === 'youth_wrestler' && (
                    <>
                      {isAdmin && (
                    <>
                      <button type="button" className="block py-3 px-4 text-accent font-semibold hover:bg-white/10 min-h-[44px] w-full text-left" onClick={goToAdmin}>Back to Admin</button>
                      <div className="px-4 py-2 border-b border-white/10">
                        <label className="text-xs text-white/70 uppercase tracking-wide">Preview as</label>
                        <Select value={viewAsRole ?? 'admin'} onValueChange={(v) => { handleViewAsChange(v); setMobileOpen(false); }}>
                          <SelectTrigger className="mt-1.5 w-full border-white/30 bg-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="coach">Coach</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="youth_wrestler">Athlete</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                      <Link href="/youth-dashboard" className={navLinkClass} onClick={() => setMobileOpen(false)}>Dashboard</Link>
                      <Link href="/workspaces" className={navLinkClass} onClick={() => setMobileOpen(false)}>Workspaces</Link>
                      <Link href="/small-group-sessions" className={navLinkClass} onClick={() => setMobileOpen(false)}>Group & partner</Link>
                      <Link href="/inbox" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                        <span className="flex items-center gap-2">
                          <Mail className="h-5 w-5 shrink-0" />
                          Community
                          {inboxUnreadCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold bg-accent text-black rounded-full">
                              {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                            </span>
                          )}
                        </span>
                      </Link>
                      <Link href="/notifications" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                        <span className="flex items-center gap-2">
                          <Bell className="h-5 w-5 shrink-0" />
                          Notifications
                          {notificationCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold bg-accent text-black rounded-full">
                              {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                          )}
                        </span>
                      </Link>
                    </>
                  )}
                  {effectiveRole === 'admin' && (
                    <>
                      <Link href="/dashboard" className={navLinkClass} onClick={() => setMobileOpen(false)}>Dashboard</Link>
                      <button type="button" className={navLinkClass} onClick={() => { goToAdmin(); setMobileOpen(false); }}>Admin</button>
                      <div className="px-4 py-2 border-b border-white/10">
                        <label className="text-xs text-white/70 uppercase tracking-wide">Preview as</label>
                        <Select value={viewAsRole ?? 'admin'} onValueChange={(v) => { handleViewAsChange(v); setMobileOpen(false); }}>
                          <SelectTrigger className="mt-1.5 w-full border-white/30 bg-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="coach">Coach</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="youth_wrestler">Athlete</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                  {effectiveRole === 'parent' && (
                    <>
                      {isAdmin && (
                    <>
                      <button type="button" className="block py-3 px-4 text-accent font-semibold hover:bg-white/10 min-h-[44px] w-full text-left" onClick={goToAdmin}>Back to Admin</button>
                      <div className="px-4 py-2 border-b border-white/10">
                        <label className="text-xs text-white/70 uppercase tracking-wide">Preview as</label>
                        <Select value={viewAsRole ?? 'admin'} onValueChange={(v) => { handleViewAsChange(v); setMobileOpen(false); }}>
                          <SelectTrigger className="mt-1.5 w-full border-white/30 bg-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="coach">Coach</SelectItem>
                            <SelectItem value="parent">Parent</SelectItem>
                            <SelectItem value="youth_wrestler">Athlete</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                      <Link href="/dashboard" className={navLinkClass} onClick={() => setMobileOpen(false)}>Home</Link>
                      <Link href="/find-training" className={navLinkClass} onClick={() => setMobileOpen(false)}>Find Training</Link>
                      <Link href="/browse" className={navLinkClass} onClick={() => setMobileOpen(false)}>Coaches</Link>
                      <Link href="/bookings" className={navLinkClass} onClick={() => setMobileOpen(false)}>My Sessions</Link>
                      <Link href="/inbox" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                        <span className="flex items-center gap-2">
                          <Mail className="h-5 w-5 shrink-0" />
                          Messages
                          {inboxUnreadCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold bg-accent text-black rounded-full">
                              {inboxUnreadCount > 99 ? '99+' : inboxUnreadCount}
                            </span>
                          )}
                        </span>
                      </Link>
                      <Link href="/account" className={navLinkClass} onClick={() => setMobileOpen(false)}>Account</Link>
                      <Link href="/notifications" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                        <span className="flex items-center gap-2">
                          <Bell className="h-5 w-5 shrink-0" />
                          Notifications
                          {notificationCount > 0 && (
                            <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center text-xs font-bold bg-accent text-black rounded-full">
                              {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                          )}
                        </span>
                      </Link>
                    </>
                  )}
                  <div className="border-t border-white/20 mt-2 pt-2 px-4">
                    <p className="text-white/70 text-sm py-2 truncate">{user.email}</p>
                    <button
                      type="button"
                      className="w-full py-3 text-left font-medium text-white hover:text-accent min-h-[44px] flex items-center"
                      onClick={() => { handleSignOut(); setMobileOpen(false); }}
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              </nav>
            )}
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

            <div className="md:hidden flex items-center gap-1">
              <Link
                href="/login"
                className="py-2 px-3 min-h-[44px] flex items-center text-white hover:text-accent hover:bg-white/10 rounded font-medium text-sm"
                onClick={() => setMobileOpen(false)}
              >
                Sign in
              </Link>
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
                  <Link href="/browse" className={navLinkClass} onClick={() => setMobileOpen(false)}>Browse Coaches</Link>
                  <Link href="/signup?role=coach" className={navLinkClass} onClick={() => setMobileOpen(false)}>For Coaches</Link>
                  <Link href="/how-it-works" className={navLinkClass} onClick={() => setMobileOpen(false)}>How It Works</Link>
                  <Link href="/login" className={navLinkClass} onClick={() => setMobileOpen(false)}>Login</Link>
                  <Link href="/signup" className={navLinkClass} onClick={() => setMobileOpen(false)}>
                    <span className="font-semibold text-accent">Book Training</span>
                  </Link>
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
