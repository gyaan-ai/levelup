'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth/use-auth';
import { Button } from './ui/button';
import { Menu } from 'lucide-react';

export function Header() {
  const { user, userRole, loading, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    window.location.href = '/login';
  };

  return (
    <header className="bg-primary text-white border-b border-accent/20 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center group">
              <span className="text-2xl font-serif font-bold text-accent group-hover:text-accent-light transition-colors tracking-wide">
                THE GUILD
              </span>
            </Link>
          </div>

          {loading ? (
            <div className="text-sm text-white/70">Loading...</div>
          ) : user ? (
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
          ) : (
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
          )}

          <button
            type="button"
            className="md:hidden text-white p-2"
            aria-label="Open menu"
          >
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
    </header>
  );
}
