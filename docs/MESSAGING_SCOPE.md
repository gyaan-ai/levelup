# LevelUp Messaging — Scoped Enhancement Spec

**Context:** LevelUp has parent ↔ coach messaging (inbox, threads, unread). This doc scopes down the RecruitNC-style messaging spec to what LevelUp actually needs: no groups, channels, forums, mass messaging, or SMS — just better 1:1 messaging and session threads.

**Stack:** Next.js 15 App Router · Supabase (Postgres + Realtime + Storage + Auth) · Tailwind · Dark + gold theme.

**Existing:** `coach_inquiries` (parent_id, athlete_id, sender_id, body, created_at), `coach_inquiry_thread_read`, `/inbox`, `/inbox/thread/[parentId]/[athleteId]`, booking messages per session.

---

## PROMPT 1 — Realtime for Coach Inquiries

```
Add Supabase Realtime to LevelUp coach inquiry threads so new messages appear without refresh.

1. Supabase: enable Realtime for table `coach_inquiries` (if not already).
   In Dashboard: Database → Replication → add `coach_inquiries` to the publication, or add a migration that does:
   ALTER PUBLICATION supabase_realtime ADD TABLE coach_inquiries;

2. In the thread view (app/inbox/thread/[parentId]/[athleteId]/inquiry-thread.tsx):
   - Create a Supabase client (use existing createClient from @/lib/supabase/client or browser client).
   - On mount, subscribe to:
     supabase.channel('inquiry-' + parentId + '-' + athleteId)
       .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'coach_inquiries', filter: 'parent_id=eq.' + parentId + 'and athlete_id=eq.' + athleteId }, (payload) => { ... })
   - On new INSERT: append the new message to local state (setMessages(prev => [...prev, payload.new])).
   - If the new message is from the other party (payload.new.sender_id !== currentUserId), optionally play a short sound or show a subtle toast (optional).
   - Unsubscribe on unmount (channel.unsubscribe()).

3. Keep existing fetch on mount for initial load; realtime is only for new messages.
```

---

## PROMPT 2 — Read Receipts (Seen)

```
Add "Seen" read receipts to coach inquiry threads so senders know when the other party has read the thread.

1. Schema: You already have coach_inquiry_thread_read (user_id, parent_id, athlete_id, last_read_at).
   When a user opens a thread, mark-read is already called (last_read_at updated).
   No schema change needed.

2. API: Extend GET /api/coach-inquiries (when fetching a thread) to return the other party's last_read_at for this thread.
   - Query coach_inquiry_thread_read for the other user (the one who is not current user) for this (parent_id, athlete_id).
   - Return it as otherParty.lastReadAt in the JSON response.

3. Thread UI (inquiry-thread.tsx):
   - After the last message from the other party, if otherParty.lastReadAt exists and is >= that message's created_at, show a small "Seen" or "Seen at {time}" line (muted text, right-aligned).
   - Use relative time for "Seen" (e.g. "Seen 2m ago") or exact time on hover.
```

---

## PROMPT 3 — Draft Persistence

```
Persist the composer draft for coach inquiry threads in localStorage so users don't lose text when navigating away.

1. In inquiry-thread.tsx:
   - Storage key: `levelup-inquiry-draft-${parentId}-${athleteId}` (or include tenant if multi-tenant).
   - On mount: read from localStorage and setDraft(parsed) if key exists.
   - On draft change (onChange): debounce 300ms and write draft to localStorage.
   - On successful send: remove the key from localStorage.
   - Use a simple debounce (e.g. useEffect with draft in deps and a 300ms timeout) so we don't write on every keystroke.
```

---

## PROMPT 4 — Inbox & Thread UI Polish

