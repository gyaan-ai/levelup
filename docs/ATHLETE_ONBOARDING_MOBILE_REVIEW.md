# Athlete onboarding — mobile review

Quick review of coach onboarding for mobile (MVP → iPhone app).

---

## What’s already good

- **Touch targets:** Buttons, `Input`, and `SelectTrigger` use `min-h-[44px]` and `touch-manipulation` in the UI kit. Nav (Back / Skip / Continue) is thumb-friendly.
- **One focus per step:** 4 steps (photo → bio → facilities → payout), one main task per screen. No long wizard.
- **Nav order on mobile:** Wizard uses `flex-col-reverse` so Continue appears above Back on small screens — primary action is easier to reach.
- **Step indicator:** Dots are visual only (not tappable). Simple and low clutter.
- **Copy:** “Tap to upload”, “Handle without @”, short labels. Scannable.
- **Dialog:** “Go live?” uses stacked full-width buttons on mobile (`flex-col sm:flex-row`). Make Public / Keep Private are clear.
- **Container:** `max-w-xl`, `px-4` — readable width and safe padding on phones.

---

## Suggestions (done or optional)

1. **Photo tap area:** The photo block is 128×128px, so already above 44px. Added `touch-manipulation` on the label so taps feel immediate on mobile.
2. **Zelle input:** Optional: use `inputMode="email"` when you want to favor email (e.g. placeholder “Email or phone”) so the email keyboard shows first; users can switch to numeric for phone.
3. **Bio textarea:** `rows={5}` is fine; the page scrolls. No change needed.
4. **Facility selects:** Long lists are handled by Radix (scroll inside dropdown). If the list gets very long, consider search later; for MVP it’s fine.
5. **Dialog on very small screens:** Content is short. If you ever add more copy, give the dialog `max-h-[90vh] overflow-y-auto` so it never overflows.

---

## Summary

Onboarding is already mobile-friendly: 44px touch targets, one step per screen, and clear primary actions. The small tweaks above (photo `touch-manipulation`, optional Zelle `inputMode`) keep it that way as you move to the app.
