# Workspace & Collaboration Plan

Comprehensive plan for: **follow coaches**, **availability alerts**, and **coach–parent workspace** (notes, videos, requests, full history).

---

## 1. Follow coaches (parents follow coaches)

**Concept:** Parents can favorite/follow coaches. Used for "My coaches" and for availability notifications.

**Data model:**
- `coach_follows`: `id`, `parent_id` (users), `coach_id` (athletes.id), `created_at`. Unique `(parent_id, coach_id)`.

**UI:**
- Coach profile (`/athlete/[id]`): "Follow" / "Following" button.
- Parent dashboard or "My coaches": list of followed coaches, link to profile and workspace.
- Browse cards: optional follow indicator.

**APIs:**
- `POST /api/coach-follows` – follow (parent + coach).
- `DELETE /api/coach-follows?coachId=...` – unfollow.
- `GET /api/coach-follows` – list my followed coaches.
- `GET /api/coach-follows/check?coachId=...` – am I following this coach? (for button state).

---

## 2. Notify when coach adds new availability

**Concept:** When a coach updates `athlete_availability` (add/change), notify all parents who follow that coach.

**Flow:**
- Coach saves availability via existing availability API (or new one).
- After save, backend finds all `coach_follows` for that `coach_id`, then inserts `notifications` for each `parent_id` with `type: 'coach_new_availability'`, `data: { coach_id, coach_name }`, link to coach profile or browse.

**Implementation:**
- Availability write happens in `POST/PUT /api/availability` (or `availability/me`). After successful write, call an internal helper (or queue) that:
  - Reads `coach_follows` for this coach.
  - Inserts notifications for each follower.
- Use service-role client to insert notifications (RLS may restrict insert by other users).

---

## 3. Workspace (coach–parent collaboration)

**Concept:** A **workspace** is the shared collaboration space between one **coach** (NCAA wrestler) and one **parent**. It aggregates all sessions, notes, videos, and “things to work on” requests. Both coach and parent can use it.

**Data model:**

| Table | Purpose |
|-------|--------|
| `workspaces` | One row per (parent, coach). `id`, `parent_id`, `coach_id`, `created_at`, `updated_at`. Unique `(parent_id, coach_id)`. |
| `workspace_notes` | `id`, `workspace_id`, `author_id` (users), `content` (text), `session_id` (optional), `created_at`, `updated_at`. |
| `workspace_videos` | `id`, `workspace_id`, `uploaded_by`, `storage_path` (Supabase Storage), `title`, `description`, `created_at`. |
| `workspace_requests` | “Things to review / work on.” `id`, `workspace_id`, `requested_by` (parent), `content`, `status` (`pending` \| `in_progress` \| `done`), `coach_notes`, `created_at`, `updated_at`. |

**When is a workspace created?**
- Option A: First time a session is booked between that parent and coach.
- Option B: When either party opens “Workspace with [coach/parent]” (lazy-create).  
Recommendation: **lazy-create** when first accessed (e.g. parent clicks “Workspace” on coach profile or from a session).

**Storage:** Reuse existing Supabase Storage bucket; add a `workspace-videos` prefix (or similar) and RLS policies for workspace members.

**UI (high level):**
- **Route:** e.g. `/workspace/[coachId]` for parents, `/workspace/parent/[parentId]` for coaches — or a single `/workspace/[workspaceId]` with resolver. Simpler: **`/workspace/coach/[coachId]`** for parents (current user = parent), **`/workspace/parent/[parentId]`** for coaches.
- **Workspace page sections:**
  1. **Header:** Coach (or parent) name, link to profile; “Book again” CTA.
  2. **Sessions:** List of past and upcoming sessions with this coach/parent (date, type, status).
  3. **Notes:** Shared notes. Add note (textarea + submit). List by date; optionally filter by session.
  4. **Videos:** Upload (file picker → Storage), title, description. List with thumbnails/links, playback.
  5. **Requests (“Things to work on”):** Parent adds requests; coach updates status and coach notes. List with status badges.
  6. **Timeline / History (optional):** Combined feed of sessions, notes, videos, requests by date.

**APIs:**
- `GET /api/workspaces?coachId=...` (parent) or `?parentId=...` (coach) – get or create workspace, return `workspaceId` + summary.
- `GET /api/workspaces/[id]` – full workspace (sessions, notes, videos, requests) for allowed users only.
- `POST /api/workspaces/[id]/notes` – add note.
- `PATCH/DELETE /api/workspaces/[id]/notes/[noteId]` – edit/delete own note (optional).
- `POST /api/workspaces/[id]/videos` – upload video (multipart or presigned URL); create `workspace_videos` row.
- `GET /api/workspaces/[id]/videos` – list videos.
- `POST /api/workspaces/[id]/requests` – create “work on” request (parent).
- `PATCH /api/workspaces/[id]/requests/[requestId]` – update status + coach notes (coach).

**Access control:** Only the parent and the coach of that workspace can read/write. Resolve workspace by `(parent_id, coach_id)` and enforce that the current user is either the parent or the coach.

---

## 4. Where to link the workspace

- **Coach profile** (`/athlete/[id]`): “Workspace” button (for parents who have or had a booking with this coach).
- **Parent dashboard:** “Workspace with [Coach X]” per booked/followed coach.
- **Booking confirmation / session detail:** “Open workspace” next to the coach.
- **Coach dashboard:** “Workspaces” or “Parents I work with” → list of parents → open workspace.

---

## 5. Phased implementation

| Phase | Scope | Deliverables |
|-------|--------|--------------|
| **1** | Follow coaches + availability notifications | `coach_follows` migration, follow/unfollow API, follow button on profile + “My coaches”. Notify followers when coach updates availability. |
| **2** | Workspace foundation | `workspaces`, `workspace_notes`, `workspace_videos`, `workspace_requests` migrations. Create workspace when first needed. GET workspace API, minimal workspace page (sessions + notes). |
| **3** | Notes & requests | Add/edit notes, create/update requests, coach notes, status. UI for notes and “things to work on”. |
| **4** | Video upload & playback | Storage rules, upload API, workspace videos list + playback in workspace. |
| **5** | Polish & history | Timeline view, “My coaches” dashboard widget, notifications deep-links to workspace or coach profile. |

---

## 6. Next steps

1. ~~**Phase 1:** Implement `coach_follows`, follow APIs, and “Follow” on coach profile. Add “My coaches” (or integrate into parent dashboard). Wire availability save to “notify followers” logic.~~ **Done.**
2. **Phase 2:** Add workspace tables, resolve workspace by (parent, coach), GET workspace API, basic workspace page with sessions and notes.
3. Then iterate on Phase 3–5 as above.

---

## 7. Terminology

- **Coach** = NCAA wrestler ( teaches ). Stored in `athletes`; profile at `/athlete/[id]`.
- **Parent** = User with role `parent`; books for youth wrestlers.
- **Workspace** = Shared collaboration space between one parent and one coach.

Youth wrestlers can be brought into scope later (e.g. workspace per youth wrestler, or parent acts on their behalf).
