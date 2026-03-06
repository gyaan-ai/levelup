# Simplicity & Coach Scope Review

Full review of the product and codebase for **simplicity** and **opening the platform to all coaches** (NCAA + club). MVP will move to an iPhone app—flows must stay simple and mobile-friendly.

---

## 1. Design principles (already in COACH_RATE_CARD_AND_SESSIONS.md)

- **Simplicity first** — fewer options, clear defaults, minimal steps.
- **Easy to use is critical** — reduce friction; cut or simplify for MVP.
- **MVP → iPhone app** — short flows, scannable copy, no desktop-only patterns.

---

## 2. Coach scope: NCAA → NCAA + club coaches

**Goal:** **NCAA athletes are the lead**—the main highlight. Club coaches are also supported. Testing will use a **club coach** and **NCAA athletes from UNC**.

**Copy hierarchy:** Lead with "NCAA wrestlers" / "NCAA athletes"; then "and elite coaches" so NCAA is the draw.

**What was updated:**

| Location | Intent |
|----------|--------|
| Homepage, meta, CTAs | "NCAA wrestlers and elite coaches" — NCAA first |
| Requirements page | "Requirements for NCAA Wrestlers & Coaches"; bullet "Current NCAA athlete or qualified club coach" |
| Footer | "For NCAA Wrestlers & Coaches" |
| Browse, dashboard, my-wrestlers | "NCAA athletes and coaches" / "NCAA wrestlers and elite coaches" |
| Product description | "your coach" (neutral) |

**Schema (no change for MVP):**

- **`athletes`** table = coaches (NCAA or club). No new table needed.
- **`school`** = program name: e.g. "UNC", "Tar Heel Wrestling Club", "Iowa". Works for both.
- **`year`** = optional (Freshman–5th Year). Club coaches can leave blank; UI should not require it for coach signup.

**Signup:** "School" field kept; label can stay "School" or become "School / program" so club coaches enter club or school name without confusion.

**Testing:** MVP testing includes **club coach** and **NCAA athletes (e.g. UNC)**. All coach-facing and parent-facing copy should read "coaches" so both feel included.

---

## 3. Simplicity alignment — what’s already simple

- **Three session types** (1:1, partner, small group) — clear, not cluttered.
- **Three durations** (60 / 90 / 120 min) — consistent, easy to scan.
- **Partner invite:** one link, one join page — good pattern to reuse for small group.
- **Roles:** parent, athlete (coach), admin — no extra roles for MVP.
- **Browse:** filter by school, book — minimal steps.

---

## 4. Simplicity — watch out or simplify

| Area | Risk | Recommendation |
|------|------|----------------|
| **Coach onboarding** | Too many steps (bio, facility, payout, photo) | Keep steps minimal; allow save & complete later where possible. |
| **Booking flow** | Partner options (invite / open / solo) can feel heavy | Keep; ensure one clear "recommended" path (e.g. invite) and short labels. |
| **Availability** | Recurring vs one-off can get complex | Prefer simple recurring blocks (e.g. "Mon 7–9 PM") for MVP; avoid per-date complexity. |
| **Rate card (future)** | Per-duration, per-type could mean many fields | One price per session type × duration; no tiered or seasonal pricing for MVP. |
| **Small group** | 4 / 6 / 8 as separate products vs one product + "max" | Prefer one small-group product; parent picks "up to 4 / 6 / 8" at booking to keep coach setup simple. |
| **Workspace / messages** | Many sections (notes, videos, requests) | Ship minimal (e.g. messages + session list); add notes/videos/requests only if needed. |
| **Copy** | Long paragraphs on landing | Short lines, one idea per block; same for app → mobile later. |

---

## 5. Mobile readiness (MVP → iPhone app)

- **Tap targets:** Buttons and links already use min-h for touch (e.g. footer).
- **Flows:** Booking, join, confirm should have one primary CTA per screen.
- **Forms:** Reduce required fields; avoid long wizards; consider "Save and continue later" for coach profile.
- **Copy:** Short headings and bullets; avoid walls of text so small screens stay scannable.

---

## 6. Summary

- **Coach scope:** Copy and requirements updated so the platform is **coaches** (NCAA + club). Schema unchanged; `school` and optional `year` support both. Testing: club coach + UNC athletes.
- **Simplicity:** Session types and durations are already simple; keep rate card and small-group setup minimal; avoid extra workspace sections until needed.
- **Next:** Keep defaulting to fewer options and one clear path per flow; re-check before adding new features.
