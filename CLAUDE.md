# CLAUDE.md — Brosens Family Foundation App

## Project Overview

Mobile-first grant management platform for the Brosens Family Foundation. Members submit grant proposals, vote on them (blind voting), track budgets with 75/25 allocation splits, and manage foundation governance through versioned mandate policies.

## Tech Stack

- **Framework:** Next.js 15.3 with App Router, React 19, TypeScript 5.7 (strict mode)
- **UI Components:** shadcn/ui (copy-paste components built on Radix UI primitives)
- **Styling:** Tailwind CSS 4 with CSS-first config (`@theme`, `@variant`), HSL color space, dark mode via `next-themes`
- **Primitives:** Radix UI (via shadcn/ui) for accessible Dialog, focus trapping, scroll lock
- **Data Fetching:** SWR with polling for near-real-time updates
- **Database:** Supabase (PostgreSQL) with Row-Level Security (RLS)
- **Auth:** Supabase Auth (email/password), JWT sessions via cookies
- **Email:** Resend
- **Push Notifications:** Web Push API (`web-push`)
- **AI Services:** Google Gemini 2.0 Flash (primary), OpenAI gpt-4o-mini (fallback) for org categorization
- **Icons:** lucide-react
- **Charts:** recharts
- **Testing:** Playwright (mobile screenshot E2E tests)

## Commands

```bash
npm run dev              # Start development server
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint (next/core-web-vitals)
npm run typecheck        # TypeScript strict type checking (tsc --noEmit)
npm run test:mobile-screenshots          # Playwright E2E tests
npm run test:mobile-screenshots:headed   # Playwright with browser UI
npm run test:mobile-screenshots:install  # Install Chromium for Playwright
```

### CI Pipeline (.github/workflows/ci.yml)

Runs on push/PR to `main`: `typecheck` → `lint` → `build` (Node 20).

Always run `npm run typecheck` and `npm run lint` before committing to catch issues early.

## Project Structure

```
app/
  (auth)/              # Unauthenticated pages: login, forgot-password, reset-password
  (app)/               # Protected pages: dashboard, workspace, meeting, reports, etc.
  api/                 # API routes (14 feature groups, ~32 endpoints)
    admin/             auth/            budgets/
    foundation/        frank-deenie/    meeting/
    navigation/        notifications/   organizations/
    policy/            proposals/       settings/
    votes/             workspace/
  open/                # Device-aware redirect handler

components/
  ui/                  # shadcn/ui primitives (card, badge, dialog, table, button, skeleton) + app wrappers (modal, metric-card, status-pill, etc.)
  auth/                # AuthProvider, Guard component
  dashboard/           # Charts and dashboard widgets
  voting/              # Voting interface components
  workspace/           # Personal workspace components
  notifications/       # Push notification components
  frank-deenie/        # Donation tracking components

lib/
  supabase/            # Supabase client configs (browser, server, admin)
  types.ts             # Shared TypeScript types and interfaces
  foundation-data.ts   # Foundation data access utilities
  push-notifications.ts
  email-notifications.ts
  organization-categorization.ts
  policy-data.ts

supabase/
  migrations/          # 13+ SQL migration files (schema versioning)
  functions/           # Edge functions (stub)

tests/                 # Playwright E2E tests (mobile viewports)
public/                # Static assets, sw.js service worker, manifest
```

## Architecture & Patterns

### App Router Conventions

- Pages under `app/` are **Server Components** by default
- Client components use `"use client"` directive at the top
- Route groups: `(auth)` for public pages, `(app)` for protected pages
- All `(app)` routes are wrapped with `<Guard>` which redirects unauthenticated users to `/login`

### API Route Patterns

- JSON request/response with status-code-based error handling
- Server auth via `requireAuthContext()` which returns `{ profile, authUserId, admin }`
- Role authorization via `assertRole(profile, allowedRoles)`
- Worker endpoints (push/process, email/process, org categories/process) validate Bearer token secrets
- Custom `HttpError` class and `toErrorResponse()` wrapper for consistent error responses
- `POST` for mutations, `GET` for queries, `PUT` for updates

