# Kidani Dating

Kidani is a React/Vite app served by an Express API backed by PostgreSQL. Accounts use bcrypt password hashes and HTTP-only PostgreSQL-backed sessions. Profiles, discovery, interactions, and messages are shared across signed-in members.

## Run locally

1. Install dependencies with `npm ci`.
2. Set `DATABASE_URL` to a PostgreSQL database and `SESSION_SECRET` to a random secret of at least 32 characters.
3. Start the API with `npm start`.
4. In a second terminal, run `npm run dev`. Vite proxies `/api` requests to the local API.

The API creates and updates its tables on startup. It listens on `PORT` (default `10000`).

## Deploy with Render

The root `render.yaml` is a Render Blueprint for the Kidani web service and PostgreSQL database. Connect the private `CPS-alt/kidani-dating` repository to Render and create a Blueprint from that file. Render generates `SESSION_SECRET` and supplies the database connection string.

The Blueprint uses paid Render service and database plans so the API stays online and account data is stored in PostgreSQL. Review current charges in Render before creating the services; do not apply the Blueprint if the displayed cost is not acceptable.

## Current launch limitations

- M-Pesa checkout is a manual handoff. Kidani does not verify payments or activate memberships automatically.
- Verification photos are held only in the current browser session and are not submitted for admin review.
- Profile photos are stored in PostgreSQL and are visible to eligible signed-in members. The app does not yet include email verification, password recovery, account deletion, or a moderation/admin console.
- Previous browser-only preview accounts are not migrated to the shared account database.
