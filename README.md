# Brosens Family Foundation App

Mobile-first grant management app based on the PRD. This implementation includes:

- Email/password auth with Supabase Auth and profile mapping from `user_profiles`
- Role-based experiences for members, oversight (Tom), manager (Dad), and admin (Brynn)
- Foundation Dashboard with budget tracking, grant status tracker, and historical impact charts
- Personal "My Workspace" with action items, personal budget tracking, voting history, and submitted gifts
- Proposal submission and blind voting engine
- Meeting reveal flow for unmasking votes and confirming decisions
- Admin execution queue for marking approved grants as sent
- Oversight budget settings with annual cycle conventions
- Mandate policy page with Oversight editing and versioned change notifications (acknowledge/flag workflow for non-oversight users)
- API routes backed by real Supabase queries (no in-memory data layer)

## Stack

- Next.js App Router + React + Tailwind CSS
- SWR for real-time-ish UI updates (polling)
- Supabase-ready schema + edge function stub in `supabase/`

## Local setup

1. Install dependencies:

```bash
npm install
```

2. Create environment file:

```bash
cp .env.example .env.local
```

3. Set Supabase keys in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:you@example.com
PUSH_WORKER_SECRET=...
EMAIL_WORKER_SECRET=...
ORG_CATEGORY_WORKER_SECRET=...
GOOGLE_GENERATIVE_AI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
SERPER_API_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
RESEND_API_KEY=...
EMAIL_FROM=...
EMAIL_REPLY_TO=...
APP_BASE_URL=http://localhost:3000
```

4. Run the app:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

## Mobile screenshot checks (Playwright)

1. Install Chromium once:

```bash
npm run test:mobile-screenshots:install
```

2. Capture screenshots for mobile/tablet viewports:

```bash
npm run test:mobile-screenshots
```

3. Optional authenticated route coverage:

```bash
E2E_EMAIL=you@example.com E2E_PASSWORD=your_password npm run test:mobile-screenshots
```

Artifacts are saved under `test-results/` and include no-horizontal-overflow checks for each captured route.

## Supabase schema

- Migration: `/Users/tombrosens/brosens-family-foundation/supabase/migrations/20260211_initial_schema.sql`
- Migration: `/Users/tombrosens/brosens-family-foundation/supabase/migrations/20260211_auth_profile_and_blind_vote_policies.sql`
- Migration: `/Users/tombrosens/brosens-family-foundation/supabase/migrations/20260212_mandate_policy_notifications.sql`
- Migration: `/Users/tombrosens/brosens-family-foundation/supabase/migrations/20260213_push_notifications.sql`
- Migration: `/Users/tombrosens/brosens-family-foundation/supabase/migrations/20260213_email_notifications.sql`
- Migration: `/Users/tombrosens/brosens-family-foundation/supabase/migrations/20260213_frank_deenie_donations.sql`
- Migration: `/Users/tombrosens/brosens-family-foundation/supabase/migrations/20260212_discretionary_vote_choices.sql`
- Edge function stub: `/Users/tombrosens/brosens-family-foundation/supabase/functions/notify-admin/index.ts`

## Push notifications

- Service worker: `/Users/tombrosens/brosens-family-foundation/public/sw.js`
- Subscription/preferences APIs:
  - `/api/notifications/push/subscribe`
  - `/api/notifications/push/unsubscribe`
  - `/api/notifications/push/preferences`
- Delivery worker API:
  - `/api/notifications/push/process` (supports `Authorization: Bearer $PUSH_WORKER_SECRET`)

## Email notifications

- Notification queue + retries:
  - `/api/notifications/email/process` (supports `Authorization: Bearer $EMAIL_WORKER_SECRET`)
- Weekly action reminders:
  - `/api/notifications/email/reminders` — GET (Vercel cron) or POST (manual). Auth: `Authorization: Bearer $EMAIL_WORKER_SECRET` or `Bearer $CRON_SECRET`.
  - Cron schedule: `vercel.json` runs this endpoint **hourly** (`0 * * * *` UTC). The app time-gates in America/New_York: **intro** (one-off Feb 16 9am ET), **Tuesday 10am ET** weekly reminders, **daily 10am ET** proposal-sent digest. Set `CRON_SECRET` in Vercel (e.g. same value as `EMAIL_WORKER_SECRET`) so cron requests are authorized.
- Device-aware email links:
  - `/open?to=/target/path` routes mobile users to `/mobile` and desktop users to the web target

## Organization categorization

- Category worker:
  - `/api/organizations/categories/process` (supports `Authorization: Bearer $ORG_CATEGORY_WORKER_SECRET`)
- NTEE-style broad categories used in the app:
  - Arts, Culture & Humanities
  - Education
  - Environment & Animals
  - Health
  - Human Services
  - International & Foreign Affairs
  - Public & Societal Benefit
  - Other
- Categorization strategy:
  - rules first
  - Gemini fallback (`GOOGLE_GENERATIVE_AI_API_KEY`, optional `GEMINI_MODEL`)
  - optional Serper enrichment (`SERPER_API_KEY`)
  - optional OpenAI fallback (`OPENAI_API_KEY`, optional `OPENAI_MODEL`)

## PRD rule mapping (implemented)

- 75/25 split: budget settings and dashboard visualized
- Blind voting: masked amounts and vote visibility until user submits own vote
- Discretionary voting: non-proposers mark Acknowledged or Flag for Discussion, with final Oversight approve/reject logged in Meeting
- Proposed amount on submission: discretionary uses proposer-set final amount, joint uses it as vote guidance
- Meeting reveal stage: explicit reveal/mask controls before decision logging
- Admin execution cue: approved proposals appear in Brynn queue
- Annual cycle milestones: Jan review, Feb reset convention, Dec 31 year-end messaging
