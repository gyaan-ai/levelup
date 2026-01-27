# Branding & Logo Setup Guide

## Quick Start

### 1. Add Your Logos

Place your logo files in the following locations:

```
public/
├── logos/
│   └── nc-united.png          # NC United Wrestling logo (recommended: 200x80px, PNG with transparency)
└── favicons/
    └── levelup.ico            # LevelUp favicon (16x16 or 32x32 ICO file)
```

**Logo Requirements:**
- **Format**: PNG (with transparency) or SVG
- **Size**: Recommended 200-300px width, height proportional
- **Background**: Transparent preferred
- **File name**: Must match the path in `config/tenants.ts` (`/logos/nc-united.png`)

### 2. Update Branding Colors

Edit `/config/tenants.ts` to update your brand colors:

```typescript
brandColors: {
  levelup: {
    primary: "#1E40AF",     // Main brand color (buttons, links)
    secondary: "#7C3AED",   // Secondary color
    accent: "#F59E0B"       // Accent color (highlights)
  },
  stateOrg: {
    primary: "#003366",     // NC United navy
    secondary: "#CC0000",   // NC United red
    accent: "#FFD700"       // NC United gold
  }
}
```

**Where colors are used:**
- `levelup-primary`: Main buttons, primary CTAs, links
- `levelup-secondary`: Secondary buttons, accents
- `levelup-accent`: Highlights, badges
- `org-primary`, `org-secondary`, `org-accent`: State org branding (currently used in footer)

### 3. Update Favicon

Replace `/public/favicon.ico` with your custom favicon:
- **Format**: ICO, PNG, or SVG
- **Sizes**: 16x16, 32x32, or 48x48
- **Tool**: Use [favicon.io](https://favicon.io) or similar to generate from your logo

### 4. Update Metadata

Edit `/app/layout.tsx` to update page metadata:

```typescript
export const metadata = {
  title: 'LevelUp - Private Wrestling Lessons',
  description: 'Connect with college wrestlers for private lessons',
  icons: {
    icon: '/favicon.ico',
  },
};
```

## Where Branding Appears

### Header
- **LevelUp logo**: Text-based (currently just "LevelUp" text)
- **State org logo**: Image next to LevelUp text (if provided)
- **Colors**: Primary buttons use `levelup-primary`

### Footer
- **Tagline**: From `tenant.tagline`
- **Contact info**: From `tenant.supportEmail` and `tenant.phone`
- **Org name**: From `tenant.orgName`

### Throughout App
- **Buttons**: Use `levelup-primary` color
- **Links**: Use `levelup-primary` color
- **Accents**: Use `levelup-accent` for highlights

## Adding a LevelUp Logo

If you want to add a LevelUp logo image (instead of just text):

1. Add logo file: `public/logos/levelup.png`
2. Update header component to show logo:

```tsx
// In components/header.tsx
<Link href="/" className="flex items-center gap-4">
  <img 
    src="/logos/levelup.png" 
    alt="LevelUp"
    className="h-8"
  />
  {tenant.stateOrgLogo && (
    <img 
      src={tenant.stateOrgLogo} 
      alt={tenant.orgName}
      className="h-8"
    />
  )}
</Link>
```

## Testing Your Branding

1. **Local testing**: 
   - Add logo files to `public/logos/`
   - Restart dev server: `npm run dev`
   - Check header and footer

2. **Production**:
   - Commit logo files to git
   - Push to trigger Vercel deployment
   - Verify on live site

## Current Configuration

Your current branding is set in `/config/tenants.ts`:

- **Logo path**: `/logos/nc-united.png` (create this file)
- **Favicon**: `/favicons/levelup.ico` (update this file)
- **Tagline**: "Train with Carolina's Best College Wrestlers"
- **Colors**: Blue/Purple/Amber for LevelUp, Navy/Red/Gold for NC United

## Quick Checklist

- [ ] Add `nc-united.png` to `public/logos/`
- [ ] Update `public/favicon.ico` with custom favicon
- [ ] Update colors in `config/tenants.ts` if needed
- [ ] Update metadata in `app/layout.tsx` if needed
- [ ] Test locally
- [ ] Commit and deploy





