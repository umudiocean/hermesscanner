# HERMES AI — MOBILE RESPONSIVE AUDIT REPORT v2.0

**Date:** 2026-02-22  
**Scope:** Full spectrum hardening 320px → 1536px | Zero overflow | Zero broken layout

---

## VIEWPORTS TARGETED

| Device | Width | Priority |
|--------|-------|----------|
| iPhone SE (2020) | 320px | P1 |
| iPhone 13 Mini | 375px | P1 |
| iPhone 14/15 | 390px | P1 |
| iPhone 14 Pro Max | 430px | P1 |
| Samsung Galaxy S23 | 412px | P1 |
| iPad Mini | 768px | P2 |
| iPad Air | 820px | P2 |
| Desktop | 1280px–1536px | P3 |

---

## FILES MODIFIED

| File | Changes |
|------|---------|
| `tailwind.config.ts` | xs breakpoint (375px), screens override, safe-area padding/spacing |
| `globals.css` | Scroll containment, iOS Safari fixes, input zoom prevention, reduced-motion |
| `Layout.tsx` | Header GPU acceleration (transform-gpu, will-change-transform) |
| `ScoreGauge.tsx` | SVG viewBox + w-full h-full for responsive scaling |
| `TabCoins.tsx` (MiniSparkline) | SVG viewBox, preserveAspectRatio, responsive class |
| `TabMarket.tsx` | Treasury grid: grid-cols-4 sm:grid-cols-7, min-w responsive |
| `SharePanel.tsx` | max-w-[calc(100vw-2rem)] to prevent overflow |
| `MarketLauncher.tsx` | grid-cols-1 xs:grid-cols-2 lg:grid-cols-5 |
| `TabStocks.tsx` | GUVEN/FIYATLAMA/SINYAL: grid-cols-1 md:grid-cols-3 |
| `ModuleCryptoTradeAI.tsx` | Signal cards: grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 |

---

## PHASE 1 — GLOBAL LAYOUT

### Tailwind Breakpoints
- **xs:** 375px (iPhone 13+)
- **sm:** 640px | **md:** 768px | **lg:** 1024px | **xl:** 1280px | **2xl:** 1536px
- **Safe area:** padding-safe-bottom, padding-safe-top, spacing-safe-bottom

### Scroll Containment (globals.css)
- `html`: overflow-x hidden, -webkit-overflow-scrolling touch, text-size-adjust 100%
- `body`: overflow-x hidden, scrollbar-gutter stable

### iOS Safari Fixes
- `.full-height`: 100dvh + -webkit-fill-available fallback
- Input/select/textarea: font-size max(16px, 1em) — prevents zoom on focus
- Button/a: -webkit-tap-highlight-color transparent, touch-action manipulation
- `.ios-fixed`: transform translateZ(0) for GPU layer
- `prefers-reduced-motion: reduce`: animations/transitions → 0.001ms

---

## PHASE 2 — NAVIGATION

- Header: `transform-gpu will-change-transform` for sticky iOS stability
- Module nav: already has `overflow-x-auto scrollbar-hide` (unchanged)
- Market status/labels: existing `hidden sm:inline` pattern kept

---

## PHASE 3 — TABLES

- TabStocks: Table inside `overflow-x-auto overflow-y-auto max-h-[80vh]` (existing)
- Filter cards: grid-cols-1 md:grid-cols-3 for GUVEN/FIYATLAMA/SINYAL
- Segment filters: flex flex-wrap (unchanged)

---

## PHASE 4 — SVG & GAUGE

### ScoreGauge
- Added `viewBox={0 0 size size}` + `w-full h-full` for container-based scaling

### MiniSparkline (TabCoins)
- Added `viewBox`, `preserveAspectRatio="none"`, `w-full h-auto min-w-0`

---

## GRID FIXES

| Component | Before | After |
|-----------|--------|-------|
| TabMarket Treasury | grid-cols-7 | grid-cols-4 sm:grid-cols-7 |
| MarketLauncher cards | grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 | grid-cols-1 xs:grid-cols-2 lg:grid-cols-5 |
| TabStocks filter cards | grid-cols-3 | grid-cols-1 md:grid-cols-3 |
| ModuleCryptoTradeAI signals | grid-cols-5 | grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 |

---

## SHAREPANEL

- `w-[280px] max-w-[calc(100vw-2rem)]` — prevents overflow on 320px viewport

---

## BUILD STATUS

- **TypeScript:** 0 errors
- **Next.js build:** SUCCESS
- **Linter:** Pass

---

## REMAINING WORK (Future Phases)

1. **PHASE 3 Extended:** Card layout for tables < 768px (StockCard mobile view)
2. **PHASE 5:** TabCalendar grid-cols-4, TabAnalyst grid-cols-8 at 320px
3. **PHASE 6:** System Nabzi / Fear & Greed responsive stack
4. **PHASE 8:** Market Launcher hero card layout refinement
5. **PHASE 10:** Modal full-screen on mobile
6. **PHASE 14:** Playwright responsive test suite

---

## CONSTITUTION ARTICLES (Going Forward)

**ARTICLE 18:** Every layout component must render correctly at 320px minimum.

**ARTICLE 19:** New component PRs must include responsive test coverage for 320px, 375px, 768px, 1280px.

**ARTICLE 20:** iOS Safari is first-class. Touch targets ≥ 44px, fixed elements GPU-accelerated, inputs font-size ≥ 16px.
