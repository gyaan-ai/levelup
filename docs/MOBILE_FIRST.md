# Mobile-first (iPhone) guidelines

This app is built **mobile-first** for iPhone. Default styles target small touchscreens; use `sm:`, `md:`, `lg:` for larger breakpoints.

## Layout
- **Single column by default** – use `grid-cols-1` then `md:grid-cols-2` etc.
- **Full-width tap targets on mobile** – primary actions use `w-full sm:w-auto` so buttons are easy to tap on phone.
- **Safe areas** – `env(safe-area-inset-*)` is used for body padding and main content so content clears notch and home indicator.

## Touch
- **Minimum 44px** – interactive elements use `min-h-[44px]` / `min-w-[44px]` on mobile (buttons already do this; override only when needed).
- **touch-manipulation** – used on buttons/links to reduce delay and double-tap zoom.

## Typography & spacing
- **Base font 16px on inputs** – prevents iOS zoom on focus in form fields.
- **Tighter padding on mobile** – e.g. `py-5 md:py-8`, `gap-4 md:gap-6`.
- **Smaller headings on mobile** – e.g. `text-2xl md:text-3xl`.

## Tabs / horizontal scroll
- Dashboard tabs use **horizontal scroll** on small screens (`overflow-x-auto`, `flex-nowrap`) so all tabs are reachable without wrapping into a tiny font.
- Use `-webkit-overflow-scrolling: touch` (via `.overflow-x-auto` in globals) for smooth scroll on iOS.

## Viewport
- `viewportFit: 'cover'` and `appleWebApp.capable: true` are set for add-to-home-screen and full-screen use on iPhone.
