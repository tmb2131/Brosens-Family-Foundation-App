# CLAUDE.md — Brosens Family Foundation App

## Project Overview

Mobile-first grant management platform for the Brosens Family Foundation. Members submit grant proposals, vote on them (blind voting), track budgets with 75/25 allocation splits, and manage foundation governance through versioned mandate policies.

## Tech Stack

- **Framework:** Next.js 15.3 with App Router, React 19, TypeScript 5.7 (strict mode)
- **UI Components:** shadcn/ui (copy-paste components built on Radix UI primitives)
- **Styling:** Tailwind CSS 4 with CSS-first config (`@theme`, `@variant`), HSL color space, dark mode via `next-themes`
- **Primitives:** Radix UI (via shadcn/ui) for accessible Dialog, focus trapping, scroll lock
- **Drawer:** vaul (bottom sheet/drawer primitives)
- **Toast:** sonner (toast notifications, bottom-center position)
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
npm run dev              # Start development server (default port)
npm run dev:1            # Start on port 3000
npm run dev:2            # Start on port 3001
npm run dev:3            # Start on port 3002
npm run dev:4            # Start on port 3003
npm run dev:test         # Start with test env (NODE_ENV=test, .env.test.local)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint (next/core-web-vitals)
npm run typecheck        # TypeScript strict type checking (tsc --noEmit)
npm run test:mobile-screenshots          # Playwright E2E tests
npm run test:mobile-screenshots:headed   # Playwright with browser UI
npm run test:mobile-screenshots:install  # Install Chromium for Playwright
npm run supabase         # Supabase CLI passthrough (npx supabase)
npm run db:push          # Apply pending migrations to Supabase
npm run db:push:dry-run  # Preview pending migrations without applying
npm run digest-preview   # Preview today's daily email digest (requires .env.local)
```

### CI Pipeline (.github/workflows/ci.yml)

Runs on push/PR to `main`: `typecheck` → `lint` → `build` (Node 20).

Always run `npm run typecheck` and `npm run lint` before committing to catch issues early.

### Vercel Cron Jobs (vercel.json)

Email reminders run automatically via Vercel cron:
- `POST /api/notifications/email/reminders` — daily at 23:30 UTC
- `POST /api/notifications/email/reminders` — weekly on Tuesdays at 14:30 UTC

## Project Structure

```
app/
  (auth)/              # Unauthenticated pages: login, forgot-password, reset-password
  (app)/               # Protected pages: dashboard, workspace, meeting, reports, etc.
  api/                 # API routes (14 feature groups, ~35 endpoints)
    admin/             auth/            budgets/
    foundation/        frank-deenie/    meeting/
    navigation/        notifications/   organizations/
    policy/            proposals/       settings/
    votes/             workspace/
  open/                # Device-aware redirect handler (mobile vs desktop)

components/
  ui/                  # shadcn/ui primitives (card, badge, dialog, table, button, skeleton,
                       #   drawer, sheet, tabs, switch, select, tooltip, alert, sonner) +
                       #   app wrappers (responsive-modal, metric-card, status-pill, role-pill,
                       #   amount-input, data-table, filter-panel, chart-legend, route-progress-bar)
  auth/                # AuthProvider, Guard component, LastAccessedTouch
  dashboard/           # Charts and dashboard widgets (budget-split, historical-impact, reports-charts)
  voting/              # Voting interface components (vote-form)
  workspace/           # Personal workspace components (personal-budget-bars)
  notifications/       # Push notification components (push-settings-card)
  frank-deenie/        # Donation tracking components (year-split-chart)
  app-shell.tsx        # Full app layout: desktop sidebar + mobile bottom nav, badge polling
  providers.tsx        # Root providers: ThemeProvider, AuthProvider, SWRConfig, TooltipProvider
  dashboard-walkthrough-context.tsx  # Contextual walkthrough guide for Dashboard
  workspace-walkthrough-context.tsx  # Contextual walkthrough guide for Workspace
  pwa-ios-install-banner.tsx         # iOS PWA install prompt banner
  scroll-to-top.tsx                  # Scroll restoration on route change

