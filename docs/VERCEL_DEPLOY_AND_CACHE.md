# Vercel: Deploys not updating (e.g. mobile still shows old “Sessions” page)

If you push to git and Vercel builds, but the live site (especially on mobile) doesn’t change, try this.

## 1. Clear build cache and redeploy

Vercel reuses build cache by default. A cached build can produce the same output even after code changes.

- In **Vercel Dashboard** → your project → **Deployments**
- Open the **⋯** menu on the latest deployment (or any deployment you want to use as base)
- Choose **Redeploy**
- Turn **ON**: **“Clear build cache and redeploy”** (or equivalent)
- Confirm

Then open the production URL (and on mobile, use a **new incognito/private** tab or clear site data) and check again.

## 2. Confirm production is this repo

- **Settings** → **Git**: confirm the connected repo is the one you push to (e.g. `gyaan-ai/levelup`).
- **Settings** → **Environments** → **Production** → **Branch tracking**: must be **`main`** (or whatever branch should ship to Production). This is **not** on the Git page — it lives under **Environments**.
- For the deployment you’re testing: **Deployments** → open the deployment → **Source** and confirm the commit.

## 3. After a deploy, verify the new build

- Open the **My bookings** page (or the URL that was wrong on mobile).
- **Desktop:** Right‑click → Inspect → in the Elements tree, search for `data-bookings-version="full-with-reviews"`. If you see it, the new bookings page is live.
- **Mobile:** Use a new private/incognito window so the browser doesn’t use old cached HTML/JS.

If you still see old content after a “Clear cache and redeploy” and a fresh incognito load, the next place to check is Vercel’s **Build & Development Settings** (e.g. build command, output directory) and that the production domain is assigned to the deployment you redeployed.

---

## How to know if the NEW build is live

On **wrestlingguild.com** the indicator is: bottom nav and page say **“My bookings”** (not “Sessions”). Page title “My bookings”, subtitle about Past tab and leave feedback, and on past completed sessions a **Leave feedback** / **View feedback** button.

If you see “Sessions” or “Upcoming and past sessions for your wrestlers” or no “Leave feedback” on past sessions, **the site is not running the build from this repo.** Then:

- **Vercel → Settings → Domains:** which project has **wrestlingguild.com**? Is it the same project that is connected to **this** Git repo (e.g. gyaan-ai/levelup)?
- If the domain is on a different project (or an old/staging project), point **wrestlingguild.com** to the project that builds from this repo, then redeploy with “Clear build cache and redeploy”.
