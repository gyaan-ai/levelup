export interface TenantConfig {
  slug: string;
  orgName: string;
  orgType: string;
  productName: string;

  brandColors: {
    primary: string;
    accent: string;
    accentHover: string;
    accentLight: string;
    background: string;
    textPrimary: string;
    textSecondary: string;
  };

  stateOrgLogo: string;
  favicon: string;
  tagline: string;
  secondaryTagline?: string;

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
    productName: "The Crew",

    brandColors: {
      primary: "#36454F",
      accent: "#FF6600",
      accentHover: "#CC5200",
      accentLight: "#FF9933",
      background: "#FFFFFF",
      textPrimary: "#36454F",
      textSecondary: "#6B7280",
    },

    stateOrgLogo: "/logos/nc-united.png",
    favicon: "/favicons/crew.ico",
    tagline: "Outwork everyone",
    secondaryTagline: "Real wrestlers. Real work.",

    domain: "crew.ncunitedwrestling.com",
    supportEmail: "support@ncunitedwrestling.com",
    phone: "(919) 555-0100",

    supabaseUrl: process.env.NEXT_PUBLIC_NC_UNITED_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_NC_UNITED_SUPABASE_ANON_KEY!,

    stripePublishableKey: process.env.NEXT_PUBLIC_NC_UNITED_STRIPE_KEY!,

    facilities: [
      { name: "UNC Wrestling Room", school: "UNC" },
      { name: "NC State Wrestling Room", school: "NC State" },
    ],

    features: {
      creditPools: true,
      groupSessions: true,
      videoSessions: false,
    },

    pricing: {
      oneOnOne: 60,
      twoAthlete: 80,
      groupRate: 30,
      pools: {
        five: 375,
        ten: 700,
        twenty: 1300,
      },
    },

    certificationRequirements: {
      usaWrestling: true,
      safeSport: true,
      backgroundCheck: true,
      cpr: false,
    },
  },
};

export function getTenantByDomain(hostname: string): TenantConfig | null {
  return tenants["nc-united"];
}

export function getTenantConfig(slug: string): TenantConfig {
  const tenant = tenants[slug];
  if (!tenant) {
    throw new Error(`Tenant not found: ${slug}`);
  }
  return tenant;
}
