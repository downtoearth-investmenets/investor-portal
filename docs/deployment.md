# Deploy Down to Earth

Run the Node API as one Render Web Service and the Next.js frontend as one Vercel project. The existing user, loan and portfolio modules run inside the API process. They need no separate Render services or internal service URL settings.

| Render field | Value |
| --- | --- |
| Language | Node |
| Root Directory | Leave blank (repository root) |
| Build Command | `pnpm install --frozen-lockfile` |
| Start Command | `pnpm start:api` |
| Health Check Path | `/health` |

Set `HOST=0.0.0.0`, `NODE_ENV=production`, and `NODE_VERSION=22.x`. Render supplies `PORT`. Set `PORTAL_URL` to the public frontend origin and add `RESEND_API_KEY` and `MAIL_FROM` for invitation and password recovery emails.

For persistent hosted data, set `USER_DATABASE_URL` and `LOAN_DATABASE_URL` on Render after applying the [PostgreSQL migration](postgres.md). Use separate database logins, even though the backend runs in one process. Fresh production databases contain no demo accounts; provision the first administrator separately. Local development can continue with SQLite.

On Vercel, set Root Directory to `apps/web`, allow workspace files outside that directory in the build, and set `API_GATEWAY_URL` to the public Render origin, without an `/api` suffix. Redeploy after changing the URL. Check the Render health endpoint and the frontend's `/api/health`, then verify sign-in and investor data isolation in staging.
