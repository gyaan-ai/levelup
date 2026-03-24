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

  /** Main brand logo (header + homepage hero). Place file in public/logos/ e.g. guild-g.png */
  logo: string;
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
  guild: {
    slug: "guild",
    orgName: "The Guild",
    orgType: "501c3",
    productName: "The Guild",

    brandColors: {
      primary: "#000000",
      accent: "#B89D60",
      accentHover: "#9A8550",
      accentLight: "#C9B078",
      background: "#FFFFFF",
      textPrimary: "#000000",
      textSecondary: "#6B7280",
    },

    logo: "/logos/guild-bronze.jpg",
    stateOrgLogo: "/logos/guild-bronze.jpg",
    favicon: "/favicons/guild.ico",
    tagline: "Mastery. Technique. Access the Elite.",
    secondaryTagline: "Elite wrestling technique instruction",

    domain: "www.wrestlingguild.com",
    supportEmail: "info@WrestlingGuild.com",
    phone: "631.662.5409",

    supabaseUrl: process.env.NEXT_PUBLIC_GUILD_SUPABASE_URL || process.env.NEXT_PUBLIC_NC_UNITED_SUPABASE_URL!,
    supabaseAnonKey: process.env.NEXT_PUBLIC_GUILD_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_NC_UNITED_SUPABASE_ANON_KEY!,

    stripePublishableKey: process.env.NEXT_PUBLIC_GUILD_STRIPE_KEY || process.env.NEXT_PUBLIC_NC_UNITED_STRIPE_KEY!,

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

/**
 * Matches the deployed app hostname from NEXT_PUBLIC_APP_URL (www vs apex, etc.).
 * Without this, getTenantByDomain returns null on production aliases → register/confirmed
 * 404s before finalize, and registration-status 404s — paid Stripe, no session_participants row.
 */
function hostMatchesConfiguredAppUrl(host: string): boolean {
  const raw = process.env.NEXT_PUBLIC_APP_URL;
  if (!raw) return false;
  try {
    const u = new URL(raw);
    const appHost = u.hostname.toLowerCase();
    const h = host.toLowerCase();
    if (appHost === h) return true;
    const stripWww = (s: string) => (s.startsWith('www.') ? s.slice(4) : s);
    return stripWww(appHost) === stripWww(h);
  } catch {
    return false;
  }
}

export function getTenantByDomain(hostname: string): TenantConfig | null {
  const host = hostname.split(':')[0].toLowerCase();
  // Primary domain and localhost for dev
  if (host === 'www.wrestlingguild.com' || host === 'wrestlingguild.com' || host === 'localhost') {
    return tenants.guild;
  }
  // Legacy / alternate domain (redirect to www.wrestlingguild.com in Vercel if desired)
  if (host === 'guildwrestling.com' || host === 'www.guildwrestling.com' || host === 'guild.ncunitedwrestling.com') {
    return tenants.guild;
  }
  // Vercel preview and other known hosts
  if (host.endsWith('.vercel.app')) {
    return tenants.guild;
  }
  if (hostMatchesConfiguredAppUrl(host)) {
    return tenants.guild;
  }
  return null;
}

export function getTenantConfig(slug: string): TenantConfig {
  const tenant = tenants[slug];
  if (!tenant) {
    throw new Error(`Tenant not found: ${slug}`);
  }
  return tenant;
}
