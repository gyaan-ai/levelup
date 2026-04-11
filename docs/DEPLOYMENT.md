# Deployment (Vercel)

## What causes “old” production

**Production** in Vercel is tied to **one Git branch** and to **which deployment** your domain points at. If that branch is not **`main`**, or **Redeploy** was used on an **old deployment**, users can see code from an **older commit** even though **`main`** has moved forward. That is a **hosting / Git settings** issue, not the app randomly reverting in GitHub.

## What this repo does to help

- **Middleware** — Sends **`Cache-Control: no-store`** on app HTML so browsers and CDNs are less likely to keep stale pages after a deploy.
- **`data-deployment-sha` on `<html>`** (when built on Vercel) — Lets you confirm in **View Source** which commit is serving.

## What must be set in Vercel (dashboard)

1. **Settings → Git → Production Branch** = **`main`** (or the single branch you intend to ship).
2. **Domains** — Your live domain must attach to **Production** for that branch, not to a one-off Preview deployment.
3. Prefer **shipping by pushing to the production branch** over **Redeploy** on an old deployment (redeploy rebuilds **that** commit).

## Verify

After a deploy, **View page source** and check **`data-deployment-sha`** matches the commit you expect on the Vercel deployment.
