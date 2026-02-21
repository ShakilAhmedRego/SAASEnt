# VerifiedMeasure Enterprise

**Production-ready SaaS Intelligence Platform** — Bright modern UI, database-first architecture, enterprise features.

## Features Implemented ✅

- **Bright Modern Design** (not dark by default)
- **Gradient Mesh Background**
- **Glass Navigation** with backdrop blur
- **Authentication** (sign up / sign in)
- **Dashboard** with KPI cards
- **Intelligence Score** visualization (0-400 scale)
- **Search & Filters** (real-time, score range)
- **Preview Model** (all leads visible, email/phone masked)
- **Credit System** (pay-per-unlock)
- **Bulk Selection** (select all locked)
- **Secure Unlock** (RPC only, client cannot bypass)
- **Zero State** (premium empty state)
- **Responsive** (mobile-first)

## Quick Start (5 minutes)

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create new project
3. Go to **SQL Editor**
4. Paste contents of `supabase/DATABASE_SETUP.sql`
5. Click **Run**

### 2. Configure Environment

Create `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Get these from **Settings → API** in Supabase.

### 3. Run Locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Grant Credits

```sql
-- Get your user ID after signing up
SELECT id, email FROM auth.users;

-- Grant 100 credits
INSERT INTO public.credit_ledger (user_id, amount, reason, ref_type)
VALUES ('YOUR_USER_ID', 100, 'initial_grant', 'admin_grant');
```

## Deploy to Vercel

```bash
vercel --prod
```

Add environment variables in Vercel dashboard.

## Architecture

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Styling | Tailwind CSS |

## Security Model

- **Preview Model**: All authenticated users can SELECT all leads
- **Masking**: Email/phone masked unless entitled
- **RPC-Only Unlock**: `unlock_leads_secure()` validates credits
- **No Client Bypass**: Cannot insert into `lead_access` or `credit_ledger` directly
- **RLS Enforced**: Row-level security on all tables

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `leads` | Company intelligence data |
| `lead_access` | Entitlement rows (who unlocked what) |
| `credit_ledger` | Credit transactions |
| `user_profiles` | User roles |
| `feature_flags` | Feature toggles |

### Views

| View | Purpose |
|------|---------|
| `dashboard_metrics` | Materialized KPIs |
| `stage_breakdown` | Companies by stage |

### RPCs

| Function | Purpose |
|----------|---------|
| `unlock_leads_secure(uuid[])` | Unlock leads with credit validation |
| `admin_grant_credits(uuid, int)` | Admin-only credit grant |

## Extending the Platform

### Add Command Palette (Cmd+K)

Create `components/ui/CommandPalette.tsx`:
- Listen for ⌘+K / Ctrl+K
- Search leads
- Quick actions (unlock, export, etc.)

### Add Detail Drawer

Create `components/dashboard/DetailDrawer.tsx`:
- Click lead card to open
- Tabs: Overview, Signals, Contacts, Activity
- Slide-in from right

### Add Admin Console

Create `app/admin/page.tsx`:
- Protected by `user_profiles.role = 'admin'`
- Database console (tables, rows, queries)
- Credit management
- User management

### Add Dark Mode Toggle

```tsx
const [dark, setDark] = useState(false);
useEffect(() => {
  document.documentElement.classList.toggle('dark', dark);
}, [dark]);
```

## Sample Data

DATABASE_SETUP.sql includes 20 sample companies with:
- Intelligence scores (258-398)
- Tech stacks
- ARR estimates
- Workflow stages
- Contact info

## Troubleshooting

**No companies showing**
→ Run DATABASE_SETUP.sql in Supabase SQL Editor

**Can't unlock**
→ Grant credits via SQL

**RLS error**
→ Ensure user is authenticated

**Build error**
→ `rm -rf .next && npm run build`

## License

MIT
