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
- Edge function stub: `/Users/tombrosens/brosens-family-foundation/supabase/functions/notify-admin/index.ts`

## PRD rule mapping (implemented)

- 75/25 split: budget settings and dashboard visualized
- Blind voting: masked amounts and vote visibility until user submits own vote
- Discretionary approvals: voted only by non-proposers; unanimous yes auto-approves, any no auto-declines
- Proposed amount on submission: discretionary uses proposer-set final amount, joint uses it as vote guidance
- Meeting reveal stage: explicit reveal/mask controls before decision logging
- Admin execution cue: approved proposals appear in Brynn queue
- Annual cycle milestones: Jan review, Feb reset convention, Dec 31 year-end messaging
