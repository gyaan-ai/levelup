# Coach Rate Card & Session Types

Product spec for session formats, durations, pricing structure, and small-group registration flow.

**Coach scope:** **NCAA athletes are the lead**—the main highlight. Club coaches are also supported. Testing includes a club coach and NCAA athletes (e.g. UNC). Copy leads with "NCAA wrestlers" / "NCAA athletes," then "and elite coaches."

---

## Design principles

- **Simplicity first.** Every screen and flow should be easy to understand and quick to use. Prefer fewer options, clear defaults, and minimal steps.
- **Easy to use is critical.** If a feature adds friction, simplify or cut it for the MVP.
- **MVP → iPhone app.** This web MVP will become a mobile app. Keep flows short, copy scannable, and avoid desktop-only patterns (e.g. hover states, complex multi-step wizards). Design so the same flows work on a phone.

---

## Session lengths (platform standard)

All session types use these duration options:

- **60 minutes**
- **90 minutes**
- **120 minutes**

Coaches set price per duration (e.g. 1:1 at $75/hr, $100/90m, $150/2h). No 30- or 45-minute options.

---

## Session types

### 1. 1:1 Private Session

- One athlete, one coach.
- **Durations:** 60 / 90 / 120 minutes.
- **Fields:** Session length options, price per length, availability, virtual / in-person.

### 2. Partner Session (1:2)

- Two athletes per session.
- **Durations:** 60 / 90 / 120 minutes.
- **Pricing:** Total session cost (displayed to athlete as “$X per athlete” where X = total ÷ 2).
- **Max athletes:** 2.
- **Share flow:** Same as today — initiator gets partner invite link; partner uses link to join and pay. Coach can also share the link.

### 3. Small Group Session

- **Group size options:** 4, 6, or 8 athletes (coach configures which of these they offer).
- **Durations:** 60 / 90 / 120 minutes.
- **Pricing:** Price per athlete; platform multiplies by headcount for total.
- **Max athletes:** 4, 6, or 8 depending on the option selected for that session.

#### Small-group registration / share flow

- **Initiator:** The parent (or athlete) who creates the small-group session gets a **shareable registration link**. They share it with other families/athletes so others can register and pay their share.
- **Coach:** The coach also receives the **same (or equivalent) shareable link** and can share it (e.g. with their network, team, or social) to fill the remaining spots.
- **Mechanics:** Same idea as partner sessions: one link per session; initiator and coach both get it; others use the link to join and complete registration/payment until the session is full (4, 6, or 8 depending on the session).

---

## Rate card (coach-facing)

- Coaches configure **1:1**, **Partner**, and **Small Group** (4 / 6 / 8) with prices for 60 / 90 / 120 as applicable.
- **Rate visibility:** Athletes and parents see coach rate cards; coaches do **not** see other coaches’ rates (no price undercutting).
- Suggested pricing ranges remain platform guidance only; coaches set their own rates.

---

## Implementation notes (for later)

- Keep it simple: reuse the existing partner-invite pattern (one shareable link, one join page) for small group; same mental model for users.
- Avoid extra session types or schema complexity unless necessary; prefer one small-group product with a single “max participants” (4, 6, or 8) chosen at booking.
- Build every flow so it works on mobile later—big tap targets, minimal typing, clear next step.
