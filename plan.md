# Plan: Improve Mobile UI

## Summary

The app already has solid mobile-first foundations (safe area support, 44px nav targets, iOS zoom fix, device detection, responsive grids). This plan targets the gaps: inconsistent touch targets, missing mobile data views, bare-bones loading/error states, modal safe-area issues, and form usability on small screens.

---

## Phase 1 — Touch Targets & Interactive Element Consistency

**Goal:** Every tappable element meets the 44px minimum on mobile.

### 1.1 Increase small icon buttons to 44px on mobile
- **Files:** `app/globals.css` (`.sidebar-control-button`), various inline icon buttons
- **Change:** Add `min-h-11 min-w-11` (44px) to icon-only buttons on mobile; keep 32px on desktop via `sm:min-h-8 sm:min-w-8` where space is tight
- **Scope:** Theme toggle, sign-out button in mobile header, sort/filter toggles on dashboard, dropdown toggle on proposals/new

### 1.2 Enlarge segmented control buttons
- **File:** `app/globals.css` (`.segmented-control-button`)
- **Change:** Increase `py-1.5` to `py-2` for better vertical touch area

### 1.3 Increase suggestion dropdown item padding
- **File:** `app/(app)/proposals/new/page.tsx`
- **Change:** Increase suggestion item padding from `py-1.5` to `py-2.5` for easier selection

---

## Phase 2 — Mobile Data Table Alternatives

**Goal:** Replace hidden desktop tables with mobile-friendly card lists.

### 2.1 Create a `MobileProposalCard` component
- **New file:** `components/dashboard/mobile-proposal-card.tsx`
- **Change:** Stacked card layout showing: title, organization, amount, status pill, date — displayed below `md:` breakpoint where the data table is currently hidden
- **Key fields:** Title (bold), org name, amount (large), status pill, submitted date

### 2.2 Wire mobile cards into dashboard
- **File:** `app/(app)/dashboard/page.tsx`
- **Change:** Below `md:` breakpoint, render `MobileProposalCard` list instead of showing nothing; keep the desktop `<table>` for `md:` and up

### 2.3 Add mobile meeting agenda cards
- **File:** `app/(app)/meeting/page.tsx`
- **Change:** The summary card hidden at `sm:block` should have a mobile-friendly alternative — a compact status banner showing meeting date and proposal count

---

## Phase 3 — Loading & Error State Improvements

**Goal:** Replace plain-text loading messages with skeleton loaders and add retry actions to error states.

### 3.1 Create a `Skeleton` UI primitive
- **New file:** `components/ui/skeleton.tsx`
- **Change:** Simple `animate-pulse` rounded div with configurable width/height, consistent with glass-card aesthetic

### 3.2 Add skeleton loaders to key pages
- **Files:** `app/(app)/mobile/page.tsx`, `app/(app)/dashboard/page.tsx`, `app/(app)/workspace/page.tsx`
- **Change:** Replace `"Loading workspace..."` text with skeleton card placeholders (2–3 skeleton cards matching actual card layout)

### 3.3 Add chart loading skeleton
- **File:** `components/dashboard/historical-impact-chart.tsx`
- **Change:** Replace blank `<div className="h-[220px]">` fallback with a skeleton pulse placeholder

### 3.4 Add retry buttons to error states
- **Files:** `app/(app)/mobile/page.tsx`, `app/(app)/workspace/page.tsx`
- **Change:** Add a "Try again" button next to error messages that calls `mutate()` to retry the SWR fetch

---

## Phase 4 — Modal & Overlay Improvements for Notched Devices

**Goal:** Modals and overlays work correctly on phones with notches and home indicators.

### 4.1 Add safe area padding to modal
- **File:** `components/ui/modal.tsx`
- **Change:** Add `pb-[env(safe-area-inset-bottom)]` to the modal content wrapper on mobile; reduce `max-h-[92vh]` to `max-h-[85vh]` to leave room for system chrome

### 4.2 Cap suggestion dropdown height
- **File:** `app/(app)/proposals/new/page.tsx`
- **Change:** Reduce `max-h-64` to `max-h-48` to prevent nested scrolling issues on short phones (360x800)

---

## Phase 5 — Form & Input Refinements

**Goal:** Improve form ergonomics on small mobile screens.

### 5.1 Full-width vote buttons on very small screens
- **File:** `components/voting/vote-form.tsx`
- **Change:** Switch from `grid-cols-2` to stacked `grid-cols-1` on screens below 380px via a container check, or simply add `min-w-[120px]` to prevent text truncation

### 5.2 Improve disabled button visibility
- **File:** `app/globals.css`
- **Change:** Change `disabled:opacity-50` to `disabled:opacity-40` and add a subtle strikethrough or grayscale filter for better outdoor/glare readability

### 5.3 Better error styling with icon
- **Files:** `components/voting/vote-form.tsx`, `app/(app)/proposals/new/page.tsx`
- **Change:** Prefix error messages with a small `AlertCircle` icon from lucide-react and wrap in a lightly tinted `bg-rose-50 dark:bg-rose-900/20 rounded-lg p-2` container for visual distinction from help text

---

## Phase 6 — Chart Responsiveness

**Goal:** Charts render cleanly on all mobile viewport widths.

### 6.1 Add responsive margins and tick formatting
- **File:** `components/dashboard/historical-impact-chart.tsx`
- **Change:** Reduce X-axis tick font size on viewports < 400px; add `angle={-45}` rotation when more than 4 data points; reduce left margin from default to `left: -10` on mobile

---

## Phase 7 — Visual Polish & Micro-interactions

**Goal:** Small refinements that make the mobile experience feel more polished.

### 7.1 Add pull-to-refresh hint on mobile focus page
- **File:** `app/(app)/mobile/page.tsx`
- **Change:** Add a subtle "Pull down to refresh" or a small refresh icon button at the top that triggers `workspaceQuery.mutate()`

### 7.2 Add page transition animations
- **File:** `app/globals.css`
- **Change:** The existing `.page-enter` animation (fade-up 500ms) is good; add a subtle `.page-stack > *` staggered fade for card-by-card entrance

### 7.3 Haptic-style active state on nav items
- **File:** `app/globals.css`
- **Change:** Add `active:scale-95` with `transition-transform duration-75` to `.mobile-nav-link` for tactile button press feedback

---

## Testing & Validation

After each phase:
1. Run `npm run typecheck` and `npm run lint` to catch regressions
2. Run `npm run test:mobile-screenshots` to verify no horizontal overflow and nav state assertions still pass
3. Manually verify on 360x800, 390x844, and 428x926 viewports in browser DevTools

---

## Files Modified (estimated)

| File | Phases |
|------|--------|
| `app/globals.css` | 1, 2, 5, 7 |
| `app/(app)/mobile/page.tsx` | 3, 7 |
| `app/(app)/dashboard/page.tsx` | 2, 3 |
| `app/(app)/workspace/page.tsx` | 3 |
| `app/(app)/meeting/page.tsx` | 2 |
| `app/(app)/proposals/new/page.tsx` | 1, 4 |
| `components/ui/modal.tsx` | 4 |
| `components/ui/skeleton.tsx` | 3 (new) |
| `components/voting/vote-form.tsx` | 5 |
| `components/dashboard/mobile-proposal-card.tsx` | 2 (new) |
| `components/dashboard/historical-impact-chart.tsx` | 3, 6 |

## New Files

- `components/ui/skeleton.tsx` — reusable skeleton loader primitive
- `components/dashboard/mobile-proposal-card.tsx` — mobile card view for proposals
