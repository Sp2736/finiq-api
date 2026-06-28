# FinIQ Custom Theme Panel — Gemini Implementation Prompt

---

## Project Context

You are implementing a production-grade **Custom Theme Panel** for **FinIQ**, a mutual fund distributor SaaS platform. The stack is:

- **Frontend:** Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Recharts, Framer Motion, Lucide React
- **Backend:** NestJS (TypeScript), PostgreSQL, Redis (cache), JWT auth
- **Frontend repo:** `finiq` (branch: `main`)
- **Backend repo:** `finiq-api` (branch: `master`)

The platform has two user roles that share one UI codebase:
- **Distributor** (`/distributor/*`) — the company's staff. They configure themes.
- **Investor** (`/investor/*`) — the company's clients. They see the theme the distributor set.

The DB already has a `company_themes` table (see schema below). All themes are scoped to `company_id`.

---

## Existing Codebase Patterns You Must Match

### Frontend patterns
- All pages use `"use client"` at the top
- Routing is via Next.js App Router with conventional `page.tsx` / `layout.tsx` files
- Tailwind v4 is used — `@theme inline { }` in `globals.css` defines palette tokens like `--color-distributor-600`
- Current color tokens: `distributor-600`, `distributor-50`, `distributor-700`, `distributor-800`, `distributor-100`, `distributor-300`, `distributor-500`, `distributor-900`, `distributor-950`, `investor-600` etc. These are currently hardcoded in `globals.css` as hex values.
- API calls are made via service files in `src/services/*.service.ts` (plain fetch, no axios)
- Auth cookies are HTTP-only; Next.js proxies API calls to NestJS
- No component library — all UI is handcrafted Tailwind
- Animations use Tailwind's `animate-[fadeIn_0.3s_ease-out]` pattern
- `framer-motion` is available
- lucide-react icons throughout

### Backend patterns
- NestJS modules in `src/modules/<name>/<name>.module.ts`
- Raw `pg` client (TypeORM NOT used) — queries written directly in service files
- JWT extracted from HTTP-only cookie via existing `AuthGuard`
- `company_id` always extracted from JWT payload — never trusted from request body
- All modules registered in `src/app.module.ts`

---

## Database Schema

```sql
-- EXISTING table (do not recreate):
CREATE TABLE public.company_themes (
    id              uuid DEFAULT uuid_generate_v4() NOT NULL,
    company_id      uuid NOT NULL UNIQUE,
    theme_name      varchar(255) DEFAULT 'System Default',
    theme_variables jsonb DEFAULT '{}',
    saved_themes    jsonb DEFAULT '{}',
    distributor_theme jsonb DEFAULT '{}',
    investor_theme    jsonb DEFAULT '{}',
    created_at      timestamptz DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamptz DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE
);
```

**Storage convention:**
- `theme_variables`: flat map of active theme → `{ "--fin-brand-600": "#0ea5e9", "--fin-page-bg": "#f0f9ff", ... }`
- `saved_themes`: `{ "[uuid]": { "id": "...", "name": "Ocean Blue", "variables": {...}, "is_default": false, "created_at": "ISO" }, ... }`
- `theme_name`: name of currently active theme (denormalised)
- When `theme_variables = {}`, the "System Default" theme is active

---

## Complete CSS Variable Catalogue

Add ALL of the following to `src/app/globals.css` inside `:root { }`. These are the **theming layer** — they sit on top of Tailwind.

