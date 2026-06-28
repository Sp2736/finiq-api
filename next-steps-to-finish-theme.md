# next-steps-to-finish-theme.md

> **Status as of current build:** The scaffolding exists but has 6 critical broken gaps and several UX/behaviour gaps. This document is a surgical step-by-step plan — every file, every function, every line you need to change. Follow the sections in order. Nothing here is optional.

---

## Gap Audit — What Is Broken Right Now

| # | Gap | Why it breaks things |
|---|-----|---------------------|
| 1 | **Investor JWT has no `company_id`** | `investor-auth.service.ts` signs a JWT with only `{ investor_id, mobile, username, email }`. When the investor hits `GET /api/themes/active`, the controller's `getCompanyId()` finds nothing and throws. Investors see zero theming. |
| 2 | **`getCompanyId()` in controller doesn't handle investor type** | Even if the investor JWT had a `company_id`, the current extractor only reads `req.user.roles[].company_id` or `req.user.company_id`. It never handles the `type: 'investor'` path that needs a DB lookup. |
| 3 | **Reset button calls `activateDefault()` — wrong behaviour** | `handleReset` in `ThemePanel.tsx` calls `activateDefault()` which does a `PUT /themes/activate-default` → sets `theme_variables = '{}'` in DB and broadcasts the reset to everyone. It should only reset the local color pickers back to `DEFAULT_VARS`, touching nothing in the DB. |
| 4 | **No FOUC prevention script** | Neither `distributor/layout.tsx` nor `investor/layout.tsx` has the blocking `<script>` that applies the localStorage-cached theme before React hydrates. Every page load flashes the default blue then snaps to the custom theme after ~300ms. |
| 5 | **`applyPreview` / `revertPreview` are no-ops** | In `ThemeContext.tsx` both functions have empty bodies (`// Isolated to ThemePreviewPane`). This means the ThemePanel's `handleColorChange` calls `applyPreview(updated)` and nothing happens globally — only the preview pane updates, the rest of the UI is frozen during editing. |
| 6 | **`ThemePreviewPane` receives `previewVariables` as a prop but the global DOM is never updated during editing** | Because `applyPreview` is a no-op, while you're editing a theme the rest of the site (sidebar, KPI cards, etc.) doesn't live-update. The preview pane does update (it uses inline style), but nothing else does. |
| 7 | **`company_themes` table uses `TEXT` as PK for `company_id` but the actual `companies` table uses `UUID`** | The service's `onModuleInit` creates a table with `company_id TEXT PRIMARY KEY`. If the real `company_themes` table (from the schema you already have) uses `UUID` typed foreign key, there's a type mismatch. The `onModuleInit` CREATE TABLE IF NOT EXISTS is harmless if the table already exists, but the type assumption in queries is wrong. |
| 8 | **`apiClient` sends `Authorization: Bearer <token>` but the proxy also forwards `Cookie` headers** | The NestJS `JwtStrategy` uses `fromAuthHeaderAsBearerToken()`. This is fine for staff (cookie → apiClient reads it → sends as Bearer). For investors the same flow works. But the proxy also forwards raw cookies which could cause double-auth confusion on NestJS. Minor, but needs cleaning. |

---

## Section 1 — Backend Fixes (finiq-api)

### 1.1 — Fix Investor JWT to include `company_id`

**File:** `src/modules/investor-auth/investor-auth.service.ts`

Find the `loginWithPassword` method (or wherever `this.jwtService.sign(payload)` is called for investors). The `investor` entity has a `company_id` field (confirmed at line 308 of investors.service.ts). Add it to the payload.

**Find this block (around line 88):**
```typescript
const payload = {
  investor_id: investor.id,
  mobile: investor.mobile,
  username: investor.username,
  email: investor.email,
};
const accessToken = this.jwtService.sign(payload);
```

**Replace with:**
```typescript
const payload = {
  investor_id: investor.id,
  mobile: investor.mobile,
  username: investor.username,
  email: investor.email,
  company_id: investor.company_id, // ← ADD THIS
};
const accessToken = this.jwtService.sign(payload);
```

**Also update** `src/modules/auth/jwt.strategy.ts` so the validated investor payload also returns `company_id`:

