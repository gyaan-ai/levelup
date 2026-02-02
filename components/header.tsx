'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/use-auth';
import { Button } from './ui/button';
import { Menu, X } from 'lucide-react';

const navLinkClass = 'block py-3 px-4 text-white hover:text-accent hover:bg-white/10 transition-colors font-medium min-h-[44px] flex items-center';

export function Header() {
  const { user, userRole, loading, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <header className="bg-primary text-white border-b border-accent/20 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-14 sm:h-16">
          <div className="flex items-center gap-4 min-w-0">
            <Link href="/" className="flex items-center group shrink-0" onClick={() => setMobileOpen(false)}>
              <Image
                src="/logos/guild-g.png"
                alt="The Guild"
                width={40}
                height={40}
                className="h-9 w-9 sm:h-10 sm:w-10 object-contain"
              />
            </Link>
          </div>

          {loading ? (
            <div className="text-sm text-white/70">Loading...</div>
          ) : user ? (
            <>
            <nav className="hidden md:flex items-center gap-6">
              {userRole === 'athlete' && (
                <>
                  <Link
                    href="/athlete-dashboard"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/notifications"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Notifications
                  </Link>
                </>
              )}
              {(userRole === 'admin' || userRole === 'parent') && (
                <>
                  <Link
                    href="/dashboard"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/browse"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Browse Coaches
                  </Link>
                  <Link
                    href="/my-coaches"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    My Coaches
                  </Link>
                  <Link
                    href="/bookings"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    My Bookings
                  </Link>
                  <Link
                    href="/workspaces"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Workspaces
                  </Link>
                  <Link
                    href="/partner-sessions"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Partner Sessions
                  </Link>
                  <Link
                    href="/notifications"
                    className="text-white hover:text-accent transition-colors font-medium"
                  >
                    Notifications
                  </Link>
                  {userRole === 'admin' && (
                    <Link
                      href="/admin"
                      className="text-white hover:text-accent transition-colors font-medium border-l border-white/20 pl-4 ml-2"
                    >
                      Admin
                    </Link>
                  )}
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

            {/* Mobile menu */}
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
            {mobileOpen && (
              <nav
                className="absolute left-0 right-0 top-full bg-primary border-b border-accent/20 shadow-lg md:hidden"
                aria-label="Mobile navigation"
              >
                <div className="container mx-auto px-0 py-2">
                  {userRole === 'athlete' && (
                    <>
                      <Link href="/athlete-dashboard" className={navLinkClass} onClick={() => setMobileOpen(false)}>Dashboard</Link>
                      <Link href="/notifications" className={navLinkClass} onClick={() => setMobileOpen(false)}>Notifications</Link>
                    </>
                  )}
                  {(userRole === 'admin' || userRole === 'parent') && (
                    <>
                      <Link href="/dashboard" className={navLinkClass} onClick={() => setMobileOpen(false)}>Dashboard</Link>
                      <Link href="/browse" className={navLinkClass} onClick={() => setMobileOpen(false)}>Browse Coaches</Link>
                      <Link href="/my-coaches" className={navLinkClass} onClick={() => setMobileOpen(false)}>My Coaches</Link>
                      <Link href="/bookings" className={navLinkClass} onClick={() => setMobileOpen(false)}>My Bookings</Link>
                      <Link href="/workspaces" className={navLinkClass} onClick={() => setMobileOpen(false)}>Workspaces</Link>
                      <Link href="/partner-sessions" className={navLinkClass} onClick={() => setMobileOpen(false)}>Partner Sessions</Link>
                      <Link href="/notifications" className={navLinkClass} onClick={() => setMobileOpen(false)}>Notifications</Link>
                      {userRole === 'admin' && (
                        <Link href="/admin" className={navLinkClass} onClick={() => setMobileOpen(false)}>Admin</Link>
                      )}
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
            <nav className="hidden md:flex items-center gap-6">
              <Link
                href="/browse"
                className="text-white hover:text-accent transition-colors font-medium"
              >
                Browse Coaches
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
                  <Link href="/how-it-works" className={navLinkClass} onClick={() => setMobileOpen(false)}>How It Works</Link>
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
