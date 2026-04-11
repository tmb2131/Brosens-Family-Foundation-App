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
npm run dev:test         # Start with test env (NODE_ENV=test; env-cmd loads .env.test.local)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # ESLint 9 flat config (eslint.config.mjs → next/core-web-vitals)
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
    admin/             # Admin queue page
    dashboard/         # Foundation dashboard with budget tracking
    frank-deenie/      # Donation tracking for Frank & Deenie
    mandate/           # Mandate policy editor (Oversight role)
    meeting/           # Meeting reveal & decision flow
    mobile/            # Mobile-first home (members)
    proposals/new/     # New proposal submission form
    reports/           # Reports and historical analysis
    settings/          # User preferences and settings
    workspace/         # Personal "My Workspace" dashboard
  api/                 # API routes (16 feature groups, ~45 endpoints)
    admin/             auth/            budgets/
    charity-navigator/ foundation/      frank-deenie/
    health/            meeting/         navigation/
    notifications/     organizations/   policy/
    proposals/         settings/        votes/
    workspace/
  auth/callback/       # Supabase OAuth callback handler
  open/                # Device-aware redirect handler (mobile vs desktop)

components/
  ui/                  # shadcn/ui primitives (card, badge, dialog, table, button, skeleton,
                       #   drawer, tabs, switch, select, tooltip, alert, sonner,
                       #   dropdown-menu, input, label, progress, separator, textarea) +
                       #   app wrappers (responsive-modal, metric-card, status-pill, role-pill,
                       #   amount-input, data-table, filter-panel, chart-legend, route-progress-bar,
                       #   password-input, collapsible-section, theme-toggle, autocomplete-input,
                       #   page-with-sidebar, revalidating-dot)
  auth/                # AuthProvider, Guard component, LastAccessedTouch, ServerAuthSeed
  dashboard/           # Charts and dashboard widgets (budget-split, historical-impact, reports-charts)
  meeting/             # Meeting components (meeting-proposal-card)
  voting/              # Voting interface components (vote-form)
  workspace/           # Personal workspace components (personal-budget-bars, budget-preview-card)
  notifications/       # Push notification components (push-settings-card)
  frank-deenie/        # Donation tracking components (year-split-chart)
  app-shell.tsx        # Full app layout: desktop sidebar + mobile bottom nav, badge polling
  providers.tsx        # Root providers: ThemeProvider, AuthProvider, SWRConfig, TooltipProvider
  charity-giving-history.tsx             # Historical giving display for a charity/org
  dashboard-walkthrough-context.tsx      # Contextual walkthrough guide for Dashboard
  workspace-walkthrough-context.tsx      # Contextual walkthrough guide for Workspace
  mobile-walkthrough-context.tsx         # Contextual walkthrough guide for Mobile
  pwa-ios-install-banner.tsx             # iOS PWA install prompt banner
  scroll-to-top.tsx                      # Scroll restoration on route change

lib/
  supabase/            # Supabase client configs (browser, server, admin)
  hooks/               # Custom hooks: use-draft-persistence, use-charity-navigator-preview,
                       #   use-walkthrough, use-sort
  types.ts             # Shared TypeScript types and interfaces
  auth-server.ts       # requireAuthContext(), assertRole(), isVotingRole()
  http-error.ts        # HttpError class, toErrorResponse(), cache header constants
  utils.ts             # General utilities: cn(), currency formatting, number parsing
  foundation-data.ts   # Foundation data access utilities (proposals, voting, budget, workspace)
  frank-deenie-data.ts # Frank & Deenie donation data access (donations, foundation events, returns)
  policy-data.ts       # Mandate policy data access
  mandate-policy.ts    # Mandate policy business logic (versioning, diffing)
  navigation-summary.ts # Navigation badge counts (getNavigationSummary)
  organization-giving-history.ts  # Historical giving analysis by org
  proposer-display-names.ts       # Proposer name formatting utilities
  perf-logger.ts       # Server-side page performance timing (startPagePerf)
  perf-logger-client.ts # Client-side page performance hooks (usePagePerf)
  push-notifications.ts
  email-notifications.ts
  organization-categorization.ts  # AI-based category assignment (Gemini/OpenAI)
  charity-navigator.ts # Charity Navigator GraphQL API (EIN lookup, encompass score)
  audit.ts             # Audit log writer (writeAuditLog)
  csv.ts               # CSV parsing utilities (parseCsvRows, normalizeHeader)
  device-detection.ts  # Mobile/iOS/standalone detection (server + client)
  url-validation.ts    # URL normalization and validation (normalizeOptionalHttpUrl)
  swr-helpers.ts       # SWR invalidation helpers (mutateAllFoundation)
  chart-styles.ts      # Recharts styling utilities
  export-utils.ts      # CSV/TSV/HTML export helpers and client download utilities

