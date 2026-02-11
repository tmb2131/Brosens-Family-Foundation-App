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

## Supabase schema

- Migration: `/Users/tombrosens/brosens-family-foundation/supabase/migrations/20260211_initial_schema.sql`
- Migration: `/Users/tombrosens/brosens-family-foundation/supabase/migrations/20260211_auth_profile_and_blind_vote_policies.sql`
- Edge function stub: `/Users/tombrosens/brosens-family-foundation/supabase/functions/notify-admin/index.ts`

## PRD rule mapping (implemented)

- 75/25 split: budget settings and dashboard visualized
- Blind voting: masked amounts and vote visibility until user submits own vote
- Discretionary proposer auto-yes: applied on proposal creation
- Meeting reveal stage: explicit reveal/mask controls before decision logging
- Admin execution cue: approved proposals appear in Brynn queue
- Annual cycle milestones: Jan review, Feb reset convention, Dec 31 year-end messaging