### Data Access

- **Admin client** (service role key) for server-side elevated operations
- **User client** respects RLS policies for row-level data isolation
- No ORM — raw SQL via Supabase JS client
- SWR on the client with polling intervals for real-time-ish UI updates

### Authentication Flow

1. Email/password sign-in via Supabase Auth
2. `user_profiles` table maps auth user to app profile (role, name)
3. Roles: `member`, `oversight`, `admin`, `manager`
4. Default role for new users: `member`
5. Session stored in HTTP-only cookies

### Database Conventions

- **snake_case** for table and column names
- UUIDs for primary keys (`gen_random_uuid()`)
- Timestamps with timezone (`created_at`, `updated_at` with triggers)
- Enums: `app_role`, `proposal_status`, `proposal_type`, `allocation_mode`, `vote_choice`
- RLS policies on all user-facing tables
- Migrations in `supabase/migrations/` named with date prefix

## Coding Conventions

### TypeScript

- Strict mode enabled — no `any` types, explicit null checks required
- Path alias: `@/*` maps to project root (e.g., `@/lib/types`, `@/components/ui/card`)
- Types defined in `lib/types.ts` — use shared types, don't duplicate
- `allowJs: false` — all source must be TypeScript

### Components

- PascalCase for component files and names
- camelCase for variables, functions, hooks
- Styling via Tailwind CSS v4 utility classes (CSS-first config, no JS config file)
- `cn()` utility (clsx + tailwind-merge) for conditional class composition with conflict resolution
- shadcn/ui components in `components/ui/` — use these as the base for new UI
- Legacy app wrappers: `GlassCard`, `CardLabel`, `CardValue` for glass-morphism card pattern
- `ModalOverlay`/`ModalPanel` wrappers around Radix Dialog for backward-compatible modal API
- Dynamic imports for heavy components (e.g., recharts charts)

### Naming

| Context | Convention | Example |
|---------|-----------|---------|
| Components/Types | PascalCase | `ProposalCard`, `AppRole` |
| Variables/Functions | camelCase | `fetchProposals`, `isLoading` |
| Database columns | snake_case | `created_at`, `full_name` |
| Constants | UPPER_SNAKE_CASE | `PUSH_WORKER_SECRET` |
| API routes | kebab-case dirs | `frank-deenie`, `forgot-password` |

### Error Handling

- API routes: try/catch with `HttpError` and `toErrorResponse()`
- Client: SWR error states with user-friendly messages
- Never expose internal errors to the client

## Environment Variables

### Required for core app
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase public anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase secret service role key
- `APP_BASE_URL` — Application base URL (e.g., `https://brosensfoundation.com`)

### Push notifications
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`
- `PUSH_WORKER_SECRET`

### Email notifications
- `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_REPLY_TO`
- `EMAIL_WORKER_SECRET`

### AI / Org categorization
- `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_MODEL` (default: `gemini-2.0-flash`)
- `OPENAI_API_KEY`, `OPENAI_MODEL` (default: `gpt-4o-mini`) — optional fallback
- `SERPER_API_KEY` — optional org enrichment
- `ORG_CATEGORY_WORKER_SECRET`

## Testing

Playwright is configured for mobile viewport E2E screenshot testing:

- **Viewports:** 360x800, 390x844, 428x926 (phones), 768x1024 (tablet)
- **Test file:** `tests/mobile-screenshots.spec.ts`
- **Routes tested:** /mobile, /dashboard, /workspace, /meeting, /reports, /mandate, /settings, /proposals/new
- **Assertions:** No horizontal overflow, correct nav active state, CTA button state
- **Auth:** Tests use `E2E_EMAIL` and `E2E_PASSWORD` env vars for authenticated flows

Run tests:
```bash
npx playwright install chromium   # First time only
npm run test:mobile-screenshots
```

## Security

- Middleware sets security headers: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`
- `poweredByHeader: false` in Next.js config
- RLS policies enforce data isolation at the database level
- Worker endpoints require Bearer token authentication
- Never commit `.env` files — use `.env.local` for local development
