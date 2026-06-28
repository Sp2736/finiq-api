# final-tasks.md — Total Theme-Compliance Sweep (FinIQ Frontend)
## Zero Hardcoded Colors. Period.

> **Context for Antigravity:** `theme-tasks.md` and `next-steps-to-finish-theme.md` already fixed the theme *engine* (ThemeContext, backend persistence, FOUC, multi-tenant scoping, preview isolation). Assume that work is done and **do not re-touch theme logic, the API, or auth**. This document is a different, narrower, and stricter pass: a **full visual audit** of `finiq` (frontend) that finds and replaces **every single hardcoded color** — hex codes, `rgba()`, and literal Tailwind palette classes (`slate-*`, `gray-*`, `white`, `black`, `rose-*`, `emerald-*`, `amber-*`, `blue-*`, `indigo-*`, etc.) — with the existing `--fin-*` CSS variables defined in `src/app/globals.css`. Nothing decorative, nothing "just a border," nothing "it's just gray so it doesn't matter" is exempt. If a pixel has color, it must come from a `--fin-*` variable.

> **Environment fact you must rely on:** this project uses **Tailwind v4** (`@import "tailwindcss"` + `@theme inline {}` in `globals.css`). Tailwind v4 supports CSS-variable-driven arbitrary values natively: `bg-[var(--fin-table-bg)]`, `text-[var(--fin-muted-text)]`, `border-[var(--fin-border)]`, `shadow-[0_4px_20px_var(--fin-table-shadow)]`, `ring-[var(--fin-input-ring-focus)]`, `fill-[var(--fin-chart-color-1)]`, `divide-[var(--fin-table-row-border)]`. **This is the replacement syntax to use everywhere a literal Tailwind color class currently exists.** Do not invent new color tokens unless explicitly told to in Section 6 — every value needed already exists in `globals.css`, your job is wiring, not invention.

---

## Section 0 — Definitions (read this before changing anything)

These three terms are used throughout the rest of this document and must be applied consistently:

| Term | CSS Variable(s) | Where it applies |
|---|---|---|
| **Primary background** | `--fin-page-bg` (and `--fin-page-bg-subtle` for a slightly recessed page-level panel) | The `<body>`/page wrapper background behind everything — i.e. the area visible around cards, tables, and the sidebar gutter. |
| **Secondary background** | `--fin-table-bg` for desktop table/grid containers and table cells; `--fin-card-bg` for the mobile responsive "card" replacement of a table row; `--fin-table-header-bg` for table header rows/sticky headers | Any white surface that sits *on top of* the primary background to present data: table containers, table rows, table header rows, the mobile card list that responsive layouts swap to below the `lg`/`md` breakpoint, expandable sub-rows, KPI cards (`--fin-kpi-bg`), modal bodies, settings panels (`--fin-settings-section-bg`). **Desktop table and mobile card must visually read as the same "layer" of the UI** — if you ever see `bg-white` used for a table cell on desktop and a different `bg-white` used for the equivalent mobile card, both must resolve to their respective variable so that changing the theme moves both together. |
| **Tertiary / hover-state background** | `--fin-table-row-hover-bg`, `--fin-sidebar-item-hover-bg`, `--fin-btn-ghost-hover-bg`, `--fin-table-expanded-bg`, etc. (each component family already has its own hover variable defined in `globals.css` — use the matching one, never reuse `--fin-page-bg-subtle` as a generic hover color) | Any `hover:bg-slate-50`, `group-hover:bg-[...]`, or expanded/active row tint. |

**Status colors are not arbitrary** — they map to a fixed semantic family already defined in `globals.css`:

| Semantic meaning | Tailwind literal you'll find in code | Variable family to use instead |
|---|---|---|
| Positive / success / gains | `emerald-*`, `green-*` | `--fin-badge-success-*`, `--fin-kpi-positive-text`, `--fin-analysis-positive-*`, `--fin-ribbon-positive`, `--fin-chart-returns-fill` |
| Negative / danger / loss | `rose-*`, `red-*` | `--fin-badge-danger-*`, `--fin-kpi-negative-text`, `--fin-analysis-negative-*`, `--fin-ribbon-negative`, `--fin-sidebar-icon-logout-hover(-bg)` |
| Warning / caution / mid-risk | `amber-*`, `yellow-*` | `--fin-badge-warning-*`, `--fin-analysis-risk-mid-*` |
| Admin role badge | `purple-*`, `indigo-*` (role context only) | `--fin-badge-admin-*` |
| Broker / info role badge | `blue-*`, `sky-*` (role context only) | `--fin-badge-broker-*` |
| Neutral / default badge | `slate-*`, `gray-*` (badge context only) | `--fin-badge-neutral-*` |
| Brand / primary accent | `blue-*`, `indigo-*` (CTA / link / active-state context) | `--fin-brand-*`, or the already-auto-remapped `distributor-*` / `investor-*` Tailwind classes (leave these alone — see Section 1.1) |

When you hit an ambiguous color (e.g. is this `text-slate-500` a "muted body text" or a "table header label"?), resolve it by **matching the nearest existing `--fin-*` variable for that exact UI role** (table header text has its own var, KPI label has its own var, card label has its own var — they are intentionally separate so each can be tuned independently in the theme editor). Never default to a generic var when a more specific one exists for that component family.

---

## Section 1 — Master Replacement Rules

### 1.1 — What NOT to touch (already correctly wired)

