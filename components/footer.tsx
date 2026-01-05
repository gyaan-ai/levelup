'use client';

import { useTenant } from './theme-provider';

export function Footer() {
  const tenant = useTenant();
  
  return (
    <footer className="border-t mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <h3 className="font-semibold mb-4">LevelUp</h3>
            <p className="text-sm text-muted-foreground">
              {tenant.tagline}
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">Contact</h3>
            <p className="text-sm text-muted-foreground">
              {tenant.supportEmail}
            </p>
            <p className="text-sm text-muted-foreground">
              {tenant.phone}
            </p>
          </div>
          <div>
            <h3 className="font-semibold mb-4">{tenant.orgName}</h3>
            <p className="text-sm text-muted-foreground">
              {tenant.orgType}
            </p>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} LevelUp. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

