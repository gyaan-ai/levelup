'use client';

import { createContext, useContext, ReactNode } from 'react';
import { TenantConfig } from '@/config/tenants';

const ThemeContext = createContext<TenantConfig | null>(null);

export function ThemeProvider({ 
  tenant, 
  children 
}: { 
  tenant: TenantConfig; 
  children: ReactNode;
}) {
  return (
    <ThemeContext.Provider value={tenant}>
      <div
        style={{
          '--color-levelup-primary': tenant.brandColors.levelup.primary,
          '--color-levelup-secondary': tenant.brandColors.levelup.secondary,
          '--color-levelup-accent': tenant.brandColors.levelup.accent,
          '--color-org-primary': tenant.brandColors.stateOrg.primary,
          '--color-org-secondary': tenant.brandColors.stateOrg.secondary,
          '--color-org-accent': tenant.brandColors.stateOrg.accent,
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





