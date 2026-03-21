'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';
import { VIEW_AS_COOKIE_NAME } from '@/lib/auth/view-as-cookie';

const VIEW_AS_STORAGE_KEY = 'levelup_view_as_role';

function syncViewAsCookie(role: ViewAsRole | null) {
  if (typeof document === 'undefined') return;
  if (role) {
    document.cookie = `${VIEW_AS_COOKIE_NAME}=${encodeURIComponent(role)}; path=/; max-age=31536000; SameSite=Lax`;
  } else {
    document.cookie = `${VIEW_AS_COOKIE_NAME}=; path=/; max-age=0`;
  }
}

export type ViewAsRole = 'admin' | 'coach' | 'parent' | 'youth_wrestler';

interface AuthContextType {
  user: User | null;
  userRole: 'parent' | 'coach' | 'admin' | 'youth_wrestler' | null;
  /** When admin uses "View as" dropdown, this is the selected role; otherwise null. */
  viewAsRole: ViewAsRole | null;
  /** Role to use for UI (nav, etc.). For admins with viewAsRole set, this is viewAsRole; else userRole. */
  effectiveRole: 'parent' | 'coach' | 'admin' | 'youth_wrestler' | null;
  setViewAsRole: (role: ViewAsRole | null) => void;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ 
  children,
  tenantSlug 
}: { 
  children: ReactNode;
  tenantSlug: string;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<'parent' | 'coach' | 'admin' | 'youth_wrestler' | null>(null);
  const [viewAsRole, setViewAsRoleState] = useState<ViewAsRole | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient(tenantSlug);

  const setViewAsRole = useCallback((role: ViewAsRole | null) => {
    setViewAsRoleState(role);
    if (typeof window !== 'undefined') {
      if (role) window.localStorage.setItem(VIEW_AS_STORAGE_KEY, role);
      else window.localStorage.removeItem(VIEW_AS_STORAGE_KEY);
      syncViewAsCookie(role);
    }
  }, []);

  const effectiveRole: 'parent' | 'coach' | 'admin' | 'youth_wrestler' | null =
    userRole === 'admin' && viewAsRole ? viewAsRole : userRole;

  const fetchUserRole = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', userId)
        .maybeSingle(); // Use maybeSingle instead of single to handle missing records gracefully

      if (error) {
        // Log error but don't throw - user might not have a record yet
        console.error('Error fetching user role:', error);
        setUserRole(null);
        return;
      }

      if (data && data.role) {
        setUserRole(data.role as 'parent' | 'coach' | 'admin' | 'youth_wrestler');
      } else {
        // User record doesn't exist yet - this can happen during signup
        setUserRole(null);
      }
    } catch (err) {
      console.error('Error in fetchUserRole:', err);
      setUserRole(null);
    }
  }, [supabase]);

  const refreshUser = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);
      
      if (currentUser) {
        await fetchUserRole(currentUser.id);
      } else {
        setUserRole(null);
      }
    } catch (error) {
      console.error('Error refreshing user:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(VIEW_AS_STORAGE_KEY) as ViewAsRole | null;
      if (stored && ['admin', 'coach', 'parent', 'youth_wrestler'].includes(stored)) {
        setViewAsRoleState(stored);
        syncViewAsCookie(stored);
      }
    }
  }, []);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserRole(session.user.id).finally(() => setLoading(false));
      } else {
        setUserRole(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [tenantSlug, supabase, fetchUserRole]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserRole(null);
    setViewAsRoleState(null);
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(VIEW_AS_STORAGE_KEY);
      syncViewAsCookie(null);
    }
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, userRole, viewAsRole, effectiveRole, setViewAsRole, loading, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

