# Workspaces vs Messaging — Full Review

## What exists today

### 1. **Workspaces** (Development Workspaces)

- **Route:** `/workspaces` (list) and `/workspaces/[id]` (single workspace).
- **Nav:** Separate “Workspaces” link for parents (and in mobile). Athletes do **not** have a Workspaces link in the header (only “Messages”).
- **Data model:**
  - One **workspace** per `(parent_id, youth_wrestler_id, athlete_id)` — i.e. per parent + **specific kid** + coach.
  - Tables: `workspaces`, `workspace_goals`, `workspace_media`, `workspace_session_notes`, `workspace_actions`, **`workspace_messages`**.
- **Created when:** A session exists for that (parent, youth_wrestler, coach) combo; the `/workspaces` page also auto-creates missing workspaces when you load it.
- **Inside each workspace:** Goals, video/media, session notes, action items, **and a message thread** (`workspace_messages`). So each workspace has its own chat.
- **Who sees it:** Parents see workspaces where they are `parent_id`; athletes (coaches) see workspaces where they are `athlete_id`. Admin can access any.

### 2. **Messaging (Inbox / “Messages”)**

- **Route:** `/inbox` with layout + sidebar (`InboxSidebar`).
- **Nav:** “Messages” for parents and athletes → `/inbox`.
- **Sidebar shows two things:**
  - **Groups** (athlete-only): “Messaging groups” — coach-created, multi-participant. API: `messaging-groups`, tables: `messaging_groups`, etc.
  - **Direct messages:** 1:1 threads from **coach inquiries** — one thread per `(parent_id, athlete_id)`. No youth wrestler; it’s parent ↔ coach only. API: `coach-inquiries`, table: `coach_inquiries`.
- **Unread badge:** Header “Messages” unread count comes from **coach inquiries only** (`/api/coach-inquiries/unread-count`). Workspace messages are **not** included.

### 3. **“Community”**

- There is **no** dedicated “Community” section in the app. The word “community” appears only in marketing copy (e.g. “coaches in your community”). So “community” here means: **the place where people communicate** — i.e. Messaging/Inbox (and optionally Workspaces).

---

## Comparison

| Aspect | Workspaces | Messaging (Inbox) |
|--------|------------|-------------------|
| **Scope** | Per (parent, **kid**, coach) | Parent ↔ coach (no kid), or Groups (coach-created) |
| **When** | After sessions (or first visit to /workspaces) | Anytime (inquiry before/without booking) |
| **Content** | Goals, media, notes, actions **+ chat** | Chat only (DMs + group channels) |
| **Where listed** | Only on `/workspaces` page | Inbox sidebar (Groups + Direct messages) |
| **Unread** | Not in header badge | Coach-inquiry unread only |

So you effectively have **two chat surfaces**:

1. **Inbox → Direct messages:** parent ↔ coach (1:1, no kid).
2. **Workspace → Messages:** parent + coach (and implicitly one kid) in that workspace.

For the same parent and coach there can be both an inbox thread and one or more workspaces (one per kid). So a parent might not realize that “messages” with a coach can live in two places: Inbox (general) vs Workspace (kid-specific).

---

## Should we list workspaces in the Messages / “Community” section?

**Recommendation: Yes — list workspaces in the Messages (Inbox) sidebar.**

Reasons:

1. **One place for “all my conversations”**  
   Parents and coaches see DMs, Groups, and Workspaces in one sidebar. They don’t have to remember that “Workspaces” is a separate nav item for another kind of chat.

2. **Clearer model**  
   - **Direct messages** = general 1:1 with a coach (no specific kid).  
   - **Workspaces** = “[Kid name] + [Coach name]” — kid-specific collaboration (goals, video, notes, **and** chat). Clicking a workspace can still go to `/workspaces/[id]` (full workspace) so goals/media/notes/actions stay in one place.

3. **Athletes (coaches)**  
   Right now athletes have “Messages” but no “Workspaces” in the header. If workspaces appear inside Messages as a section, coaches can open workspace chats without a separate Workspaces nav item (or we keep one nav link for “Workspaces” that goes to the list; either way, listing inside Inbox is consistent).

4. **Optional: unread for workspace messages**  
   If we add “last read” or unread for workspace threads (similar to coach inquiries), we could include workspace unread in the same Messages badge so the badge means “all message activity.”

---

## Recommended changes (summary)

1. **Inbox sidebar: add a “Workspaces” section**
   - For the current user (parent or athlete), fetch their workspaces (e.g. existing `GET /api/workspaces` or a small list endpoint).
   - Render each as a link, e.g. “[Wrestler name] + [Coach name]” (parent) or “[Parent’s kid] + [You]” (coach).
   - Link to `/workspaces/[id]` so opening a workspace still shows the full page (goals, media, notes, messages).

2. **Optional: rename or order sections**
   - For example: **Direct messages** (inquiry threads), **Workspaces** (kid + coach spaces), **Groups** (athlete-only). So “Workspaces” are clearly “development/collab spaces” that also have chat.

3. **Athlete nav**
   - Either add “Workspaces” to the athlete header (for consistency with parents) or rely on “Messages” and show workspaces only in the Inbox sidebar. Recommendation: show workspaces in the sidebar and keep a single “Messages” entry; optionally add “Workspaces” as well for quick access to the list.

4. **Unread (later)**
   - If desired, add tracking for “last read at” per workspace (or per workspace_messages) and include workspace unread in the header Messages count so one badge covers DMs + workspace threads.

5. **Docs / in-app copy**
   - Short tooltip or help text in the Inbox: “Direct messages = general chat with a coach. Workspaces = collaboration (goals, video, notes) + chat for a specific wrestler and coach.”

---

## Implementation notes

- **List workspaces in sidebar:** Reuse or add an API that returns the same list the `/workspaces` page uses (e.g. `GET /api/workspaces` returning `{ workspaces: [...] }`). Inbox sidebar already fetches groups and threads; add a third fetch for workspaces and a “Workspaces” section.
- **Layout:** Inbox layout is already role-aware (parent vs athlete). Workspace list is already role-scoped (parent_id or athlete_id). So the same list can be shown in the sidebar.
- **No schema change required** to simply list workspaces in the sidebar; only UI and one API call (or reuse of existing workspace list).

This keeps “Messages” as the single “community” surface (DMs + Groups + Workspaces) while preserving Workspaces as the full collaboration experience when you open one.
