# Mobile Home Screen Icon

When users add the site to their home screen (mobile shortcut), the app uses these files:

## Required

**`/apple-touch-icon.png`** — Gold G logo on black background
- **Size:** 180×180px minimum (192×192 or 512×512 recommended)
- **Format:** PNG
- **Content:** Your Guild “G” logo in gold (#D4AF37) on black (#000000)
- Used by: iOS (Add to Home Screen), Android, PWA

## Quick setup

1. Create or export your gold G on black as a square PNG.
2. Save it as `public/apple-touch-icon.png`.

If `logos/guild-g.png` is already gold on black and square, you can copy it:

```bash
cp public/logos/guild-g.png public/apple-touch-icon.png
```

(Resize to 192×192 or 512×512 first if needed.)
