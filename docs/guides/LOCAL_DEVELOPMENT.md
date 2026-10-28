# Local Development Guide

This guide walks you through setting up and running IVC-PULSE on your local workstation.

---

## 1. Prerequisites

- **Node.js**: `v18.17+` or `v20+` (LTS recommended)
- **Package Manager**: `npm` (comes with Node)
- **Supabase Account**: Remote Supabase project or local Supabase CLI instance

---

## 2. Environment Configuration

Create a `.env.local` file in the repository root:

```env
# Supabase Public Keys (Browser-safe)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Supabase Server Key (NEVER expose to client)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Optional: Port overrides
BASE_PORT=3000
```

---

## 3. Installation

Install all package dependencies:

```bash
npm install
```

---

## 4. Launching the Portals

### Option A: Concurrent Multi-Portal Launch (Recommended for Event Testing)

Spawns all 4 portals simultaneously on staggered ports with clean terminal logs:

```bash
npm run dev:all
```

This starts:
- **Admin HQ**: [http://localhost:3000](http://localhost:3000)
- **Judge Portal**: [http://localhost:3001](http://localhost:3001)
- **Team Portal**: [http://localhost:3002](http://localhost:3002)
- **Ops Desk**: [http://localhost:3003](http://localhost:3003)

### Option B: Single Portal Dedicated Launch

If working on a specific domain, launch only that portal:

```bash
# Admin Command Center (Port 3000)
npm run dev:admin

# Judge Evaluation Terminal (Port 3001)
npm run dev:judge

# Participant & Team Portal (Port 3002)
npm run dev:team

# Operations & QR Scanner Desk (Port 3003)
npm run dev:ops
```

---

## 5. Running the Automated Integration Suite

The repository includes an end-to-end integration test runner validating database connectivity, authentication for all 5 roles, route responses, and server actions:

```bash
node scripts/test-all-portals.js
```

### What the test suite checks:
1. **Database Audit**: Validates record counts across `teams`, `profiles`, `evaluation_rounds`, `evaluations`, and `event_activity_logs`.
2. **Public Routes**: Validates `/login`, `/signup`, `/event-details`, `/event-flow`.
3. **Role Authentication**: Signs into Supabase as Admin, Judge, Staff, Leader, and Participant using mock credentials.
4. **Portal Verification**: Tests all sub-routes across Admin (`/admin/*`), Judge (`/judge/*`), Ops (`/ops/*`), and Team (`/team/*`).
5. **Server Actions Logic**: Tests team scan roster lookup, activity stream, and announcements.

---

## 6. Build & Type Checking

To verify production compatibility and validate types:

```bash
# Production Build
npm run build

# Code Linting
npm run lint
```
