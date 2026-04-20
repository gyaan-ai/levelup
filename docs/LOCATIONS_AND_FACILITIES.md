# Locations & Facilities — How to Handle Coaches’ Clubs

## Copy / terminology

In user-facing product copy, prefer **wrestling room** or **facility**. Avoid **gym** (too generic).

**Current state**
- **facilities** table: global list (name, school, address). Seeded by admin; not created in-app.
- Each **coach** has one **facility_id** (primary “where I train”).
- Each **session** has **facility_id** (required). Booking uses the coach’s default.
- Coaches only **choose** from existing facilities; they can’t add “my club” or multiple venues.

**Goal**
- Let coaches use their clubs and other venues (NCAA wrestling room, club facility).
- Avoid duplicate entries when two coaches use the same club.
- Keep it simple (MVP, then mobile).

---

## Recommended: Global approved list + coaches pick from it

**Idea:** You maintain **one global list** of locations/clubs (the existing **facilities** table, or a renamed **locations** table). Admins add and edit; nothing duplicate. Coaches **select** which of those locations they use (and can use multiple). When two coaches train at “Tar Heel Wrestling Club,” they both pick the same row — one source of truth.

**Why this is better when clubs are shared**
- No duplicate “Tar Heel Wrestling Club” entries.
- One place to fix an address or name.
- Parents see consistent location names across coaches.
- You control what’s on the list (quality, branding).

**What to add**
1. **Many-to-many: coaches ↔ facilities**  
   So a coach can have **multiple** locations (e.g. their club + a school room). Today they only have one `facility_id` on `athletes`.

2. **Ways to grow the list**  
   - **Admin only:** You add new locations as clubs/schools come onboard.  
   - **Optional “Suggest a location”:** Coach submits name + address; you approve and add to the global list; then any coach can pick it.

---

## Schema direction

**Option A – Minimal: keep current, add junction (recommended for MVP)**

- Keep **facilities** as the single global table (name, school, address).
- Add **athlete_facilities**: `(athlete_id, facility_id, is_primary)`. A coach can have several facilities; one can be marked primary for default booking.
- **Sessions** keep **facility_id** (required). At booking, parent/flow picks from that coach’s facilities (or you default to primary).
- **Migration:** Backfill: for each athlete with a `facility_id`, insert one row into `athlete_facilities` with `is_primary = true`. Then make **athlete.facility_id** optional or derive “default” from the junction (e.g. the one with `is_primary = true`).

**Option B – Rename and optional “suggested”**

- Rename or keep **facilities**; add **suggested_by_athlete_id** (nullable). When a coach “suggests” a location, you create a row with `suggested_by_athlete_id` set and e.g. **approved** = false. Admin approves → set approved = true (and maybe clear suggested_by). So the list stays global and approved; coaches only suggest, you approve.

---

## Coach experience

- **Profile / onboarding:** “Where do you train?” → pick **one or more** from the global list. Optionally mark one as default. If their club isn’t there, “Suggest a location” (name + address) → you add it and approve; they (and others) can then select it.
- **Booking:** Session is at one of the coach’s chosen facilities (default or chosen at booking). Display that facility’s name/address everywhere.

---

## Summary

| Approach | Duplicates? | Who maintains list? | Complexity |
|----------|-------------|---------------------|------------|
| **Global approved list (recommended)** | No — same club = one row | You (admin); optional coach “suggest” | Add junction coach ↔ facilities; optional suggest flow |
| Coach-owned locations per coach | Yes — same club can be entered twice | Coaches | New table; no shared list |

**Recommendation:** Use a **global approved list** (current facilities table). Add a **coach ↔ facilities** link so coaches can pick **multiple** locations from that list. You (or admin) update the list; optionally let coaches suggest new locations for you to approve. That way two coaches using the same club share one location row and you keep control.