```
Improve the inbox and thread UX to feel more like a modern messaging app (dark + gold theme).

1. Inbox list (inbox-client.tsx):
   - Show avatar for the other party (parent or coach). Fetch avatar URL from users or athletes in the threads API (e.g. add otherParty.avatarUrl or photo_url to thread list response).
   - Use relative timestamps in the list: "2m ago", "Yesterday", "Mar 5" (no need for exact time in list).
   - Ensure unread row uses gold left border (border-l-accent) instead of border-l-primary for theme consistency.
   - Optional: sort threads by last message time (most recent first) if not already.

2. Thread view (inquiry-thread.tsx):
   - Show a compact header: other party avatar + name, and a "Back to Messages" link.
   - Message bubbles: keep current layout; use relative time under each message ("2m ago") with full datetime on hover (title attribute or tooltip).
   - Auto-scroll to bottom when new messages arrive (realtime or after send). Use a ref on the messages container and scrollIntoView({ behavior: 'smooth' }) on the last message when messages length increases.
   - Ensure my-message bubble uses accent (bg-accent text-black) for theme consistency instead of bg-primary text-primary-foreground.

3. Thread API (GET /api/coach-inquiries): include otherParty.avatarUrl (from users.avatar_url or athletes.photo_url) and otherParty.lastReadAt for the other user's read state.
```

---

## PROMPT 5 — Optional: Typing Indicator

```
Add a simple typing indicator for coach inquiry threads using Supabase Realtime presence.

1. Create a Realtime presence channel for the thread (e.g. same channel name as in Prompt 1, or a separate presence channel "inquiry-presence-{parentId}-{athleteId}").
   - When the user is focused in the thread and types in the composer, set presence: { typing: true } (with a short TTL, e.g. 5 seconds; refresh while still typing).
   - When they blur or stop typing for 2 seconds, set typing: false or leave.

2. Subscribe to presence sync; when the other user's presence shows typing: true, display a small "…" or "Name is typing" below the messages (muted, animated).

3. Use Supabase Realtime presence API (channel().on('presence', ...)) and track presence state per user. Scope to this thread only so we don't need a global presence key.
```

---

## PROMPT 6 — Optional: Image Attachments

```
Allow one image per message in coach inquiries (no files). Keep implementation minimal.

1. Schema: add column to coach_inquiries: attachment_url TEXT (or keep body-only and add optional attachment_url). Migration: ALTER TABLE coach_inquiries ADD COLUMN IF NOT EXISTS attachment_url TEXT;

2. Storage: Supabase Storage bucket for inquiry attachments (e.g. inquiry-attachments). RLS: authenticated users can INSERT/SELECT objects where the object path includes their user id or the conversation id (define a clear path like {tenant}/inquiry/{parentId}_{athleteId}/{messageId}.jpg).

3. Composer: add an "Attach image" button; on select file (image only), upload to Storage, get public URL, then send message with attachment_url in the POST body. API POST /api/coach-inquiries: accept optional attachment_url, save to DB.

4. Thread UI: when rendering a message, if attachment_url is present, show a small image thumbnail (click to open in new tab or lightbox). Keep body text as today.
```

---

## What We're Not Doing (Out of Scope)

- **Groups, channels, forums** — LevelUp is 1:1 parent–coach and session-based only.
- **Mass messaging, templates, SMS, email digest** — not needed for current product.
- **Reactions, polls, threading (replies to a message)** — keep one linear thread per conversation.
- **Cmd+K search, global search** — optional later; not in this scope.
- **Group DMs or athlete-to-athlete** — only parent ↔ coach and session participants.

---

## Implementation Order

1. **Prompt 1** — Realtime (biggest perceived improvement).
2. **Prompt 2** — Read receipts (low effort, high clarity).
3. **Prompt 3** — Draft persistence (easy, avoids lost work).
4. **Prompt 4** — UI polish (avatars, relative time, auto-scroll, theme).
5. **Prompt 5** — Typing indicator (optional).
6. **Prompt 6** — Image attachments (optional).

Use these prompts in sequence. If the codebase already has Realtime enabled for coach_inquiries, skip that part of Prompt 1 and only add the client subscription.
