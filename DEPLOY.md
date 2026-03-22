# ShieldPay — Deployment Guide

## Stack
- **Frontend:** React + TypeScript + Vite + Tailwind → Vercel
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions)
- **Payments:** KCB Buni (M-Pesa) + Stanbic PesaLink
- **Supabase project:** `rnplqhlwvnqrghrjvylx`

---

## 1 — Run the SQL Schema

1. Open Supabase → `rnplqhlwvnqrghrjvylx` → SQL Editor
2. Paste the entire contents of `supabase/migrations/001_schema.sql`
3. Click **Run**
4. You should see a table list at the bottom with: `businesses`, `business_members`, `suppliers`, `payment_schedules`, `payment_requests`, `audit_logs`, `notifications`

---

## 2 — Push code to GitHub

```bash
cd ~/ShieldPay-Bills        # or your repo folder
rm -rf *
cp -r /path/to/ShieldPay/. .
git add -A
git commit -m "Full rebuild v2"
git push origin main --force
```

---

## 3 — Set up Vercel

1. Go to your Vercel project for `shield-pay-bills.vercel.app`
2. Add Environment Variables:
   ```
   VITE_SUPABASE_URL=https://rnplqhlwvnqrghrjvylx.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_from_supabase_dashboard
   ```
3. Redeploy

---

## 4 — Deploy Edge Functions via GitHub Actions

### Add GitHub Secrets
In your GitHub repo → Settings → Secrets → Actions:

| Secret name | Value |
|---|---|
| `SUPABASE_PROJECT_REF` | `rnplqhlwvnqrghrjvylx` |
| `SUPABASE_ACCESS_TOKEN` | Your token from Supabase dashboard → Account → Access Tokens |

Push any change to `supabase/functions/**` and functions deploy automatically.

### Or deploy manually via terminal:
```bash
npx supabase@latest functions deploy payments --project-ref rnplqhlwvnqrghrjvylx
npx supabase@latest functions deploy callback --project-ref rnplqhlwvnqrghrjvylx
```

---

## 5 — Set Edge Function Secrets

In Supabase Dashboard → Edge Functions → Manage Secrets:

```
BUNI_ENV=sandbox
BUNI_CLIENT_ID=your_kcb_client_id
BUNI_CLIENT_SECRET=your_kcb_client_secret
BUNI_SHORTCODE=your_shortcode
BUNI_PASSKEY=your_passkey

STANBIC_ENV=sandbox
STANBIC_CLIENT_ID=your_stanbic_client_id
STANBIC_CLIENT_SECRET=your_stanbic_client_secret
STANBIC_ACCOUNT_NO=your_stanbic_account
```

---

## 6 — Notify KCB Buni (Charles Murage)

The callback URL has changed. Send this to Charles Murage:

```
Callback URL:  https://rnplqhlwvnqrghrjvylx.supabase.co/functions/v1/callback
Payments URL:  https://rnplqhlwvnqrghrjvylx.supabase.co/functions/v1/payments
```

The callback handles all types automatically via `?type=` query parameter:
- `?type=buni_stk`     — STK push result
- `?type=buni_b2b`     — B2B paybill/till result
- `?type=buni_b2c`     — B2C send money result
- `?type=pesalink`     — Stanbic PesaLink result

---

## 7 — Go live checklist

- [ ] SQL schema runs without errors
- [ ] Vercel env vars set and build passes
- [ ] Edge functions deployed
- [ ] Edge function secrets set
- [ ] KCB Buni notified of new callback URL
- [ ] Test payment end-to-end in sandbox
- [ ] Change `BUNI_ENV=production` and `STANBIC_ENV=production`
- [ ] Super admin: `diondickson3@gmail.com` → go to `/admin`

---

## File Structure

```
ShieldPay/
├── src/
│   ├── App.tsx                          # Router — all routes
│   ├── components/layout/AppLayout.tsx  # Sidebar, topbar, stat cards
│   ├── hooks/useAuth.ts                 # Auth + role + permissions
│   ├── lib/
│   │   ├── types.ts                     # All TypeScript types
│   │   ├── constants.ts                 # Plans, roles, methods config
│   │   └── utils.ts                     # Helpers (fmtKES, dates, etc)
│   ├── integrations/supabase/client.ts  # Supabase client
│   └── pages/
│       ├── Landing.tsx                  # Public landing page
│       ├── auth/
│       │   ├── Auth.tsx                 # Login + register
│       │   └── Onboarding.tsx           # First-time setup flow
│       ├── app/
│       │   ├── Dashboard.tsx            # Home stats + quick actions
│       │   ├── Bills.tsx                # Bill schedule management
│       │   ├── Suppliers.tsx            # Supplier CRUD
│       │   ├── Payments.tsx             # Upcoming / Pending / History
│       │   ├── Team.tsx                 # Team management + roles
│       │   ├── Reports.tsx              # Summary / KRA / Audit
│       │   ├── KRA.tsx                  # Dedicated KRA filing page
│       │   └── Settings.tsx             # Profile / Billing / Workflow
│       └── admin/
│           └── SuperAdmin.tsx           # Super admin panel
└── supabase/
    ├── functions/
    │   ├── payments/index.ts            # Execute KCB Buni / PesaLink
    │   └── callback/index.ts            # Handle all payment callbacks
    └── migrations/
        └── 001_schema.sql               # Complete database schema
```

---

## Adding features in future

| What to add | Where |
|---|---|
| New payment method | Add to `METHOD_CONFIG` in `constants.ts`, handle in `payments/index.ts` |
| New supplier type | Add to `SUPPLIER_TYPE_CONFIG` in `constants.ts`, add fields in `Suppliers.tsx` |
| New report | Add tab in `Reports.tsx` |
| New role | Add to `ROLE_CONFIG` in `constants.ts` + SQL CHECK constraint |
| New industry | Add to `INDUSTRY_CONFIG` in `constants.ts` |
| New notification type | Add case in `AppLayout.tsx` + send from edge function |
| Recurring auto-execute | Add a scheduled Supabase cron function that queries `payment_schedules` |
| Multi-currency | Add `currency` column to `payment_requests`, handle in edge function |
