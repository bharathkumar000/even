# Automation & DevOps Scripts

This directory contains utility, testing, and lifecycle scripts for operating IVC-PULSE during development and live events.

---

## 📜 Script Catalog

| Script | Runtime | Command | Purpose |
| :--- | :--- | :--- | :--- |
| **`start-all-portals.mjs`** | Node.js (ESM) | `npm run dev:all` | Concurrent multi-port portal launcher with port collision detection and staggered initialization. |
| **`test-all-portals.js`** | Node.js (CJS) | `node scripts/test-all-portals.js` | Automated end-to-end integration test runner validating database, 5 roles auth, route HTTP codes, and server actions. |
| **`utils/remove-bg.ps1`** | PowerShell | `powershell scripts/utils/remove-bg.ps1` | Image utility script using `.NET System.Drawing` to remove white backgrounds from raw logo pngs. |

---

## 🚀 Usage Details

### Multi-Portal Orchestrator (`start-all-portals.mjs`)
Automatically checks availability of ports `3000`, `3001`, `3002`, and `3003`. If occupied, seamlessly shifts base port to `4000`. Staggers process spawning by 1.2s to prevent Next.js `.next` write lock race conditions.

### Test Runner (`test-all-portals.js`)
Executes an 8-phase diagnostic test against local dev server:
- Phase 1: Database count audits (`teams`, `profiles`, `evaluation_rounds`, etc.)
- Phase 2: Public routes
- Phase 3: Auth verification across all 5 roles (`admin`, `judge`, `staff`, `leader`, `participant`)
- Phase 4: Admin Portal subroutes
- Phase 5: Judge Portal subroutes & dynamic team evaluation routes
- Phase 6: Operations Scanner Desk subroutes
- Phase 7: Team Portal subroutes & QR routes
- Phase 8: Core server actions and realtime activity stream
- Final Scorecard & health metrics summary