**Find:**
```typescript
if (payload.investor_id) {
  return {
    id: payload.investor_id,
    mobile: payload.mobile,
    type: 'investor'
  };
}
```

**Replace with:**
```typescript
if (payload.investor_id) {
  return {
    id: payload.investor_id,
    mobile: payload.mobile,
    company_id: payload.company_id, // ← ADD THIS
    type: 'investor',
  };
}
```

---

### 1.2 — Fix `getCompanyId()` in Themes Controller

**File:** `src/modules/themes/themes.controller.ts`

The current extractor:
```typescript
private getCompanyId(req: any): string {
  const companyId = req.user?.roles?.find((r: any) => r.company_id)?.company_id || req.user?.company_id;
  if (!companyId) throw new Error("Could not extract company_id from token");
  return companyId;
}
```

This works for staff (`req.user.company_id` is set directly) but fails for investors if `company_id` is not on `req.user` yet. After fix 1.1, investors will have `company_id` on `req.user` directly. But add defensive fallback:

**Replace with:**
```typescript
private getCompanyId(req: any): string {
  // Staff: company_id is a top-level claim on the JWT
  // Investors: also now has company_id as a top-level claim (after fix in investor-auth.service)
  // Fallback: if roles array carries it (some older tokens)
  const companyId =
    req.user?.company_id ||
    req.user?.roles?.find((r: any) => r.company_id)?.company_id;

  if (!companyId) {
    throw new Error(
      `Could not extract company_id from token. User type: ${req.user?.type}, id: ${req.user?.id}`,
    );
  }
  return companyId;
}
```

---

### 1.3 — Harden `getActiveTheme` to handle cold start gracefully

**File:** `src/modules/themes/themes.service.ts`

The current `getActiveTheme` returns a plain object when no row exists. This is fine. But make sure `saved_themes` is always a proper JS object, not a JSONB string:

```typescript
async getActiveTheme(companyId: string) {
  const query = `
    SELECT theme_name, theme_variables, active_theme_id, saved_themes 
    FROM company_themes 
    WHERE company_id = $1
  `;
  const res = await db.query(query, [companyId]);

  if (res.rows.length === 0) {
    return {
      theme_name: 'System Default',
      theme_variables: {},
      active_theme_id: null,
      saved_themes: {},
    };
  }

  const row = res.rows[0];
  return {
    theme_name: row.theme_name || 'System Default',
    theme_variables: row.theme_variables || {},
    active_theme_id: row.active_theme_id || null,
    // Ensure saved_themes is always a plain object, not a JSONB string
    saved_themes: typeof row.saved_themes === 'string'
      ? JSON.parse(row.saved_themes)
      : (row.saved_themes || {}),
  };
}
```

---

### 1.4 — Verify `company_themes` table schema matches the service

**Run this SQL** in your PostgreSQL database to check the actual column types:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'company_themes';
```

The `onModuleInit` in the service creates `company_id TEXT PRIMARY KEY`. But your `full_schema.sql` shows `company_id uuid NOT NULL UNIQUE` (with a separate `id uuid` primary key). This means two things:

1. The `onModuleInit` `CREATE TABLE IF NOT EXISTS` will **not** run because the table already exists — so this is harmless.
2. All queries in the service use `$1` bound to the `company_id` value — this works fine as PostgreSQL will coerce the UUID string.

**No change needed** here, but be aware: if you ever wipe the DB and let `onModuleInit` recreate the table, it will create a different schema. Recommend commenting out the `CREATE TABLE IF NOT EXISTS` in `onModuleInit` and only keeping the `ADD COLUMN IF NOT EXISTS` migration line.

---

## Section 2 — Frontend Fixes (finiq)

### 2.1 — Fix `applyPreview` and `revertPreview` in ThemeContext

**File:** `src/context/ThemeContext.tsx`

The current implementations are deliberately emptied (`// Isolated to ThemePreviewPane`). This is wrong for the global live-update requirement. These need to mutate the DOM **and** the ThemePanel needs the global site to react while editing.

**Find:**
```typescript
const applyPreview = useCallback((vars: Record<string, string>) => {
  // Isolated to ThemePreviewPane - no global mutation needed
}, []);

const revertPreview = useCallback(() => {
  // Isolated to ThemePreviewPane - no global mutation needed
}, []);
```

