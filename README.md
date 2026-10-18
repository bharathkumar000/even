# IVC-PULSE — Vice Verse Ideathon Operating System

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-15.1-black?style=for-the-badge&logo=next.js)
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

---

## 📂 Repository Directory Organization

The codebase is organized following clean architectural principles:

```
IVC-PULSE/
├── docs/                              # Engineering & Architectural Documentation Hub
│   ├── README.md                      # Documentation catalog index
│   ├── ARCHITECTURE.md                # System topology, middleware routing & RBAC
│   ├── DESIGN_SYSTEM.md               # Cyberpunk Synthwave tokens, Orbitron & animations
│   ├── MOCK_CREDENTIALS.md            # Account credentials, roles, and passcodes
│   ├── DATABASE.md                    # Database ERD, table definitions & RLS policies
│   └── guides/
│       ├── LOCAL_DEVELOPMENT.md       # Onboarding, multi-port execution & commands
│       └── DEPLOYMENT.md              # Vercel & Supabase production release guide
│
├── assets/                            # Design & Media Asset Repository
│   ├── README.md                      # Asset guidelines & distinction from public/
│   ├── branding/                      # Vector & high-res emblems (VVCE, Vice Verse, InUnity)
│   ├── vectors/                       # Cyberpunk SVG dividers, sun backdrops, icons
│   ├── screenshots/                   # Application preview screenshots
│   └── fonts/                         # Pricedown typography archive & licensing EULA
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
│   └── vectors/                       # Web-ready vector dividers
│
├── scripts/                           # Operations & DevOps Automation
│   ├── README.md                      # CLI script documentation
│   ├── start-all-portals.mjs          # Concurrent multi-portal runner (Ports 3000-3003)
│   ├── test-all-portals.js            # End-to-end integration test suite
│   └── utils/
│       └── remove-bg.ps1              # Transparency processing utility
│
├── supabase/                          # Backend Relational Schema & Migrations
│   ├── README.md                      # Database guide & CLI commands
│   ├── seed.sql                       # Default tracks, evaluation criteria & mock data
│   └── migrations/                    # Sequential SQL migrations (001 to 006)
│
└── src/                               # Application Core Source Code
    ├── app/                           # Next.js App Router (Pages, Layouts & Server Actions)
    │   ├── (public)/                  # /login, /signup, /event-flow, /event-details
    │   ├── admin/                     # /admin HQ and dashboard submodules
    │   ├── judge/                     # /judge live scoring and rubrics
    │   ├── ops/                       # /ops scanner and roster management
    │   ├── team/                      # /team portal, submissions and QR badges
    │   └── actions/                   # Type-safe Next.js Server Actions
    ├── components/                    # Domain-modular React Components
    │   ├── admin/                     # Stat cards, announcements modal
    │   ├── judge/                     # Scoring sliders, criteria controls
    │   ├── ops/                       # Camera QR scanner, live activity feed
    │   ├── team/                      # Submission forms, status widgets
    │   └── auth/                      # Authentication & verification cards
    ├── lib/                           # Core utilities, Supabase SSR/Admin clients, validations
    ├── types/                         # Centralized TypeScript domain interfaces
    └── middleware.ts                  # Edge port isolation, RBAC routing & HTTP security
```

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
NEXT_PUBLIC_SUPABASE_URL=https://your-supabase-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### 3. Launch Development Servers

#### Concurrent Multi-Portal Launch (Recommended):
```bash
npm run dev:all
```
Spawns all 4 portals simultaneously:
- **Admin HQ**: [http://localhost:3000](http://localhost:3000)
- **Judge Portal**: [http://localhost:3001](http://localhost:3001)
- **Team Portal**: [http://localhost:3002](http://localhost:3002)
- **Ops Desk**: [http://localhost:3003](http://localhost:3003)

#### Dedicated Individual Portal Launch:
```bash
npm run dev:admin   # Port 3000
npm run dev:judge   # Port 3001
npm run dev:team    # Port 3002
npm run dev:ops     # Port 3003
```

---

## 🧪 Testing & Verification

Run the comprehensive integration test suite validating database tables, 5-role authentication, HTTP routes, and server actions:

```bash
node scripts/test-all-portals.js
```

To run a production build and typecheck:
```bash
npm run build
```

---

## 🔐 Credentials & Role Directory

All mock and testing accounts use the default password: **`123`**  
Admin portal passcode: **`2026VICEVERSE@IVC`**

For the complete list of Judges, SPOC coordinators, Staff accounts, and team assignments, refer to [docs/MOCK_CREDENTIALS.md](docs/MOCK_CREDENTIALS.md).

---

## 🎨 Design System

IVC-PULSE features a customized **Cyberpunk Neon / Synthwave** aesthetic inspired by GTA Vice City and futuristic terminal interfaces:
- **Typography**: Orbitron (Headings), Rajdhani (UI & Data), Share Tech Mono (Monospace)
- **Palette**: Deep Void Black (`#050508`), Hot Neon Pink (`#FF007F`), Amber Gold (`#FBC815`), Cyan Glow (`#00F0FF`)
- **Micro-interactions**: Neon flickering (`.animate-flicker`), glassmorphic panels, and glowing card lift states.

For full style guidelines and component rules, see [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md).

---

## 📄 Documentation Links

- 🏛️ [System Architecture](docs/ARCHITECTURE.md)
- 🎨 [Design System Guidelines](docs/DESIGN_SYSTEM.md)
- 🔑 [Mock Credentials & Role Access](docs/MOCK_CREDENTIALS.md)
- 🗄️ [Database Schema & Migrations](docs/DATABASE.md)
- 💻 [Local Development Guide](docs/guides/LOCAL_DEVELOPMENT.md)
- 🚀 [Production Deployment Guide](docs/guides/DEPLOYMENT.md)
