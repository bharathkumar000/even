# IVC-PULSE Documentation Hub

Welcome to the **IVC-PULSE (Vice Verse Ideathon Platform)** engineering documentation center. This directory contains architectural specifications, database design docs, credential matrices, design systems, and developer onboarding guides.

---

## 📚 Documentation Index

| Document | Description | Target Audience |
| :--- | :--- | :--- |
| **[Architecture Overview](./ARCHITECTURE.md)** | Full system architecture, multi-portal topology, edge middleware routing, RBAC, and data flow. | All Engineers & Architects |
| **[Design System & Guidelines](./DESIGN_SYSTEM.md)** | Cyberpunk/Neon Synthwave UI guidelines, color tokens, typography (Orbitron/Rajdhani), and component standards. | Frontend & UI/UX Engineers |
| **[Mock Credentials & Role Access](./MOCK_CREDENTIALS.md)** | Test accounts matrix, role-based portal mapping, passcodes, and SPOC assignments. | QA, Testers & Developers |
| **[Database Schema & Migrations](./DATABASE.md)** | Supabase PostgreSQL schema, table definitions, RLS security policies, and migration sequence. | Backend & Database Engineers |
| **[SEO & Web Discovery Report](./SEO_REPORT.md)** | Technical SEO architecture, crawlability, canonical strategy, metadata, and validation audit. | Technical SEO, Growth & Product |
| **[Local Development Guide](./guides/LOCAL_DEVELOPMENT.md)** | Environment variables, local setup, multi-port execution (`dev:all`), and test suites. | All Developers |
| **[Deployment Guide](./guides/DEPLOYMENT.md)** | Production deployment instructions for Vercel and Supabase cloud infrastructure. | DevOps & Release Leads |

---

## 🏛️ Directory Architecture

```
docs/
├── README.md                  # This documentation index
├── ARCHITECTURE.md           # System design & multi-portal topology
├── DESIGN_SYSTEM.md          # Visual tokens, styles, components, animations
├── MOCK_CREDENTIALS.md       # Pre-seeded accounts, roles, access matrix
├── DATABASE.md               # Database schema, tables, migrations & RLS
└── guides/
    ├── LOCAL_DEVELOPMENT.md  # Multi-port launcher & developer onboarding
    └── DEPLOYMENT.md         # Production rollout & hosting configuration
```

For quickstart and repository setup commands, refer to the root [README.md](../README.md).