**Replace with:**
```typescript
const applyPreview = useCallback((vars: Record<string, string>) => {
  // Save current active snapshot so we can revert
  snapshotRef.current = variables;
  applyVarsToDOM(vars);
}, [variables, applyVarsToDOM]);

const revertPreview = useCallback(() => {
  // Restore the last snapshot (which is the currently saved/active theme)
  if (Object.keys(snapshotRef.current).length > 0) {
    applyVarsToDOM(snapshotRef.current);
  } else {
    // No snapshot means system default was active — clear all inline vars
    document.documentElement.style.cssText = '';
  }
  snapshotRef.current = {};
}, [applyVarsToDOM]);
```

**Why this is correct:** When the editor opens and the user changes a color, `applyPreview(updated)` fires, instantly updating `document.documentElement` CSS vars. The entire site — sidebar, KPI cards, the navbar gradient, everything — updates in real time. When Cancel is clicked, `revertPreview()` restores from the snapshot. When Save is clicked, the saved vars become the new canonical state.

---

### 2.2 — Fix the Reset button in ThemePanel

**File:** `src/components/settings/ThemePanel.tsx`

**Current wrong behaviour:**
```typescript
const handleReset = async () => {
  setIsSubmitting(true);
  try {
    await activateDefault(); // ← calls API, sets DB to empty, broadcasts to all users
    setEditorMode({ type: "idle" });
    addToast("success", "Reset to System Default.");
  } ...
```

**What it should do:** Reset the local color picker inputs back to `DEFAULT_VARS`, without touching the DB, without affecting any other user, and without changing the active theme.

**Replace `handleReset` entirely:**
```typescript
const handleReset = () => {
  // Reset the editor inputs to the canonical system defaults.
  // This does NOT change what theme is active, does NOT touch the DB,
  // and does NOT affect any other user or session.
  setLocalVars({ ...DEFAULT_VARS });
  if (isEditing) {
    applyPreview({ ...DEFAULT_VARS });
  }
  setHasUnsavedChanges(true); // Mark as changed so user knows to save if they want
  addToast("success", "Color inputs reset to system defaults. Save to apply.");
};
```

Also **rename the button label** from "Reset" to "Reset to Defaults" so the intent is unambiguous:
```tsx
<button
  onClick={handleReset}
  disabled={isSubmitting}
  className="px-4 py-2.5 flex items-center gap-2 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm disabled:opacity-50"
  title="Reset color pickers to system defaults (does not change active theme)"
>
  <RotateCcw size={15} />
  <span className="hidden sm:inline">Reset to Defaults</span>
</button>
```

The "System Default" theme activation is already handled correctly in `ThemePickerList.tsx` via `handleActivateDefault` — that's where the DB call should live and it's already correct.

---

### 2.3 — Add FOUC Prevention Script to Both Layouts

**File 1:** `src/app/distributor/layout.tsx`

Add a blocking inline `<script>` immediately inside `<html>` or before the `<ThemeProvider>`. Because this is the App Router, the correct place is inside the **root `layout.tsx`** as a Script, or inside the distributor layout's render return. Since Next.js App Router doesn't let you access `<html>` from nested layouts, we use a `<script>` tag injected via `dangerouslySetInnerHTML` in the distributor layout's outermost div:

Add this as the **very first element** inside the returned JSX, before the `<ThemeProvider>`:

```tsx
// At the top of the returned JSX:
return (
  <>
    <script
      dangerouslySetInnerHTML={{
        __html: `
          (function() {
            try {
              var cached = localStorage.getItem('finiq_theme_vars');
              if (cached) {
                var vars = JSON.parse(cached);
                var root = document.documentElement;
                var keys = Object.keys(vars);
                for (var i = 0; i < keys.length; i++) {
                  root.style.setProperty(keys[i], vars[keys[i]]);
                }
              }
            } catch(e) {}
          })();
        `,
      }}
    />
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden ..." style={{ backgroundColor: 'var(--fin-page-bg)' }}>
        {/* ... rest of layout */}
      </div>
    </ThemeProvider>
  </>
);
```

**File 2:** `src/app/investor/layout.tsx` — apply the identical script in the same position.