```css
:root {
  /* ── PAGE FOUNDATION ─────────────────────────────── */
  --fin-page-bg:              #f8fafc;
  --fin-page-bg-subtle:       #f1f5f9;
  --fin-content-surface:      #ffffff;
  --fin-content-surface-alt:  #f8fafc;
  --fin-border:               #e2e8f0;
  --fin-border-subtle:        #f1f5f9;
  --fin-shadow-color:         rgba(0,0,0,0.04);

  /* ── BRAND / PRIMARY PALETTE ────────────────────── */
  --fin-brand-50:   #f0f4fa;
  --fin-brand-100:  #e3ecf7;
  --fin-brand-200:  #cddcf0;
  --fin-brand-300:  #abc5e6;
  --fin-brand-400:  #83a8d9;
  --fin-brand-500:  #658ccb;
  --fin-brand-600:  #3d60ab;
  --fin-brand-700:  #334e8f;
  --fin-brand-800:  #2b4177;
  --fin-brand-900:  #263760;
  --fin-brand-950:  #18223e;

  /* ── SIDEBAR / NAVBAR ────────────────────────────── */
  --fin-sidebar-bg:                    #ffffff;
  --fin-sidebar-bg-opacity:            0.80;
  --fin-sidebar-border:                #e2e8f0;
  --fin-sidebar-brand-logo-from:       #3d60ab;
  --fin-sidebar-brand-logo-to:         #2b4177;
  --fin-sidebar-brand-label:           #3d60ab;
  --fin-sidebar-item-default-text:     #475569;
  --fin-sidebar-item-hover-bg:         #f0f4fa;
  --fin-sidebar-item-hover-text:       #334e8f;
  --fin-sidebar-item-active-bg:        #3d60ab;
  --fin-sidebar-item-active-text:      #ffffff;
  --fin-sidebar-item-active-dot:       #ffffff;
  --fin-sidebar-sub-item-text:         #64748b;
  --fin-sidebar-sub-item-hover-text:   #3d60ab;
  --fin-sidebar-sub-item-hover-bg:     rgba(255,255,255,0.5);
  --fin-sidebar-sub-item-active-bg:    #ffffff;
  --fin-sidebar-sub-item-active-text:  #334e8f;
  --fin-sidebar-sub-item-active-ring:  #e3ecf7;
  --fin-sidebar-group-active-bg:       #f0f4fa;
  --fin-sidebar-group-active-text:     #334e8f;
  --fin-sidebar-footer-bg:             rgba(255,255,255,0.50);
  --fin-sidebar-footer-border:         #f1f5f9;
  --fin-sidebar-icon-settings-hover:   #3d60ab;
  --fin-sidebar-icon-settings-hover-bg:#f0f4fa;
  --fin-sidebar-icon-logout-hover:     #e11d48;
  --fin-sidebar-icon-logout-hover-bg:  #fff1f2;
  --fin-sidebar-collapse-icon-color:   #94a3b8;
  --fin-sidebar-collapse-icon-hover:   #1e293b;
  --fin-sidebar-mobile-backdrop:       rgba(15,23,42,0.20);
  --fin-sidebar-mobile-btn-bg:         #ffffff;
  --fin-sidebar-mobile-btn-border:     #e2e8f0;
  --fin-sidebar-mobile-btn-text:       #475569;
  --fin-sidebar-section-accent:        #658ccb;
  --fin-sidebar-chevron-open:          #3d60ab;
  --fin-sidebar-chevron-closed:        #94a3b8;

  /* ── TYPOGRAPHY ──────────────────────────────────── */
  --fin-heading-primary:    #0f172a;
  --fin-heading-secondary:  #3d60ab;
  --fin-heading-tertiary:   #1e293b;
  --fin-subheading:         #334155;
  --fin-body-text:          #475569;
  --fin-muted-text:         #64748b;
  --fin-aux-text:           #94a3b8;
  --fin-label-text:         #64748b;
  --fin-overline-text:      #94a3b8;
  --fin-placeholder-text:   #94a3b8;
  --fin-link-text:          #3d60ab;
  --fin-link-hover:         #334e8f;

  /* ── KPI CARDS ───────────────────────────────────── */
  --fin-kpi-bg:              #ffffff;
  --fin-kpi-border:          #e2e8f0;
  --fin-kpi-shadow:          rgba(0,0,0,0.04);
  --fin-kpi-label:           #94a3b8;
  --fin-kpi-value-hidden:    #0f172a;
  --fin-kpi-value-revealed:  #3d60ab;
  --fin-kpi-accent-bar:      #658ccb;
  --fin-kpi-icon-bg:         #f0f4fa;
  --fin-kpi-icon-color:      #3d60ab;
  --fin-kpi-hover-bg:        #f0f4fa;
  --fin-kpi-hover-shadow:    rgba(61,96,171,0.08);
  --fin-kpi-positive-text:   #16a34a;
  --fin-kpi-negative-text:   #dc2626;
  --fin-kpi-neutral-text:    #475569;

  /* ── GLOBAL STATS RIBBON ─────────────────────────── */
  --fin-ribbon-bg:            #ffffff;
  --fin-ribbon-bg-opacity:    0.80;
  --fin-ribbon-border:        rgba(226,232,240,0.60);
  --fin-ribbon-divider:       #f1f5f9;
  --fin-ribbon-label:         #94a3b8;
  --fin-ribbon-value:         #0f172a;
  --fin-ribbon-highlight-value: #3d60ab;
  --fin-ribbon-positive:      #16a34a;
  --fin-ribbon-negative:      #dc2626;

  /* ── TABLES ──────────────────────────────────────── */
  --fin-table-bg:             #ffffff;
  --fin-table-border:         #e2e8f0;
  --fin-table-shadow:         rgba(0,0,0,0.04);
  --fin-table-header-bg:      #f8fafc;
  --fin-table-header-text:    #64748b;
  --fin-table-header-border:  rgba(226,232,240,0.80);
  --fin-table-row-bg:         #ffffff;
  --fin-table-row-alt-bg:     #ffffff;
  --fin-table-row-hover-bg:   rgba(248,250,252,0.60);
  --fin-table-row-border:     #f1f5f9;
  --fin-table-row-text:       #334155;
  --fin-table-row-muted:      #64748b;
  --fin-table-sticky-border:  rgba(226,232,240,0.50);
  --fin-table-sticky-shadow:  rgba(0,0,0,0.05);
  --fin-table-expanded-bg:    rgba(248,250,252,0.60);
  --fin-table-expanded-border:#e3ecf7;

  /* ── INFO CARDS (mobile) ──────────────────────────── */
  --fin-card-bg:              #ffffff;
  --fin-card-border:          #e2e8f0;
  --fin-card-shadow:          rgba(0,0,0,0.04);
  --fin-card-hover-shadow:    rgba(61,96,171,0.06);
  --fin-card-header-bg:       #f0f4fa;
  --fin-card-header-text:     #334e8f;
  --fin-card-header-border:   #e3ecf7;
  --fin-card-label:           #94a3b8;
  --fin-card-value:           #0f172a;
  --fin-card-badge-bg:        #f0f4fa;
  --fin-card-badge-text:      #334e8f;

  /* ── BADGES ──────────────────────────────────────── */
  --fin-badge-brand-bg:       #f0f4fa;
  --fin-badge-brand-text:     #334e8f;
  --fin-badge-brand-border:   #e3ecf7;
  --fin-badge-success-bg:     #f0fdf4;
  --fin-badge-success-text:   #15803d;
  --fin-badge-success-border: #bbf7d0;
  --fin-badge-danger-bg:      #fef2f2;
  --fin-badge-danger-text:    #dc2626;
  --fin-badge-danger-border:  #fecaca;
  --fin-badge-warning-bg:     #fffbeb;
  --fin-badge-warning-text:   #d97706;
  --fin-badge-warning-border: #fde68a;
  --fin-badge-neutral-bg:     #f8fafc;
  --fin-badge-neutral-text:   #475569;
  --fin-badge-neutral-border: #e2e8f0;
  --fin-badge-admin-bg:       #faf5ff;
  --fin-badge-admin-text:     #7e22ce;
  --fin-badge-admin-border:   #e9d5ff;
  --fin-badge-broker-bg:      #f0f9ff;
  --fin-badge-broker-text:    #0369a1;
  --fin-badge-broker-border:  #bae6fd;

  /* ── FORM INPUTS ──────────────────────────────────── */
  --fin-input-bg:             #ffffff;
  --fin-input-border:         #e2e8f0;
  --fin-input-border-hover:   #cbd5e1;
  --fin-input-border-focus:   #3d60ab;
  --fin-input-ring-focus:     rgba(61,96,171,0.20);
  --fin-input-text:           #334155;
  --fin-input-placeholder:    #94a3b8;
  --fin-input-disabled-bg:    #f8fafc;
  --fin-input-disabled-text:  #94a3b8;

  /* ── BUTTONS ─────────────────────────────────────── */
  --fin-btn-primary-bg:       #3d60ab;
  --fin-btn-primary-bg-hover: #334e8f;
  --fin-btn-primary-text:     #ffffff;
  --fin-btn-primary-shadow:   rgba(61,96,171,0.20);
  --fin-btn-secondary-bg:     #ffffff;
  --fin-btn-secondary-bg-hover:#f8fafc;
  --fin-btn-secondary-text:   #334155;
  --fin-btn-secondary-border: #e2e8f0;
  --fin-btn-ghost-hover-bg:   #f0f4fa;
  --fin-btn-ghost-hover-text: #334e8f;
  --fin-btn-danger-bg:        #dc2626;
  --fin-btn-danger-text:      #ffffff;

  /* ── MODALS ──────────────────────────────────────── */
  --fin-modal-backdrop:           rgba(15,23,42,0.50);
  --fin-modal-bg:                 #ffffff;
  --fin-modal-border:             #e2e8f0;
  --fin-modal-shadow:             rgba(0,0,0,0.15);
  --fin-modal-header-text:        #0f172a;
  --fin-modal-close-hover:        #ef4444;
  --fin-modal-tab-active-bg:      #f0f4fa;
  --fin-modal-tab-active-text:    #334e8f;
  --fin-modal-tab-active-border:  #3d60ab;
  --fin-modal-tab-idle-text:      #64748b;
  --fin-modal-tab-idle-hover-bg:  #f8fafc;

  /* ── CHARTS ──────────────────────────────────────── */
  --fin-chart-color-1:   #3d60ab;
  --fin-chart-color-2:   #658ccb;
  --fin-chart-color-3:   #83a8d9;
  --fin-chart-color-4:   #10b981;
  --fin-chart-color-5:   #f59e0b;
  --fin-chart-color-6:   #ef4444;
  --fin-chart-color-7:   #8b5cf6;
  --fin-chart-color-8:   #06b6d4;
  --fin-chart-grid:      rgba(226,232,240,0.60);
  --fin-chart-axis-text: #94a3b8;
  --fin-chart-tooltip-bg:   #1e293b;
  --fin-chart-tooltip-text: #f8fafc;
  --fin-chart-invested-fill: rgba(61,96,171,0.15);
  --fin-chart-returns-fill:  rgba(16,185,129,0.15);

  /* ── ANALYSIS BOXES ──────────────────────────────── */
  --fin-analysis-bg:              #f0f4fa;
  --fin-analysis-border:          #e3ecf7;
  --fin-analysis-label:           #334e8f;
  --fin-analysis-value:           #263760;
  --fin-analysis-positive-bg:     #f0fdf4;
  --fin-analysis-positive-border: #bbf7d0;
  --fin-analysis-positive-text:   #15803d;
  --fin-analysis-negative-bg:     #fef2f2;
  --fin-analysis-negative-border: #fecaca;
  --fin-analysis-negative-text:   #dc2626;
  --fin-analysis-neutral-bg:      #f8fafc;
  --fin-analysis-neutral-border:  #e2e8f0;
  --fin-analysis-neutral-text:    #334155;
  --fin-analysis-risk-low-bg:     #f0fdf4;
  --fin-analysis-risk-low-text:   #15803d;
  --fin-analysis-risk-high-bg:    #fef2f2;
  --fin-analysis-risk-high-text:  #dc2626;
  --fin-analysis-risk-mid-bg:     #fffbeb;
  --fin-analysis-risk-mid-text:   #d97706;

  /* ── FILTER BAR ──────────────────────────────────── */
  --fin-filter-bg:                    #ffffff;
  --fin-filter-border:                #e2e8f0;
  --fin-filter-option-active-bg:      #3d60ab;
  --fin-filter-option-active-text:    #ffffff;
  --fin-filter-option-idle-bg:        #ffffff;
  --fin-filter-option-idle-text:      #475569;
  --fin-filter-option-idle-hover-bg:  #f0f4fa;
  --fin-filter-option-idle-hover-text:#334e8f;
  --fin-filter-search-bg:             #ffffff;
  --fin-filter-search-border:         #e2e8f0;
  --fin-filter-search-focus-border:   #3d60ab;
  --fin-filter-search-icon:           #94a3b8;

  /* ── PAGINATION ──────────────────────────────────── */
  --fin-page-btn-active-bg:   #3d60ab;
  --fin-page-btn-active-text: #ffffff;
  --fin-page-btn-idle-bg:     #ffffff;
  --fin-page-btn-idle-text:   #334155;
  --fin-page-btn-idle-border: #e2e8f0;
  --fin-page-btn-hover-bg:    #f0f4fa;
  --fin-page-btn-hover-text:  #334e8f;

  /* ── SETTINGS ─────────────────────────────────────── */
  --fin-settings-tab-active-border: #3d60ab;
  --fin-settings-tab-active-text:   #334e8f;
  --fin-settings-tab-idle-text:     #64748b;
  --fin-settings-tab-hover-bg:      #f0f4fa;
  --fin-settings-section-bg:        #ffffff;
  --fin-settings-section-border:    #e2e8f0;
  --fin-settings-toggle-on-bg:      #3d60ab;
  --fin-settings-toggle-off-bg:     #e2e8f0;
  --fin-settings-toggle-knob:       #ffffff;

  /* ── CALCULATORS ──────────────────────────────────── */
  --fin-calc-card-bg:             #ffffff;
  --fin-calc-card-border:         #e2e8f0;
  --fin-calc-select-bg:           #f0f4fa;
  --fin-calc-select-border:       #e3ecf7;
  --fin-calc-select-text:         #334e8f;
  --fin-calc-select-hover-border: #abc5e6;
  --fin-calc-result-invested-bg:  rgba(61,96,171,0.08);
  --fin-calc-result-returns-bg:   rgba(16,185,129,0.08);
  --fin-calc-result-total-bg:     #3d60ab;
  --fin-calc-result-total-text:   #ffffff;
  --fin-calc-slider-track:        #cddcf0;
  --fin-calc-slider-thumb:        #3d60ab;

  /* ── USER TREE ────────────────────────────────────── */
  --fin-tree-connector-color: #e2e8f0;
  --fin-tree-row-hover-bg:    rgba(248,250,252,0.60);
  --fin-tree-expanded-bg:     #f8fafc;

  /* ── SCROLLBARS ──────────────────────────────────── */
  --fin-scrollbar-track:       rgba(241,245,249,0.50);
  --fin-scrollbar-thumb:       #cbd5e1;
  --fin-scrollbar-thumb-hover: #94a3b8;

  /* ── SKELETON ─────────────────────────────────────── */
  --fin-skeleton-base:      #f1f5f9;
  --fin-skeleton-highlight: #e2e8f0;

  /* ── SELECTION ────────────────────────────────────── */
  --fin-selection-bg:   #e3ecf7;
  --fin-selection-text: #263760;
}
```