lib/
  supabase/            # Supabase client configs (browser, server, admin)
  types.ts             # Shared TypeScript types and interfaces
  auth-server.ts       # requireAuthContext(), assertRole(), isVotingRole()
  http-error.ts        # HttpError class, toErrorResponse(), cache header constants
  utils.ts             # General utilities: cn(), currency formatting
  foundation-data.ts   # Foundation data access utilities
  frank-deenie-data.ts # Frank & Deenie donation data access
  policy-data.ts       # Mandate policy data access
  mandate-policy.ts    # Mandate policy business logic
  navigation-summary.ts # Navigation badge counts (getNavigationSummary)
  in-memory-db.ts      # In-memory seeded database for dev/prototype mode
  push-notifications.ts
  email-notifications.ts
  organization-categorization.ts
  charity-navigator.ts # Charity Navigator GraphQL API (EIN lookup, encompass score)
  audit.ts             # Audit log writer (writeAuditLog)
  device-detection.ts  # Mobile/iOS/standalone detection (server + client)
  url-validation.ts    # URL normalization and validation (normalizeOptionalHttpUrl)
  swr-helpers.ts       # SWR invalidation helpers (mutateAllFoundation)
  chart-styles.ts      # Recharts styling utilities

scripts/
  daily-digest-preview.ts  # Preview the daily digest email in the terminal

supabase/
  migrations/          # 22 SQL migration files (schema versioning, date-prefixed)
  functions/           # Edge functions (notify-admin stub)
  config.toml          # Supabase CLI config

