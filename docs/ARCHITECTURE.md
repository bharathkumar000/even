# System Architecture Specification

## 1. Executive Summary

**IVC-PULSE** is the real-time event operating system powering the **Vice Verse Ideathon**, an intensive multi-track hackathon organized by the Innovators and Visionaries Club (IVC) at Vidyavardhaka College of Engineering (VVCE) in partnership with InUnity.

The platform provides end-to-end operational automation across four distinct role-based stakeholder portals:
1. **Administrative Command Center (Admin HQ)**: Competition management, judge assignment, scoring rounds, audit trails, and announcements.
2. **Adjudication Desk (Judge Portal)**: Track-specific live scoring, rubric-based criteria, submission reviews, and real-time tabulation.
3. **Participant Hub (Team Portal)**: Deliverable submissions, SPOC direct assistance, digital badges/QR pass generation, and published results.
4. **Operations Desk (Ops Desk)**: High-speed QR scanner for on-site registration check-in, kit dispatch, meal tracking, and live audit feed.

---

## 2. Multi-Portal Topology & Multi-Port Local Architecture

To support parallel operations at on-site physical desks during the hackathon, IVC-PULSE is architected to run either as a unified single-domain deployment (production) or as a multi-port local cluster (development/event deployment):

```mermaid
graph TD
    Client[Web Browser Client] --> MW[Next.js Edge Middleware]
    MW -->|Port 3000 or /admin| Admin[Admin Command HQ]
    MW -->|Port 3001 or /judge| Judge[Judge Evaluation Portal]
    MW -->|Port 3002 or /team| Team[Team & Participant Portal]
    MW -->|Port 3003 or /ops| Ops[Operations & Scanner Desk]

    Admin --> SA[Next.js Server Actions]
    Judge --> SA
    Team --> SA
    Ops --> SA

    SA --> SB_Admin[Supabase Service Client (Admin Bypass)]
    SA --> SB_User[Supabase SSR Client (RLS Enforced)]
    SB_Admin --> DB[(Supabase PostgreSQL)]
    SB_User --> DB
```

### Local Multi-Port Mapping:
| Port | Role Target | Default Landing | Environment Purpose |
| :--- | :--- | :--- | :--- |
| `:3000` | `admin` | `/admin` | Executive management and system administration. |
| `:3001` | `judge` | `/judge` | Dedicated evaluation terminal for judges. |
| `:3002` | `leader` / `participant` | `/team` | Participant station for submissions and team info. |
| `:3003` | `staff` / `organizer` | `/ops/scanner` | High-speed camera QR check-in & meal dispatch. |

The orchestrator script [`scripts/start-all-portals.mjs`](../scripts/start-all-portals.mjs) handles concurrent process spawning with port collision detection and staggered startup.

---

## 3. Edge Middleware & Security Routing

The routing core is implemented in [`src/middleware.ts`](../src/middleware.ts):

1. **Port Isolation**: Inspects incoming request `host` headers. If accessed via dedicated ports (`3001`, `3002`, `3003`), requests are automatically constrained to their respective portals.
2. **Role Auto-Routing**: If accessed on port `:3000` at root `/`, the middleware queries the authenticated user's session claims and immediately directs them to their assigned role portal.
3. **HTTP Hardening Headers**: Enforces strict security headers:
   - `X-Frame-Options: DENY`
   - `X-Content-Type-Options: nosniff`
   - `Referrer-Policy: strict-origin-when-cross-origin`
   - `X-XSS-Protection: 1; mode=block`
   - `Permissions-Policy: camera=(self), microphone=(), geolocation=()`

---

## 4. Role-Based Access Control (RBAC) Matrix

| User Role | Accessible Route Prefixes | Special Permissions |
| :--- | :--- | :--- |
| `admin` | `/admin/*`, `/event-details`, `/event-flow` | Full read/write over users, rounds, criteria, evaluations, and audit logs. |
| `judge` | `/judge/*`, `/event-details`, `/event-flow` | Score evaluation rubrics for assigned teams, review team submissions. |
| `staff` / `organizer` | `/ops/*`, `/event-details`, `/event-flow` | QR badge scanning, check-in registration, meal pass logging, roster view. |
| `leader` | `/team/*`, `/event-details`, `/event-flow` | Submit deliverables, view SPOC contact info, download team QR badge. |
| `participant` | `/team/*`, `/event-details`, `/event-flow` | View team profile, schedules, announcements, and results. |

---

## 5. Technology Stack Specifications

- **Framework**: [Next.js 15](https://nextjs.org/) (App Router, Server Actions, Server-Side Rendering)
- **UI Library**: [React 18](https://react.dev/)
- **Styling**: [Tailwind CSS 3.4](https://tailwindcss.com/) with Cyberpunk / Neon Synthwave custom theme tokens
- **Icons**: [Lucide React](https://lucide.dev/)
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security, SSR Cookie Auth, Realtime Postgres Changes)
- **QR Code Engine**: `qrcode` (Generation) & `html5-qrcode` (Hardware camera scanning)
- **Form & Schema Validation**: `react-hook-form` with `zod`
