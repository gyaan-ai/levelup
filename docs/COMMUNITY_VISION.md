# Community Vision — Slack-like development hub

## Your vision (in your words)

A **Slack-like “Community”** where coaches, parents, and wrestlers can:

- **Collaborate** — one place for the relationship beyond the mat
- **Message** — ongoing conversation
- **Assign actions** — homework, things to work on, accountability
- **Share video** — film and send for review
- **Assess video** — coach (and maybe parent) review and give feedback
- **Create action plans for sessions** — what we’re working on, focus areas
- **Provide feedback for sessions** — how it went, progress, next steps
- **Kids share goals** — wrestlers add what they want to work on
- **One modern workspace** so privates and the athlete–coach relationship extend **beyond the hour**

---

## Does this make sense?

**Yes.** This is exactly what **workspaces** are built for. The gap is mostly **naming**, **unifying** where people land, and **who has access** (especially the kid).

---

## What already exists (workspaces today)

| Vision piece | Current implementation |
|-------------|------------------------|
| **One space per relationship** | One workspace per (parent, **youth wrestler**, coach) — so per kid + coach. |
| **Message** | `workspace_messages` — thread in every workspace; real-time-style collaboration. |
| **Assign actions** | `workspace_actions` — coach assigns; parent/kid see and can mark complete. |
| **Share video** | `workspace_media` — upload video (and images); stored in Supabase, shown in workspace. |
| **Assess video** | Media has optional description/notes; coach can add comments. (Structured “assessment” could be a later layer.) |
| **Action plans / focus for sessions** | **Goals** (“what to work on”) + **Session notes** (what we worked on, focus areas, next session plan). |
| **Feedback for sessions** | **Session notes** — coach writes summary, highlights, focus areas, effort/progress. |
| **Kids share goals** | **Gap:** Only **parent** and **coach** can open a workspace today. The **youth wrestler (kid)** does not have access, so they can’t add goals or participate in the thread. |

So: the **product shape** already matches a “development area of accountability and planning” and “relationship beyond the hour.” The main missing pieces are:

1. **Branding and one front door** — Call it **Community** and make it the single place (Slack-like) for messaging + these workspaces.
2. **Youth wrestler access** — Let the **kid** into the workspace (and optionally into Community) so they can add goals and participate.

---

## Recommended direction

### 1. **“Community” as the one place**

- **Rename / reframe** “Workspaces” and “Messages” into one **Community** experience:
  - **Community** = list of your “spaces” (each space = one workspace: “[Wrestler] + [Coach]”).
  - Opening a space = the full workspace: **Messages**, **Goals**, **Video**, **Session notes**, **Actions** (and any future “session plans” or “assessments”).
- In the nav: one link, e.g. **“Community”** (or “Development” if you prefer), instead of separate “Messages” and “Workspaces.”
- Inside Community:
  - **Spaces** (current workspaces) — default view: list of “[Kid] + [Coach]” (or for coach: “[Parent’s kid] + [You]”).
  - **Direct messages** (current coach-inquiry 1:1 threads) can live as a section or tab so general parent–coach chat is still in the same app.
- That gives a **Slack-like** feel: one app, one sidebar (or list) of spaces + DMs, click into a space and get messages + goals + video + notes + actions in one place.

### 2. **Let kids into the room**

- **Access:** Allow the **youth wrestler** (the kid) to open workspaces where they are the `youth_wrestler_id`.
  - You already have a `youth_wrestler` role and optional link from `users.id` to `youth_wrestlers.id` (e.g. when a kid has their own account).
  - Backend: in workspace access checks, add “OR current user is the workspace’s youth_wrestler” (e.g. `youth_wrestlers.id = auth.uid()` or via `users` → `youth_wrestlers`).
- **UX:** When a kid logs in, Community shows their spaces (e.g. “You + Coach Jake”). They can:
  - Add **goals** (“I want to work on…”).
  - Read and reply in **Messages**.
  - See **actions** assigned to them and mark them done.
  - View **video** and **session notes** (and later, structured assessments if you add them).
- That delivers “kids can share goals” and “wrestlers can collaborate” in the same workspace as parents and coaches.

### 3. **Optional enhancements (later)**

- **Video assessment:** Dedicated “coach review” on a piece of media (rating, bullets, timestamped comments) if you want to go beyond a single description.
- **Session plans:** A small “plan for next session” (focus, 2–3 goals) that coach (or parent/kid) can fill before the session; could live in session notes or a lightweight new block.
- **Unread / notifications:** One Community (or Messages) badge that includes workspace messages so nothing feels “hidden” in a separate Workspaces section.

---

## Summary

- Your vision **makes sense** and matches the existing **workspace** model: one space per kid + coach (and parent), with messaging, goals, video, session notes, and actions.
- To make it feel like **one Slack-like Community**: (1) unify under a single “Community” entry and list workspaces (and optionally DMs) there, and (2) give **youth wrestlers** access to their workspaces so they can share goals and participate.
- After that, “Community” is the **one modern workspace** that extends privates and the athlete–coach relationship beyond the hour, with room to add more structure (e.g. video assessment, session plans) over time.