**Why this works:** The script runs synchronously before React hydrates. The cached vars from the previous session are applied directly to `document.documentElement.style`. When `ThemeProvider` mounts and fetches the latest theme from the API, it calls `applyVarsToDOM` which overwrites with the fresh data. The result: zero flash.

---

### 2.4 — Connect `ThemePanel` save flow to also call `activateTheme` when saving

Currently, when a user saves a new theme, it is saved to the DB as a `saved_theme` but **does not become the active theme**. The user has to then manually click "Apply" on the card. This is unexpected UX — an industry-standard theme panel activates the theme on first save.

**File:** `src/components/settings/ThemePanel.tsx`

**Find `handleSave`:**
```typescript
const handleSave = async () => {
  ...
  if (editorMode.type === "edit") {
    await updateSavedTheme(editorMode.theme.id, themeName.trim(), localVars);
    addToast("success", `"${themeName.trim()}" updated and saved to database.`);
    setEditorMode({ type: "edit", theme: { ...editorMode.theme, name: themeName.trim(), variables: localVars } });
  } else {
    const saved = await saveTheme(themeName.trim(), localVars);
    addToast("success", `"${saved.name}" saved to database.`);
    setEditorMode({ type: "edit", theme: saved });
  }
```

**Replace the `else` branch (new theme save) with:**
```typescript
} else {
  // 1. Save the theme to DB
  const saved = await saveTheme(themeName.trim(), localVars);
  // 2. Immediately activate it for the company so all users see it
  await activateTheme(saved.id);
  addToast("success", `"${saved.name}" saved and activated for your company.`);
  setEditorMode({ type: "edit", theme: saved });
}
```

Also add `activateTheme` to the destructured values at the top of the component:
```typescript
const {
  variables,
  activeThemeId,
  savedThemes,
  applyPreview,
  revertPreview,
  activateDefault,
  activateTheme,   // ← ADD THIS
  saveTheme,
  updateSavedTheme,
} = useTheme();
```

For the **update** branch, if the theme being edited is currently the active theme, re-activate after updating to refresh the global vars:
```typescript
if (editorMode.type === "edit") {
  await updateSavedTheme(editorMode.theme.id, themeName.trim(), localVars);
  // If this is the active theme, reactivate to push updated vars to everyone
  if (activeThemeId === editorMode.theme.id) {
    await activateTheme(editorMode.theme.id);
    addToast("success", `"${themeName.trim()}" updated and live across your company.`);
  } else {
    addToast("success", `"${themeName.trim()}" updated and saved.`);
  }
  setEditorMode({ type: "edit", theme: { ...editorMode.theme, name: themeName.trim(), variables: localVars } });
}
```

---

### 2.5 — Ensure the Themes API proxy route forwards the Bearer token correctly

**File:** `src/app/api/themes/[...path]/route.ts`

The current proxy only forwards cookies. But `apiClient.ts` sends the token as `Authorization: Bearer <token>` in the request headers. The proxy must also forward that header:

**Find:**
```typescript
const headers: Record<string, string> = {
  "Content-Type": "application/json",
};

// Forward auth cookie to NestJS
const cookie = req.headers.get("cookie");
if (cookie) headers["Cookie"] = cookie;
```

**Replace with:**
```typescript
const headers: Record<string, string> = {
  "Content-Type": "application/json",
};

// Forward Authorization bearer token (used by apiClient for both staff and investors)
const authorization = req.headers.get("authorization");
if (authorization) headers["Authorization"] = authorization;

// Forward cookies as well (belt-and-suspenders for server-side flows)
const cookie = req.headers.get("cookie");
if (cookie) headers["Cookie"] = cookie;
```

---

### 2.6 — `activateDefault` in ThemeContext must clear the DOM vars

**File:** `src/context/ThemeContext.tsx`

When `activateDefault` is called from `ThemePickerList`, the API call sets `theme_variables = {}` in DB. Then `fetchActiveTheme` runs and gets `vars = {}`. Then `applyVarsToDOM({})` is called which currently does `document.documentElement.style.cssText = ""`. **This removes ALL inline styles, which is correct.** CSS `:root` defaults in `globals.css` then take over.

No code change needed here — the existing `applyVarsToDOM` already handles the empty case:
```typescript
const applyVarsToDOM = useCallback((vars: Record<string, string>) => {
  if (typeof window === "undefined") return;
  if (Object.keys(vars).length === 0) {
    document.documentElement.style.cssText = ""; // ← Correct — clears all custom vars
    return;
  }
  ...
```