Do not change these — they are correct and already theme-reactive via the `@theme inline` remap in `globals.css`:

- Any class using `distributor-{50..950}` or `investor-{50..950}` (e.g. `bg-distributor-600`, `text-investor-700`, `from-distributor-600`, `accent-distributor-600`). These remap to `--fin-brand-*` automatically.
- Anything already written as `var(--fin-...)` (inline `style` props or `[var(--fin-...)]` arbitrary classes).
- `ThemePanel.tsx`'s `DEFAULT_VARS` object (the big object of `"--fin-x": "#hexvalue"` around lines 24–190+). **This is the single source of truth for default values and is correct as hex** — it is what *defines* the variables, not a place consuming them.
- Pure structural/opacity-only utilities with no hue (e.g. `bg-white/0`, `opacity-50`) are fine to leave **only if** the base color before the slash is already a `var(...)` — if the base is `white`/`slate-900`/etc., it still needs fixing (see 1.3 for opacity handling).
- `shadow-[0_4px_20px_rgb(0,0,0,0.03)]`-style **pure black/transparent** shadows with no hue (literal `rgb(0,0,0,...)` or `rgba(0,0,0,...)`) are cosmetically neutral and may stay **unless** a matching `--fin-*-shadow` variable already exists for that component (most do — `--fin-kpi-shadow`, `--fin-table-shadow`, `--fin-card-shadow`, `--fin-modal-shadow`, `--fin-btn-primary-shadow`, etc.). **Prefer the variable over the literal in every case where one exists**, since theme authors may want colored shadows (e.g. a brand-tinted shadow) — only leave a literal black shadow where no variable exists for that exact element and adding one is not warranted.

### 1.2 — Literal Tailwind class → variable mapping (apply by context per Section 0)

This is the exhaustive token list found across the codebase (3,000+ occurrences) and its replacement pattern. `X` = the matching `--fin-*` variable for that component's role, chosen per Section 0.

