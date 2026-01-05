'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  userRole: 'parent' | 'athlete' | 'admin' | null;
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
  const [userRole, setUserRole] = useState<'parent' | 'athlete' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient(tenantSlug);

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
        setUserRole(data.role as 'parent' | 'athlete' | 'admin');
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
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, userRole, loading, signOut, refreshUser }}>
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