But add a localStorage clear when reverting to default:
```typescript
const activateDefault = useCallback(async () => {
  await apiClient.put("themes/activate-default", {});
  snapshotRef.current = {};
  // Clear the FOUC cache so next page load also shows system default
  try { localStorage.removeItem('finiq_theme_vars'); } catch (_) {}
  await fetchActiveTheme();
}, [fetchActiveTheme]);
```

---

### 2.7 — Add `@theme inline` remapping in globals.css

**File:** `src/app/globals.css`

Currently the `distributor-600`, `distributor-50` etc. Tailwind tokens are hardcoded hex values (they are NOT remapped to `var(--fin-brand-*)`). This means when a theme changes `--fin-brand-600`, classes like `bg-distributor-600` on the sidebar won't update.

Add this block in `globals.css` inside `@theme inline { }`. If it doesn't exist yet, add it:

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --font-sans: var(--font-inter);

  /* ── Remap distributor palette → fin-brand vars ── */
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

  /* ── Remap investor palette → same fin-brand vars ── */
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

**This is the single most important CSS change.** Once this is in place, every class like `bg-distributor-600`, `text-distributor-700`, `hover:bg-distributor-50` — used throughout the Sidebar, InvestorSidebar, and all other components — automatically reflects the active theme at runtime. You do **not** need to refactor any component's class names.

> **Tailwind v4 note:** In Tailwind v4 with `@import "tailwindcss"`, the `@theme inline {}` block remaps design token CSS variables. Setting `--color-distributor-600: var(--fin-brand-600)` makes `bg-distributor-600` compile to `background-color: var(--color-distributor-600)` at build time, which at runtime resolves through `--color-distributor-600 → --fin-brand-600 → [the inline style value]`. This is a zero-refactor approach.

---

## Section 3 — What Still Needs To Be Added to the Theme Panel (UX Completeness)

The current panel covers: Brand Core (3 vars), Surfaces (4), Typography (5), Borders (2), Buttons (7), KPI Cards (5). That's 26 variables out of the ~160 defined in `:root`. The below groups are missing and should be added as additional `<ColorPickerGroup>` blocks in `ThemePanel.tsx`.

### 3.1 — Add missing color groups to ThemePanel

**File:** `src/components/settings/ThemePanel.tsx`

After the "KPI Cards" group, add:

```tsx
<ColorPickerGroup
  label="Sidebar"
  description="Navigation panel colors for active, hover, and default states."
  variables={[
    { key: "--fin-sidebar-bg", label: "Sidebar Background", value: varGroupLabel("--fin-sidebar-bg") },
    { key: "--fin-sidebar-item-active-bg", label: "Active Item", value: varGroupLabel("--fin-sidebar-item-active-bg") },
    { key: "--fin-sidebar-item-hover-bg", label: "Hover Item", value: varGroupLabel("--fin-sidebar-item-hover-bg") },
    { key: "--fin-sidebar-brand-label", label: "Brand Label", value: varGroupLabel("--fin-sidebar-brand-label") },
  ]}
  onChange={isEditing ? handleColorChange : () => {}}
  disabled={!isEditing}
/>

<ColorPickerGroup
  label="Tables"
  description="Table headers, row backgrounds, and hover states."
  variables={[
    { key: "--fin-table-header-bg", label: "Header Background", value: varGroupLabel("--fin-table-header-bg") },
    { key: "--fin-table-header-text", label: "Header Text", value: varGroupLabel("--fin-table-header-text") },
    { key: "--fin-table-row-hover-bg", label: "Row Hover", value: varGroupLabel("--fin-table-row-hover-bg") },
    { key: "--fin-table-row-text", label: "Row Text", value: varGroupLabel("--fin-table-row-text") },
  ]}
  onChange={isEditing ? handleColorChange : () => {}}
  disabled={!isEditing}
/>

<ColorPickerGroup
  label="Charts"
  description="Data visualisation series colors."
  variables={[
    { key: "--fin-chart-color-1", label: "Series 1", value: varGroupLabel("--fin-chart-color-1") },
    { key: "--fin-chart-color-2", label: "Series 2", value: varGroupLabel("--fin-chart-color-2") },
    { key: "--fin-chart-color-3", label: "Series 3", value: varGroupLabel("--fin-chart-color-3") },
    { key: "--fin-chart-color-4", label: "Series 4 (Green)", value: varGroupLabel("--fin-chart-color-4") },
    { key: "--fin-chart-color-5", label: "Series 5 (Amber)", value: varGroupLabel("--fin-chart-color-5") },
    { key: "--fin-chart-color-6", label: "Series 6 (Red)", value: varGroupLabel("--fin-chart-color-6") },
  ]}
  onChange={isEditing ? handleColorChange : () => {}}
  disabled={!isEditing}
/>

<ColorPickerGroup
  label="Status Indicators"
  description="Positive (gains), negative (losses), and neutral states."
  variables={[
    { key: "--fin-kpi-positive-text", label: "Positive / Gain", value: varGroupLabel("--fin-kpi-positive-text") },
    { key: "--fin-kpi-negative-text", label: "Negative / Loss", value: varGroupLabel("--fin-kpi-negative-text") },
    { key: "--fin-analysis-positive-bg", label: "Gain Card Bg", value: varGroupLabel("--fin-analysis-positive-bg") },
    { key: "--fin-analysis-negative-bg", label: "Loss Card Bg", value: varGroupLabel("--fin-analysis-negative-bg") },
  ]}
  onChange={isEditing ? handleColorChange : () => {}}
  disabled={!isEditing}
/>
```

