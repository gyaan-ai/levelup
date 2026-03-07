# Multiple parents per youth wrestler

## Model

- **Primary parent:** `youth_wrestlers.parent_id` (the parent who created the profile). One per kid.
- **Additional parents:** `youth_wrestler_parents(youth_wrestler_id, parent_id)` — any number of linked parents per kid.

A parent can be primary for some kids and linked for others (e.g. two parents, each primary on different kids).

## What each parent can do

| Action | Primary parent | Linked parent |
|--------|----------------|----------------|
| See kid on dashboard / in lists | ✅ | ✅ |
| Edit kid profile | ✅ | ✅ |
| Delete kid | ✅ | ❌ |
| Add another parent (link by email) | ✅ | ❌ |
| Unlink themselves | — | ✅ (delete own row from youth_wrestler_parents) |
| Book sessions for the kid | ✅ | ✅ (same as today: book as yourself; session has your parent_id) |
| See workspaces for the kid | Per-workspace (workspace has one parent_id) | Can have their own workspace with same kid + coach |

## API

- **GET /api/youth-wrestlers** — Returns all kids the current user can see (primary or linked). RLS enforces this.
- **GET /api/youth-wrestlers/[id]** — Single kid; allowed if user is primary or linked (no extra filter; RLS only).
- **PUT /api/youth-wrestlers/[id]** — Update kid; allowed if user is primary or linked.
- **DELETE /api/youth-wrestlers/[id]** — Delete kid; allowed only for primary parent.
- **GET /api/youth-wrestlers/[id]/parents** — List parents (primary + linked). Allowed if user is primary or linked.
- **POST /api/youth-wrestlers/[id]/parents** — Add linked parent. Body: `{ "email": "other@example.com" }`. Primary parent only. The other account must exist and have role `parent`.

## Migration

- **20240142000000_youth_wrestler_multiple_parents.sql** — Creates `youth_wrestler_parents`, indexes, RLS; updates `youth_wrestlers` RLS so SELECT/UPDATE allow linked parents; DELETE stays primary-only.

## UI (to add)

- On kid profile or settings: “Linked parents” section for primary parent: list linked parents, “Add parent” (email), and unlink.
- For linked parent: show “You’re linked as a parent for [Kid]” and option to “Unlink my account” (delete own row in `youth_wrestler_parents`).

## Sessions and workspaces

- **Sessions:** Still have a single `parent_id` (who booked). Both parents can book for the same kid; each booking has their own `parent_id`. Dashboard “upcoming sessions” can be extended to show sessions for any of my kids (already the case when we include linked kids in “my youth wrestlers” and session lists key off kid participation).
- **Workspaces:** One per (parent_id, youth_wrestler_id, athlete_id). So primary and linked parent each have their own workspace with the same kid + coach if they both have a relationship with that coach. No change required.
