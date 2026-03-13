# Repeat Booking & Multi-Session

Implementation notes for **Book again**, **Book another**, and future **multi-session checkout**.

---

## 1. Book again (past sessions)

**Location:** Past session cards on **Sessions** (`/bookings`, Past tab).

- **Behavior:** A “Book again” button links to Training with preselected filters so repeat booking feels like a fast rebooking flow, not a generic redirect.
- **Preselected when available:**
  - **Coach** — `coach=<athlete_id>`
  - **Same wrestler** — `wrestler=<youth_wrestler_id>` (passed to register page; dropdown pre-filled)
  - **Same facility** — `location=<facility_id>`
- **Link shape:**  
  `/training?tab=sessions&coach=<id>[&location=<facility_id>][&wrestler=<youth_wrestler_id>]`
- **Implementation:** `BookingCard` builds the link from `session.coach.id`, `session.facility_id`, and `session.primaryWrestlerId`. Bookings page provides `facility_id` and `primaryWrestlerId` (first participant’s `youth_wrestler_id`) in the session payload. Register page accepts `?wrestler=` and passes `initialWrestlerId` to preselect the wrestler in the dropdown.

---

## 2. Book another (after booking confirmation)

**Locations:**

- **Group/small group:** `/sessions/[id]/register/confirmed` (after paying to join a session).
- **Private/partner:** `/book/[athleteId]/confirmed?sessionId=...` (after booking with a coach).

**Options shown after a successful booking:**

1. **Book another with this coach** — Private: `/book/<athleteId>`. Group/small group: `/training?tab=sessions&coach=<athleteId>`.
2. **Book another session** — `/training` (no filters).
3. **Done — Back to Sessions** — `/bookings`.

This is the first-step solution for multi-session behavior: one booking per action, but clear paths to book again immediately.

---

## 3. Current limitation: one booking per action / checkout

- **One session per flow:** Each booking or registration completes a single session (one Stripe Checkout, one session or one participant added).
- **No cart:** There is no basket of multiple sessions; no “add to cart” or single checkout for several sessions.
- **Repeat usage:** Users can book multiple sessions in sequence via “Book another” / “Book again” and repeating the flow.

---

## 4. Future multi-session cart (not yet built)

Below is an evaluation of what would be required to support:

- Add multiple sessions to a cart
- Single checkout for the cart
- Assign wrestler(s) to each selected session
- Handle availability conflicts before payment completes

### 4.1 Current booking & payment architecture

- **Private/partner:** Parent picks coach → time/slot → creates one `sessions` row → one Stripe Checkout Session → webhook sets `sessions.status = 'scheduled'` and creates `session_participants`.
- **Group/small group:** Parent picks session → register flow sends one `session_id` + one `youth_wrestler_id` → one Stripe Checkout Session → webhook adds one `session_participants` row and increments `sessions.current_participants`.
- **Stripe:** One Checkout Session per request; metadata carries `session_id`, `youth_wrestler_id`, `parent_id`, and `register: 'true'` for group join. Webhook handles a single session/participant per event.

### 4.2 What a multi-session cart would require

| Area | Requirement |
|------|-------------|
| **Cart storage** | Server-side cart (e.g. DB table or tenant-scoped key-value) or client-held cart with server validation at checkout. Must key by parent/user. |
| **Cart contents** | List of items: each = `session_id` + chosen `youth_wrestler_id` (and optionally slot/type for private). Need to support mixed types (e.g. group + private) if product allows. |
| **Stripe Checkout** | Single Checkout Session with **multiple line items**: one line per cart item (session + wrestler). `metadata` cannot hold a full list; use a single cart id or server-side cart snapshot id so the webhook can load the cart and apply all items. |
| **Webhook** | On `checkout.session.completed`, resolve cart by id from metadata, then for each cart item: create or update `session_participants`, update `sessions.current_participants` where applicable, set `sessions.status` for created private sessions. Idempotency per cart + item to avoid double application. |
| **Availability conflicts** | Before creating Checkout: re-validate each session (still open, not full, slot still valid). If any item is invalid, return errors and remove or flag that item; optionally re-check on a short TTL (e.g. 10–15 min). Optionally lock slots briefly when “checkout” is started (complex; not required for first version). |
| **Assigning wrestlers** | Per cart item: store `session_id` + `youth_wrestler_id`. UI: when adding a session to cart, require wrestler selection (or default to a preselected one). Same validation as today: wrestler must belong to parent; for group sessions, wrestler not already in that session. |
| **UX** | Cart page or drawer: list items (session, date/time, coach, wrestler, price). Edit wrestler per line; remove item; “Checkout” → one Stripe redirect; success URL to a “Cart complete” page listing all booked sessions. |

### 4.3 Summary

- **Straightforward extensions:** Multiple line items in one Checkout Session; webhook looping over a server-side cart; re-validation of availability right before creating Checkout.
- **Larger work:** Cart schema and API (add/remove/update, expiry); success/cancel URLs and “Cart complete” page; clear error handling when an item becomes invalid (full or cancelled) before payment.
- **Not built yet:** No cart table, no cart API, no multi-line Checkout, no cart-specific webhook logic. Documented here so we can implement when prioritised.

---

## 5. PRD / implementation notes summary

- **Past sessions** support **Book again** with coach, facility, and wrestler preselected where possible.
- **Successful booking confirmation** (group register and private/partner) supports **Book another** (with this coach, or any session) and **Done — Back to Sessions**.
- **True multi-session checkout** (cart, single checkout, wrestler per session, conflict handling) is a **future enhancement**; see §4 above for requirements.
