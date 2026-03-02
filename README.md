# OMD Finance Platform

Internal invoice management and timesheet tracking system for OMD Systems.

## Features

- **Multi-team support** — Each team lead manages their own team's timesheets and invoices
- **Timesheet management** — Manual entry or Excel upload
- **One-click invoice generation** — DOCX files matching the WS-Invoice template
- **Expense tracking** — UAH/USD conversion, categories, linked to invoices
- **Inter-company settlements** — Automatic WS/OMD/OM Energy cost allocation
- **Reports** — Monthly summaries, utilization, settlement calculations
- **Role-based access** — Admin, Team Lead, Viewer roles
- **Secure** — Cloudflare Access authentication (email OTP)

## Tech Stack

- **Frontend**: Vanilla JS (no frameworks), Fury Dark Theme CSS
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Hosting**: Cloudflare Pages
- **Auth**: Cloudflare Access (email OTP for @omdsystems.com)
- **PDF**: Browser print (@media print CSS)
- **DOCX**: docx.js library (client-side)
- **Excel**: SheetJS (client-side parsing)

## Setup

### 1. Supabase
1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Run `data/seed.sql` in the SQL Editor
4. Copy Project URL and anon key
5. Update `js/db.js` with your credentials:
   ```javascript
   const SUPABASE_URL = 'https://your-project.supabase.co';
   const SUPABASE_ANON_KEY = 'your-anon-key';
   ```
6. Enable Email OTP in Authentication settings

### 2. GitHub
1. Create private repo on GitHub
2. Push this code
3. Add secrets for Cloudflare deployment:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

### 3. Cloudflare Pages
1. Create account at [cloudflare.com](https://cloudflare.com)
2. Go to Pages → Create project → Connect to GitHub
3. Select the repo, deploy
4. (Optional) Add custom domain

### 4. Cloudflare Access (Security)
1. Go to Zero Trust → Access → Applications
2. Create Application → Self-hosted
3. Application domain: your-pages-url.pages.dev
4. Policy: Allow emails ending in @omdsystems.com
5. Identity providers: One-time PIN

### 5. Initial Data
1. Open the deployed site
2. Login with admin email
3. Go to Settings → add projects, teams, employees
4. Or import from existing timesheet Excel

## Project Structure

```
├── index.html              # SPA entry point
├── css/
│   ├── fury.css            # Fury dark theme
│   └── invoice-print.css   # Print styles for PDF
├── js/
│   ├── app.js              # Router + app controller
│   ├── auth.js             # Supabase auth
│   ├── db.js               # Supabase client
│   ├── pages/
│   │   ├── dashboard.js    # Overview + KPIs
│   │   ├── timesheet.js    # Hour entry / upload
│   │   ├── invoices.js     # Invoice management
│   │   ├── employees.js    # Employee directory
│   │   ├── expenses.js     # Expense tracking
│   │   ├── reports.js      # Reports + settlements
│   │   └── settings.js     # Admin settings
│   └── services/
│       ├── invoice-docx.js # DOCX generation
│       ├── invoice-preview.js # HTML preview
│       ├── timesheet-parser.js # Excel parser
│       ├── numbering.js    # Invoice numbering
│       ├── settlements.js  # Inter-company calc
│       └── export.js       # XLSX export
├── data/
│   └── seed.sql            # Database schema
└── .github/
    └── workflows/
        └── deploy.yml      # CI/CD
```

## Roles

| Role | Permissions |
|------|-------------|
| **admin** | Full access: all teams, settings, user management |
| **lead** | Own team: timesheets, invoices, employees, expenses |
| **viewer** | Read-only: reports and summaries |

## Invoice Format

Generated DOCX invoices match the existing WS-Invoice template:
- 5-table structure (Header, Billing, Items, Totals, Footer)
- Billed to: Woodenshark LLC
- Bank: JSC Universal Bank (IBAN UA, SWIFT UNJSUAUKXXX)
- Terms: 14 days payment, 4% monthly late fee

## License

Private — OMD Systems internal use only.
