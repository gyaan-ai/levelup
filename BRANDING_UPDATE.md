# Branding Colors Update

## NC United Branding Colors

Updated the tenant configuration with official NC United colors:

### Primary Colors
- **Navy Blue**: `#0D1A4D` (nc-navy-950) - Used in headers, tables, primary UI elements
- **Red**: `#B31B1B` (nc-red-800) - Used for CTAs, alerts, important actions  
- **Gold**: `#D3B574` (nc-gold-400) - Used for accents, rankings, highlights

### Where Colors Are Applied

1. **Tenant Config** (`/config/tenants.ts`):
   - `stateOrg.primary`: `#0D1A4D` (Navy)
   - `stateOrg.secondary`: `#B31B1B` (Red)
   - `stateOrg.accent`: `#D3B574` (Gold)

2. **Tailwind Config** (`/tailwind.config.ts`):
   - Added custom color classes:
     - `nc-navy-950`: `#0D1A4D`
     - `nc-red-800`: `#B31B1B`
     - `nc-gold-400`: `#D3B574`
     - `nc-gold-500`: `#CBAF5D` (alternative gold shade)

3. **CSS Variables** (via ThemeProvider):
   - `--color-org-primary`: Navy Blue
   - `--color-org-secondary`: Red
   - `--color-org-accent`: Gold

### Usage in Components

You can now use these colors in your components:

```tsx
// Using Tailwind classes
<div className="bg-nc-navy-950 text-white">Navy background</div>
<button className="bg-nc-red-800">Red button</button>
<span className="text-nc-gold-400">Gold text</span>

// Using CSS variables (via org-* classes)
<div className="bg-org-primary">Navy</div>
<div className="bg-org-secondary">Red</div>
<div className="bg-org-accent">Gold</div>
```

### Current Application

- **LevelUp brand colors** remain consistent (Blue/Purple/Amber)
- **NC United colors** are used for:
  - Footer branding
  - State org logo area
  - Local accent elements

The colors are now live and will be applied throughout the application via the theme provider.





