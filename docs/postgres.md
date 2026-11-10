# PostgreSQL setup for Down to Earth

The single Node backend uses PostgreSQL when both `USER_DATABASE_URL` and `LOAN_DATABASE_URL` are set. Without them it still uses local SQLite. The Next.js UI does not receive PostgreSQL credentials. The migrations create schema and permissions only; they do not copy records, create a real administrator, or populate fixtures.

1. Create a separate staging Supabase project. Apply the SQL in [the migration](../supabase/migrations/20261109000100_portal.sql) as the database owner. For a linked project, use [Supabase migrations](https://supabase.com/docs/guides/deployment/database-migrations) to track the migration rather than applying the same file twice.
2. Create two login roles, each with a unique secret, and grant only the corresponding runtime role. For example, as the database owner in `psql`:

   ~~~sql
   CREATE ROLE portal_users_app LOGIN IN ROLE portal_users_runtime;
   CREATE ROLE portal_loans_app LOGIN IN ROLE portal_loans_runtime;
   ~~~

   Use `\password portal_users_app` and `\password portal_loans_app` interactively. Neither login is a schema owner or has access to the other schema. Keep `portal_users` and `portal_loans` out of the Supabase Data API exposed schemas.
3. Set both `USER_DATABASE_URL` and `LOAN_DATABASE_URL` on the single Render backend using their respective logins. For long-running Render processes use a direct TLS connection if reachable, or Supabase's **Session pooler** if IPv4 is needed. For a custom role on the shared session pooler, use `<role>.<project-ref>` as the username. Use TLS certificate verification (`sslmode=verify-full`, with the CA configured where required). The backend sets its private schema on each connection, so use session mode rather than transaction mode. Set `NODE_ENV=production` for hosted services. Store both connection strings only on the backend. [Supabase connection options](https://supabase.com/docs/guides/database/connecting-to-postgres)
4. For a fresh hosted database, run `node scripts/bootstrap-admin.mjs` once from a trusted environment with the **user-service** `DATABASE_URL` and `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_NAME`, and `BOOTSTRAP_ADMIN_PASSWORD` supplied securely. Remove the temporary bootstrap variables after use. The command refuses to create another admin once one exists. Configure email before testing real invites or password recovery.

Use synthetic data for staging. Demo seeding for PostgreSQL requires explicit `ENABLE_DEMO_DATA=true` outside production. The backend initializes users before loans, since demo loans reference investor profiles. Hosted production services never seed demos, even if the flag is set.

To validate locally, create an empty PostgreSQL database named `dte_test_portal`, apply the migration, and create the two restricted logins as above. Set `TEST_USER_DATABASE_URL` and `TEST_LOAN_DATABASE_URL` to the two **local test** connections, then run `node scripts/test-services.mjs`. The test runner requires fresh empty tables, verifies the role separation, seeds synthetic records, and uses temporary HTTP ports. With both variables unset, the same suite uses throwaway SQLite files.

If real records already exist in SQLite, plan the import separately: preserve investor IDs and load profiles before loans, validate payments and rates, and have users sign in again instead of importing sessions and invite tokens. No data import runs automatically.