Also **extend `DEFAULT_VARS`** to include all the new keys:

```typescript
const DEFAULT_VARS: Record<string, string> = {
  // ... existing vars ...
  "--fin-sidebar-item-active-bg": "#3d60ab",
  "--fin-sidebar-item-hover-bg": "#f0f4fa",
  "--fin-sidebar-brand-label": "#3d60ab",
  "--fin-table-header-bg": "#f8fafc",
  "--fin-table-header-text": "#64748b",
  "--fin-table-row-hover-bg": "rgba(248,250,252,0.60)",
  "--fin-table-row-text": "#334155",
  "--fin-chart-color-1": "#3d60ab",
  "--fin-chart-color-2": "#658ccb",
  "--fin-chart-color-3": "#83a8d9",
  "--fin-chart-color-4": "#10b981",
  "--fin-chart-color-5": "#f59e0b",
  "--fin-chart-color-6": "#ef4444",
  "--fin-kpi-positive-text": "#16a34a",
  "--fin-kpi-negative-text": "#dc2626",
  "--fin-analysis-positive-bg": "#f0fdf4",
  "--fin-analysis-negative-bg": "#fef2f2",
};
```

---

### 3.2 — Wire `deriveColorScale` into the Brand Core picker

When the user changes `--fin-brand-600` (Brand Accent), the full scale (50 through 950) should auto-derive. Currently `colorUtils.ts` has `deriveColorScale()` but it's never called from the panel.

**File:** `src/components/settings/ThemePanel.tsx`

Import at the top:
```typescript
import { deriveColorScale } from "@/lib/colorUtils";
```

Modify `handleColorChange`:
```typescript
const handleColorChange = useCallback((key: string, val: string) => {
  setLocalVars((prev) => {
    let updated = { ...prev, [key]: val };

    // When the main brand accent changes, auto-derive the full scale
    if (key === "--fin-brand-600") {
      const scale = deriveColorScale(val);
      updated = { ...updated, ...scale };
      // Also sync sidebar active, button primary, link colors to new brand
      updated["--fin-sidebar-item-active-bg"] = val;
      updated["--fin-sidebar-brand-label"] = val;
      updated["--fin-btn-primary-bg"] = val;
      updated["--fin-link-text"] = val;
      updated["--fin-heading-secondary"] = val;
      updated["--fin-kpi-value-revealed"] = val;
      updated["--fin-kpi-accent-bar"] = scale["--fin-brand-500"] || val;
      updated["--fin-filter-option-active-bg"] = val;
      updated["--fin-page-btn-active-bg"] = val;
      updated["--fin-chart-color-1"] = val;
    }

    applyPreview(updated);
    return updated;
  });
  setHasUnsavedChanges(true);
}, [applyPreview]);
```

---

