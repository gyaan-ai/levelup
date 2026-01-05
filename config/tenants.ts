export interface TenantConfig {
  slug: string;
  orgName: string;
  orgType: string;
  
  brandColors: {
    levelup: {
      primary: string;
      secondary: string;
      accent: string;
    };
    stateOrg: {
      primary: string;
      secondary: string;
      accent: string;
    };
  };
  
  stateOrgLogo: string;
  favicon: string;
  tagline: string;
  
  domain: string;
  supportEmail: string;
  phone: string;
  
  supabaseUrl: string;
  supabaseAnonKey: string;
  
  stripePublishableKey: string;
  
  facilities: Array<{
    name: string;
    school: string;
  }>;
  
  features: {
    creditPools: boolean;
    groupSessions: boolean;
    videoSessions: boolean;
  };
  
  pricing: {
    oneOnOne: number;
    twoAthlete: number;
    groupRate: number;
    pools: {
      five: number;
      ten: number;
      twenty: number;
    };
  };
  
  certificationRequirements: {
    usaWrestling: boolean;
    safeSport: boolean;
    backgroundCheck: boolean;
    cpr: boolean;
  };
}

export const tenants: Record<string, TenantConfig> = {
  "nc-united": {
    slug: "nc-united",
    orgName: "NC United Wrestling",
    orgType: "501c3",
    
    brandColors: {
      levelup: {
        primary: "#1E40AF",     // Blue 700
        secondary: "#7C3AED",   // Purple 600
        accent: "#F59E0B"       // Amber 500
      },
      stateOrg: {
        primary: "#003366",     // NC United navy
        secondary: "#CC0000",   // NC United red
        accent: "#FFD700"       // NC United gold
      }
    },
    
    stateOrgLogo: "/logos/nc-united.png",
    favicon: "/favicons/levelup.ico",
    tagline: "Train with Carolina's Best College Wrestlers",
    
    domain: "levelup.ncunitedwrestling.com",
    supportEmail: "support@ncunitedwrestling.com",
    phone: "(919) 555-0100",
    
    supabaseUrl: process.env.NEXT_PUBLIC_NC_UNITED_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_NC_UNITED_SUPABASE_ANON_KEY!,
    
    stripePublishableKey: process.env.NEXT_PUBLIC_NC_UNITED_STRIPE_KEY!,
    
    facilities: [
      { name: "UNC Wrestling Room", school: "UNC" },
      { name: "NC State Wrestling Room", school: "NC State" }
    ],
    
    features: {
      creditPools: true,
      groupSessions: true,
      videoSessions: false
    },
    
    pricing: {
      oneOnOne: 60,
      twoAthlete: 80,
      groupRate: 30,
      pools: {
        five: 375,
        ten: 700,
        twenty: 1300
      }
    },
    
    certificationRequirements: {
      usaWrestling: true,
      safeSport: true,
      backgroundCheck: true,
      cpr: false
    }
  }
};

// Helper functions
export function getTenantByDomain(hostname: string): TenantConfig | null {
  // Extract subdomain: levelup.ncunitedwrestling.com → nc-united
  // For now, just return nc-united (add more logic later)
  return tenants["nc-united"];
}

export function getTenantConfig(slug: string): TenantConfig {
  const tenant = tenants[slug];
  if (!tenant) {
    throw new Error(`Tenant not found: ${slug}`);
  }
  return tenant;
}