Also, critically, **remap the Tailwind palette tokens** in `@theme inline {}` so that ALL existing `bg-distributor-600` etc. classes continue to work and auto-update:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);

  /* Remap distributor palette to fin vars */
  --color-distributor-50:  var(--fin-brand-50);
  --color-distributor-100: var(--fin-brand-100);
  --color-distributor-200: var(--fin-brand-200);
  --color-distributor-300: var(--fin-brand-300);
  --color-distributor-400: var(--fin-brand-400);
  --color-distributor-500: var(--fin-brand-500);
  --color-distributor-600: var(--fin-brand-600);
  --color-distributor-700: var(--fin-brand-700);
  --color-distributor-800: var(--fin-brand-800);
  --color-distributor-900: var(--fin-brand-900);
  --color-distributor-950: var(--fin-brand-950);

  /* Remap investor palette to same fin vars */
  --color-investor-50:  var(--fin-brand-50);
  --color-investor-100: var(--fin-brand-100);
  --color-investor-200: var(--fin-brand-200);
  --color-investor-300: var(--fin-brand-300);
  --color-investor-400: var(--fin-brand-400);
  --color-investor-500: var(--fin-brand-500);
  --color-investor-600: var(--fin-brand-600);
  --color-investor-700: var(--fin-brand-700);
  --color-investor-800: var(--fin-brand-800);
  --color-investor-900: var(--fin-brand-900);
  --color-investor-950: var(--fin-brand-950);

  --color-border: var(--border);
}
```

This is the **key architectural decision**: by remapping `--color-distributor-*` to `var(--fin-brand-*)`, every existing Tailwind class like `bg-distributor-600` automatically reads from the CSS variable, which gets updated at runtime. **You do NOT need to change any existing component class names.** Only new components going forward, and some specific overrides, need explicit `style={{ color: 'var(--fin-...)' }}` props.

---

## What Components Exist and What Must Be Themed

Here is the **exhaustive list** of every component in the codebase and what variables apply to it:

### `src/components/distributor/Sidebar.tsx`
The left navigation sidebar used on all distributor pages. Variables:
- `<aside>` background → `--fin-sidebar-bg` + `--fin-sidebar-bg-opacity`
- `<aside>` right border → `--fin-sidebar-border`
- Logo gradient `from-*` → `--fin-sidebar-brand-logo-from`
- Logo gradient `to-*` → `--fin-sidebar-brand-logo-to`
- "FinIQ" brand text → `--fin-heading-primary`
- "Distributor" label → `--fin-sidebar-brand-label`
- Default nav item text → `--fin-sidebar-item-default-text`
- Hover nav item bg → `--fin-sidebar-item-hover-bg`
- Hover nav item text → `--fin-sidebar-item-hover-text`
- Active nav item bg → `--fin-sidebar-item-active-bg`
- Active nav item text → `--fin-sidebar-item-active-text`
- Active dot indicator → `--fin-sidebar-item-active-dot`
- Group parent active bg (Reports, Calculators) → `--fin-sidebar-group-active-bg`
- Group parent active text → `--fin-sidebar-group-active-text`
- Group chevron open → `--fin-sidebar-chevron-open`
- Group chevron closed → `--fin-sidebar-chevron-closed`
- Sub-item text → `--fin-sidebar-sub-item-text`
- Sub-item hover text → `--fin-sidebar-sub-item-hover-text`
- Sub-item hover bg → `--fin-sidebar-sub-item-hover-bg`
- Sub-item active bg → `--fin-sidebar-sub-item-active-bg`
- Sub-item active text → `--fin-sidebar-sub-item-active-text`
- Sub-item active ring → `--fin-sidebar-sub-item-active-ring`
- Footer bg → `--fin-sidebar-footer-bg`
- Footer border → `--fin-sidebar-footer-border`
- Settings icon hover text → `--fin-sidebar-icon-settings-hover`
- Settings icon hover bg → `--fin-sidebar-icon-settings-hover-bg`
- Logout icon hover text → `--fin-sidebar-icon-logout-hover`
- Logout icon hover bg → `--fin-sidebar-icon-logout-hover-bg`
- Collapse button icon → `--fin-sidebar-collapse-icon-color`
- Collapse button icon hover → `--fin-sidebar-collapse-icon-hover`
- Mobile hamburger button bg/border/text → `--fin-sidebar-mobile-btn-*`
- Mobile backdrop → `--fin-sidebar-mobile-backdrop`

### `src/components/investor/InvestorSidebar.tsx`
Same sidebar structure for the investor portal. "Investor" label instead of "Distributor". Apply identical sidebar variables. The investor sidebar also has a Reports section (no Calculators), download buttons, and a PDF export trigger. Apply sidebar variables there too.

### `src/app/distributor/page.tsx` (Dashboard)
- Layout bg → `--fin-page-bg`
- Page selection highlight → `--fin-selection-bg`, `--fin-selection-text`
- Section heading → `--fin-heading-primary` (e.g. "Good morning,")
- Section heading accent → `--fin-heading-secondary` (e.g. the date/welcome part)
- KPI card bg → `--fin-kpi-bg`
- KPI card border → `--fin-kpi-border`
- KPI card box-shadow → `--fin-kpi-shadow`
- KPI accent bar (left strip) → `--fin-kpi-accent-bar`
- KPI label text → `--fin-kpi-label`
- KPI masked value text → `--fin-kpi-value-hidden`
- KPI revealed value text (on hover) → `--fin-kpi-value-revealed`
- KPI icon container bg → `--fin-kpi-icon-bg`
- KPI icon color → `--fin-kpi-icon-color`
- KPI card hover bg → `--fin-kpi-hover-bg`
- KPI card hover shadow → `--fin-kpi-hover-shadow`
- Positive delta indicators → `--fin-kpi-positive-text`
- Negative delta indicators → `--fin-kpi-negative-text`
- "Top 10 Contributors" section title → `--fin-heading-tertiary`
- Top 10 left accent bar → `--fin-kpi-accent-bar`

### `src/components/distributor/dashboard/DesktopContributorTable.tsx`
- Container bg/border → `--fin-table-bg`, `--fin-table-border`
- Header bg → `--fin-table-header-bg`
- Header text → `--fin-table-header-text`
- Header border → `--fin-table-header-border`
- Row hover → `--fin-table-row-hover-bg`
- Row border → `--fin-table-row-border`
- Row text (investor name) → `--fin-table-row-text`
- Row muted text (AUM value) → `--fin-table-row-muted`
- Rank badge text → `--fin-overline-text`
- View button → `--fin-btn-ghost-hover-bg`, `--fin-btn-ghost-hover-text`

### `src/components/investor/GlobalStatsRibbon.tsx`
- Container bg/border → `--fin-ribbon-bg` + `--fin-ribbon-bg-opacity`, `--fin-ribbon-border`
- Divider lines → `--fin-ribbon-divider`
- Stat labels → `--fin-ribbon-label`
- Stat values → `--fin-ribbon-value`
- "Current Value" highlighted value → `--fin-ribbon-highlight-value`
- Positive values (Unrealised Gain) → `--fin-ribbon-positive`
- Negative values → `--fin-ribbon-negative`
- LT/ST breakdown text → `--fin-aux-text`

### `src/components/investor/FilterBar.tsx`
- Container bg/border → `--fin-filter-bg`, `--fin-filter-border`
- Active filter chip bg → `--fin-filter-option-active-bg`
- Active filter chip text → `--fin-filter-option-active-text`
- Idle chip bg → `--fin-filter-option-idle-bg`
- Idle chip text → `--fin-filter-option-idle-text`
- Idle chip hover bg → `--fin-filter-option-idle-hover-bg`
- Idle chip hover text → `--fin-filter-option-idle-hover-text`
- Search input bg/border → `--fin-filter-search-bg`, `--fin-filter-search-border`
- Search focus border → `--fin-filter-search-focus-border`
- Search icon → `--fin-filter-search-icon`

### `src/components/investor/DesktopFundTable.tsx`
- All table variables as listed above
- Expanded row bg → `--fin-table-expanded-bg`
- Expanded row border → `--fin-table-expanded-border`
- Sticky cell border/shadow → `--fin-table-sticky-border`, `--fin-table-sticky-shadow`
- Fund name → `--fin-heading-tertiary`
- Fund house text → `--fin-muted-text`
- Analytics button hover → `--fin-btn-ghost-hover-bg`, `--fin-btn-ghost-hover-text`
- Positive P&L → `--fin-kpi-positive-text`
- Negative P&L → `--fin-kpi-negative-text`
- Badge (category) → `--fin-badge-brand-*`

### `src/components/investor/MobileHoldings.tsx` (and `MobileFundDetails`)
- Card bg/border → `--fin-card-bg`, `--fin-card-border`
- Card header bg/border/text → `--fin-card-header-bg`, `--fin-card-header-border`, `--fin-card-header-text`
- Card label → `--fin-card-label`
- Card value → `--fin-card-value`
- Positive/negative → `--fin-kpi-positive-text`, `--fin-kpi-negative-text`
- Badges → `--fin-badge-brand-*`

### `src/components/distributor/clients/DesktopClientTable.tsx`
All table variables.

### `src/app/distributor/clients/page.tsx`
- Search input → `--fin-input-*`
- Pagination buttons → `--fin-page-btn-*`
- Page heading → `--fin-heading-primary`

### `src/components/distributor/clients/ClientHoldingsView.tsx`
This is the largest file. Apply:
- All table variables
- All ribbon variables
- All modal variables (for inline modal-like panels)
- All analysis box variables:
  - `--fin-analysis-bg`, `--fin-analysis-border`, `--fin-analysis-label`, `--fin-analysis-value`
  - `--fin-analysis-positive-*`, `--fin-analysis-negative-*`, `--fin-analysis-neutral-*`
- Download/export button → `--fin-btn-primary-*`, `--fin-btn-secondary-*`
- KPI summary cards → `--fin-kpi-*`
- Chart series colors → `--fin-chart-color-1` through `--fin-chart-color-8` (passed as `stroke`/`fill` props to Recharts)
- Chart grid → `--fin-chart-grid`
- Chart axis tick → `--fin-chart-axis-text`
- Recharts `<Tooltip>` custom content bg/text → `--fin-chart-tooltip-bg`, `--fin-chart-tooltip-text`
- Fund category badge → `--fin-badge-brand-*`
- Positive P&L → `--fin-kpi-positive-text`
- Negative P&L → `--fin-kpi-negative-text`

### `src/components/distributor/clients/FundAnalyticsModal.tsx`
- Modal backdrop → `--fin-modal-backdrop`
- Modal container bg/border → `--fin-modal-bg`, `--fin-modal-border`
- Modal title → `--fin-modal-header-text`
- Close button hover → `--fin-modal-close-hover`
- Tab active underline/text/bg → `--fin-modal-tab-active-border`, `--fin-modal-tab-active-text`, `--fin-modal-tab-active-bg`
- Tab idle text → `--fin-modal-tab-idle-text`
- Tab idle hover → `--fin-modal-tab-idle-hover-bg`
- All analysis stat boxes → `--fin-analysis-*`
- Monthly returns bar chart → `--fin-chart-color-4` for positive, `--fin-chart-color-6` for negative
- Risk stats table → table variables
- Positive returns → `--fin-kpi-positive-text`
- Negative returns → `--fin-kpi-negative-text`

### `src/app/distributor/reports/ledger/page.tsx`
- Page bg → `--fin-page-bg`
- Section cards bg/border → `--fin-content-surface`, `--fin-border`
- KPI summary cards at top → `--fin-kpi-*`
- Table → all table vars
- Add Entry modal → all modal vars
- Custom dropdowns → `--fin-input-*`
- Submit button → `--fin-btn-primary-*`
- Status badges → `--fin-badge-*` (success/danger/neutral)
- Star icon (favorite) → `--fin-chart-color-5` (amber) or `--fin-badge-warning-text`

### `src/app/distributor/reports/sips/page.tsx`
- Page bg → `--fin-page-bg`
- Summary KPI cards → `--fin-kpi-*`
- Investor row cards → `--fin-card-*` (used for mobile-style list items)
- Drawer/slide-over for SIP details → modal variables
- Search bar → `--fin-filter-search-*`
- SIP status badges → `--fin-badge-*`

### `src/app/distributor/reports/systematic-transactions/page.tsx`
Apply table vars + filter vars + badge vars.

### `src/app/distributor/reports/hierarchy/page.tsx`
Apply table vars + badge vars + tree vars.

### `src/app/distributor/users/page.tsx`
- Table → all table vars
- Tree connector lines → `--fin-tree-connector-color`
- Expanded rows → `--fin-tree-expanded-bg`
- Role badges → `--fin-badge-brand-*` (Distributor), `--fin-badge-admin-*` (Admin), `--fin-badge-broker-*` (Sub-Broker)
- Add/Edit user modal → all modal vars
- Inputs → `--fin-input-*`
- Initials avatar → `--fin-kpi-icon-bg`, `--fin-kpi-icon-color`

### `src/app/distributor/calculators/mf-returns/page.tsx`
- Card bg/border → `--fin-calc-card-bg`, `--fin-calc-card-border`
- Synced sliders → `--fin-calc-slider-track`, `--fin-calc-slider-thumb`
- Result "Invested" box → `--fin-calc-result-invested-bg`
- Result "Returns" box → `--fin-calc-result-returns-bg`
- Result "Total" box → `--fin-calc-result-total-bg`, `--fin-calc-result-total-text`
- Bar chart → `--fin-chart-color-1` (invested), `--fin-chart-color-4` (returns)
- Chart grid → `--fin-chart-grid`

### `src/app/distributor/calculators/CalculatorSelect.tsx`
- Trigger bg/border/text → `--fin-calc-select-bg`, `--fin-calc-select-border`, `--fin-calc-select-text`
- Trigger hover border → `--fin-calc-select-hover-border`
- Dropdown bg → `--fin-content-surface`
- Dropdown border → `--fin-border`
- Active option → `--fin-sidebar-item-active-bg`, `--fin-sidebar-item-active-text`
- Hover option → `--fin-sidebar-item-hover-bg`, `--fin-sidebar-item-hover-text`
- Chevron open → `--fin-sidebar-chevron-open`
- Chevron closed → `--fin-sidebar-chevron-closed`

### `src/app/distributor/calculators/goal/page.tsx`, `fd/page.tsx`, `swp/page.tsx`, `stp/page.tsx`, `reverse-emi/page.tsx`
Apply the same calculator variables as `mf-returns` page. Adjust chart colors per series.

### `src/app/distributor/settings/page.tsx`
- Tab active border → `--fin-settings-tab-active-border`
- Tab active text → `--fin-settings-tab-active-text`
- Tab idle text → `--fin-settings-tab-idle-text`
- Tab hover bg → `--fin-settings-tab-hover-bg`
- Section bg/border → `--fin-settings-section-bg`, `--fin-settings-section-border`
- Inputs → `--fin-input-*`
- Save button → `--fin-btn-primary-*`
- Cancel button → `--fin-btn-secondary-*`
- Toggle switches → `--fin-settings-toggle-*`
- Section headings → `--fin-heading-tertiary`
- Labels → `--fin-overline-text`

### `src/app/investor/page.tsx` (Investor Dashboard / Portfolio view)
Apply ALL of: ribbon vars, table vars, card vars (mobile), filter vars, modal vars, badge vars, chart vars, analysis vars, KPI vars, button vars.

The investor page is 99KB and contains virtually the entire investor experience in one file. It renders:
- InvestorSidebar (separate component)
- GlobalStatsRibbon
- FilterBar
- DesktopFundTable (desktop) / MobileHoldings (mobile)
- FundAnalyticsModal
- Export dropdown (button vars)
- Page-level headings → `--fin-heading-primary`, `--fin-heading-secondary`

### `src/app/login/page.tsx` (if it exists)
- Page bg → `--fin-page-bg`
- Card bg/border → `--fin-content-surface`, `--fin-border`
- Logo → `--fin-sidebar-brand-logo-from`, `--fin-sidebar-brand-logo-to`
- Inputs → `--fin-input-*`
- Submit button → `--fin-btn-primary-*`

---

## Backend Task: NestJS Themes Module

Create `src/modules/themes/` with:

### `themes.module.ts`
```typescript
@Module({
  controllers: [ThemesController],
  providers: [ThemesService],
})
export class ThemesModule {}
```
Register in `app.module.ts`.

### `themes.service.ts` — methods needed:
```
getActiveTheme(companyId: string)
  → SELECT from company_themes WHERE company_id = $1
  → If not found, INSERT blank row, return defaults