## Section 4 — Verifying the Full Multi-Company / Multi-Role Flow

This is the core requirement: "theme T saved by company X is seen by all users/investors of company X, and only them."

Here is how it works end-to-end after the fixes above:

### 4.1 — How company scoping works

1. Every user (staff or investor) has a `company_id` in their JWT payload.
2. `getCompanyId(req)` extracts it.
3. All theme operations (`getActiveTheme`, `saveTheme`, `activateTheme`) are keyed on `company_id`.
4. PostgreSQL stores one row per `company_id` in `company_themes`.
5. When `activateTheme` is called, it sets `theme_variables` and `active_theme_id` on that company's row.

### 4.2 — How a theme change propagates to all users of the same company

There is **no WebSocket push**. The theme is fetched fresh on every page load (or tab focus). Here is the full sequence:

1. Distributor admin goes to Settings → Appearance.
2. They edit a theme and click "Apply" (or save a new one which auto-activates).
3. `PUT /api/themes/activate/:id` is called → DB updates `company_themes` for their `company_id`.
4. The calling client immediately re-fetches (`fetchActiveTheme()`) and updates their own DOM vars.
5. Any other staff/investor of the same company who next loads a page or navigates will call `GET /api/themes/active` on mount, receive the updated `theme_variables`, and have the new theme applied.

This is exactly how SaaS theming works (Notion, Linear, etc.) — no push needed. If you want instantaneous cross-tab propagation, you can add a `localStorage` event listener later, but it's not required.

### 4.3 — Test this flow manually

1. Log in as Company A's distributor admin.
2. Go to Settings → Appearance.
3. Create a theme "Red Brand", set `--fin-brand-600` to `#dc2626`, save.
4. Observe: sidebar turns red immediately for this tab.
5. Open a new tab, log in as Company A's investor.
6. Navigate to `/investor` — sidebar should be red.
7. Open a new tab, log in as Company B's distributor.
8. Navigate to `/distributor` — sidebar should be the default blue.
9. Back to Company A distributor: click "System Default" card in the picker.
10. Observe: sidebar returns to blue. Company A's investor next load also gets blue.

---

## Section 5 — Remaining Missing Components (Not Yet Themed)

The `@theme inline` remap in Section 2.7 handles most of the site automatically. But some components use hardcoded `rgba()` or `shadow-[...]` syntax that can't be driven by a Tailwind token. These need explicit `style={{ }}` overrides. Listed in priority order:

### High priority (visible on every page)

**`src/components/distributor/Sidebar.tsx`**
- `bg-white/80 backdrop-blur-xl` on `<aside>` → add `style={{ backgroundColor: \`rgba(\${hexToRgb(sidebarBg)}, var(--fin-sidebar-bg-opacity, 0.8))\` }}` — OR simplify to `style={{ background: 'var(--fin-sidebar-bg)' }}` (drop the transparency since most themes will use solid colors)
- Logo gradient: `from-distributor-600 to-distributor-800` — these now auto-update via `@theme inline` remap. ✓ No change needed.
- All `bg-distributor-*`, `text-distributor-*`, `hover:bg-distributor-*` classes → all auto-update via remap. ✓

**`src/components/investor/InvestorSidebar.tsx`**
- Same pattern as distributor Sidebar. The `@theme inline` remap handles `investor-*` classes. ✓

### Medium priority (per-page)

**`src/app/distributor/page.tsx` (Dashboard KPI cards)**
- Box shadow colors: `shadow-[0_4px_20px_rgb(0,0,0,0.03)]` — these use raw rgba, not a Tailwind color token, so they don't need theming (it's just black at low opacity).
- The KPI icon containers `bg-distributor-50` → auto via remap. ✓
- The left accent bar `bg-distributor-500` → auto via remap. ✓

**`src/components/investor/GlobalStatsRibbon.tsx`**
- `bg-white/80 border-slate-200/60` → add `style={{ background: 'var(--fin-ribbon-bg)', borderColor: 'var(--fin-ribbon-border)' }}`
- Stat labels `text-slate-500` → `style={{ color: 'var(--fin-ribbon-label)' }}`
- Values → `style={{ color: 'var(--fin-ribbon-value)' }}`

