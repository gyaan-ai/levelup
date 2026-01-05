'use client';

import { useTenant } from './theme-provider';
import { useAuth } from '@/lib/auth/use-auth';
import { Button } from './ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function Header() {
  const tenant = useTenant();
  const { user, userRole, loading, signOut } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-4">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--color-levelup-primary)' }}>
            LevelUp
          </h1>
          {tenant.stateOrgLogo && (
            <img 
              src={tenant.stateOrgLogo} 
              alt={tenant.orgName}
              className="h-8"
            />
          )}
        </Link>
        <nav className="flex items-center gap-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : user ? (
            <>
              {userRole === 'parent' && (
                <Link href="/browse">
                  <Button variant="ghost">Browse</Button>
                </Link>
              )}
              {userRole === 'athlete' && (
                <Link href="/dashboard">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
              )}
              {userRole === 'admin' && (
                <Link href="/admin">
                  <Button variant="ghost">Admin</Button>
                </Link>
              )}
              <span className="text-sm text-muted-foreground">{user.email}</span>
              <Button variant="outline" onClick={handleSignOut}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link href="/browse">
                <Button variant="ghost">Browse</Button>
              </Link>
              <Link href="/login">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link href="/signup">
                <Button>Sign Up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

