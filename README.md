# IVC-PULSE — Vice Verse Ideathon Operating System

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-16.4-black?style=for-the-badge&logo=next.js)
![React](https://img.shields.io/badge/React-18.3-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![Status](https://img.shields.io/badge/Status-Production_Ready-FF007F?style=for-the-badge)

**The real-time, 4-tier event management platform powering the Vice Verse Ideathon.**  
*Organized by Innovators and Visionaries Club (IVC) at Vidyavardhaka College of Engineering (VVCE) in partnership with InUnity.*

</div>

---

## 🌟 Executive Overview

**IVC-PULSE** is a mission-critical hackathon operating system engineered to eliminate operational friction across all stages of a multi-track ideathon. The platform unifies administrative oversight, live judging rubrics, team submissions, on-site QR check-ins, meal pass tracking, and live results into a high-performance Cyberpunk Neon terminal interface.

Built on Next.js 16 (App Router), React 18, TypeScript, Tailwind CSS, and Supabase (PostgreSQL with Row Level Security), IVC-PULSE delivers four role-isolated portals — Admin HQ, Judge Portal, Team Portal, and Ops Desk — each running on a dedicated local port during development and under unified route namespaces in production.

---

## 🏛️ System Architecture & Portals

The application is structured into four role-isolated portals:

```
+-----------------------------------------------------------------------------------+
|                           NEXT.JS EDGE MIDDLEWARE ROUTER                          |
+-------------------+-------------------+-------------------+-----------------------+
        |                   |                   |                   |
        v                   v                   v                   v
+---------------+   +---------------+   +---------------+   +-----------------------+
|   ADMIN HQ    |   | JUDGE PORTAL  |   |  TEAM PORTAL  |   |    OPERATIONS DESK    |
|  (Port 3000)  |   |  (Port 3001)  |   |  (Port 3002)  |   |      (Port 3003)      |
|  Route: /admin|   |  Route: /judge|   |  Route: /team |   |   Route: /ops/scanner |
+---------------+   +---------------+   +---------------+   +-----------------------+
| Teams & Users |   | Track Teams   |   | Submissions   |   | Hardware QR Scanner   |
| Scoring Rounds|   | Live Rubrics  |   | SPOC Mentors  |   | Attendance Check-in   |
| SPOC Manager  |   | Realtime Sync |   | Dynamic Badges|   | Meal & Kit Passes     |
| Audit Stream  |   | Grade Sliders |   | Live Results  |   | Live Activity Feed    |
+---------------+   +---------------+   +---------------+   +-----------------------+
```

### Portal Breakdown

| Portal | Port | Route | Primary Users | Core Responsibilities |
|--------|------|-------|---------------|----------------------|
| **Admin HQ** | `3000` | `/admin` | Administrators | User management, team provisioning, judge/SPOC assignment, rounds & criteria, results publishing, audit logs, announcements |
| **Judge Portal** | `3001` | `/judge` | Judges | Live rubric-based scoring, criteria sliders, evaluation matrix, team reviews, grade tabulation |
| **Team Portal** | `3002` | `/team` | Team Leaders & Participants | Deliverable submissions, SPOC contact & WhatsApp, digital QR badges, published results, schedules |
| **Ops Desk** | `3003` | `/ops/scanner` | Staff / Organizers | Hardware QR scanner for check-in, kit dispatch, meal/tea/lunch/dinner tokens, live activity feed |

---

## 📂 Repository Directory Organization

```
IVC-PULSE/
├── docs/                              # Engineering & Architectural Documentation Hub
│   ├── README.md                      # Documentation catalog index
│   ├── ARCHITECTURE.md                # System topology, middleware routing & RBAC
│   ├── DESIGN_SYSTEM.md               # Cyberpunk Synthwave tokens, Orbitron & animations
│   ├── MOCK_CREDENTIALS.md            # Account credentials, roles, and passcodes
│   ├── DATABASE.md                    # Database ERD, table definitions & RLS policies
│   ├── SEO_REPORT.md                  # UI/UX & accessibility audit report
│   └── guides/
│       ├── LOCAL_DEVELOPMENT.md       # Onboarding, multi-port execution & commands
│       └── DEPLOYMENT.md              # Vercel & Supabase production release guide
│
├── assets/                            # Design & Media Asset Repository
│   ├── README.md                      # Asset guidelines & distinction from public/
│   ├── branding/                      # Vector & high-res emblems (VVCE, Vice Verse, InUnity)
│   ├── vectors/                       # Cyberpunk SVG dividers, sun backdrops, icons
│   ├── screenshots/                   # Application preview screenshots
│   └── fonts/                         # Typography archive & licensing EULA
│
├── archive/                           # Historical Code & Prototypes
│   ├── README.md                      # Archive explanation & migration notes
│   └── legacy-vite-src/               # Pre-migration standalone Vite + React SPA prototype
│
├── public/                            # Runtime Web Assets (Served by Next.js HTTP server)
│   ├── favicon.png & favicon.svg      # Favicons & platform icons
│   ├── ivc-gear-logo.png              # Primary IVC glowing gear emblem
│   ├── vvce-logo.png                  # VVCE official golden emblem
│   ├── Vice_verse_logo.png            # Vice Verse title emblem
│   ├── fonts/pricedown.otf            # Web font binary
│   ├── payment-qr.png                 # Payment QR code
│   └── vectors/                       # Web-ready vector dividers
│
├── scripts/                           # Operations & DevOps Automation
│   ├── README.md                      # CLI script documentation
│   ├── start-all-portals.mjs          # Concurrent multi-portal runner (Ports 3000-3003)
│   ├── test-all-portals.js            # End-to-end integration test suite
│   ├── create-demo-users.mjs          # Demo account seeding
│   ├── clean-demo-accounts.js         # Demo account cleanup
│   ├── seed-mock-full-squads.mjs      # Full squad seeding
│   ├── seed-mock-portal-accounts.mjs  # Portal account seeding
│   ├── seed-mock-registrations.mjs    # Registration seeding
│   ├── export-registered-teams-csv.mjs# CSV export utility
│   └── utils/
│       └── remove-bg.ps1              # Transparency processing utility
│
├── supabase/                          # Backend Relational Schema & Migrations
│   ├── README.md                      # Database guide & CLI commands
│   ├── seed.sql                       # Default tracks, evaluation criteria & mock data
│   ├── .temp/                         # Temporary migration artifacts
│   └── migrations/                    # Sequential SQL migrations (001 to 006)
│       ├── 001_initial_schema.sql
│       ├── 002_rbac_user_management.sql
│       ├── 003_schema_alignment.sql
│       ├── 004_spoc_management.sql
│       ├── 005_spoc_avatar_support.sql
│       └── 006_realtime_activity_logs.sql
│
└── src/                               # Application Core Source Code
    ├── app/                           # Next.js App Router (Pages, Layouts & Server Actions)
    │   ├── page.tsx                   # Landing / root page
    │   ├── layout.tsx                 # Root layout with fonts & providers
    │   ├── globals.css                # Global styles & CSS variables
    │   ├── error.tsx                  # Global error boundary
    │   ├── not-found.tsx              # 404 page
    │   ├── robots.ts                  # Robots.txt generator
    │   ├── sitemap.ts                 # Sitemap generator
    │   ├── about/                     # About page
    │   ├── faq/                       # FAQ page
    │   ├── schedule/                  # Event schedule page
    │   ├── event-details/             # Event details page
    │   ├── event-flow/                # Event flow page
    │   ├── gateway/                   # Gateway / redirect page
    │   ├── login/                     # Authentication login
    │   ├── signup/                    # Authentication signup
    │   ├── register/                  # Team registration
    │   ├── participants/              # Participant dashboard
    │   ├── judges/                    # Judges listing
    │   ├── admin/                     # /admin HQ and dashboard submodules
    │   │   ├── (dashboard)/           # Admin dashboard shell
    │   │   │   ├── page.tsx           # Admin overview
    │   │   │   ├── users/             # User management
    │   │   │   ├── registrations/     # Registration oversight
    │   │   │   ├── rounds/            # Evaluation round management
    │   │   │   ├── spoc/              # SPOC coordinator management
    │   │   │   ├── evaluations/       # Evaluation oversight
    │   │   │   ├── evaluation/        # Evaluation matrix
    │   │   │   ├── results/           # Results publishing
    │   │   │   ├── audit-logs/        # Audit trail
    │   │   │   ├── assignments/       # Judge/team assignments
    │   │   │   └── content-releases/  # Content publishing
    │   │   └── submission-forms/      # Submission form builder
    │   ├── judge/                     # /judge live scoring and rubrics
    │   │   ├── page.tsx               # Judge landing
    │   │   ├── dashboard/             # Judge dashboard
    │   │   ├── evaluate/[teamId]/     # Team evaluation detail
    │   │   ├── rubrics/               # Rubric controls
    │   │   └── results/               # Judge results view
    │   ├── ops/                       # /ops scanner and roster management
    │   │   ├── page.tsx               # Ops landing
    │   │   ├── scanner/               # Hardware QR scanner
    │   │   ├── activity/              # Live activity feed
    │   │   ├── assigned-teams/        # Assigned team roster
    │   │   ├── team-lookup/           # Team search
    │   │   ├── judges-roster/         # Judge roster
    │   │   └── rounds/                # Round status for ops
    │   ├── team/                      # /team portal, submissions and QR badges
    │   │   ├── page.tsx               # Team dashboard
    │   │   ├── submission/            # Deliverable submission forms
    │   │   ├── qr/                    # QR badge generation
    │   │   ├── results/               # Published results
    │   │   └── problem-statements/    # Problem statement selection
    │   └── actions/                   # Type-safe Next.js Server Actions
    │       ├── admin-*.ts             # Admin domain actions
    │       ├── judge-evaluation.ts    # Judge scoring action
    │       ├── team-submission.ts     # Team submission action
    │       ├── operations.ts          # Ops scanner actions
    │       ├── live-activity.ts       # Activity stream actions
    │       ├── announcements.ts       # Announcement actions
    │       ├── auth-login.ts          # Authentication actions
    │       ├── team-registration.ts   # Registration action
    │       ├── upload-deliverable.ts  # File upload action
    │       └── ...                    # 30+ server action modules
    ├── components/                    # Domain-modular React Components
    │   ├── admin/                     # Admin stat cards, announcements modal
    │   ├── judge/                     # Scoring sliders, criteria controls
    │   ├── ops/                       # Camera QR scanner, live activity feed
    │   ├── team/                      # Submission forms, status widgets
    │   ├── auth/                      # Authentication & verification cards
    │   ├── ui/                        # Base shadcn/ui primitives
    │   ├── navigation/                # Sidebar & portal navigation
    │   ├── analytics/                 # Analytics components
    │   ├── announcements/             # Announcement banner
    │   ├── content-hub/               # Content management
    │   ├── gateway/                   # Gateway UI
    │   ├── mobile/                    # Mobile-specific components
    │   ├── DataContext.tsx            # React context provider
    │   ├── Sidebar.tsx                # Main navigation sidebar
    │   ├── SignOutButton.tsx          # Sign-out control
    │   ├── RealtimeRoundsListener.tsx # Realtime round updates
    │   ├── PartnerLogosBar.tsx        # Partner logo strip
    │   └── RelayathonFooter.tsx       # Footer with partner logos
    ├── lib/                           # Core utilities, Supabase clients, validations
    │   ├── supabase/                  # Supabase SSR & Admin clients
    │   ├── auth/                      # Authentication helpers
    │   ├── realtime/                  # Realtime subscription helpers
    │   ├── validations/               # Zod validation schemas
    │   ├── utils.ts                   # General utilities
    │   ├── csrf.ts / csrf-server.ts / csrf-client.ts # CSRF protection
    │   ├── csrf-constants.ts          # CSRF constants
    │   ├── domain-mapping.ts          # Domain-to-portal mapping
    │   ├── event-schedule.ts          # Event schedule data
    │   ├── feedback-sound.ts          # Audio feedback utilities
    │   ├── google-sheets-sync.ts      # Google Sheets integration
    │   ├── googleSheet.ts             # Google Sheets client
    │   ├── haptic.ts                  # Haptic feedback
    │   ├── offline-storage.ts         # Offline data persistence
    │   ├── qr-signature.ts            # QR code signing
    │   ├── rate-limit.ts              # Rate limiting
    │   ├── sanitize.ts                # HTML sanitization (DOMPurify)
    │   └── seo-config.ts              # SEO configuration
    ├── middleware.ts                  # Edge port isolation, RBAC routing & HTTP security
    └── types/                         # Centralized TypeScript domain interfaces
        ├── index.ts                   # User, Team, Evaluation, Result types
        ├── evaluation-matrix.ts       # Judge evaluation matrix types
        └── pdfjs-dist.d.ts            # PDF.js type declarations
```

---

## 🛠️ Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Framework | Next.js | 16.4.6 | App Router, Server Actions, SSR |
| UI Library | React | 18.3.1 | Component framework |
| Language | TypeScript | 5.x | Type safety |
| Styling | Tailwind CSS | 3.4.17 | Utility-first CSS |
| Database & Auth | Supabase | — | PostgreSQL, RLS, SSR Cookie Auth, Realtime |
| Icons | Lucide React | 0.441.0 | Iconography |
| QR Generation | qrcode | 1.5.4 | QR badge payloads |
| QR Scanning | html5-qrcode | 2.3.8 | Hardware camera scanning |
| Forms | react-hook-form | 7.53.0 | Form state management |
| Validation | zod | 3.23.8 | Schema validation |
| Resolvers | @hookform/resolvers | 3.9.0 | Zod resolver for RHF |
| Date Utils | date-fns | 4.4.0 | Date manipulation |
| Sanitization | isomorphic-dompurify | 4.6.0 | HTML sanitization |
| PDF Rendering | pdfjs-dist | 6.4.299 | PDF import/preview |
| Animation | tailwindcss-animate | 1.0.7 | Animation primitives |
| Class Utilities | clsx, tailwind-merge, class-variance-authority | — | Conditional classes |

---

## ⚡ Quick Start

### 1. Installation

```bash
git clone https://github.com/Innovators-and-Visionaries-Club/IVC-PULSE.git
cd IVC-PULSE
npm install
```

### 2. Environment Variables

Create `.env.local` in the project root:

```env
# Supabase Public Keys (Browser-safe)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

# Supabase Server Key (NEVER expose to client or commit to git)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Optional: External Integrations
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_SHEETS_WEBHOOK_URL=https://script.google.com/macros/.../exec

# SEO & Analytics
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_GA_MEASUREMENT_ID=

# Multi-Portal Configuration
NODE_ENV=development
PORT=3000
BASE_PORT=3000
TEST_BASE_URL=http://localhost:3000
NEXT_TELEMETRY_DISABLED=1
```

### 3. Launch Development Servers

#### Concurrent Multi-Portal Launch (Recommended):

```bash
npm run dev:all
```

Spawns all 4 portals simultaneously:
- **Admin HQ**: http://localhost:3000
- **Judge Portal**: http://localhost:3001
- **Team Portal**: http://localhost:3002
- **Ops Desk**: http://localhost:3003

#### Dedicated Individual Portal Launch:

```bash
npm run dev:admin   # Port 3000
npm run dev:judge   # Port 3001
npm run dev:team    # Port 3002
npm run dev:ops     # Port 3003
```

---

## 🔑 Features by Portal

### Admin HQ (`/admin`, Port 3000)
- **User Management**: Create, edit, delete, and import/export users across all 5 roles
- **Team Management**: Register teams, assign tracks, generate unique team codes (QR payloads)
- **SPOC Management**: Assign Single Points of Contact to teams with WhatsApp/phone contact
- **Judge Assignment**: Assign judges to specific teams and tracks
- **Evaluation Rounds**: Create and manage competition rounds (Ideation, Prototype, Final)
- **Evaluation Criteria**: Define scoring rubrics with max points and weights
- **Results Publishing**: Compile scores, assign ranks, publish leaderboard to teams
- **Audit Logs**: View full system activity trail
- **Announcements**: Broadcast real-time alerts across portals (info/warning/critical)
- **Content Hub**: Manage problem statements and content releases

### Judge Portal (`/judge`, Port 3001)
- **Dashboard**: Overview of assigned teams and evaluation status
- **Live Rubrics**: Score teams on criteria with interactive sliders (Innovation, Feasibility, Market Viability, etc.)
- **Evaluation Matrix**: Grid view showing all teams, judge scores, discrepancies, and final combined scores
- **Team Evaluation**: Per-team detailed scoring page with feedback text
- **Results**: View published results and leaderboard
- **Realtime Sync**: Live updates across judge sessions

### Team Portal (`/team`, Port 3002)
- **Dashboard**: Team profile, track, code, leader info, SPOC contact
- **Deliverable Submission**: Upload project deliverables (PDF, links, files up to 10MB)
- **Problem Statements**: Browse and select competition problem statements
- **QR Badge**: Generate and download team QR badge for check-in
- **Results**: View published results and team rank
- **SPOC Assistance**: Direct WhatsApp chat and phone contact with assigned coordinator

### Ops Desk (`/ops/scanner`, Port 3003)
- **Hardware QR Scanner**: Camera-based QR code scanning for on-site check-in
- **Team Lookup**: Search teams by code or name
- **Activity Logging**: Log check_in, kit_collected, tea_token, lunch_token, dinner_token actions
- **Live Activity Feed**: Real-time stream of all operational scans
- **Assigned Teams**: View teams assigned to staff members
- **Judges Roster**: View judge assignments for operations coordination
- **Rounds Status**: Monitor evaluation round status

---

## 🗄️ Database Schema

IVC-PULSE uses Supabase PostgreSQL with Row Level Security (RLS). Six sequential migrations build the schema:

| Migration | Description |
|-----------|-------------|
| `001_initial_schema.sql` | Core tables: teams, members, criteria, evaluations, results |
| `002_rbac_user_management.sql` | Role constraints, profile sync triggers, auth hooks |
| `003_schema_alignment.sql` | Schema alignment for Next.js Server Actions |
| `004_spoc_management.sql` | SPOC coordinator mappings and team allocation |
| `005_spoc_avatar_support.sql` | Profile avatar URLs and coordinator WhatsApp fields |
| `006_realtime_activity_logs.sql` | Realtime publication for activity logs and announcements |

### Core Tables

| Table | Description |
|-------|-------------|
| `profiles` | Identity directory linked to `auth.users` (id, email, role, phone, department, avatar) |
| `teams` | Competition teams (name, track, unique code, leader) |
| `team_members` | Profile-to-team associations (leader/member role) |
| `evaluation_rounds` | Competition stages (draft/open/closed/completed) |
| `evaluation_criteria` | Scoring rubrics per round (title, max points, weight) |
| `evaluations` | Judge score cards per team per round |
| `evaluation_scores` | Per-criterion score breakdowns |
| `event_results` | Finalized ranks, total/average scores, publish status |
| `event_activity_logs` | QR scan operations (check-in, kit, meal tokens) |
| `spoc_assignments` | SPOC-to-team mappings |
| `announcements` | Broadcast alerts with severity and target role |

### Row Level Security (RLS)
- **Admin**: Full bypass via Supabase service role client in server actions
- **Judge**: Read assigned teams/rounds; write limited to own evaluations
- **Team**: Read own profile, submissions, published results, announcements
- **Staff**: Read/write `event_activity_logs` and attendance verification

### Mock Credentials

All mock accounts use password **`123`**. Admin portal passcode: **`2026VICEVERSE@IVC`**.

| Role | Count | Portal | Example |
|------|-------|--------|---------|
| Admin | 1 | `/admin` | Seeded via Admin UI |
| Judge | 5 | `/judge` | `judge.arvind@ivc.pulse` |
| SPOC | 5 | `/team` (contact) | `spoc.iyer@ivc.pulse` |
| Staff | 5 | `/ops/scanner` | `staff.aman@ivc.pulse` |
| Teams | 20 | `/team` | 60 participants across 5 tracks |

See [docs/MOCK_CREDENTIALS.md](docs/MOCK_CREDENTIALS.md) for the complete directory of 20 teams, 5 judges, 5 SPOCs, and 5 staff accounts.

---

## 🎨 Design System

IVC-PULSE features a customized **Cyberpunk Neon / Synthwave** aesthetic inspired by GTA Vice City and futuristic terminal interfaces:

- **Typography**: Orbitron (Headings), Rajdhani (UI & Data), Share Tech Mono (Monospace)
- **Palette**: Deep Void Black (`#050508`), Hot Neon Pink (`#FF007F`), Amber Gold (`#FBC815`), Cyan Glow (`#00F0FF`)
- **Micro-interactions**: Neon flickering (`.animate-flicker`), glassmorphic panels, glowing card lift states, cascading fade-in animations

For full style guidelines and component rules, see [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

---

## 📜 Available Scripts

| Script | Command | Description |
|--------|---------|-------------|
| dev | `npm run dev` | Start Next.js on port 3000 |
| dev:admin | `npm run dev:admin` | Admin portal (port 3000) |
| dev:judge | `npm run dev:judge` | Judge portal (port 3001) |
| dev:team | `npm run dev:team` | Team portal (port 3002) |
| dev:ops | `npm run dev:ops` | Ops portal (port 3003) |
| dev:all | `npm run dev:all` | Launch all 4 portals concurrently |
| build | `npm run build` | Production build |
| start | `npm run start` | Production server |
| lint | `npm run lint` | ESLint on src/ |
| seed-demo | `npm run seed-demo` | Create demo users |
| clean-demo | `npm run clean-demo` | Clean demo accounts |

---

## 🧪 Testing & Verification

Run the comprehensive integration test suite validating database tables, 5-role authentication, HTTP routes, and server actions:

```bash
node scripts/test-all-portals.js
```

**What the test suite checks:**
1. **Database Audit** — Record counts across `teams`, `profiles`, `evaluation_rounds`, `evaluations`, `event_activity_logs`
2. **Public Routes** — `/login`, `/signup`, `/event-details`, `/event-flow`
3. **Role Authentication** — Sign in as Admin, Judge, Staff, Leader, Participant using mock credentials
4. **Portal Verification** — All sub-routes across Admin, Judge, Ops, and Team portals
5. **Server Actions Logic** — Team scan roster lookup, activity stream, announcements

To run a production build and typecheck:
```bash
npm run build
```

---

## 🚀 Deployment

The platform is deployed to **Vercel** backed by **Supabase**. All four portals are served from a unified domain under route namespaces (`/admin`, `/judge`, `/ops`, `/team`).

### Production Steps

1. Configure environment variables on Vercel Dashboard (Project Settings > Environment Variables):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

2. Run all migrations sequentially in `supabase/migrations/` (001 → 006).

3. Populate competition tracks, rounds, and criteria via `supabase/seed.sql`.

4. Enable Realtime in Supabase for `announcements` and `event_activity_logs`.

5. Run `npm run build` locally to verify compilation, then push to trigger Vercel deployment.

See [docs/guides/DEPLOYMENT.md](docs/guides/DEPLOYMENT.md) for the full production release guide.

---

## 📄 Documentation Links

- 🏛️ [System Architecture](docs/ARCHITECTURE.md)
- 🎨 [Design System Guidelines](docs/DESIGN_SYSTEM.md)
- 🔑 [Mock Credentials & Role Access](docs/MOCK_CREDENTIALS.md)
- 🗄️ [Database Schema & Migrations](docs/DATABASE.md)
- 💻 [Local Development Guide](docs/guides/LOCAL_DEVELOPMENT.md)
- 🚀 [Production Deployment Guide](docs/guides/DEPLOYMENT.md)
- 📊 [UI/UX Test Report](UI_REPORT.md)

---

## 👥 Organizers

**Innovators and Visionaries Club (IVC)**  
Vidyavardhaka College of Engineering (VVCE)  
In partnership with **InUnity**

---

<div align="center">

Built with ⚡ for the Vice Verse Ideathon — Real-time. Role-isolated. Production-ready.

</div>
