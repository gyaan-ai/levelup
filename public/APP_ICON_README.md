# Mobile Home Screen Icon

When users add the site to their home screen (mobile shortcut), the app uses these files:

## Required

**`/apple-touch-icon.png`** — Gold G logo on black background  
- **Size:** 180×180px minimum  
- Used by: iOS home screen shortcut, marketing  

**`/icon-192.png`** and **`/icon-512.png`** — same artwork, square PNG  
- Referenced from **`/public/manifest.json`** for Chrome / Android PWA install.  
- Regenerate after changing the logo:

```bash
cp public/apple-touch-icon.png public/icon-192.png
cp public/apple-touch-icon.png public/icon-512.png
```

(For production, export real 192×192 and 512×512 assets when you have them.)

## Quick setup

1. Create or export your gold G on black as a square PNG.
2. Save it as `public/apple-touch-icon.png`, then copy to `icon-192.png` and `icon-512.png` as above.

If `logos/guild-g.png` is already gold on black and square, you can copy it:

```bash
cp public/logos/guild-g.png public/apple-touch-icon.png
```
