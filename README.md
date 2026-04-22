# Hospital CRM — Prescription Anti-Abuse System

A secure, full-stack Hospital CRM with clinical, pharmacy, and billing modules designed to prevent prescription abuse through QR-authenticated prescriptions, FIFO pharmacy dispensing, and an immutable billing ledger.

## Architecture

```
services/
├── core-api/          Express + Prisma + PostgreSQL backend (port 8080)
└── web/               Next.js 15 + Shadcn UI frontend (port 3000)

infra/
├── terraform/         AWS VPC + EKS + RDS + Redis + KMS
└── k8s/               API gateway + rules engine manifests
```

**Backend:** Express with Helmet, CORS, rate limiting, Zod validation, CSRF protection, and HttpOnly cookie-based auth. Prisma ORM on PostgreSQL with Redis for nonce replay prevention and login throttling.

**Frontend:** Next.js App Router with Tailwind CSS and Shadcn UI. Role-based dashboards (Doctor, Pharmacist, Admin) with server-side route guards (Edge Middleware) and client-side role guards.

## Prerequisites

- [Nix](https://nixos.org/download.html) with flakes enabled, **or** manually install:
  - Node.js 20+
  - pnpm
  - PostgreSQL 16
  - Redis

## Quick Start

### 1. Enter the dev shell

```bash
nix develop
```

This provisions all tooling (Node, pnpm, Postgres, Redis, Prisma engines, JWT keypair) automatically.

### 2. Bootstrap databases

```bash
./scripts/bootstrap.zsh
```

This starts local Postgres + Redis, runs migrations, and seeds sample data.

### 3. Start the backend

```bash
cd services/core-api
pnpm install
pnpm dev
```

The API starts on `http://localhost:8080`. Verify with:

```bash
curl http://localhost:8080/healthz
```

### 4. Start the frontend

```bash
cd services/web
pnpm install
pnpm dev
```

The UI starts on `http://localhost:3000`. API requests are proxied to the backend automatically via the Next.js rewrite in `next.config.ts`.

## Default Dev Credentials

After seeding (`pnpm seed` in `services/core-api`), use the credentials defined in `services/core-api/prisma/seed.ts`.

## Security Posture

| Layer | Control |
|-------|---------|
| Auth tokens | HttpOnly + Secure + SameSite cookies (never localStorage) |
| CSRF | Double-submit cookie pattern on all mutations |
| Passwords | Argon2id with OWASP-recommended parameters |
| Refresh tokens | Rotation with automatic theft detection (reuse revokes chain) |
| HTTP edge | Helmet, strict CSP, HSTS, rate limiting, JSON body 32 KB cap |
| Login throttle | 10 attempts/min per endpoint, sliding window via Redis |
| Input | Zod schemas reject malformed/oversized payloads |
| Database | Prisma parameterized queries; serialized txn around inventory+billing |
| Ledger | DB-level trigger rejects UPDATE/DELETE on `LedgerTransaction`; rows hash-chained |
| QR | RS256 signed; nonce stored in row + Redis SETNX (replay-proof) |
| Network | k8s NetworkPolicies — rules-engine reachable only from api-gateway |
| Pods | non-root, read-only FS, all caps dropped, seccomp RuntimeDefault |
| Storage | RDS + Redis encrypted with KMS CMK; key rotation enabled |

## OAuth Setup (Optional)

Set these in `services/core-api/.env` to enable social login:

```env
GOOGLE_CLIENT_ID=your-id
GOOGLE_CLIENT_SECRET=your-secret
MICROSOFT_CLIENT_ID=your-id
MICROSOFT_CLIENT_SECRET=your-secret
APPLE_CLIENT_ID=your-id
APPLE_CLIENT_SECRET=your-secret
```

Users must be pre-created by an admin — OAuth links to existing accounts only (no self-registration).

## Project Structure

```
services/core-api/
├── prisma/                 Schema, migrations, seed
├── src/
│   ├── auth/               Middleware, sessions, cookies, CSRF, password hashing
│   ├── http/routes/        Express route handlers (auth, prescriptions, billing, etc.)
│   ├── rules/              Business logic (canPrescribe, dispenseAndBill, QR crypto)
│   ├── jobs/               Background tasks (prescription expiry)
│   └── server.ts           Express app assembly

services/web/
├── src/
│   ├── app/
│   │   ├── login/          Login page (credentials + OAuth)
│   │   └── (dashboard)/    Role-based dashboards (doctor, pharmacist, admin)
│   ├── components/         Sidebar, TopNav, RoleGuard, Shadcn UI primitives
│   ├── lib/                API client, auth context, providers
│   └── middleware.ts       Next.js Edge Middleware (route protection)
```

## API Surface

All endpoints are mounted under `/v1`.

- **Auth:** `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/csrf`, `/auth/providers`, `/auth/oauth/:provider`, `/auth/users`
- **Shifts:** `/shifts/clock-in`, `/shifts/clock-out`
- **Doctors:** `/doctors`, `/doctors/:id`
- **Patients:** `/patients`, `/patients/:id`, `/patients/:id/encounters`, `/patients/:id/prescriptions`, `/patients/:id/invoices`
- **Encounters:** `/encounters` (list/create), `/encounters/:id`, `/encounters/:id/end`
- **Drugs:** `/drugs`, `/drugs/:id`, `/drugs/:id/batches`, `/drugs/_/batches/expiring`
- **Prescriptions:** `/prescriptions` (list/create), `/prescriptions/:id`, `/prescriptions/:id/qr`, `/prescriptions/:id/void`
- **Dispensations:** `/dispensations` (list/create), `/dispensations/:id`
- **Billing:** `/billing/invoices`, `/billing/invoices/:id`, `/billing/invoices/:id/payments`, `/billing/invoices/:id/write-off`, `/billing/invoices/:id/ledger`, `/billing/invoices/:id/ledger/verify`, `/billing/claims/:id`
- **Audit:** `/audit` (admin-only)
- **Admin:** `/admin/departments`, `/admin/specialties`, `/admin/drug-classes`, `/admin/users`

## Seed Contents

`prisma/seed.ts` is idempotent and seeds:

- Roles: admin, pharmacist, 2 doctors (both on active shift)
- Clinical dictionaries: departments, specialties, drug classes, specialty-drug authorization links
- Pharmacy inventory: 2 drugs with multiple batches
- Patients: insured and self-pay records
- Clinical flow: recent encounters for prescribing eligibility
- Prescription states: pending, fulfilled, and expired samples
- Billing flow: invoice + insurance claim + hash-chained ledger rows for a fulfilled dispense
