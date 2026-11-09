# Down to Earth Investments — Private Investor Portal & Fund Administration

Custom-built investor portal and loan management platform designed specifically for **Down to Earth Investments**.

The system implements a **Progressive Feature MVVM (Model-View-ViewModel)** architecture on the frontend and a **Node.js Microservices Cluster** on the backend.

---

## Architecture Overview

```
                     +---------------------------------------+
                     |    Next.js 14 Web Frontend (MVVM)     |
                     |         http://localhost:3000         |
                     +-------------------+-------------------+
                                         |
                                         | (Reverse Proxy /api/*)
                                         v
                     +---------------------------------------+
                     |         Node.js API Gateway           |
                     |         http://localhost:4000         |
                     +---+-------------------+---------------+
                         |                   |               |
                         v                   v               v
            +--------------------+  +------------------+  +----------------------+
            |    User Service    |  |   Loan Service   |  |  Portfolio Service   |
            |     Port: 4001     |  |    Port: 4002    |  |      Port: 4003      |
            +--------------------+  +------------------+  +----------------------+
            | - Investor Accounts|  | - Land Notes     |  | - Aggregate AUM      |
            | - Token Invites    |  | - APN / Parcels  |  | - Blended Yields     |
            | - Auth & Personas  |  | - Amortization   |  | - Inflow Projections |
            +--------------------+  +------------------+  +----------------------+
```

---

## 1. Frontend Progressive Feature MVVM Structure

Following the `next-feature-architecture` standard, all product routes are kept wafer-thin, and domain logic is encapsulated in isolated feature vertical slices:

```
apps/web/src/
├── app/                                 # Thin App Router page wrappers only
│   ├── (admin)/admin/dashboard/page.tsx # Renders <AdminDashboardView />
│   ├── (admin)/admin/investors/page.tsx # Renders <AdminInvestorsView />
│   ├── (admin)/admin/loans/page.tsx     # Renders <AdminLoansView />
│   ├── (investor)/investor/dashboard/   # Renders <InvestorDashboardView />
│   ├── (investor)/investor/loans/       # Renders <InvestorLoansView />
│   └── page.tsx                         # Persona entry & live switcher
│
└── features/                            # Isolated MVVM Feature Slices
    ├── admin/
    │   ├── dashboard/                   # { model, data, view-models, views, index.ts }
    │   ├── investors/                   # { model, data, view-models, views, index.ts }
    │   └── loans/                       # { model, data, view-models, views, index.ts }
    └── investor/
        ├── dashboard/                   # { model, data, view-models, views, index.ts }
        └── loans/                       # { model, data, view-models, views, index.ts }
```

### The MVVM Chain
Each feature slice implements the strict reactive pipeline:
1. **Model** (`model/*.model.ts`): Pure TypeScript types, validation rules, and domain definitions.
2. **Data** (`data/*.repo.ts`): HTTP I/O calling the Node.js API Gateway, mapping DTOs.
3. **ViewModel** (`view-models/*.vm.ts`): Reactive React hooks managing state, modals, filters, and loading/error states.
4. **Views** (`views/*.view.tsx`): Presentational JSX bound strictly to ViewModel state, styled with Down to Earth brand tokens and Framer Motion transitions.

---

## 2. Node.js Microservices Cluster

| Service | Port | Description & Responsibilities |
| :--- | :--- | :--- |
| **API Gateway** | `4000` | Single entry point. Checks the session, enforces admin vs investor access, limits repeated sign-in attempts, and emails investors after a rate change. |
| **User Service** | `4001` | Accounts, sessions, invites, password reset and change. Owns `services/user-service/data/users.db`. |
| **Loan Service** | `4002` | Notes, land details, rate history, the payment ledger, and the activity log. Owns `services/loan-service/data/loans.db`. |
| **Portfolio Service** | `4003` | Read-only totals for dashboards: collected vs scheduled, late payments, investor income. No database of its own. |

Each service with data keeps its own SQLite file (built into Node 22.5+, no extra install). The SQL lives in each service's `db.mjs` and `server.mjs`, so moving to Postgres for production is a contained change.

### Rules that protect the numbers

* **Fixed-rate changes only affect future payments.** The admin picks the first unpaid payment the new rate applies to and gives a reason. Installments with a recorded payment are locked. The remaining balance is re-amortized over the remaining payments, and the change is kept in the note's rate history.
* **Payments are recorded in order**, one per installment, with amount, date received, method, and reference. A short payment is marked as short. Only the most recent payment can be undone.
* **Every change is logged** with who made it. Admins see the activity log; investors see the rate history and their payments.

