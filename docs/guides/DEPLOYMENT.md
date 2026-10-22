# Production Deployment Guide

This guide details the procedure for deploying IVC-PULSE to production on **Vercel** backed by **Supabase**.

---

## 1. Hosting Architecture

In production, the platform is served from a unified domain (e.g. `https://pulse.viceverse.in`):
- All four portals are served from the same domain under route namespaces:
  - `/admin` — Administrative Console
  - `/judge` — Judge Evaluation Portal
  - `/ops` — Operations Desk & Scanner
  - `/team` — Participant Team Portal
- [`src/middleware.ts`](../../src/middleware.ts) handles role validation and redirects `/` to the user's corresponding landing portal based on their authenticated profile.

---

## 2. Vercel Configuration

The project includes [`vercel.json`](../../vercel.json) configured for Next.js App Router:

```json
{
  "framework": "nextjs",
  "buildCommand": "next build"
}
```

### Environment Variables on Vercel Dashboard:
Configure the following under **Project Settings > Environment Variables**:

| Variable Name | Environment | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production & Preview | Remote Supabase project HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production & Preview | Supabase public anonymous API key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production & Preview | Supabase administrative service role secret |

---

## 3. Database Preparation (Supabase)

Before triggering deployment:
1. Run all migrations sequentially in [`supabase/migrations/`](../../supabase/migrations/):
   - `001_initial_schema.sql`
   - `002_rbac_user_management.sql`
   - `003_schema_alignment.sql`
   - `004_spoc_management.sql`
   - `005_spoc_avatar_support.sql`
   - `006_realtime_activity_logs.sql`
2. Populate the competition tracks, rounds, and criteria via [`supabase/seed.sql`](../../supabase/seed.sql).
3. Ensure Realtime is enabled in Supabase for:
   - `announcements`
   - `event_activity_logs`

---

## 4. Pre-Deployment Health Check

Run a clean build locally before pushing release tags:

```bash
# Clean previous build cache
rm -rf .next

# Execute complete build and typecheck
npm run build
```

Verify that all static pages and dynamic route handlers compile with code `0`.
