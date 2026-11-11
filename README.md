# Kidani Dating

Kidani is a React/Vite app served by an Express API backed by PostgreSQL. Accounts use bcrypt password hashes and HTTP-only PostgreSQL-backed sessions. Profiles, discovery, interactions, and messages are shared across signed-in members.

## Run locally

1. Install dependencies with `npm ci`.
2. Set `DATABASE_URL` to a PostgreSQL database and `SESSION_SECRET` to a random secret of at least 32 characters.
3. Start the API with `npm start`.
4. In a second terminal, run `npm run dev`. Vite proxies `/api` requests to the local API.

The API creates and updates its tables on startup. It listens on `PORT` (default `10000`).

## Free hobby deployment

The root `render.yaml` creates a free Render web service. Kidani still needs PostgreSQL for shared accounts, profiles, sessions, and messages, so create a PostgreSQL project on Neon's Free plan and provide its pooled connection string as `DATABASE_URL` when setting up the Render Blueprint. Render generates `SESSION_SECRET`.

1. Create a Neon project on its Free plan and copy its pooled PostgreSQL connection string. Neon currently lists a 1 GB storage limit per project and 100 compute-hours per month; check its current limits before launch.
2. In Render, create a Blueprint from this repository's `main` branch and root `render.yaml`.
3. Enter the Neon connection string when Render prompts for `DATABASE_URL`, then deploy.
4. Open the Render service's public `onrender.com` URL and check `/api/health`.

This is a $0 hobby setup only while usage stays within both providers' free allowances. Render's free web service sleeps after 15 minutes without traffic and can take about a minute to wake; its 750 free instance-hours are shared across the workspace. Its filesystem is temporary, so the app stores profile photos in PostgreSQL. Render Free PostgreSQL is intentionally not used because it expires after 30 days. Neon Free also has compute, storage, and data-transfer limits. Monitor both providers' usage and set a workspace spend limit if available. Free plans are not suitable for a production service or guaranteed uptime.

## Current launch limitations

- M-Pesa checkout is a manual handoff. Kidani does not verify payments or activate memberships automatically.
- Verification photos are held only in the current browser session and are not submitted for admin review.
- Profile photos are stored in PostgreSQL and are visible to eligible signed-in members. The app does not yet include email verification, password recovery, account deletion, or a moderation/admin console.
- Previous browser-only preview accounts are not migrated to the shared account database.