listSavedThemes(companyId: string)
  → Returns Object.values(saved_themes) from the row

saveTheme(companyId: string, name: string, variables: Record<string,string>)
  → Generate a UUID for the new theme
  → Upsert company_themes row
  → Use jsonb_set or plain UPDATE with JSONB || operator to append to saved_themes
  → Returns { id, name, variables, created_at }

updateSavedTheme(companyId: string, themeId: string, variables: Record<string,string>, name?: string)
  → Update the specific key inside saved_themes JSONB

deleteSavedTheme(companyId: string, themeId: string)
  → Remove the key from saved_themes JSONB using jsonb_set

activateTheme(companyId: string, themeId: string)
  → Read saved_themes[themeId].variables
  → SET theme_variables = that, theme_name = that name

activateDefault(companyId: string)
  → SET theme_variables = '{}', theme_name = 'System Default'
```

### `themes.controller.ts` — routes:
```
GET    /themes/active          → getActiveTheme
POST   /themes/saved           → saveTheme (body: { name, variables })
PUT    /themes/saved/:id       → updateSavedTheme
DELETE /themes/saved/:id       → deleteSavedTheme
PUT    /themes/activate/:id    → activateTheme
PUT    /themes/activate-default → activateDefault
```

All routes must be protected by the existing JWT auth guard. Extract `company_id` from the JWT payload (`req.user.company_id`) — never trust it from the body.

---

## Frontend Task: ThemeContext

Create `src/context/ThemeContext.tsx`:

```typescript
interface SavedTheme {
  id: string;
  name: string;
  variables: Record<string, string>;
  is_default?: boolean;
  created_at: string;
}