---

## 3. Brand Identity & Motion Design

Extracted directly from [Down to Earth Investments](https://downtoearthinvestments.com/):

* **Color Palette**:
  - Primary Sage Teal: `#69a2a5`
  - Deep Bark Neutral: `#443a26`
  - Dark Woodland Slate: `#1c211e`
  - Warm Sand & Stone Backgrounds: `#fbfaf8`, `#f4f1ea`, `#e7e3d8`
  - Forest Yield Accent: `#6a9b7c`
* **Motion & Micro-interactions**:
  - Smooth slide-out drawers for loan amortization schedules and parcel inspection.
  - Staggered entrance animations for executive KPI metric cards.
  - Interactive modal dialogs with spring transitions.
  - Reduced-motion accessibility fallback.

---

## 4. Personas & Demo Accounts

The public source snapshot contains synthetic users, loans, and properties only. Fresh databases seed the fixtures outside `NODE_ENV=production`; a live installation needs a separately provisioned administrator. Sign in locally at `/login`. Every demo account uses the password `LocalDemoOnly2026!` (override with the `DEMO_PASSWORD` env var on the user service). In development, the **Demo account** dropdown fills in the email. Production builds hide the picker by default; set `ENABLE_DEMO_ACCOUNT_PICKER=true` before building a private demo to include it.

| Account | Role | Lands on |
| --- | --- | --- |
| `admin.one@portal.example` | Admin | `/admin/dashboard` |
| `admin.two@portal.example` | Admin | `/admin/dashboard` |
| `investor.one@portal.example` | Investor | `/investor/dashboard` |
| `investor.two@portal.example` | Investor | `/investor/dashboard` |
| `investor.three@portal.example` | Investor | `/investor/dashboard` |

* **Admins** see collected vs scheduled payments, late payments, upcoming payments, all investors, and all notes. They can invite investors (and resend invites), create notes, record or undo payments, and change a note's fixed rate (Notes → pencil icon, or open a note → Change).
* **Investors** see only their own notes, next payment, recent payments, rate history, and schedules. The gateway enforces this; investors get `403` on admin endpoints and `404` on other investors' notes.
* **Invites:** a new investor gets a one-time link (`/onboard/<token>`, valid 7 days) to choose a password. Until then they show as **Invited** and cannot sign in.
* **Passwords:** `/forgot-password` sends a reset link (valid 1 hour, signs out other sessions). Signed-in users can change their password from **Account** (click your name in the sidebar).

Data is saved in the SQLite files above and survives restarts. To go back to the demo data, stop the app and run `pnpm reset-data`.

### Reports and investor pages

* **Reports** (sidebar → Reports) previews a report, downloads it as CSV, or saves it as PDF through the browser's print dialog. Admins get the investor statement, payments received, payment schedule, note register, and investor summary. Investors get their own statement, payments, and schedule; the gateway pins them to their own data.
* **Investor pages** (`/admin/investors/<id>`) show one investor's balance, cash flow, notes, payments, and profile. Switch investors with the searchable name dropdown or the previous/next arrows.

### Email

Set `RESEND_API_KEY` and `MAIL_FROM` on the user service to send real email through Resend. Without them, every message is saved to the `email_outbox` table and printed in the user-service log, and the screens show the invite or reset link so you can pass it on yourself. Set `PORTAL_URL` to the public address used in links (default `http://localhost:3000`).

---

## 5. Quick Start Guide

### Prerequisites
* Node.js `v22.5+` (for the built-in SQLite module)
* `pnpm` (recommended) or `npm`

### Run Integration Verification Tests
```bash
node scripts/test-services.mjs
```

Runs about 50 checks: sign-in, role boundaries, investor data isolation, the payment ledger, rate changes that keep history, data surviving a restart, invites, password reset and change, sign-in limits, and sign-out. It uses throwaway databases, so your data is untouched. Stop `pnpm dev` first, because the test starts its own services on ports 4000–4003.

### Start All Services (Full Cluster + Frontend)
```bash
pnpm dev
# or: node scripts/dev.mjs
```

This will start:
* User Service on `http://localhost:4001`
* Loan Service on `http://localhost:4002`
* Portfolio Service on `http://localhost:4003`
* API Gateway on `http://localhost:4000`
* Next.js Web App on `http://localhost:3000`

Open [http://localhost:3000](http://localhost:3000) in your browser.