| Literal class found | Replace with | Typical role |
|---|---|---|
| `bg-white` | `bg-[var(--fin-table-bg)]` / `bg-[var(--fin-card-bg)]` / `bg-[var(--fin-content-surface)]` / `bg-[var(--fin-modal-bg)]` / `bg-[var(--fin-input-bg)]` / `bg-[var(--fin-kpi-bg)]` | Surface backgrounds — pick the variable for the specific component (table, card, modal, input, KPI) |
| `bg-slate-50` | `bg-[var(--fin-table-header-bg)]` / `bg-[var(--fin-page-bg)]` / `bg-[var(--fin-sidebar-item-hover-bg)]` (if it's a hover state) | Secondary surfaces / table headers / page subtle bg |
| `bg-slate-100` / `bg-slate-200` | `bg-[var(--fin-badge-neutral-bg)]` / `bg-[var(--fin-skeleton-base)]` / `bg-[var(--fin-calc-slider-track)]` | Neutral chips, skeleton loaders, slider tracks |
| `bg-slate-300`, `bg-slate-700`, `bg-slate-800`, `bg-slate-900` | `bg-[var(--fin-heading-primary)]` (dark text-on-light contexts) or a dedicated new var if it's a "selected/active dark chip" state — see Section 6.1 | Dark-on-light contrast chips (e.g. active theme card) |
| `border-slate-50/100/200/300/400` | `border-[var(--fin-border-subtle)]` (lightest) or `border-[var(--fin-border)]` (standard) | Borders/dividers — match table vs card vs input border var if a more specific one exists (`--fin-table-row-border`, `--fin-table-border`, `--fin-input-border`, `--fin-card-border`) |
| `divide-slate-50/100/200` | `divide-[var(--fin-table-row-border)]` | Table row dividers |
| `ring-slate-100/200/500/900` | `ring-[var(--fin-input-ring-focus)]` or `ring-[var(--fin-selection-bg)]` | Focus rings / selection rings |
| `text-slate-900` | `text-[var(--fin-heading-primary)]` | Primary headings / strong values |
| `text-slate-800` | `text-[var(--fin-heading-tertiary)]` | Sub-headings |
| `text-slate-700` | `text-[var(--fin-subheading)]` / `text-[var(--fin-table-row-text)]` | Body emphasis / table cell primary text |
| `text-slate-600` | `text-[var(--fin-body-text)]` / `text-[var(--fin-table-row-muted)]` | Standard body text |
| `text-slate-500` | `text-[var(--fin-muted-text)]` / `text-[var(--fin-label-text)]` / `text-[var(--fin-kpi-label)]` / `text-[var(--fin-card-label)]` | Muted/secondary text, field labels — pick the component-specific label var |
| `text-slate-400` | `text-[var(--fin-aux-text)]` / `text-[var(--fin-placeholder-text)]` / `text-[var(--fin-sidebar-collapse-icon-color)]` | Auxiliary text, placeholders, idle icons |
| `text-slate-300` | `text-[var(--fin-aux-text)]` | Faint/disabled text |
| `text-white` | `text-[var(--fin-btn-primary-text)]` / `text-[var(--fin-sidebar-item-active-text)]` / `text-[var(--fin-chart-tooltip-text)]` | Text-on-brand / text-on-dark contexts — pick the matching component var |
| `border-white` / `via-white` / `from-slate-*` / `to-slate-*` gradients | Replace solid edges with the matching surface var; for true gradients, build from two existing vars, e.g. `bg-[linear-gradient(to_bottom,var(--fin-content-surface),var(--fin-page-bg-subtle))]` | Decorative gradients |
| `bg-rose-50` / `text-rose-600/700` / `border-rose-100/200` | `bg-[var(--fin-badge-danger-bg)]` / `text-[var(--fin-badge-danger-text)]` / `border-[var(--fin-badge-danger-border)]` (or `--fin-analysis-negative-*` / `--fin-kpi-negative-text` depending on component) | Negative/loss/danger |
| `bg-emerald-50/100` / `text-emerald-500/600/700/800` / `border-emerald-100/200` | `bg-[var(--fin-badge-success-bg)]` / `text-[var(--fin-badge-success-text)]` / `border-[var(--fin-badge-success-border)]` (or `--fin-analysis-positive-*` / `--fin-kpi-positive-text`) | Positive/gain/success |
| `bg-amber-50/400` / `text-amber-400/500/600/700/900` / `border-amber-100/200` | `bg-[var(--fin-badge-warning-bg)]` / `text-[var(--fin-badge-warning-text)]` / `border-[var(--fin-badge-warning-border)]` (or `--fin-analysis-risk-mid-*`) | Warning/mid-risk |
| `bg-indigo-50/500` / `text-indigo-600/700` / `border-indigo-100/200/600` | `bg-[var(--fin-badge-admin-bg)]` / `text-[var(--fin-badge-admin-text)]` / `border-[var(--fin-badge-admin-border)]` | Admin role badge **only** — if indigo/blue is being used as a generic CTA/link accent instead of a role badge, use `--fin-link-text` / `--fin-brand-600` / the `distributor-*`/`investor-*` classes instead |
| `bg-blue-50/100/200/950` / `text-blue-500/600/700` / `border-blue-200/300/400/500/950` | `bg-[var(--fin-badge-broker-bg)]` / `text-[var(--fin-badge-broker-text)]` / `border-[var(--fin-badge-broker-border)]` | Broker role badge **only** (same caveat as above for non-badge usage — true brand accents should use `--fin-brand-*`, not be hardcoded blue) |
| `text-red-500/600/700` / `bg-red-50` | Same as rose mapping above — `--fin-badge-danger-*` family | Danger (some files use `red-*` instead of `rose-*` inconsistently — normalize both to the danger family) |
| `text-teal-600/700` / `bg-teal-50` / `text-sky-600/700` / `bg-sky-50` | `--fin-badge-broker-*` (closest existing family) or a dedicated new "info" family if these are used distinctly from blue broker badges — flag for confirmation, otherwise fold into broker/info | Misc info accents |
| `text-purple-600/700` / `bg-purple-50` | `--fin-badge-admin-*` | Admin (purple is a duplicate of indigo usage — normalize) |
| `text-white-600` (typo class, renders nothing in Tailwind) | Fix the typo — determine intended color from surrounding context and replace with the correct var | **Bug**, not just a theming gap — found once, locate and correct |
| `accent-distributor-600` etc. on `<input type="range">` | Leave the `accent-*` class as-is (auto-remaps). Fix the **track** background (`bg-slate-200`) to `bg-[var(--fin-calc-slider-track)]` | Calculator sliders |
| `shadow-slate-900/20`, `shadow-slate-900/30`, `shadow-slate-300/60`, `shadow-blue-500/15` | Replace with the matching `--fin-*-shadow` variable, e.g. `shadow-[0_8px_24px_var(--fin-modal-shadow)]` or `shadow-[0_4px_16px_var(--fin-btn-primary-shadow)]` | Colored shadows |
| `bg-[#9be4ff1b]` (literal arbitrary hex) | New variable — see Section 6.2 | Expanded table row highlight |
| `bg-[#f8fafc]` (literal arbitrary hex, duplicate of `--fin-page-bg-subtle`) | `bg-[var(--fin-page-bg-subtle)]` | Group-hover table cell state |
| `text-[#8b5cf6]`, `text-[#7c3aed]` (literal arbitrary hex, violet) | `text-[var(--fin-badge-admin-text)]` (closest existing semantic match) or new var if this is a distinct "premium/special" indicator — confirm intent, then wire to a variable either way | One-off accent text |

### 1.3 — Opacity-suffixed classes (`bg-white/80`, `bg-white/20`, `text-white/60`, `border-slate-200/60`, etc.)

Tailwind v4 arbitrary values support the same opacity-modifier syntax on `var()`-based colors **only if the variable is a plain hex/rgb, not itself already an `rgba()` string** — check each variable. For variables defined as solid hex (most of them), you can do:

```
bg-white/80   →   bg-[var(--fin-sidebar-bg)]/80      (if --fin-sidebar-bg is solid hex, the /80 modifier works directly)
```

For variables that are **already** `rgba(...)` (e.g. `--fin-sidebar-footer-bg: rgba(255,255,255,0.50)`), do **not** stack a Tailwind opacity modifier on top — just use the variable directly: `bg-[var(--fin-sidebar-footer-bg)]`. Mixing both will double-apply opacity and look wrong. Check `globals.css` before applying the modifier — if uncertain, use `style={{ backgroundColor: 'var(--fin-x)' }}` inline instead of a class, which is always safe regardless of whether the variable is hex or rgba.

---

## Section 2 — File-by-File Audit Checklist

Below is the complete list of every file in `finiq/src` containing literal Tailwind palette color classes, sorted by violation count, generated by a full-codebase scan. **Every single file below must be brought to zero matches** against this verification command before this task is considered complete:

```bash
grep -rEo '\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|placeholder|caret|decoration|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-[0-9]+)?(/[0-9]+)?\b' --include="*.tsx" --include="*.ts" -r src/
```

Work top-to-bottom (highest impact first). For each file, apply Section 1's mapping per the component family it belongs to.

| # | File | Violations | Component family / notes |
|---|---|---|---|
| 1 | `components/distributor/clients/ClientHoldingsView.tsx` | 207 | Desktop+mobile holdings view — tables, KPI strip, and **embedded Recharts charts** (see Section 3) |
| 2 | `components/distributor/clients/FundAnalyticsModal.tsx` | 148 | Modal + chart — apply `--fin-modal-*` and Section 3 chart fixes |
| 3 | `app/distributor/users/page.tsx` | 136 | User management table + role badges — apply badge family mapping precisely (admin/broker/neutral) |
| 4 | `app/distributor/reports/ledger/page.tsx` | 117 | Ledger table/report page |
| 5 | `app/distributor/reports/sips/page.tsx` | 112 | SIPs report table |
| 6 | `app/distributor/reports/systematic-transactions/page.tsx` | 106 | Systematic transactions table |
| 7 | `app/distributor/settings/page.tsx` | 100 | Settings shell (tabs, sections) — apply `--fin-settings-*` |
| 8 | `app/investor/page.tsx` | 95 | Investor dashboard — KPI + ribbon + holdings |
| 9 | `components/investor/MobileFundDetails.tsx` | 92 | Mobile responsive fund card view — must mirror `DesktopFundTable.tsx` surface vars |
| 10 | `app/investor/reports/systematic-transactions/page.tsx` | 84 | Investor systematic transactions table |
| 11 | `components/settings/ThemePickerList.tsx` | 66 | Theme editor chrome — see Section 1.1 caveat and Section 6.1 for the "active card" dark state |
| 12 | `app/(auth)/login/page.tsx` | 62 | Pre-auth page — see Section 4 nuance on auth pages |
| 13 | `components/settings/ThemePanel.tsx` | 59 | **Tailwind classes only** — leave `DEFAULT_VARS` hex object untouched per 1.1; fix surrounding chrome classes |
| 14 | `components/distributor/clients/HoldingsReport.tsx` | 56 | Report table |
| 15 | `components/distributor/Sidebar.tsx` | 50 | Sidebar — most already auto-remaps; fix remaining literal slate/white classes per `--fin-sidebar-*` |
| 16 | `components/distributor/DesktopBrokerageTable.tsx` | 47 | Table — includes the `bg-[#9be4ff1b]` arbitrary hex highlight (Section 6.2) |
| 17 | `components/distributor/BrokerageDashboard.tsx` | 46 | Dashboard shell |
| 18 | `components/investor/MobileHoldings.tsx` | 44 | Mobile card view — mirror desktop holdings vars |
| 19 | `components/distributor/clients/FundStyleBox.tsx` | 41 | Style box visual (likely a 3×3 grid with semantic risk colors) |
| 20 | `components/investor/InvestorSidebar.tsx` | 40 | Sidebar — mirror distributor Sidebar fixes |
| 21 | `components/distributor/clients/FundHoldingDetail.tsx` | 36 | Detail panel |
| 22 | `components/layouts/EmailPasswordForm.tsx` | 35 | Auth form — apply `--fin-input-*` |
| 23 | `components/distributor/MobileBrokerageOverview.tsx` | 34 | Mobile card view |
| 24–25 | `app/{investor,distributor}/calculators/reverse-emi/page.tsx` | 33 each | Calculator + chart (Section 3) |
| 26 | `components/investor/DesktopFundTable.tsx` | 32 | Table |
| 27 | `app/distributor/clients/clients page.tsx` *(note the literal space in filename — confirm this isn't a stray duplicate/typo file vs. `app/distributor/clients/page.tsx` at #41; if duplicate, flag and resolve which is the real route before theming both)* | 30 | Table |
| 28 | `components/distributor/BrokerLedgerTable.tsx` | 28 | Table |
| 29 | `components/distributor/clients/FundPortfolioTab.tsx` | 27 | Tab panel + likely chart |
| 30 | `app/distributor/reports/page.tsx` | 27 | Report index |
| 31 | `app/(auth)/admin-portal/page.tsx` | 27 | Auth page |
| 32 | `app/distributor/overview/page.tsx` | 26 | Overview dashboard |
| 33 | `components/distributor/clients/DesktopClientTable.tsx` | 22 | Table |
| 34–35 | `app/{investor,distributor}/calculators/fd/page.tsx` | 22 each | Calculator + chart |
| 36–37 | `app/{investor,distributor}/calculators/swp/page.tsx` | 21 each | Calculator + chart |
| 38 | `components/distributor/dashboard/MobileContributorList.tsx` | 20 | Mobile card view |
| 39–40 | `app/{investor,distributor}/calculators/stp/page.tsx` | 20 each | Calculator + chart |
| 41 | `app/investor/calculators/mf-returns/page.tsx` | 20 | Calculator + chart |
| 42 | `app/distributor/clients/page.tsx` | 20 | Table (see #27 duplicate-file note) |
| 43 | `app/distributor/calculators/mf-returns/page.tsx` | 20 | Calculator + chart |
| 44–45 | `app/{investor,distributor}/calculators/goal/page.tsx` | 19 each | Calculator + chart |
| 46 | `app/distributor/calculators/page.tsx` | 19 | Calculator index/nav |
| 47 | `components/layouts/OTPVerificationForm.tsx` | 18 | Auth form |
| 48 | `components/distributor/GlobalBrokerageStats.tsx` | 18 | Stats ribbon |
| 49 | `components/distributor/dashboard/DesktopContributorTable.tsx` | 16 | Table |
| 50 | `app/(auth)/distributor-portal/page.tsx` | 16 | Auth page |
| 51 | `components/distributor/clients/MobileClientList.tsx` | 15 | Mobile card view |
| 52 | `app/admin/page.tsx` | 14 | Admin page |
| 53 | `components/investor/Badge.tsx` | 12 | **Critical** — this component is reused everywhere; fix once per Section 5 below, propagates everywhere |
| 54 | `components/settings/ColorPickerGroup.tsx` | 10 | Theme editor chrome |
| 55 | `components/investor/CalculatorNavDropdown.tsx` | 9 | Nav dropdown |
| 56 | `components/settings/ThemePreviewPane.tsx` | 8 | Theme editor chrome — only the outer `border-slate-200` wrapper border needs fixing; internals already correctly scoped |
| 57 | `components/layouts/RoleSelector.tsx` | 8 | Auth component |
| 58 | `app/distributor/page.tsx` | 8 | Dashboard |
| 59 | `components/investor/LogoutButton.tsx` | 6 | Button — apply danger/logout vars |
| 60 | `app/investor/CalculatorsModules.tsx` | 6 | Calculator index |
| 61 | `lib/portfolioExport.ts` | 4 | **PDF/Excel export styling** — these colors render into exported documents, not the live site. Exports are static artifacts (a PDF doesn't re-theme after download), so it is acceptable for export styling to use the **default** brand palette (`--fin-brand-*` default hex values, copy-pasted as literals since exports can't read CSS vars at generation time) rather than being "broken" — but replace ad-hoc one-off hex with the actual default values from `globals.css` so they stay visually consistent with the live default theme. Do not attempt to make PDF exports dynamically theme-aware; flag as out-of-scope-by-design if asked. |
| 62 | `components/layouts/PhoneInputForm.tsx` | 4 | Auth form |
| 63 | `lib/utils.ts` | 3 | Check usage — likely a className-builder helper; verify it's not hardcoding a fallback color silently |
| 64 | `components/investor/GoBackButton.tsx` | 3 | Button |
| 65 | `components/investor/GlobalStatsRibbon.tsx` | 2 | Already mostly correct — only 2 leftover `text-slate-400/80` instances |

**Every file in this list must be edited.** Re-run the verification grep in Section 8 after finishing all files — if it returns anything outside the explicitly-allowed exceptions in Section 1.1, the task is not done.

---

## Section 3 — Chart / Recharts Color Sync (the reported "preview pane chart indicators are not synced" bug)

### 3.1 — Root cause

Recharts accepts plain CSS color strings for `stroke`, `fill`, and style-object color properties. Passing `"var(--fin-chart-color-1)"` as a string **does work and updates live** when the CSS variable changes (confirmed already working correctly for `<Area fill="var(--fin-chart-color-1)" />` in the calculator pages). The bug is that **only the `Area`/`Line` series fills use variables — every other chart element (grid, axis ticks, tooltip cursor, legend text) is still a raw hex string**, so when a theme changes those elements visually freeze while the series colors update, making the chart look "half-synced."

### 3.2 — Every chart file that needs this fix

All 12 calculator pages (both portals × `fd`, `swp`, `stp`, `goal`, `mf-returns`, `reverse-emi`) **plus**:
- `components/distributor/clients/ClientHoldingsView.tsx`
- `components/distributor/clients/FundAnalyticsModal.tsx`
- `components/distributor/clients/FundPortfolioTab.tsx` (if it renders a chart — confirm)
- `components/distributor/GlobalBrokerageStats.tsx` (if it renders a chart — confirm)
- `components/distributor/BrokerageDashboard.tsx` (if it renders a chart — confirm)

### 3.3 — Exact element-by-element fix (apply to every `<AreaChart>`/`<LineChart>`/`<BarChart>`/`<PieChart>` found)

```tsx
<CartesianGrid
  strokeDasharray="3 3"
  vertical={false}
  stroke="var(--fin-chart-grid)"              {/* was: "#f1f5f9" */}
/>
<XAxis
  dataKey="yearLabel"
  tick={{ fontSize: 11, fontWeight: 600, fill: "var(--fin-chart-axis-text)" }}   {/* was: "#64748b" */}
  axisLine={false}
  tickLine={false}
/>
<YAxis
  tick={{ fontSize: 11, fontWeight: 500, fill: "var(--fin-chart-axis-text)" }}   {/* was: "#94a3b8" */}
  axisLine={false}
  tickLine={false}
  label={{
    value: "Wealth Value",
    angle: -90,
    position: "insideLeft",
    style: { fontSize: 11, fill: "var(--fin-chart-axis-text)", fontWeight: 700 },  {/* was: "#64748b" */}
  }}
/>
<Tooltip
  content={<CustomTooltip />}     {/* see 3.4 below — CustomTooltip itself must also be fixed */}
  cursor={{
    stroke: "var(--fin-chart-color-1)",     {/* was: "rgba(61, 96, 171, 0.1)" — if you need the low-opacity look, use style={{ stroke: 'var(--fin-chart-color-1)', strokeOpacity: 0.1 }} instead of baking opacity into the color */}
    strokeWidth: 2,
    fill: "transparent",
  }}
/>
<Legend
  wrapperStyle={{
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--fin-chart-axis-text)",    {/* was: "#64748b" */}
    paddingTop: "20px",
  }}
/>
<Area dataKey="invested" fill="var(--fin-chart-color-1)" stroke="none" />   {/* already correct — leave as-is */}
<Area dataKey="interest" fill="var(--fin-chart-color-4)" stroke="none" />  {/* already correct — leave as-is */}
```

For multi-series charts (e.g. `ClientHoldingsView.tsx` if it has more than 2 series), cycle through `--fin-chart-color-1` through `--fin-chart-color-8` in order — these 8 variables exist precisely to give a full, theme-reactive categorical palette. Never fall back to a hardcoded hex once you run past 2 series.

### 3.4 — Custom Tooltip components

Search every chart file for a `CustomTooltip` (or similarly named) component used as `content={<CustomTooltip />}`. These typically render their own `<div>` with hardcoded `bg-white border border-slate-200 shadow-...` and hardcoded text colors for the label/value rows inside the floating tooltip box. Fix using:

```tsx
<div
  className="rounded-lg p-3"
  style={{
    background: 'var(--fin-chart-tooltip-bg)',
    color: 'var(--fin-chart-tooltip-text)',
    boxShadow: '0 8px 24px var(--fin-modal-shadow)',
  }}
>
  {/* row labels/values inside should also use var(--fin-chart-tooltip-text) at full/reduced opacity, not a second hardcoded color */}
</div>
```

Note `--fin-chart-tooltip-bg` is intentionally a **dark** color by default (`#1e293b`) with light tooltip text (`--fin-chart-tooltip-text: #f8fafc`) — this is a deliberate high-contrast floating-tooltip pattern independent of the page's light/dark surface, and is correct to keep even when other theme colors change, **as long as both values come from the variables** (a theme author can still override both if they want a light tooltip).

### 3.5 — `FundStyleBox.tsx` (the 3×3 risk/style grid)

This component (41 violations) almost certainly hardcodes a grid of cell background colors representing fund style categories (e.g. large/mid/small-cap × value/blend/growth) with literal `bg-slate-100`, `bg-blue-50`, etc. and a highlighted "active" cell. Audit this file specifically:
- Inactive grid cells → `bg-[var(--fin-page-bg-subtle)]` with `border-[var(--fin-border-subtle)]`
- The active/highlighted cell → `bg-[var(--fin-brand-100)]` with `border-[var(--fin-brand-300)]` and a dot/marker in `var(--fin-brand-600)`
- Labels → `text-[var(--fin-muted-text)]`

---

## Section 4 — Canvas-Drawn Decorative Backgrounds

Three files paint animated gradients/waves directly to a `<canvas>` 2D context, where CSS variables **cannot** be passed as literal `ctx.fillStyle` strings the way they can in DOM/SVG attributes — `ctx.fillStyle = "var(--fin-brand-600)"` does **not** work in Canvas 2D; it must be resolved to a real color string first.

**Files:** `components/layouts/FluidBackground.tsx`, `components/layouts/DistributorFluidBackground.tsx`, `components/layouts/InvestorFluidBackground.tsx`

**Fix pattern — add this helper at the top of each file and use it everywhere a hex literal currently exists inside the canvas drawing code:**

```tsx
const getCSSVar = (name: string, fallback: string) => {
  if (typeof window === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
};
```

Then replace every hardcoded stop color:

```tsx
// BEFORE
bgGrad.addColorStop(0, "#ffffff");
bgGrad.addColorStop(1, "#f8fafc");
// ... drawWave(..., "#274C9C", "#BAD8FF", ...)   // DistributorFluidBackground
// ... drawWave(..., "#4f46e5", "#eef2ff", ...)   // InvestorFluidBackground

// AFTER
const pageBg = getCSSVar("--fin-page-bg", "#f8fafc");
const surfaceBg = getCSSVar("--fin-content-surface", "#ffffff");
const brandWave = getCSSVar("--fin-brand-600", "#3d60ab");
const brandTint = getCSSVar("--fin-brand-100", "#e3ecf7");

bgGrad.addColorStop(0, surfaceBg);
bgGrad.addColorStop(1, pageBg);
// ... drawWave(..., brandWave, brandTint, ...)
```

**Important nuance — read this part:** these canvases render on **pre-authentication pages** (`login`, `distributor-portal`, `admin-portal`) where no company/tenant context exists yet, so there is no "active theme" to react to at that point in the user journey — the app doesn't yet know which company's theme to load. It is therefore correct and expected for these backgrounds to use the **static default `--fin-brand-*` values from `:root`** (via `getCSSVar`, which reads whatever is currently on `:root`, which on these pages will be the un-overridden defaults) rather than expecting them to be "company-themed." The fix here is about **removing duplicate hardcoded hex literals and routing through the single source of truth (`globals.css` variables)** — not about making pre-login pages tenant-aware, which is out of scope and not technically meaningful before a tenant is identified.

The login page's inline decorative SVG (`stopColor="#6366f1"` in a gradient `<linearGradient>`, and the `bg-[radial-gradient(#94a3b8_1px,transparent_1px)]` dot-grid texture) should be fixed the same way: replace the literal hex with `var(--fin-brand-600)` / `var(--fin-aux-text)` respectively, directly in the JSX (SVG `stop` elements and inline `style`/arbitrary-class do support `var()` natively, unlike canvas — no JS helper needed there, just swap the literal string).

---

## Section 5 — `components/investor/Badge.tsx` (fix once, fixes everywhere)

Current code hardcodes all four intents:

```tsx
const styles = {
  neutral: 'bg-slate-100 text-slate-600 border-slate-200',
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
  danger: 'bg-rose-50 text-rose-700 border-rose-200/60',
  brand: 'bg-indigo-50 text-indigo-700 border-indigo-200/60'
};
```

Replace with the existing badge variable family from `globals.css` (note `brand` intent maps to the badge-brand vars, not admin/broker — confirm against actual call sites of `<Badge intent="brand">` to make sure this is being used for "primary/brand" badges and not accidentally for admin roles; if it's used for admin roles, use `--fin-badge-admin-*` instead):

```tsx
const styles = {
  neutral: 'bg-[var(--fin-badge-neutral-bg)] text-[var(--fin-badge-neutral-text)] border-[var(--fin-badge-neutral-border)]',
  success: 'bg-[var(--fin-badge-success-bg)] text-[var(--fin-badge-success-text)] border-[var(--fin-badge-success-border)]',
  danger:  'bg-[var(--fin-badge-danger-bg)] text-[var(--fin-badge-danger-text)] border-[var(--fin-badge-danger-border)]',
  brand:   'bg-[var(--fin-badge-brand-bg)] text-[var(--fin-badge-brand-text)] border-[var(--fin-badge-brand-border)]',
};
```

Since `Badge.tsx` is a shared component, this single fix automatically themes every badge instance across the app — search for all `<Badge` usages after this fix to spot-check, but no per-call-site edits should be needed.

Apply the identical pattern to **any other shared/reusable small components** you find during the sweep that build their own internal color-intent maps (toast/notification components, status pills, alert boxes) — search the codebase for the string `intent` or `variant` props with a `Record<string, string>` of Tailwind classes; these are exactly the same pattern as `Badge.tsx` and must be fixed the same way, once, at the source.

---

## Section 6 — New CSS Variables to Add to `globals.css`

Two pieces of context found during the audit aren't covered by any existing variable. Add these to the `:root` block of `globals.css` (placed near their related section) so nothing falls back to a hardcoded literal:

### 6.1 — Theme-editor "active/selected" dark chip (`ThemePickerList.tsx`)

The selected theme card uses a hardcoded `bg-slate-900` / `shadow-slate-900/20` dark-chip treatment to visually distinguish "this is the active theme" regardless of the theme's own colors (this is intentional contrast design, not a mistake — but it must still be variable-driven, not literal, per the user's zero-tolerance rule). Add:

```css
/* ── THEME PICKER (settings UI itself) ───────────── */
--fin-picker-active-card-bg:     #0f172a;
--fin-picker-active-card-shadow: rgba(15, 23, 42, 0.20);
--fin-picker-active-card-text:   #ffffff;
```

Use these in `ThemePickerList.tsx` in place of `bg-slate-900`, `shadow-slate-900/20`, `text-white`.

### 6.2 — Expanded table row highlight (`DesktopBrokerageTable.tsx`'s `bg-[#9be4ff1b]`)

This is a translucent cyan highlight applied to a sticky cell when a hierarchy row is expanded. Add a proper named variable instead of a magic arbitrary hex:

```css
/* add to the TABLES section */
--fin-table-expanded-cell-highlight: rgba(155, 228, 255, 0.10);
```

Replace `bg-[#9be4ff1b]` with `bg-[var(--fin-table-expanded-cell-highlight)]` in `DesktopBrokerageTable.tsx` (and any other file where the same literal `#9be4ff1b` appears — grep for it explicitly since it's distinctive enough to find every copy).

Do not add any other new variables — every other case in this document maps to a variable that already exists in `globals.css`.

---

## Section 7 — Implementation Order

```
STEP 1  — Add the two new variables from Section 6 to globals.css.
STEP 2  — Fix components/investor/Badge.tsx and any other shared intent/variant
          color-map components (Section 5). This removes a large fraction of
          violations across every page that renders a badge.
STEP 3  — Fix components/distributor/Sidebar.tsx and
          components/investor/InvestorSidebar.tsx (visible on every single page,
          highest-leverage fix after Badge).
STEP 4  — Fix the three canvas FluidBackground files (Section 4) — isolated,
          self-contained, no dependency on other steps.
STEP 5  — Fix all 12 calculator chart pages using the Section 3.3 pattern
          (mechanical, identical fix repeated 12 times).
STEP 6  — Fix ClientHoldingsView.tsx, FundAnalyticsModal.tsx, FundPortfolioTab.tsx,
          FundStyleBox.tsx, FundHoldingDetail.tsx (the fund/holdings cluster —
          do these together since they share visual patterns and likely share
          sub-components).
STEP 7  — Fix every remaining desktop *Table.tsx and mobile *List.tsx /
          *Details.tsx / *Overview.tsx component pair together, file-by-file,
          confirming desktop table and its mobile card counterpart resolve to
          the SAME secondary-background variable (--fin-table-bg / --fin-card-bg)
          per Section 0.
STEP 8  — Fix every app/**/page.tsx route file not already covered (reports,
          users, settings, overview, dashboards) using Section 1's mapping.
STEP 9  — Fix the auth-flow files (login, OTP, role selector, email/password
          form, phone input, distributor-portal, admin-portal) — apply
          Section 4's "pre-tenant, default-palette-is-fine" nuance only to
          the canvas/decorative elements; all FORM inputs, buttons, and text
          on these pages still must use --fin-input-* / --fin-btn-* /
          --fin-body-text etc. like any other page (forms are themeable, only
          the ambient decorative canvas gets the static-default exception).
STEP 10 — Fix the Settings/Theme-editor chrome itself
          (ThemePanel.tsx classes — not DEFAULT_VARS, ColorPickerGroup.tsx,
          ThemePickerList.tsx, ThemePreviewPane.tsx) using Section 6.1's new
          variables for the active-card state and standard surface/text
          variables for everything else.
STEP 11 — Resolve the `clients page.tsx` vs `clients/page.tsx` filename
          ambiguity flagged in Section 2, row 27 — confirm with the actual
          Next.js route file (`page.tsx` is the only valid Next.js filename;
          a file literally named "clients page.tsx" with a space cannot be a
          route and is either dead code or a mistakenly-saved duplicate —
          theme it only if it's confirmed to still be imported/used somewhere,
          otherwise delete it to avoid maintaining two copies of the same UI).
STEP 12 — lib/portfolioExport.ts and lib/transactionReportExport.ts — apply
          the Section 2, row 61 nuance (normalize to default palette values,
          do not attempt live theme-reactivity for static exports).
STEP 13 — Run the full verification sweep in Section 8. Fix anything it
          surfaces. Do not stop until it returns zero unexplained matches.
```

---

## Section 8 — Verification (must pass before this task is complete)

Run all of the following from the `finiq` repo root. Every command must return **empty output**, except where a result is explicitly whitelisted below.

```bash
# 1. No literal Tailwind palette color classes anywhere in src/
grep -rEo '\b(bg|text|border|ring|from|to|via|fill|stroke|divide|outline|placeholder|caret|decoration|shadow)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|white|black)(-[0-9]+)?(/[0-9]+)?\b' --include="*.tsx" --include="*.ts" -r src/
# ALLOWED to remain: nothing. If this returns anything, it is a miss.

# 2. No raw hex codes outside globals.css
grep -rEo '#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b' --include="*.tsx" --include="*.ts" -r src/ | grep -v "src/app/globals.css"
# ALLOWED to remain: components/settings/ThemePanel.tsx (DEFAULT_VARS object only —
# verify every remaining hit in this file is inside that object, not in JSX/className)
# and lib/portfolioExport.ts / lib/transactionReportExport.ts (static export styling,
# per Section 2 row 61 nuance — verify the hex values there match the CURRENT default
# --fin-brand-* values in globals.css, not stale/different ones).

# 3. No raw rgba()/rgb() literals outside globals.css and outside the canvas
#    files' resolved-at-runtime getCSSVar() calls
grep -rEo 'rgba?\([0-9, .]+\)' --include="*.tsx" --include="*.ts" -r src/ | grep -v "var("
# ALLOWED to remain: none, once Section 3's cursor-opacity note and Section 4's
# canvas fix are both applied. If FluidBackground*.tsx still show literal rgba
# after the fix, the getCSSVar() helper wasn't wired to every call site — go back
# and finish it.

# 4. No arbitrary bracket hex/rgba color classes
grep -rEo '\b(bg|text|border|ring|shadow|from|to|via|fill|stroke|outline|divide)-\[#[0-9a-fA-F]{3,8}[0-9a-zA-Z]*\]' --include="*.tsx" -r src/
grep -rEo '\b(bg|text|border|ring|shadow|from|to|via|fill|stroke|outline|divide)-\[rgba?\([^]]*\)\]' --include="*.tsx" -r src/
# ALLOWED to remain: nothing.

# 5. Confirm every chart file's hardcoded stroke/fill is gone
grep -rn 'stroke="#\|fill="#\|fill: "#\|color: "#' --include="*.tsx" -r src/app/*/calculators src/components/distributor/clients
# ALLOWED to remain: nothing.
```

### 8.1 — Manual visual QA (do this after the grep sweep passes)

1. In the Settings → Appearance theme editor, create a deliberately extreme test theme: set `--fin-page-bg` to a dark navy, `--fin-table-bg`/`--fin-card-bg` to a near-black charcoal, `--fin-brand-600` to a bright magenta, and all chart colors to high-saturation distinct hues. Activate it.
2. Walk every route in both the **distributor** and **investor** portals at both desktop and mobile breakpoints (resize the browser, don't just rely on one viewport): dashboard/overview, clients/holdings, every report page, every calculator (check the chart specifically), settings, the user management table, and the login/auth screens (just the form chrome — the decorative canvas is exempt per Section 4).
3. **Pass condition:** there should be no surviving white card, light-gray table, or default-blue/slate text/border/badge anywhere. Every single surface, line, label, status pill, and chart element should reflect the extreme test theme. If you spot even one element still showing the old default colors, find its file using the violating literal (search the rendered DOM via browser inspector for the computed background-color hex, then grep the source for any nearby literal class that wasn't caught by Section 8's automated sweep) and fix it the same way as everything else in this document.
4. Revert/delete the test theme once QA passes, or leave it as a saved (non-active) theme for future regression checks.