interface ThemeContextValue {
  variables: Record<string, string>;
  themeName: string;
  savedThemes: SavedTheme[];
  isLoading: boolean;
  applyPreview: (vars: Record<string, string>) => void;
  revertPreview: () => void;
  activateTheme: (savedThemeId: string) => Promise<void>;
  activateDefault: () => Promise<void>;
  saveTheme: (name: string, variables: Record<string, string>) => Promise<SavedTheme>;
  deleteSavedTheme: (id: string) => Promise<void>;
  refreshTheme: () => Promise<void>;
}
```

**Key behaviors:**
1. On mount, call `GET /api/themes/active`
2. Apply returned `theme_variables` to `document.documentElement.style.setProperty(key, value)` for each variable
3. Also cache in `localStorage` as `finiq_theme_vars` to prevent FOUC on next load
4. `applyPreview(vars)`: set vars on DOM immediately (no API call); store snapshot of current vars
5. `revertPreview()`: restore snapshot, clear preview vars
6. `saveTheme`: POST to API, then re-fetch to get updated saved_themes list
7. `activateTheme`: PUT to API, then re-fetch and reapply vars
8. `activateDefault`: PUT to API, then clear all `--fin-*` vars from DOM (let `:root` defaults take over)

Add a blocking inline `<script>` to both `distributor/layout.tsx` and `investor/layout.tsx` to apply localStorage cache before React hydrates:

```tsx
<script dangerouslySetInnerHTML={{ __html: `
  (function(){
    try {
      var t = localStorage.getItem('finiq_theme_vars');
      if(t){
        var v = JSON.parse(t);
        var r = document.documentElement;
        Object.keys(v).forEach(function(k){ r.style.setProperty(k, v[k]); });
      }
    } catch(e){}
  })();
`}} />
```

---

## Frontend Task: Next.js API Proxy

Create `src/app/api/themes/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

