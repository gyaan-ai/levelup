# SMS roadmap (Twilio)

Goal: keep coordination in the app (notifications + inbox) and use SMS only where it adds clear value—so coaches don’t need side group chats for core flows.

## Principles

1. **Opt-in & consent (US / TCPA-style)**  
   - Treat SMS as **marketing/transactional** based on message type.  
   - **Transactional** (session-specific, user-initiated booking context): lower bar; still document in Terms / Privacy and show what we text.  
   - **Marketing** (promos, availability blasts): explicit checkbox + easy opt-out.  
   - Store: `users.sms_opt_in` (boolean + timestamp) or reuse account settings when you add the UI—not required for internal roadmap, but before scaling SMS volume.

2. **Numbers we store**  
   - **`users.phone`** — parent and coach logins (E.164 when sending).  
   - **`youth_wrestlers.phone`** — athlete cell (parent-supplied, required on add/edit wrestler and athlete signup). Used for coach ↔ kid SMS; see migration `20240322000000_youth_wrestlers_phone.sql`.

3. **In-app first**  
   - Push/in-app notification is default; SMS is a **fallback** or **time-sensitive** nudge (e.g. day-before session).

---

## Who gets what (suggested phases)

### Coach (`users.phone` when role = coach)

| Event | Phase | Notes |
|-------|--------|--------|
| Someone registered for their session | **Done** | In-app + `sendCoachNewSignupSms` after `session_booked` (register API + Stripe webhook). |
| Join request on small-group session | 1 | Mirror in-app notification (`session-join-requests`) with optional SMS. |
| Session cancelled / rescheduled by parent or admin | 2 | High value; coach sees schedule change immediately. |
| Payout / billing reminder | 3 | If you add coach-facing money alerts. |

### Parent (`users.phone` when role = parent`)

| Event | Phase | Notes |
|-------|--------|--------|
| Booking confirmed / receipt | 1 | Short SMS + link to session (Stripe/register paths). |
| Session reminder (e.g. 24h before) | 2 | Cron or scheduled job; respect timezone (you use EST helpers elsewhere). |
| Session cancelled / rescheduled | 2 | Same as coach side for transparency. |
| Coach sent a message (inbox) | 3 | Optional “You have a new message” SMS if not opened in X hours—easy to over-spam; use sparingly. |
| Marketing / new availability | 3 | **Opt-in only**; consider reusing `notify-availability-followers` with SMS only for opted-in users. |

### Admin

- Usually **no** automated SMS; use in-app + email unless operational need (e.g. fraud alerts)—out of scope unless product asks for it.

---

## Technical map (where to hook)

- **Coach signup SMS (existing):** `lib/twilio.ts` → `sendCoachNewSignupSms`; called from `app/api/sessions/[id]/register/route.ts`, `app/api/stripe/webhook/route.ts` after `createNotification`.
- **Parent SMS (new):** add helpers e.g. `sendParentBookingConfirmedSms`, `sendParentSessionReminderSms` in `lib/twilio.ts` (same `sendSms` + `normalizePhone`).
- **Recipients:** resolve `parent_id` on `sessions` or `session_participants` → `users.id` → `users.phone`.
- **Reminders:** Vercel Cron → route that lists sessions in next 24h and sends once per session per parent (dedupe with a `sms_logs` table or `notifications` row if you want to avoid duplicates).

---

## Phased rollout

1. **Phase 0 (now)**  
   - Coach new-signup SMS; `users.phone` for coaches and parents at account/onboarding.

2. **Phase 1**  
   - Parent: booking confirmed SMS (register + paid path).  
   - Coach: optional SMS on join-request (parity with noisy in-app events).

3. **Phase 2**  
   - Reminders + cancel/reschedule for both roles.  
   - Deduping + quiet hours (e.g. no SMS 9pm–8am local) optional but recommended.

4. **Phase 3**  
   - Marketing / availability SMS with strict opt-in.  
   - Optional inbox nudge SMS.

---

## Compliance checklist (before high volume)

- [ ] Privacy Policy + Terms mention SMS, message types, frequency, carrier charges disclaimer.  
- [ ] Opt-out: “Reply STOP” if using long codes / toll-free with Twilio; or link to Account to disable SMS.  
- [ ] Log sends (recipient user id, template id, timestamp) for support and abuse review.

---

## Related code

- `lib/twilio.ts` — `sendSms`, `sendCoachNewSignupSms`  
- `lib/notifications.ts` — in-app `createNotification`  
- `users.phone` migration: `supabase/migrations/20240320000000_users_phone.sql`  
- Docs: `docs/TWILIO_SMS.md`
