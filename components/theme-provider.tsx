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
          '--crew-charcoal': tenant.brandColors.primary,
          '--crew-orange': tenant.brandColors.accent,
          '--crew-orange-dark': tenant.brandColors.accentHover,
          '--crew-orange-light': tenant.brandColors.accentLight,
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