async function handler(req: NextRequest, { params }: { params: { path: string[] } }) {
  const path = params.path.join('/');
  const url = `${API_BASE}/themes/${path}`;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Forward auth cookie
  const cookie = req.headers.get('cookie');
  if (cookie) headers['Cookie'] = cookie;
  
  const body = req.method !== 'GET' ? await req.text() : undefined;
  
  const res = await fetch(url, {
    method: req.method,
    headers,
    body,
  });
  
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
```

---

## Frontend Task: Theme Panel UI

Add an **"Appearance"** tab to `src/app/distributor/settings/page.tsx`.

The Appearance tab renders `<ThemePanel />` which is split into 3 columns:

### Column 1 — Theme Picker List (`src/components/settings/ThemePickerList.tsx`)
- "System Default" as a permanent, non-deletable first item
- Shows a small color swatch (filled circle using `--fin-brand-600` of that theme's variables, or the current brand color for System Default)
- On click: calls `applyPreview(theme.variables)` — instantaneous preview, no save
- "Activate" button: calls `activateTheme(id)` — persists to DB
- Delete button (trash icon): shows inline confirmation → `deleteSavedTheme(id)`
- "+ Create New" button at bottom: clears the customiser to a blank state

### Column 2 — Customiser (`src/components/settings/ColorPickerGroup.tsx` used multiple times)
Grouped color pickers using native `<input type="color">` (no external library needed):

**Group A — Brand & Primary**
- "Brand Color": a single `<input type="color">` that controls `--fin-brand-600`; when changed, auto-derive the full scale (50→950) using the `colorUtils.ts` deriveColorScale function and update ALL `--fin-brand-*` vars at once

**Group B — Page Surfaces**
- Page Background → `--fin-page-bg`
- Card Surface → `--fin-content-surface`
- Border Color → `--fin-border`

**Group C — Sidebar**
- Sidebar Background → `--fin-sidebar-bg`
- Active Item Color → `--fin-sidebar-item-active-bg` (defaults to Brand)

**Group D — Typography**
- Primary Heading → `--fin-heading-primary`
- Secondary Heading Accent → `--fin-heading-secondary` (defaults to Brand)
- Body Text → `--fin-body-text`
- Muted / Helper Text → `--fin-aux-text`

**Group E — KPI & Metrics**
- KPI Card Background → `--fin-kpi-bg`
- KPI Revealed Value → `--fin-kpi-value-revealed`
- Positive Indicator → `--fin-kpi-positive-text`
- Negative Indicator → `--fin-kpi-negative-text`

**Group F — Tables**
- Table Header Background → `--fin-table-header-bg`
- Row Hover Background → `--fin-table-row-hover-bg`

**Group G — Charts** (2×4 grid of pickers)
- Series 1–8 → `--fin-chart-color-1` through `--fin-chart-color-8`
- Chart Grid → `--fin-chart-grid`
- Tooltip Background → `--fin-chart-tooltip-bg`

**Theme Name + Save**
- `<input type="text" placeholder="Theme name..." />`
- `[Save Theme]` button → calls `saveTheme(name, currentPreviewVars)`
- `[Reset to Default]` button → calls `activateDefault()`

All picker changes must call `applyPreview(currentVars)` in real-time.

### Column 3 — Preview Pane (`src/components/settings/ThemePreviewPane.tsx`)
Self-contained mini UI using ONLY `var(--fin-*)` CSS variables. Renders (top to bottom):

1. **Mini Sidebar strip** — small vertical bar, 60px wide, showing logo icon + 3 nav dots, one active
2. **Page heading** — "Client and **AUM Insights**" (heading-primary + heading-secondary)
3. **KPI Cards row** — 3 mini KPI cards with fake data: "Total AUM ₹42.8Cr", "Investors 186", "Today's P&L +₹1.2L"
4. **Mini Table** — thead with 3 cols + 3 tbody rows, one with hover:bg applied
5. **Mobile Card** — one info card showing name, 2 label-value pairs
6. **Badges row** — Brand · Success · Danger · Warning · Neutral · Admin
7. **Buttons row** — Primary button · Secondary button · Ghost hover state
8. **Mini Recharts AreaChart** — 2 series using `--fin-chart-color-1` and `--fin-chart-color-4`, 6 fake data points
9. **Analysis boxes row** — 4 boxes: Brand (analysis-*), Positive (positive-*), Negative (negative-*), Neutral (neutral-*)
10. **Typography sample** — shows all type levels: primary heading, secondary heading, subheading, body, muted, auxiliary/helper

---

## Color Scale Derivation Utility

Create `src/lib/colorUtils.ts`:

```typescript
// Converts hex to HSL
function hexToHSL(hex: string): [number, number, number] { ... }

// Converts HSL back to hex
function hslToHex(h: number, s: number, l: number): string { ... }

// Lightness levels for each scale step
const SCALE_LIGHTNESS = {
  50:  96,
  100: 93,
  200: 87,
  300: 78,
  400: 67,
  500: 55,
  600: 43,  // <- base input (approx)
  700: 35,
  800: 28,
  900: 22,
  950: 14,
};

// Given a base hex (for the 600 step), derive the full scale
export function deriveColorScale(baseHex: string): Record<string, string> {
  const [h, s] = hexToHSL(baseHex);
  const result: Record<string, string> = {};
  for (const [step, lightness] of Object.entries(SCALE_LIGHTNESS)) {
    result[`--fin-brand-${step}`] = hslToHex(h, s, lightness);
  }
  return result;
}
```

---

## Implementation Rules

1. **DO NOT break the current design.** The System Default theme must render identically to how the site looks right now. Test this before touching anything else.

2. **The safest migration strategy is the `@theme inline` remap.** By mapping `--color-distributor-600` to `var(--fin-brand-600)`, all existing Tailwind classes continue to work and automatically pick up the theme at runtime. This is the preferred approach. Only use explicit `style={{ }}` props when you need a CSS property that Tailwind cannot express as a class (e.g., box-shadow with a variable color).

3. **Never store the theme in a React state tree that causes full re-renders.** Theme vars go directly to `document.documentElement.style` — this is the fastest path and avoids any React re-rendering overhead.

4. **Investor cannot access the Theme Panel** settings tab. Add a role check in `distributor/settings/page.tsx` so only `COMPANY_ADMIN` and `TENANT_ADMIN` roles can see the Appearance tab.

5. **Both distributor and investor layouts must wrap with ThemeProvider** so the correct theme is applied for both portals.

6. **The preview pane must be a pure CSS-var consumer** — every single element inside it uses `style={{ color: 'var(--fin-...)' }}` or `style={{ background: 'var(--fin-...)' }}`. No hardcoded hex values or Tailwind color classes anywhere in the preview components.

7. **Use `"use client"` on ThemeContext, ThemePanel, ThemePreviewPane, ColorPickerGroup, ThemePickerList.**

8. **The `input[type=color]` browser native picker** is sufficient — no need for a third-party color picker library.

9. **Match the existing visual style** of the settings page. The theme panel should use the same card/panel aesthetic (white bg, `border-slate-200`, `rounded-md`, `shadow-sm`) as the existing profile and notifications tabs.

10. **Debounce `applyPreview`** calls from color picker `onChange` to ~100ms to avoid excessive DOM updates.

---

## Files To Create / Modify (Summary)

### finiq-api
- `src/modules/themes/themes.module.ts` ← CREATE
- `src/modules/themes/themes.controller.ts` ← CREATE
- `src/modules/themes/themes.service.ts` ← CREATE
- `src/modules/themes/dto/create-theme.dto.ts` ← CREATE
- `src/modules/themes/dto/update-theme.dto.ts` ← CREATE
- `src/app.module.ts` ← MODIFY (add ThemesModule import)

### finiq
- `src/app/globals.css` ← MODIFY (add `--fin-*` vars to `:root`; update `@theme inline`)
- `src/context/ThemeContext.tsx` ← CREATE
- `src/app/api/themes/[...path]/route.ts` ← CREATE
- `src/lib/colorUtils.ts` ← CREATE
- `src/app/distributor/layout.tsx` ← MODIFY (ThemeProvider + FOUC script)
- `src/app/investor/layout.tsx` ← MODIFY (ThemeProvider + FOUC script, create if missing)
- `src/components/settings/ThemePanel.tsx` ← CREATE
- `src/components/settings/ThemePreviewPane.tsx` ← CREATE
- `src/components/settings/ColorPickerGroup.tsx` ← CREATE
- `src/components/settings/ThemePickerList.tsx` ← CREATE
- `src/app/distributor/settings/page.tsx` ← MODIFY (add Appearance tab + import ThemePanel)
- All other component files ← MODIFY as needed to add `style={{ var(--fin-...) }}` overrides for non-Tailwind-remappable properties (box-shadow colors, rgba backgrounds, complex border expressions)

---

Begin by implementing the backend module and the `globals.css` changes, then the ThemeContext, then the settings UI. Confirm the System Default renders correctly before building the picker interactions.