**Charts (Recharts in `ClientHoldingsView`, `FundAnalyticsModal`, all calculators)**
- Chart series `stroke` and `fill` props are hardcoded hex values.
- Replace with CSS variable lookups using `getComputedStyle`:
```typescript
const getCSSVar = (name: string, fallback: string) => {
  if (typeof window === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
};

// In chart JSX:
<Line stroke={getCSSVar('--fin-chart-color-1', '#3d60ab')} />
<Area fill={getCSSVar('--fin-chart-invested-fill', 'rgba(61,96,171,0.15)')} />
```

### Low priority (less visible)

All calculator pages, ledger page, SIPs page — their primary colors come from `distributor-*` classes which are now auto-remapped. Any hardcoded `#3d60ab` or `slate-*` non-brand colors won't change with theme (which is usually fine — `slate` is always neutral).

---

## Section 6 — Implementation Order

Do these in strict order. Each step is independently testable.

```
STEP 1: globals.css — add @theme inline remap block
  → Test: change --fin-brand-600 in DevTools; bg-distributor-600 elements should update

STEP 2: investor-auth.service.ts — add company_id to investor JWT payload
STEP 3: jwt.strategy.ts — add company_id to investor validate() return

STEP 4: themes.controller.ts — fix getCompanyId() to read req.user.company_id directly
  → Test: log in as investor, hit GET /api/themes/active, should return 200

STEP 5: ThemeContext.tsx — fix applyPreview and revertPreview to mutate DOM
  → Test: open ThemePanel, change a color, the whole sidebar/page should update live

STEP 6: ThemePanel.tsx — fix handleReset to only reset local vars, not call activateDefault
  → Test: click Reset, color pickers snap to defaults but active theme unchanged

STEP 7: ThemePanel.tsx — add activateTheme call after saveTheme in handleSave
  → Test: save a new theme, the site immediately shows the new colors

STEP 8: Add FOUC scripts to distributor/layout.tsx and investor/layout.tsx
  → Test: hard-reload with a custom theme active, no flash

STEP 9: themes/[...path]/route.ts — forward Authorization header in proxy
  → Test: investor can GET /api/themes/active without 401

STEP 10: ThemePanel.tsx — add missing ColorPickerGroup sections (Sidebar, Tables, Charts, Status)
  → Test: all pickers appear and update the preview pane

STEP 11: ThemePanel.tsx — wire deriveColorScale to Brand Accent picker
  → Test: change Brand Accent, all brand-* shades auto-update

STEP 12: Component-level overrides for GlobalStatsRibbon, chart series colors
```

---

## Section 7 — Quick Reference: Key File Locations

| Purpose | File |
|---------|------|
| CSS variable definitions | `src/app/globals.css` |
| Tailwind palette remapping | `src/app/globals.css` → `@theme inline {}` |
| Theme state + API calls | `src/context/ThemeContext.tsx` |
| Theme panel UI (editor) | `src/components/settings/ThemePanel.tsx` |
| Theme cards list (picker) | `src/components/settings/ThemePickerList.tsx` |
| Color scale derivation | `src/lib/colorUtils.ts` |
| API proxy to NestJS | `src/app/api/themes/[...path]/route.ts` |
| NestJS theme endpoints | `src/modules/themes/themes.controller.ts` |
| NestJS theme business logic | `src/modules/themes/themes.service.ts` |
| Investor JWT generation | `src/modules/investor-auth/investor-auth.service.ts` |
| JWT validation (both types) | `src/modules/auth/jwt.strategy.ts` |

---

## Section 8 — Things That Are Already Correct (Do Not Touch)

- `ThemePickerList.tsx` — the Activate / Delete / System Default logic is correct. The `handleActivate` → `activateTheme()` → API → `fetchActiveTheme()` flow is solid.
- `ThemesService` — all SQL queries are correct and use proper JSONB operators.
- `ThemesModule` — correctly registered in `app.module.ts`.
- `apiClient.ts` — the token-forward and refresh-token interceptor logic is correct.
- `ThemePreviewPane.tsx` — receives `previewVariables` as prop and applies them as inline styles. This is correct and isolated.
- `colorUtils.ts` — the `deriveColorScale()` function is implemented and correct.
- The `company_themes` DB table — already exists with the right structure.
- `activateDefault` in ThemePickerList — correctly calls the API and re-fetches. Do not change.