scripts/
  daily-digest-preview.ts          # Preview the daily digest email in the terminal
  fetch-charity-navigator-scores.ts # Bulk fetch Charity Navigator scores for orgs

supabase/
  migrations/          # 32 SQL migration files (schema versioning, date-prefixed)
  functions/           # Edge functions (currently empty)
  config.toml          # Supabase CLI config

tests/                 # Playwright E2E tests (mobile viewports)
public/                # Static assets (icons, favicon), sw.js service worker, manifest
```

## API Routes

All routes under `app/api/`. JSON request/response. `POST` for mutations, `GET` for queries, `PATCH` for partial updates.

### Admin
- `GET /api/admin` — Admin queue data (approved proposals for sending)

### Auth
- `POST /api/auth/logout` — Session termination
- `GET /api/auth/me` — Current user profile
- `GET /api/auth/users` — List users (email autocomplete)
- `POST /api/auth/touch` — Update `last_accessed_at` (rate-limited to 1x per 15 min)
- `POST /api/auth/timezone` — Save user timezone preference

### Budgets
- `GET|POST /api/budgets` — Budget snapshot / create-update annual budget

### Charity Navigator
- `POST /api/charity-navigator/preview` — Score preview for a Charity Navigator URL

### Foundation
- `GET /api/foundation` — Foundation snapshot (proposals, budget, history)
- `GET /api/foundation/pending` — Pending proposals summary
- `GET /api/foundation/history` — Historical giving by year
- `PATCH /api/foundation/proposals/[proposalId]` — Update proposal fields

### Frank & Deenie
- `GET|POST /api/frank-deenie` — Donation ledger list/create
- `PATCH|DELETE /api/frank-deenie/[donationId]` — Update/delete single donation
- `POST /api/frank-deenie/import` — Bulk import donations
- `GET /api/frank-deenie/name-suggestions` — Name autocomplete
- `POST /api/frank-deenie/foundation-events` — Create foundation event (fund/transfer)
- `PATCH|DELETE /api/frank-deenie/foundation-events/[eventId]` — Update/delete foundation event
- `PATCH /api/frank-deenie/children-original` — Update original sent date/amount on Children proposal
- `POST /api/frank-deenie/return` — Record returned check and create replacement

### Health
- `GET /api/health` — Health check (returns `{ status: "ok", timestamp }`)

### Meeting
- `GET|POST /api/meeting` — Meeting proposals / actions (reveal, hide_votes, decision)

### Navigation
- `GET /api/navigation/summary` — Badge counts (to_review, action_items, etc.)

### Notifications
- `POST /api/notifications/push/subscribe` — Web Push subscription
- `POST /api/notifications/push/unsubscribe` — Remove subscription
- `GET|PATCH /api/notifications/push/preferences` — User notification preferences
- `POST /api/notifications/push/process` — Push delivery worker (Bearer token)
- `GET|POST /api/notifications/email/reminders` — Email reminder cron (Vercel, CRON_SECRET)
- `POST /api/notifications/email/process` — Email delivery worker (Bearer token)

### Organizations
- `GET /api/organizations/categories` — List organization categories
- `POST /api/organizations/categories/process` — Category worker (Bearer token)
- `PATCH /api/organizations/[organizationId]/category` — Set category manually
- `GET /api/organizations/giving-history` — Historical giving by org

### Policy
- `GET|PUT /api/policy/mandate` — Mandate policy CRUD
- `POST /api/policy/mandate/comments` — Create mandate comment
- `PATCH /api/policy/mandate/comments/[id]/resolve` — Mark comment resolved
- `GET /api/policy/notifications/summary` — Policy notification status
- `PATCH /api/policy/notifications/[notificationId]` — Acknowledge/flag policy change

### Proposals
- `GET|POST /api/proposals` — List/create proposals
- `GET|PUT|DELETE /api/proposals/draft` — Server-backed new-proposal form draft (per user)
- `GET /api/proposals/titles` — Proposal title autocomplete

### Settings
- `POST /api/settings/charity-navigator-scores` — Bulk score backfill for orgs
- `POST /api/settings/historical-proposals/import` — Bulk import historical proposals

### Votes
- `POST /api/votes` — Submit vote (yes/no for joint, acknowledged/flagged for discretionary)

### Workspace
- `GET /api/workspace` — Personal workspace snapshot (action items, budget, history)

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
- **Mobile:** fixed bottom nav bar; adapts between focus-nav (Home, Meeting, + New Proposal, Dashboard) and full-nav depending on route and role
- **Admin mobile nav:** special two-item nav (Admin Queue, F&D)
- **Badge counts:** polls `/api/navigation/summary` every 30s; revalidates on every client-side route change
- **Route prefetch:** prefetches all visible nav routes on browser idle

### API Route Patterns

- JSON request/response with status-code-based error handling
- Server auth via `requireAuthContext()` which returns `{ profile, authUserId, admin }`
- Role authorization via `assertRole(profile, allowedRoles)`
- Worker endpoints (push/process, email/process, org categories/process) validate Bearer token secrets
- Custom `HttpError` class and `toErrorResponse()` wrapper for consistent error responses
- Cache header constants in `lib/http-error.ts`: `PRIVATE_CACHE_HEADERS`, `STALE_CACHE_HEADERS`, `DYNAMIC_CACHE_HEADERS`
- `POST` for mutations, `GET` for queries, `PATCH` for partial updates, `PUT` for full replacements

### Data Access

- **Admin client** (service role key) for server-side elevated operations
- **User client** respects RLS policies for row-level data isolation
- **Server RPCs** — performance-critical pages use Postgres RPCs (e.g., `get_foundation_page_data()`) to fetch all page data in a single round-trip instead of many sequential queries
- No ORM — raw SQL via Supabase JS client
- SWR on the client with polling intervals for real-time-ish UI updates; client components use `revalidateIfStale: false` to prevent redundant revalidation on mount when fresh data is already present

### Performance Instrumentation

- **Server-side:** `startPagePerf(pageName)` from `lib/perf-logger.ts` tracks server component timing with named steps; outputs via `console.info` (preserved in production)
- **Client-side:** `usePagePerf(pageName, isReady)` from `lib/perf-logger-client.ts` logs mount time, content-ready time, and warns on stalls
- Route-level `loading.tsx` files have been removed — loading states are handled by SWR skeleton patterns in client components

### Layout Patterns

- `PageWithSidebar` (`components/ui/page-with-sidebar.tsx`) — responsive two-column layout (main + sidebar) with variants (`fixed`, `wide-sidebar`, `narrow-sidebar`), breakpoints, sticky sidebar, and collapsible modes. Used on Dashboard, Workspace, Meeting, Frank & Deenie
- `RevalidatingDot` (`components/ui/revalidating-dot.tsx`) — small pulsing indicator shown next to page titles during SWR revalidation when existing data is present
- `AutocompleteInput` (`components/ui/autocomplete-input.tsx`) — accessible combobox with suggestion list and "Add as new" option

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
- Migrations in `supabase/migrations/` named with date prefix (32 migrations total)
- Apply migrations with `npm run db:push`

### Key Database Tables

| Table | Purpose |
|-------|---------|
| `user_profiles` | Auth user → app profile (role, name, last_accessed_at) |
| `organizations` | Nonprofits with Charity Navigator score, directional category |
| `grants_master` | Reusable grant templates |
| `budgets` | Annual budget (total, joint/discretionary ratios, rollover) |
| `grant_proposals` | Grant proposals with status lifecycle |
| `proposal_drafts` | Per-user JSON payload for in-progress new proposal form (cross-device) |
| `proposal_detail_snapshots` | Immutable snapshot of proposal state at submission time |
| `votes` | Blind votes with allocation amounts and optional flag comments |
| `audit_log` | Immutable audit trail for all mutations |
| `frank_deenie_donations` | Frank & Deenie donation ledger (with return tracking) |
| `foundation_events` | Fund-foundation and transfer-to-foundation events |
| `push_subscriptions` | Web Push subscription endpoints |
| `email_notifications` | Email notification queue |
| `policy_documents` | Versioned mandate policy content |
| `policy_changes` | Policy change diffs with version history |
| `policy_notifications` | Per-user acknowledgement/flag status per policy version |
| `mandate_comments` | Threaded comments on mandate sections with quoted text + offset |

### Database Migrations (32 total)

| Migration | Key Changes |
|-----------|-------------|
| `20260211000000_initial_schema` | Core enums, tables: user_profiles, organizations, grants_master, budgets, grant_proposals, votes; proposal_vote_progress view |
| `20260211000001_auth_profile_and_blind_vote_policies` | handle_new_auth_user trigger; RLS for user_profiles and votes |
| `20260212000000_discretionary_vote_choices` | vote_choice enum: `acknowledged`, `flagged` |
| `20260212000001_mandate_policy_notifications` | policy_documents, policy_changes, policy_notifications tables |
| `20260212000002_proposal_sent_at` | sent_at timestamp on grant_proposals |
| `20260213000000_audit_log` | audit_log table (immutable) |
| `20260213000001_email_notifications` | email_notifications table with typed notification kinds |
| `20260213000002_frank_deenie_donations` | frank_deenie_donations table |
| `20260213000003_organization_charity_navigator_url` | charity_navigator_url on organizations |
| `20260213000004_push_notifications` | push_subscriptions, notification_events, notification_delivery tables |
| `20260214000000_organization_directional_category` | directional_category, directional_category_source, directional_category_locked on organizations |
| `20260214000001_ntee_broad_category_rebucket` | Updated NTEE category bucket mapping |
| `20260215000000_email_introduction_type` | introduction email notification type |
| `20260215000001_proposal_detail_snapshots` | proposal_detail_snapshots table |
| `20260217000000_votes_flag_comment` | flag_comment on votes |
| `20260217000001_proposal_vote_progress_security_invoker` | proposal_vote_progress view security update |
| `20260217100000_mandate_comments` | mandate_comments table (threaded, quoted with offsets) |
| `20260217100001_mandate_comment_replies` | parent_id for comment threading |
| `20260217100002_mandate_comment_resolved` | resolved_at, resolved_by_id on mandate_comments |
| `20260218000000_proposal_submitted_confirmation_type` | proposal_submitted_confirmation email type |
| `20260218100000_user_profiles_last_accessed_at` | last_accessed_at on user_profiles |
| `20260219100000_user_access_notification` | user_access_notification email type |
| `20260307000000_frank_deenie_donation_change_notification` | frank_deenie_donation_change email type |
| `20260308000000_mandate_oversight_wording` | In-place wording fix in mandate rolesAndResponsibilities (no new version) |
| `20260318000000_check_returns` | Return tracking: `return_group_id`, `return_role`, `returned_at`, `return_source_id` on frank_deenie_donations; `returned_at`, `return_group_id` on grant_proposals |
| `20260318100000_foundation_events` | `foundation_events` table for fund/transfer events with RLS |
| `20260318200000_available_years_rpc` | RPCs `get_distinct_frank_deenie_years()` and `get_distinct_children_years()` |
| `20260319000000_original_sent_at` | `original_sent_at` on grant_proposals |
| `20260319100000_giving_year_rpcs` | Giving-year RPCs (Feb 1–Jan 31 fiscal year boundaries) |
| `20260322000000_wrap_rls_auth_calls` | Wrap `auth.uid()`/`auth.role()` in `(select ...)` for RLS performance |
| `20260322100000_get_foundation_page_data` | `get_foundation_page_data()` RPC — single round-trip for Dashboard data |
| `20260329100000_proposal_drafts` | `proposal_drafts` table (per-user new-proposal form state) with RLS |

## Coding Conventions

### TypeScript

- Strict mode enabled — no `any` types, explicit null checks required
- Path alias: `@/*` maps to project root (e.g., `@/lib/types`, `@/components/ui/card`)
- Types defined in `lib/types.ts` — use shared types, don't duplicate
- `allowJs: false` — all source must be TypeScript
- ESLint: `eslint.config.mjs` (flat config) extends `next/core-web-vitals` via `@eslint/eslintrc` compat

### Components

- PascalCase for component files and names
- camelCase for variables, functions, hooks
- Styling via Tailwind CSS v4 utility classes (CSS-first config in `app/globals.css`, no JS config file)
- `cn()` utility (clsx + tailwind-merge) from `lib/utils.ts` for conditional class composition with conflict resolution
- shadcn/ui components in `components/ui/` — use these as the base for new UI
- `ResponsiveModal` (`components/ui/responsive-modal.tsx`) wraps Radix Dialog/Drawer for responsive modal/sheet pattern
- Dynamic imports (`next/dynamic` with `ssr: false`) for heavy or interaction-only components (e.g., recharts charts, VoteForm)
- `useDraftPersistence` hook (`lib/hooks/use-draft-persistence.ts`) for saving/restoring form drafts in localStorage (7-day expiry)

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
- `compiler.removeConsole: { exclude: ['info'] }` in production (strips console.* except `console.info` for perf logging)
- `experimental.optimizePackageImports`: lucide-react, recharts, @supabase/supabase-js, radix-ui, sonner
- `experimental.staleTimes.dynamic: 30` — 30s client-side router cache for dynamic pages
- Images: webp + avif formats enabled; SVG allowed with sandbox CSP

## Security

- Middleware (`middleware.ts`) sets security headers on all non-API, non-static routes:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `X-DNS-Prefetch-Control: on`
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
  - `Content-Security-Policy` (default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none')
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
- `E2E_EMAIL`, `E2E_PASSWORD` — credentials for authenticated Playwright test flows
- `PLAYWRIGHT_BASE_URL` — base URL for Playwright tests (defaults to localhost)
- `PLAYWRIGHT_PORT` — port for Playwright test server (default: 4173)
- `PLAYWRIGHT_CHROMIUM_EXECUTABLE` — override Chromium binary path

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