tests/                 # Playwright E2E tests (mobile viewports)
public/                # Static assets (icons, favicon), sw.js service worker, manifest
```

## Architecture & Patterns

### App Router Conventions

- Pages under `app/` are **Server Components** by default
- Client components use `"use client"` directive at the top
- Route groups: `(auth)` for public pages, `(app)` for protected pages
- All `(app)` routes are wrapped with `<Guard>` which redirects unauthenticated users to `/login`
- `app/open/route.ts` is a device-aware redirect: reads `User-Agent` + `Sec-CH-UA-Mobile` to send mobile users to `/mobile`, desktop to `/dashboard`

### App Shell

`components/app-shell.tsx` renders the full application chrome:
- **Desktop:** collapsible sidebar (240px open / 64px collapsed), persisted to `localStorage`; Cmd/Ctrl+B keyboard shortcut to toggle
- **Mobile:** fixed bottom nav bar; adapts between focus-nav (Home, Meeting, + New Proposal, Full Details) and full-nav depending on route and role
- **Admin mobile nav:** special two-item nav (Admin Queue, Full Details)
- **Badge counts:** polls `/api/navigation/summary` every 30s; revalidates on every client-side route change
- **Route prefetch:** prefetches all visible nav routes on browser idle

### API Route Patterns

- JSON request/response with status-code-based error handling
- Server auth via `requireAuthContext()` which returns `{ profile, authUserId, admin }`
- Role authorization via `assertRole(profile, allowedRoles)`
- Worker endpoints (push/process, email/process, org categories/process) validate Bearer token secrets
- Custom `HttpError` class and `toErrorResponse()` wrapper for consistent error responses
- Cache header constants in `lib/http-error.ts`: `PRIVATE_CACHE_HEADERS`, `STALE_CACHE_HEADERS`, `DYNAMIC_CACHE_HEADERS`, `STATIC_CACHE_HEADERS`
- `POST` for mutations, `GET` for queries, `PUT` for updates

### Data Access

- **Admin client** (service role key) for server-side elevated operations
- **User client** respects RLS policies for row-level data isolation
- **In-memory DB** (`lib/in-memory-db.ts`) — a seeded, process-global state store used for dev/prototype mode. Exposes the same shape as the real Supabase data
- No ORM — raw SQL via Supabase JS client
- SWR on the client with polling intervals for real-time-ish UI updates

### Authentication Flow

1. Email/password sign-in via Supabase Auth
2. `user_profiles` table maps auth user to app profile (role, name)
3. Roles: `member`, `oversight`, `admin`, `manager`
4. Default role for new users: `member`
5. Session stored in HTTP-only cookies
6. `LastAccessedTouch` component POSTs to `/api/auth/touch` on mount — updates `user_profiles.last_accessed_at` at most every 15 minutes (DB function enforced); triggers a `user_access_notification` email to oversight members

### Database Conventions

- **snake_case** for table and column names
- UUIDs for primary keys (`gen_random_uuid()`)
- Timestamps with timezone (`created_at`, `updated_at` with triggers)
- Enums: `app_role`, `proposal_status`, `proposal_type`, `allocation_mode`, `vote_choice`, `email_notification_type`
- RLS policies on all user-facing tables
- Migrations in `supabase/migrations/` named with date prefix (22 migrations total)
- Apply migrations with `npm run db:push`

### Key Database Tables

| Table | Purpose |
|-------|---------|
| `user_profiles` | Auth user → app profile (role, name, last_accessed_at) |
| `organizations` | Nonprofits with Charity Navigator score, directional category |
| `grants_master` | Reusable grant templates |
| `budgets` | Annual budget (total, joint/discretionary ratios, rollover) |
| `grant_proposals` | Grant proposals with status lifecycle |
| `votes` | Blind votes with allocation amounts and optional flag comments |
| `audit_log` | Immutable audit trail for all mutations |
| `frank_deenie_donations` | Frank & Deenie donation ledger |
| `push_subscriptions` | Web Push subscription endpoints |
| `email_notifications` | Email notification queue |
| `policy_documents` | Versioned mandate policy content |
| `policy_changes` | Policy change diffs with version history |
| `policy_notifications` | Per-user acknowledgement/flag status per policy version |
| `mandate_comments` | Threaded comments on mandate sections with quoted text + offset |

## Coding Conventions

### TypeScript

- Strict mode enabled — no `any` types, explicit null checks required
- Path alias: `@/*` maps to project root (e.g., `@/lib/types`, `@/components/ui/card`)
- Types defined in `lib/types.ts` — use shared types, don't duplicate
- `allowJs: false` — all source must be TypeScript

### Components

- PascalCase for component files and names
- camelCase for variables, functions, hooks
- Styling via Tailwind CSS v4 utility classes (CSS-first config in `app/globals.css`, no JS config file)
- `cn()` utility (clsx + tailwind-merge) from `lib/utils.ts` for conditional class composition with conflict resolution
- shadcn/ui components in `components/ui/` — use these as the base for new UI
- `ResponsiveModal` (`components/ui/responsive-modal.tsx`) wraps Radix Dialog/Drawer for responsive modal/sheet pattern
- Dynamic imports for heavy components (e.g., recharts charts)

### Design Tokens (app/globals.css)

All colors use HSL CSS variables defined in `:root` (light) and `.dark`:
- `--accent` (green, primary CTA), `--surface`, `--card`, `--foreground`, `--muted`, `--border`, `--success`, `--danger`
- Role colors: `--role-member`, `--role-oversight`, `--role-admin`, `--role-manager`
- Proposal CTA: `--proposal-cta` (blue, used for "+ New Proposal" button highlight)

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
- 500 errors: internal details are logged server-side, never exposed to clients
- Client: SWR error states with user-friendly messages
- Never expose internal errors to the client

## Next.js Config (next.config.mjs)

- `reactStrictMode: true`
- `poweredByHeader: false`
- `compress: true`
- `compiler.removeConsole: true` in production (console.* stripped from bundles)
- `experimental.optimizePackageImports`: lucide-react, recharts, @supabase/supabase-js, radix-ui, sonner
- Images: webp + avif formats enabled; SVG allowed with sandbox CSP

## Security

- Middleware (`middleware.ts`) sets security headers on all non-API, non-static routes:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-DNS-Prefetch-Control: on`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Content-Security-Policy` (default-src self, connect-src *.supabase.co, frame-ancestors none)
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- Static asset caching: `Cache-Control: public, max-age=31536000, immutable` for images/fonts
- `poweredByHeader: false` in Next.js config
- RLS policies enforce data isolation at the database level
- Worker endpoints require Bearer token authentication
- Never commit `.env` files — use `.env.local` for local development

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
- `CRON_SECRET` — shared secret for Vercel cron job authentication

### AI / Org categorization
- `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_MODEL` (default: `gemini-2.0-flash`)
- `OPENAI_API_KEY`, `OPENAI_MODEL` (default: `gpt-4o-mini`) — optional fallback
- `SERPER_API_KEY` — optional org enrichment
- `ORG_CATEGORY_WORKER_SECRET`

### Charity Navigator score auto-populate
- `CHARITY_NAVIGATOR_API_KEY` — optional; when set, fetches Charity Navigator encompass score (0-100) via GraphQL for new/edited proposals with a charitynavigator.org profile URL. Requires [developer registration](https://developer.charitynavigator.org/). If unset, score is not auto-populated.

### Test environment
- `DISABLE_EMAIL_CRON=true` — prevents email cron jobs from sending during tests (set in Vercel env for test Supabase project)

## Testing

Playwright is configured for mobile viewport E2E screenshot testing:

- **Viewports:** 360x800, 390x844, 428x926 (phones), 768x1024 (tablet)
- **Test file:** `tests/mobile-screenshots.spec.ts`
- **Routes tested:** /mobile, /dashboard, /workspace, /meeting, /reports, /mandate, /settings, /proposals/new
- **Assertions:** No horizontal overflow, correct nav active state, CTA button state
- **Auth:** Tests use `E2E_EMAIL` and `E2E_PASSWORD` env vars for authenticated flows
- **Test env:** `npm run dev:test` starts a server pointing at the test Supabase project (`.env.test.local`)

Run tests:
```bash
npx playwright install chromium   # First time only
npm run test:mobile-screenshots
```
