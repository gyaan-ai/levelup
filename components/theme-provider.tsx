'use client';

import { createContext, useContext, ReactNode } from 'react';
import { TenantConfig } from '@/config/tenants';

const ThemeContext = createContext<TenantConfig | null>(null);

export function ThemeProvider({
  tenant,
  children,
}: {
  tenant: TenantConfig;
  children: ReactNode;
}) {
  return (
    <ThemeContext.Provider value={tenant}>
      <div
        style={{
          '--guild-black': tenant.brandColors.primary,
          '--guild-gold': tenant.brandColors.accent,
          '--guild-gold-dark': tenant.brandColors.accentHover,
          '--guild-gold-light': tenant.brandColors.accentLight,
          '--primary': tenant.brandColors.primary,
          '--accent': tenant.brandColors.accent,
          '--accent-hover': tenant.brandColors.accentHover,
        } as React.CSSProperties}
        className="min-h-screen"
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTenant must be used within ThemeProvider');
  }
  return context;
}
