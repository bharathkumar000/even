# Supabase Backend Configuration

This directory contains the database migration scripts and initial seed data for the IVC-PULSE platform.

---

## 📂 Directory Layout

```
supabase/
├── README.md                  # This guide
├── seed.sql                   # Competition tracks, rounds, rubrics, and demo data
└── migrations/
    ├── 001_initial_schema.sql         # Base schema: teams, profiles, rounds, evaluations
    ├── 002_rbac_user_management.sql   # Role constraints, profiles sync trigger
    ├── 003_schema_alignment.sql       # Schema enhancements for Next.js Server Actions
    ├── 004_spoc_management.sql        # Single Point of Contact (SPOC) assignments table
    ├── 005_spoc_avatar_support.sql    # Profile avatar support & coordinator WhatsApp contact
    └── 006_realtime_activity_logs.sql # Realtime publication for activity logs & announcements
```

---

## 🛠️ Applying Migrations

### Via Supabase CLI:
```bash
# Link to remote project
npx supabase link --project-ref your-project-ref

# Push migrations
npx supabase db push

# Apply seed data
npx supabase db reset # (Local) or run seed.sql via Supabase SQL Editor
```

### Via Supabase Web Dashboard:
1. Navigate to **SQL Editor**.
2. Run migration files in sequential numeric order (`001` through `006`).
3. Run `seed.sql` to populate default competition tracks and scoring rubrics.
