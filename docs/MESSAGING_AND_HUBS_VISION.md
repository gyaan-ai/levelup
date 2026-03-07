# Messaging & Hubs Vision (Community as single messaging home)

## Direction (aligned with RecruitNC-style layout)

1. **DM any athlete or coach**  
   Community should support starting a direct message with **any** athlete or coach (e.g. parent → any coach, not only followed; athlete → parent or coach; etc.), so all 1:1 comms live in one place.

2. **Private, invite-only groups**  
   Users should be able to create **private, invite-only groups** (e.g. from a small group session: coach + session participants + parents). All group comms happen in Community; invite by link or “add member” so only invited people are in the group.

3. **All links to workspace hubs**  
   Community sidebar already has **Spaces** (workspace links). Treat these as **hub links**: user sees all their workspaces (hubs), clicks one, and is taken to that hub. No need to duplicate hub list elsewhere.

4. **No messaging on the hub**  
   If Community is the single place for **all** messaging (DMs + groups) and the **list of hubs**, then each **hub (workspace)** can be **content-only**: goals, media, actions, session notes. No messaging UI inside the hub — keeps one place to talk (Community) and one place to work (hub content). Optional: from a hub, a single “Open in Community” or “Message” could deep-link to the right DM or group in Community.

---

## Current state vs target

| Capability | Current | Target |
|------------|--------|--------|
| **DM** | Parent → coaches they follow only; athlete has “Create a group” only | DM any athlete or coach (e.g. pick from directory / search) |
| **Groups** | Athlete-only can create groups | Private invite-only groups; create from small group session (coach + participants) or ad hoc; invite link / add member |
| **Hub links** | “Spaces” in sidebar → `/workspaces/[id]` | Same; optionally rename to “Hubs” or “Workspaces” for clarity |
| **Messaging on hub** | Workspace has `MessagesSection` (thread in each workspace) | Remove or hide; all messaging in Community (DMs + groups) |

---

## Summary

- **Community** = one place for: DMs (any athlete/coach), private invite-only groups (from sessions or ad hoc), and links to all workspace hubs.
- **Hubs** = workspace pages for content only: goals, media, actions, session notes. No messaging on the hub; “talk” lives in Community.
- This avoids split conversations and matches the pattern: messaging area with DMs, groups, and hub links; hubs are for doing work, not for chat.
