# theme-tasks.md — Complete Theme Panel Implementation
## FinIQ · Production-Ready · Verified Against Actual Codebase

> **Read every section before touching any file.**  
> Every instruction here is based on reading the actual current source code.  
> Follow sections in order. Each section ends with a manual test you must pass before moving on.

---

## Section 0 — What Is Already Correct (Do Not Change)

These things work. Do not touch them.

- `ThemesModule` is registered in `app.module.ts` ✓  
- `ThemesController` endpoints — all 6 routes exist and are guarded ✓  
- `ThemesService` SQL — save/update/delete/activate queries are correct ✓  
- Both `investor-auth.service.ts` already includes `company_id` in JWT payload ✓  
- `jwt.strategy.ts` already returns `company_id` for both investor and staff ✓  
- `ThemePickerList` — the card UI, Activate button, Delete confirmation ✓  
- Both layouts already have the FOUC prevention `<script>` block ✓  
- The proxy route already forwards the `Authorization` header ✓  
- `globals.css` already has `@theme inline` with `distributor-*` and `investor-*` remaps ✓  
- `colorUtils.ts` — `deriveColorScale()` is implemented ✓  
- `ThemeContext` — `activateTheme`, `saveTheme`, `updateSavedTheme`, `deleteSavedTheme`, `activateDefault` all work ✓  

---

## Section 1 — The Root Cause of All Three Reported Bugs

### Bug 1: Preview bleeds into the entire site during editing

**Where it happens:** `ThemeContext.tsx`, `applyPreview` function.

```typescript
// CURRENT (wrong):
const applyPreview = useCallback((vars: Record<string, string>) => {
  snapshotRef.current = variables;
  applyVarsToDOM(vars);  // ← writes to document.documentElement globally
}, [variables, applyVarsToDOM]);
```

`applyVarsToDOM` calls `document.documentElement.style.setProperty(key, value)` which applies CSS variables to the `:root` element — the entire page. So every color picker change immediately re-themes the whole site (sidebar, KPI cards, all pages).

**The correct architecture:** During editing, color changes should go to `ThemePreviewPane` **only**. The global site should change **only** when the user explicitly clicks "Set Active" → `activateTheme()`. The preview pane is already set up to receive `previewVariables` as an inline `style` prop on its container `div`, which scopes the CSS variables to only that subtree. So `applyPreview` should be a **no-op** for global DOM — it just updates `localVars` in `ThemePanel` state, which flows to `ThemePreviewPane` via props.

### Bug 2: Theme cannot be saved to the database

**Where it happens:** `ThemesService.saveTheme()` in `themes.service.ts`.

The SQL `ON CONFLICT (company_id)` requires `company_id` to be either a PRIMARY KEY or have a UNIQUE constraint. The real `company_themes` table schema (verified from the attached schema file) has:
- Primary key: `id uuid` (not `company_id`)
- Unique constraint: `company_themes_company_id_key UNIQUE (company_id)` ✓

So the `ON CONFLICT (company_id)` **should** work. However, the `onModuleInit` `CREATE TABLE IF NOT EXISTS` defines `company_id TEXT PRIMARY KEY` — a completely different schema. If the table was ever dropped and recreated by the service (instead of using the real schema), the table would have `company_id` as PK with type `TEXT`, while the actual data has UUIDs. This creates a type mismatch.

More critically: the service `ON CONFLICT (company_id)` clause works only if Postgres knows about the constraint. The real schema has `UNIQUE (company_id)`, so it works. But there is a second issue: the `apiClient` is called with `apiClient.post<SavedTheme>("themes/saved", ...)` — the endpoint path is `themes/saved` which the `apiClient` prepends with `/api/` → `/api/themes/saved`. The proxy route handles `/api/themes/[...path]` → `API_BASE/themes/[...path]` → `API_BASE/themes/saved`. This is correct. But — is `API_BASE` set correctly? `NEXT_PUBLIC_API_URL` must match the running NestJS port. If not set, it defaults to `http://localhost:3000`.

**The third issue causing save failures:** The `ThemePanel.tsx` `handleSave` function currently calls `saveTheme()` and then **immediately** calls `activateTheme(saved.id)`. If `saveTheme` succeeds but `activateTheme` fails (race condition, network error), the save is lost from the user's perspective even though it was written to DB. The UX should decouple these.

### Bug 3: Preview pane variables not properly scoped / not syncing correctly

**Where it happens:** `ThemePreviewPane.tsx` — the component receives `previewVariables` as a prop and applies them as `style={previewVariables as React.CSSProperties}` on the root `div`. This is the correct scoped approach. The variables will cascade to all children via CSS inheritance.

The problem is that `ThemePanel` also calls `applyPreview(merged)` in its `useEffect` (when `editorMode` changes), which calls `applyVarsToDOM` on `document.documentElement`. So the same variables are applied both scopedly (good) AND globally (bad). The fix: remove all `applyPreview` calls from `ThemePanel.tsx` entirely. Just update `localVars` state — it will flow to `ThemePreviewPane` automatically via props.

---

## Section 2 — Backend Fix: `onModuleInit` in `themes.service.ts`

The `CREATE TABLE IF NOT EXISTS` uses the wrong schema. Since the real table already exists in production, this never recreates the table. But it is misleading and creates a risk if the table is ever dropped. Replace it with an approach that only ensures migrations are run.

**File:** `src/modules/themes/themes.service.ts`

**Find and replace the entire `onModuleInit` method:**

```typescript
async onModuleInit() {
  try {
    // The company_themes table already exists in production (schema-managed).
    // We only ensure the active_theme_id column exists — safe to run every startup.
    await db.query(`
      ALTER TABLE company_themes
      ADD COLUMN IF NOT EXISTS active_theme_id TEXT DEFAULT NULL
    `);
    console.log('[ThemesService] company_themes schema verified.');
  } catch (err) {
    console.error('[ThemesService] Migration error:', err);
  }
}
```

That is the only change needed in the service. All other methods (`saveTheme`, `activateTheme`, `deleteSavedTheme`, etc.) are already correct.

---

## Section 3 — Backend Fix: `deleteSavedTheme` must clear `theme_variables` when active

**File:** `src/modules/themes/themes.service.ts`

The current `deleteSavedTheme` correctly sets `active_theme_id = NULL` when the deleted theme was active, but it does NOT clear `theme_variables` or reset `theme_name`. This means the deleted theme's colours remain as the active theme visually for all users until they reload.

**Find:**
```typescript
async deleteSavedTheme(companyId: string, themeId: string) {
  const query = `
    UPDATE company_themes
    SET 
      saved_themes    = saved_themes - $2::text,
      active_theme_id = CASE WHEN active_theme_id = $2 THEN NULL ELSE active_theme_id END,
      updated_at      = CURRENT_TIMESTAMP
    WHERE company_id = $1
  `;
  await db.query(query, [companyId, themeId]);
}
```

**Replace with:**
```typescript
async deleteSavedTheme(companyId: string, themeId: string) {
  const query = `
    UPDATE company_themes
    SET
      saved_themes    = saved_themes - $2::text,
      active_theme_id = CASE WHEN active_theme_id = $2 THEN NULL         ELSE active_theme_id  END,
      theme_variables = CASE WHEN active_theme_id = $2 THEN '{}'::jsonb  ELSE theme_variables   END,
      theme_name      = CASE WHEN active_theme_id = $2 THEN 'System Default' ELSE theme_name   END,
      updated_at      = CURRENT_TIMESTAMP
    WHERE company_id = $1
  `;
  await db.query(query, [companyId, themeId]);
}
```

---

## Section 4 — Frontend Core Fix: `ThemeContext.tsx`

This is the most important file. The `applyPreview` and `revertPreview` functions must become no-ops for global DOM. All global DOM changes happen only through `activateTheme` and `activateDefault`.

**File:** `src/context/ThemeContext.tsx`

**Replace the entire file with this:**

```typescript
"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { apiClient } from "@/lib/apiClient";

export interface SavedTheme {
  id: string;
  name: string;
  variables: Record<string, string>;
  is_default?: boolean;
  created_at: string;
}

interface ThemeContextValue {
  // The currently active theme's variables (applied to the whole site)
  variables: Record<string, string>;
  themeName: string;
  activeThemeId: string | null;
  savedThemes: SavedTheme[];
  isLoading: boolean;

  // applyPreview / revertPreview are intentionally NO-OPS for global DOM.
  // They exist so ThemePanel can call them without errors, but they do nothing
  // to the global site. The ThemePreviewPane receives localVars directly via props
  // and scopes them with inline style — no global mutation needed.
  applyPreview: (vars: Record<string, string>) => void;
  revertPreview: () => void;

  // These are the ONLY functions that change the global site appearance:
  activateTheme: (savedThemeId: string) => Promise<void>;
  activateDefault: () => Promise<void>;

  saveTheme: (name: string, variables: Record<string, string>) => Promise<SavedTheme>;
  updateSavedTheme: (id: string, name: string, variables: Record<string, string>) => Promise<SavedTheme>;
  deleteSavedTheme: (id: string) => Promise<void>;
  refreshTheme: () => Promise<void>;
  refreshSavedThemes: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [themeName, setThemeName] = useState("System Default");
  const [activeThemeId, setActiveThemeId] = useState<string | null>(null);
  const [savedThemes, setSavedThemes] = useState<SavedTheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // snapshotRef is kept for potential future use but not used for global DOM mutation.
  const snapshotRef = useRef<Record<string, string>>({});

  const applyVarsToDOM = useCallback((vars: Record<string, string>) => {
    if (typeof window === "undefined") return;
    if (Object.keys(vars).length === 0) {
      // System default: remove all inline overrides so :root CSS defaults apply
      document.documentElement.style.cssText = "";
      // Also remove individual properties in case cssText didn't fully clear
      const root = document.documentElement;
      Array.from(root.style).forEach((prop) => {
        if (prop.startsWith("--fin-")) root.style.removeProperty(prop);
      });
      return;
    }
    Object.entries(vars).forEach(([key, value]) => {
      document.documentElement.style.setProperty(key, value);
    });
  }, []);

  const fetchActiveTheme = useCallback(async () => {
    try {
      const data = await apiClient.get<any>("themes/active");
      const vars = data.theme_variables || {};
      const name = data.theme_name || "System Default";
      const id = data.active_theme_id || null;
      setVariables(vars);
      setThemeName(name);
      setActiveThemeId(id);
      applyVarsToDOM(vars);
      // Cache for FOUC prevention on next page load
      try {
        if (Object.keys(vars).length > 0) {
          localStorage.setItem("finiq_theme_vars", JSON.stringify(vars));
        } else {
          localStorage.removeItem("finiq_theme_vars");
        }
      } catch (_) {}
    } catch (error) {
      console.error("Failed to fetch active theme:", error);
    }
  }, [applyVarsToDOM]);

  const fetchSavedThemes = useCallback(async () => {
    try {
      const data = await apiClient.get<SavedTheme[]>("themes/saved");
      setSavedThemes(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch saved themes:", error);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchActiveTheme(), fetchSavedThemes()]);
      setIsLoading(false);
    };
    init();
  }, [fetchActiveTheme, fetchSavedThemes]);

  // ─── applyPreview and revertPreview are INTENTIONAL NO-OPS ───────────────
  // The preview pane is isolated via inline style scoping on its container.
  // Global DOM changes happen only through activateTheme / activateDefault below.
  const applyPreview = useCallback((_vars: Record<string, string>) => {
    // No-op: ThemePreviewPane receives localVars directly as a prop.
    // The variables are scoped to the preview container via inline style.
  }, []);

  const revertPreview = useCallback(() => {
    // No-op: nothing to revert because we never applied anything globally.
    // When the user cancels editing, the active theme (set via activateTheme)
    // is already visible on the live site unchanged.
  }, []);

  // ─── These are the only functions that mutate the global site ────────────

  const activateTheme = useCallback(async (savedThemeId: string) => {
    await apiClient.put(`themes/activate/${savedThemeId}`, {});
    snapshotRef.current = {};
    await fetchActiveTheme(); // Re-fetches and applies to DOM globally
  }, [fetchActiveTheme]);

  const activateDefault = useCallback(async () => {
    await apiClient.put("themes/activate-default", {});
    snapshotRef.current = {};
    try { localStorage.removeItem("finiq_theme_vars"); } catch (_) {}
    await fetchActiveTheme(); // Re-fetches and clears DOM vars globally
  }, [fetchActiveTheme]);

  // ─── These mutate the DB but do NOT change the live site appearance ───────

  const saveTheme = useCallback(async (
    name: string,
    newVars: Record<string, string>,
  ): Promise<SavedTheme> => {
    const data = await apiClient.post<SavedTheme>("themes/saved", {
      name,
      variables: newVars,
    });
    await fetchSavedThemes(); // Refresh the list
    return data;
  }, [fetchSavedThemes]);

  const updateSavedTheme = useCallback(async (
    id: string,
    name: string,
    newVars: Record<string, string>,
  ): Promise<SavedTheme> => {
    const data = await apiClient.put<SavedTheme>(`themes/saved/${id}`, {
      name,
      variables: newVars,
    });
    await fetchSavedThemes();
    // If this is the currently active theme, also refresh the active theme
    // to update the global site appearance with the new variables.
    if (activeThemeId === id) {
      await activateTheme(id); // Re-push to DB and re-apply globally
    }
    return data;
  }, [fetchSavedThemes, activateTheme, activeThemeId]);

  const deleteSavedTheme = useCallback(async (id: string) => {
    await apiClient.delete(`themes/saved/${id}`);
    await fetchSavedThemes();
    // If we deleted the active theme, the backend already reset to System Default.
    // Re-fetch active theme to pick up the cleared state.
    if (activeThemeId === id) {
      await fetchActiveTheme();
    }
  }, [fetchSavedThemes, fetchActiveTheme, activeThemeId]);

  return (
    <ThemeContext.Provider
      value={{
        variables,
        themeName,
        activeThemeId,
        savedThemes,
        isLoading,
        applyPreview,
        revertPreview,
        activateTheme,
        activateDefault,
        saveTheme,
        updateSavedTheme,
        deleteSavedTheme,
        refreshTheme: fetchActiveTheme,
        refreshSavedThemes: fetchSavedThemes,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
```

**Why this works:**
- `applyPreview` → no-op. Color changes in the editor stay in `localVars` state inside `ThemePanel`. They flow to `ThemePreviewPane` via the `previewVariables` prop. `ThemePreviewPane` applies them as `style={previewVariables}` on its root div — scoped to only that subtree.
- `activateTheme` → calls API, re-fetches, calls `applyVarsToDOM` → changes the entire site.
- The live site never changes while the user is editing. Only "Set Active" changes the site.

---

## Section 5 — Frontend Fix: `ThemePanel.tsx`

With `applyPreview` now a no-op, the panel needs to stop calling it in `useEffect` and rely purely on `localVars` flowing to `ThemePreviewPane` as props.

**File:** `src/components/settings/ThemePanel.tsx`

### Fix 1 — Remove `applyPreview`/`revertPreview` calls from `useEffect`

**Find:**
```typescript
// When editing an existing theme, load its vars into the editor
useEffect(() => {
  if (editorMode.type === "edit") {
    const merged = { ...DEFAULT_VARS, ...editorMode.theme.variables };
    setLocalVars(merged);
    setThemeName(editorMode.theme.name || "");
    applyPreview(merged);           // ← REMOVE THIS LINE
    setHasUnsavedChanges(false);
  } else if (editorMode.type === "new") {
    const merged = { ...DEFAULT_VARS, ...variables };
    setLocalVars(merged);
    setThemeName("");
    applyPreview(merged);           // ← REMOVE THIS LINE
    setHasUnsavedChanges(false);
    setTimeout(() => themeNameRef.current?.focus(), 100);
  } else {
    // idle: revert to whatever is active
    setLocalVars({ ...DEFAULT_VARS, ...variables });
    setThemeName("");
    revertPreview();                // ← REMOVE THIS LINE
    setHasUnsavedChanges(false);
  }
  setConfirmDelete(false);
}, [editorMode]); // eslint-disable-line react-hooks/exhaustive-deps
```

**Replace with:**
```typescript
useEffect(() => {
  if (editorMode.type === "edit") {
    const merged = { ...DEFAULT_VARS, ...editorMode.theme.variables };
    setLocalVars(merged);
    setThemeName(editorMode.theme.name || "");
    setHasUnsavedChanges(false);
  } else if (editorMode.type === "new") {
    // Start a new theme from the current active vars as a base
    const merged = { ...DEFAULT_VARS, ...variables };
    setLocalVars(merged);
    setThemeName("");
    setHasUnsavedChanges(false);
    setTimeout(() => themeNameRef.current?.focus(), 100);
  } else {
    // idle: reset editor to active theme
    setLocalVars({ ...DEFAULT_VARS, ...variables });
    setThemeName("");
    setHasUnsavedChanges(false);
  }
  setConfirmDelete(false);
}, [editorMode]); // eslint-disable-line react-hooks/exhaustive-deps
```

### Fix 2 — Remove `applyPreview` call from `handleColorChange`

**Find:**
```typescript
const handleColorChange = useCallback((key: string, val: string) => {
  setLocalVars((prev) => {
    let updated = { ...prev, [key]: val };
    if (key === "--fin-brand-600") {
      const scale = deriveColorScale(val);
      updated = { ...updated, ...scale };
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
    applyPreview(updated);   // ← REMOVE THIS LINE
    return updated;
  });
  setHasUnsavedChanges(true);
}, [applyPreview]);
```

**Replace with:**
```typescript
const handleColorChange = useCallback((key: string, val: string) => {
  setLocalVars((prev) => {
    let updated = { ...prev, [key]: val };

    // Auto-derive the full brand scale when the 600 (accent) changes
    if (key === "--fin-brand-600") {
      const scale = deriveColorScale(val);
      updated = { ...updated, ...scale };
      // Sync all tokens that should always match the brand accent
      updated["--fin-sidebar-item-active-bg"] = val;
      updated["--fin-sidebar-brand-label"] = val;
      updated["--fin-btn-primary-bg"] = val;
      updated["--fin-btn-primary-bg-hover"] = scale["--fin-brand-700"] ?? val;
      updated["--fin-link-text"] = val;
      updated["--fin-heading-secondary"] = val;
      updated["--fin-kpi-value-revealed"] = val;
      updated["--fin-kpi-accent-bar"] = scale["--fin-brand-500"] ?? val;
      updated["--fin-filter-option-active-bg"] = val;
      updated["--fin-page-btn-active-bg"] = val;
      updated["--fin-chart-color-1"] = val;
      updated["--fin-modal-tab-active-border"] = val;
    }
    // No applyPreview here — localVars flows to ThemePreviewPane via props
    return updated;
  });
  setHasUnsavedChanges(true);
}, []); // No dependencies needed — no external calls
```

### Fix 3 — Decouple Save and Activate in `handleSave`

The current code auto-activates on save. This was causing issues because if activate fails, the save is lost from the user's perspective. Decouple them: Save stores to DB. "Set Active" activates it company-wide.

**Find:**
```typescript
const handleSave = async () => {
  if (!(themeName || "").trim()) {
    themeNameRef.current?.focus();
    addToast("error", "Please enter a name for this theme.");
    return;
  }
  setIsSubmitting(true);
  try {
    if (editorMode.type === "edit") {
      await updateSavedTheme(editorMode.theme.id, themeName.trim(), localVars);
      if (activeThemeId === editorMode.theme.id) {
        await activateTheme(editorMode.theme.id);
        addToast("success", `"${themeName.trim()}" updated and live across your company.`);
      } else {
        addToast("success", `"${themeName.trim()}" updated and saved.`);
      }
      setEditorMode({ type: "edit", theme: { ...editorMode.theme, name: themeName.trim(), variables: localVars } });
    } else {
      const saved = await saveTheme(themeName.trim(), localVars);
      await activateTheme(saved.id);
      addToast("success", `"${saved.name}" saved and activated for your company.`);
      setEditorMode({ type: "edit", theme: saved });
    }
    setHasUnsavedChanges(false);
  } catch (err: any) {
    addToast("error", err?.message || "Failed to save theme. Please try again.");
  } finally {
    setIsSubmitting(false);
  }
};
```

**Replace with:**
```typescript
const handleSave = async () => {
  if (!(themeName || "").trim()) {
    themeNameRef.current?.focus();
    addToast("error", "Please enter a name for this theme.");
    return;
  }
  setIsSubmitting(true);
  try {
    if (editorMode.type === "edit") {
      // Update the saved theme in the DB
      const updated = await updateSavedTheme(
        editorMode.theme.id,
        themeName.trim(),
        localVars,
      );
      // updateSavedTheme in context already re-activates if it's the active theme
      if (activeThemeId === editorMode.theme.id) {
        addToast("success", `"${themeName.trim()}" updated and live across your company.`);
      } else {
        addToast("success", `"${themeName.trim()}" saved. Use "Set Active" to apply it.`);
      }
      setEditorMode({
        type: "edit",
        theme: { ...editorMode.theme, name: themeName.trim(), variables: localVars },
      });
    } else {
      // Save as a new theme — does NOT auto-activate
      const saved = await saveTheme(themeName.trim(), localVars);
      addToast(
        "success",
        `"${saved.name}" saved. Click "Set Active" to apply it company-wide.`,
      );
      setEditorMode({ type: "edit", theme: saved });
    }
    setHasUnsavedChanges(false);
  } catch (err: any) {
    addToast("error", err?.message || "Failed to save theme. Please try again.");
  } finally {
    setIsSubmitting(false);
  }
};
```

### Fix 4 — Show "Set Active" button for ALL saved themes including currently active

The current code hides "Set Active" when `!currentIsActive`. But when editing the active theme and changing colors, after saving the user should be able to re-activate (to pick up the latest saved vars). Change the logic:

**Find:**
```typescript
const currentIsActive = editorMode.type === "edit" && activeThemeId === editorMode.theme.id;
```

Keep this line. Then find the button rendering section and update:

**Find:**
```tsx
{/* Apply Theme */}
{editorMode.type === "edit" && !currentIsActive && (
  <button
    onClick={handleActivateCurrent}
    disabled={isSubmitting || isActivating || hasUnsavedChanges}
    ...
  >
    ...Set Active
  </button>
)}
```

**Replace with:**
```tsx
{/* Set Active button — shown when in edit mode */}
{editorMode.type === "edit" && (
  <button
    onClick={handleActivateCurrent}
    disabled={isSubmitting || isActivating || hasUnsavedChanges}
    className={`px-4 py-2.5 flex items-center gap-2 text-sm font-bold rounded-xl transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
      currentIsActive
        ? "text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 cursor-default"
        : "text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100"
    }`}
    title={
      currentIsActive
        ? "This is the active theme"
        : hasUnsavedChanges
          ? "Save changes before activating"
          : "Apply as the active theme for your entire company"
    }
  >
    {isActivating ? (
      <Loader2 size={15} className="animate-spin" />
    ) : currentIsActive ? (
      <CheckCircle2 size={15} />
    ) : (
      <Zap size={15} />
    )}
    <span className="hidden xl:inline">
      {currentIsActive ? "Active" : "Set Active"}
    </span>
  </button>
)}
```

### Fix 5 — Allow deleting the active theme

The current code hides the Delete button when `currentIsActive`. This prevents deleting the active theme. Remove that restriction — the backend and context already handle graceful fallback to System Default.

**Find:**
```tsx
{/* Delete Theme */}
{editorMode.type === "edit" && !currentIsActive && (
```

**Replace with:**
```tsx
{/* Delete Theme */}
{editorMode.type === "edit" && (
```

### Fix 6 — Save button label when in "new" mode

Update the Save button label to clearly communicate that saving does NOT activate:

**Find:**
```tsx
<span>
  {editorMode.type === "edit"
    ? "Save Changes"
    : "Save & Activate"}
</span>
```

**Replace with:**
```tsx
<span>
  {editorMode.type === "edit" ? "Save Changes" : "Save Theme"}
</span>
```

### Fix 7 — Reset button: keep it correct (already correct in current code)

The current `handleReset` function is already correct — it only resets `localVars` to `DEFAULT_VARS` without touching the DB. No change needed here. Just confirm it does NOT call `activateDefault()` or `applyPreview()`. Current code:

```typescript
const handleReset = () => {
  setLocalVars({ ...DEFAULT_VARS });
  if (isEditing) {
    applyPreview({ ...DEFAULT_VARS });  // ← this is now a no-op, harmless
  }
  setHasUnsavedChanges(true);
  addToast("success", "Color inputs reset to system defaults. Save to apply.");
};
```

This is fine. The `applyPreview` call is a no-op so it's harmless.

---

## Section 6 — Frontend Fix: `ThemePreviewPane.tsx`

The preview pane architecture is already correct — it receives `previewVariables` as a prop and applies them via inline `style` on the root `div`. This scopes the CSS variables to only the preview pane subtree.

However, there is one issue: some CSS variable references inside the pane use `var(--fin-brand-50)`, `var(--fin-brand-100)`, `var(--fin-brand-200)` etc. that are NOT in `DEFAULT_VARS` and may not be in `previewVariables`. Since `DEFAULT_VARS` in `ThemePanel` only covers ~40 variables but `globals.css :root` defines ~160, the preview pane will fall through to `:root` for missing vars. This means the preview shows a mix of the preview vars AND the globally active theme's vars for missing keys.

**Fix:** Add the full brand scale to the `previewVariables` object passed to `ThemePreviewPane` by ensuring `DEFAULT_VARS` in `ThemePanel` includes all brand scale entries. The current `DEFAULT_VARS` only has `--fin-brand-500`, `--fin-brand-600`, and `--fin-brand-900`. Add the rest.

**File:** `src/components/settings/ThemePanel.tsx`

**Find:**
```typescript
const DEFAULT_VARS: Record<string, string> = {
  "--fin-brand-500": "#658ccb",
  "--fin-brand-600": "#3d60ab",
  "--fin-brand-900": "#263760",
  // ... rest of vars
```

**Replace the brand section with the complete scale:**
```typescript
const DEFAULT_VARS: Record<string, string> = {
  // Full brand scale — must be complete so preview pane is fully isolated
  "--fin-brand-50":  "#f0f4fa",
  "--fin-brand-100": "#e3ecf7",
  "--fin-brand-200": "#cddcf0",
  "--fin-brand-300": "#abc5e6",
  "--fin-brand-400": "#83a8d9",
  "--fin-brand-500": "#658ccb",
  "--fin-brand-600": "#3d60ab",
  "--fin-brand-700": "#334e8f",
  "--fin-brand-800": "#2b4177",
  "--fin-brand-900": "#263760",
  "--fin-brand-950": "#18223e",
  // ... keep all other existing vars unchanged
```

Also add these missing vars that the preview pane references:
```typescript
  "--fin-kpi-accent-bar": "#658ccb",
  "--fin-ribbon-bg": "#ffffff",
  "--fin-ribbon-border": "rgba(226,232,240,0.60)",
  "--fin-ribbon-label": "#94a3b8",
  "--fin-ribbon-value": "#0f172a",
  "--fin-ribbon-highlight-value": "#3d60ab",
  "--fin-modal-bg": "#ffffff",
  "--fin-modal-border": "#e2e8f0",
  "--fin-modal-tab-active-border": "#3d60ab",
  "--fin-filter-option-active-bg": "#3d60ab",
  "--fin-filter-option-active-text": "#ffffff",
  "--fin-page-btn-active-bg": "#3d60ab",
  "--fin-table-row-border": "#f1f5f9",
  "--fin-link-text": "#3d60ab",
  "--fin-aux-text": "#94a3b8",
  "--fin-overline-text": "#94a3b8",
```

---

## Section 7 — `globals.css` — Remove Duplicate `@tailwind` Directives

**File:** `src/app/globals.css`

In Tailwind v4, `@import "tailwindcss"` is the complete replacement for the three legacy `@tailwind` directives. Having both causes duplicate style processing.

**Find (lines 3–5):**
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Delete these three lines entirely.** The file should start:
```css
@import "tailwindcss";

:root {
  /* ── PAGE FOUNDATION ──────────────────────────────── */
```

---

## Section 8 — Staff JWT `company_id` Fix (Important for Multi-Tenancy)

The `User` entity has `company_id?: string = '9d034353-d658-4fa5-b5a1-e46253cdbc0c'` as a hardcoded default — it is **not** a real database column on the `users` table. The real `company_id` for staff lives in `user_profiles.company_id`.

The staff JWT payload includes `company_id: user.company_id` which is always this hardcoded UUID. In a single-company development/demo setup this works fine. In a real multi-tenant deployment this is wrong — every staff user would appear to belong to the same company.

The `getCompanyId()` in `ThemesController` reads `req.user?.company_id` first (the hardcoded one), then falls back to `req.user?.roles?.find(r => r.company_id)?.company_id` (the real one from user_profiles). Since the hardcoded one is always present and is a valid UUID, it always uses the hardcoded value.

**For now (demo/single-company), this works.** The fix for production multi-tenancy is:

**File:** `src/modules/themes/themes.controller.ts`

**Replace `getCompanyId()`:**
```typescript
private getCompanyId(req: any): string {
  // Priority 1: Extract from roles[] (real company_id from user_profiles table)
  // This is reliable for staff users in multi-tenant setups.
  const companyIdFromRoles =
    req.user?.roles?.find((r: any) => r.company_id)?.company_id;

  // Priority 2: Top-level claim (reliable for investors; hardcoded fallback for staff)
  const companyIdDirect = req.user?.company_id;

  const companyId = companyIdFromRoles || companyIdDirect;

  if (!companyId) {
    throw new Error(
      `Cannot resolve company_id. type=${req.user?.type}, id=${req.user?.id}`,
    );
  }
  return companyId;
}
```

---

## Section 9 — End-to-End Test Sequence

After all changes are made, test in this exact order. Each step must fully pass before the next.

### Test 1 — System Default renders correctly
1. Clear localStorage (`localStorage.clear()` in DevTools console)
2. Navigate to `/distributor`
3. Site renders with the default blue palette (sidebar blue, KPIs standard)
4. No flash or visual glitch
5. **Pass:** Default theme is intact

### Test 2 — Save a new theme
1. Go to `/distributor/settings` → "Appearance" tab
2. Click "+ New Theme"
3. Change Brand Accent (`--fin-brand-600`) to `#dc2626` (red)
4. **Verify:** The ThemePreviewPane on the right shows red elements (sidebar strip, buttons, KPI accents)
5. **Verify:** The live site sidebar and KPI cards are STILL BLUE — no global change
6. Type theme name "Red Brand"
7. Click "Save Theme"
8. **Verify:** Toast says `"Red Brand" saved. Click "Set Active" to apply it.`
9. **Verify:** The "Red Brand" card appears in the theme picker list at the top
10. **Verify:** The live site is STILL BLUE — saving alone does not change the site

### Test 3 — Activate a theme company-wide
1. Continuing from Test 2, the editor is still on "Red Brand" in edit mode
2. Click "Set Active" button
3. **Verify:** Toast says "Red Brand is now the active theme."
4. **Verify:** The entire live site immediately turns red (sidebar active items, brand gradient, buttons)
5. **Verify:** "Red Brand" card in the picker list shows an Active badge / checkmark
6. Open a new incognito tab, log in as the same company's investor
7. Navigate to `/investor`
8. **Verify:** Investor portal sidebar also shows red brand colors
9. **Pass:** Theme is applied company-wide

### Test 4 — Edit an existing theme
1. Click the "Red Brand" card in the picker list to enter edit mode
2. Change Brand Accent to `#7c3aed` (purple)
3. **Verify:** Preview pane shows purple — live site is STILL RED
4. Type a new name "Purple Brand"
5. Click "Save Changes"
6. Since "Red Brand" was the active theme and we just saved with new vars, `updateSavedTheme` in context calls `activateTheme` → live site should NOW turn purple
7. **Verify:** Site turns purple after save
8. **Pass:** Active theme updates live on save

### Test 5 — Cancel edit without affecting the site
1. Click the "Purple Brand" card (active)
2. Change some colors — preview pane updates
3. Click "Cancel"
4. **Verify:** Live site stays purple (unchanged)
5. **Verify:** Preview pane resets to Purple Brand's original colors
6. **Pass:** Cancel never touches the live site

### Test 6 — Delete a non-active theme
1. Create a second theme "Ocean Blue" (don't activate it)
2. In the picker list, click Ocean Blue card to enter edit mode
3. Click "Delete"
4. Confirm deletion
5. **Verify:** "Ocean Blue" disappears from the list
6. **Verify:** "Purple Brand" is still active, site still purple
7. **Pass:** Non-active theme deleted correctly

### Test 7 — Delete the active theme
1. With "Purple Brand" active, click its card to edit
2. Click "Delete" → Confirm
3. **Verify:** "Purple Brand" deleted from list
4. **Verify:** Site reverts to System Default (blue)
5. **Verify:** "System Default" card has the Active indicator
6. **Pass:** Deleting active theme gracefully resets to System Default

### Test 8 — System Default card
1. Create and activate "Red Brand"
2. In the picker list, click "System Default" card
3. Click its "Apply" / "Set Active" button
4. **Verify:** Site reverts to default blue
5. **Verify:** "Red Brand" still exists in the list (not deleted)
6. **Pass:** System Default works independently of saved themes

### Test 9 — Reset to Defaults button
1. Create a new theme (don't save yet)
2. Change Brand Accent to red — preview pane turns red
3. Click "Reset to Defaults"
4. **Verify:** All color pickers snap back to default values
5. **Verify:** Preview pane shows default blue again
6. **Verify:** Live site is unchanged (whatever was active before stays active)
7. **Verify:** No DB call was made (check Network tab — no PUT/POST requests)
8. **Pass:** Reset only affects the editor inputs

### Test 10 — FOUC (Flash of Unstyled Content)
1. With a custom theme active (e.g. Red Brand), do a hard reload (Ctrl+Shift+R)
2. **Verify:** Page appears with red theme immediately — no flash of blue before red appears
3. **Pass:** FOUC prevention script working

### Test 11 — Multi-company isolation
1. Log in as Company A's distributor, set theme "Saffron" (orange brand)
2. Log in as Company B's distributor in a different browser/incognito
3. **Verify:** Company B still sees default blue
4. Set Company B's theme to "Forest" (green brand)
5. **Verify:** Company A still sees orange (Saffron)
6. **Pass:** Themes are company-scoped

---

## Section 10 — Complete File Change Manifest

Every file that needs changing, in priority order:

### finiq-api (NestJS)

| File | Change | Section |
|------|--------|---------|
| `src/modules/themes/themes.service.ts` | Replace `onModuleInit` body (keep only `ALTER TABLE ADD COLUMN IF NOT EXISTS`) | §2 |
| `src/modules/themes/themes.service.ts` | Replace `deleteSavedTheme` to also clear `theme_variables` when deleting active | §3 |
| `src/modules/themes/themes.controller.ts` | Replace `getCompanyId()` to prioritize `roles[].company_id` | §8 |

### finiq (Next.js)

| File | Change | Section |
|------|--------|---------|
| `src/context/ThemeContext.tsx` | **Full replacement** — `applyPreview`/`revertPreview` become no-ops; all else unchanged | §4 |
| `src/components/settings/ThemePanel.tsx` | Remove `applyPreview` from `useEffect`; remove from `handleColorChange`; decouple save/activate; fix button logic | §5 (fixes 1–7) |
| `src/components/settings/ThemePanel.tsx` | Add full brand scale to `DEFAULT_VARS`; add missing vars | §6 |
| `src/app/globals.css` | Remove `@tailwind base/components/utilities` (lines 3–5) | §7 |

### Files that do NOT need changes

- `ThemePreviewPane.tsx` — architecture is correct ✓
- `ThemePickerList.tsx` — activate/delete flow is correct ✓
- `ColorPickerGroup.tsx` — works correctly ✓
- `distributor/layout.tsx` — FOUC script already there ✓
- `investor/layout.tsx` — FOUC script already there ✓
- `src/app/api/themes/[...path]/route.ts` — proxy already forwards Authorization ✓
- `src/lib/apiClient.ts` — token forwarding works ✓
- `src/lib/colorUtils.ts` — `deriveColorScale` is correct ✓
- `src/modules/themes/themes.module.ts` — registered correctly ✓
- `src/modules/investor-auth/investor-auth.service.ts` — `company_id` already in JWT ✓

---

## Section 11 — Architecture Summary (One-Page Reference)

```
USER EDITS COLORS IN PICKER
         │
         ▼
localVars state (ThemePanel)  ────────────────►  ThemePreviewPane
         │                                         (scoped via inline style=
         │                                          {previewVariables} on root div)
         │                                         NEVER touches document.documentElement
         │
         ▼ only on "Save Theme" click
  POST /api/themes/saved  →  DB: saved_themes JSONB
         │
         ▼ only on "Set Active" click (or "Save Changes" if updating active theme)
  PUT /api/themes/activate/:id
         │
         ▼
  fetchActiveTheme()  →  applyVarsToDOM()  →  document.documentElement.style.setProperty()
         │
         ▼
  ENTIRE SITE updates  +  localStorage cache updated (FOUC prevention)
  ALL company users see the change on their next page load / navigation
```

```
INVESTOR LOADS /investor
         │
         ▼
FOUC script reads localStorage → applies cached vars instantly (zero flash)
         │
         ▼
ThemeProvider mounts → GET /api/themes/active
JWT contains company_id (investor-auth.service.ts puts it in payload)
NestJS extracts company_id → returns company's active theme_variables
         │
         ▼
applyVarsToDOM() → investor portal renders in distributor's chosen theme
```

---

## Section 12 — Common Errors and What They Mean

| Error | Cause | Fix |
|-------|-------|-----|
| `POST /api/themes/saved` returns 401 | JWT token not forwarded; proxy issue | Verify proxy forwards `Authorization` header (already done) |
| `POST /api/themes/saved` returns 500 | `ON CONFLICT (company_id)` fails | Run `ALTER TABLE company_themes ADD CONSTRAINT ... UNIQUE (company_id)` if constraint is missing |
| `GET /api/themes/active` returns `{ error: "Could not reach API server" }` | `NEXT_PUBLIC_API_URL` not set, or NestJS not running | Set `NEXT_PUBLIC_API_URL=http://localhost:3001` (or your NestJS port) in `.env.local` |
| Theme saves but list doesn't update | `fetchSavedThemes()` call failing silently | Check console for errors; verify `GET /api/themes/saved` returns array |
| Preview pane shows wrong colors for brand-50 etc | Missing vars in `DEFAULT_VARS` | Add full brand scale to `DEFAULT_VARS` (§6) |
| Deleting active theme doesn't revert site | `deleteSavedTheme` SQL not clearing `theme_variables` | Apply §3 fix |
| `@theme inline` not working (distributor-600 not theming) | Both `@import` and `@tailwind` in globals.css conflicting | Remove `@tailwind` lines (§7) |
| Staff from different companies see same theme | `user.company_id` is hardcoded in entity | Apply §8 fix to use `roles[].company_id` instead |

---

## Section 13 — Auth Token Refresh & Company Logo: Complete Bug Audit

### 13.1 — All Confirmed Bugs (Verified Against Source Code)

| # | Bug | File | Evidence |
|---|-----|------|----------|
| A1 | **No Next.js proxy route for `/api/auth/*`** — the only proxy that exists is `/api/themes/[...path]/route.ts`. `apiClient.post("/auth/refresh")` hits `/api/auth/refresh` which returns Next.js 404, never reaching NestJS. Token refresh has never worked. | `src/app/api/` — only `themes/` subdirectory exists | `find src/app/api -type f` shows one file |
| A2 | **Investor login never stores `user_id` or `refresh_token` cookie** — `setAuthCookies(actualToken, undefined, "investor")` is called with `undefined` for both `refreshToken` and `userId`. So `investor-refresh-token` and `investor-user-id` cookies are never written. The refresh interceptor checks for these cookies and silently skips refresh. | `src/app/(auth)/login/page.tsx` line 34 | `setAuthCookies(actualToken, undefined, "investor")` |
| A3 | **Investor has no refresh token in the database** — `investors` table has no `refresh_token` or `refresh_token_expires_at` column. The backend `investor-auth.service.ts` never generates or stores a refresh token. There is no `/api/investor-auth/refresh` endpoint. Investor sessions cannot be refreshed — they always expire. | DB schema, `investor-auth.service.ts`, `investor-auth.controller.ts` | No refresh endpoint in investor controller |
| A4 | **`User` entity has `company_id` commented out** — the DB `users` table has a real `company_id uuid` column but the TypeORM entity has `// @Column({ nullable: true }) company_id: string;` commented out, replaced with a hardcoded constant. Staff JWT always carries `company_id = '9d034353-d658-4fa5-b5a1-e46253cdbc0c'` regardless of which company the user belongs to. | `src/entities/user.entity.ts` lines 27–29 | `company_id?: string = '9d034353-...'` |
| A5 | **Distributor login has `company_logo` storage commented out** — the `handleOTPVerify` function has the localStorage save block for `company_logo_base64` commented out with `// if (response.data?.user?.company_logo)`. Both sidebars read logo from `localStorage.getItem("company_logo_base64")` but it is never written for staff users. | `distributor-portal/page.tsx` lines 56–60 | Comment block around logo save |
| A6 | **`generateAuthResponse` uses `user.company_id` (hardcoded) to look up company logo** — even though `findCompanyDetail(user.company_id)` runs, it queries with the hardcoded UUID `'9d034353-...'`. If this UUID exists in `company_details`, it works by accident. If not, `logo_base64` is always `null`. The correct source is `roles[0].company_id` from `user_profiles`. | `authentication.service.ts` line ~172, 196–200 | `if (user.company_id)` uses hardcoded value |
| A7 | **`apiClient` refresh interceptor posts to `/api/auth/refresh` but investor portal context resolves to `/api/investor-auth/refresh`** — the interceptor uses a single hardcoded path `/api/auth/refresh` regardless of whether the portal is `staff` or `investor`. Even after A1 is fixed, investors would hit the wrong endpoint. | `src/lib/apiClient.ts` line ~52 | `fetch(\`${baseUrl}/auth/refresh\`, ...)` |

---

### 13.2 — Fix A1: Create the Missing `/api/auth/[...path]` Proxy Route

This is the single most critical fix. Without it, **every token refresh call returns a 404 from Next.js.**

**Create new file:** `src/app/api/auth/[...path]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join("/");
  const url = `${API_BASE}/api/auth/${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Forward Authorization header for protected endpoints (logout, /me)
  const authorization = req.headers.get("authorization");
  if (authorization) headers["Authorization"] = authorization;

  const cookie = req.headers.get("cookie");
  if (cookie) headers["Cookie"] = cookie;

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body,
    });

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } else {
      const text = await res.text();
      return NextResponse.json(
        { error: `Upstream returned non-JSON (${res.status})`, detail: text.slice(0, 400) },
        { status: res.status },
      );
    }
  } catch (error: any) {
    console.error(`[auth proxy] ${req.method} /auth/${path} →`, error?.message);
    return NextResponse.json(
      { error: "Could not reach API server", detail: error?.message },
      { status: 502 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
```

**Also create:** `src/app/api/investor-auth/[...path]/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function handler(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const resolvedParams = await params;
  const path = resolvedParams.path.join("/");
  const url = `${API_BASE}/api/investor-auth/${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  const authorization = req.headers.get("authorization");
  if (authorization) headers["Authorization"] = authorization;

  const cookie = req.headers.get("cookie");
  if (cookie) headers["Cookie"] = cookie;

  let body: string | undefined;
  if (req.method !== "GET" && req.method !== "HEAD") {
    body = await req.text();
  }

  try {
    const res = await fetch(url, {
      method: req.method,
      headers,
      body,
    });

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      return NextResponse.json(data, { status: res.status });
    } else {
      const text = await res.text();
      return NextResponse.json(
        { error: `Upstream returned non-JSON (${res.status})`, detail: text.slice(0, 400) },
        { status: res.status },
      );
    }
  } catch (error: any) {
    console.error(`[investor-auth proxy] ${req.method} /investor-auth/${path} →`, error?.message);
    return NextResponse.json(
      { error: "Could not reach API server", detail: error?.message },
      { status: 502 },
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const DELETE = handler;
```

---

### 13.3 — Fix A4: Uncomment `company_id` Column in User Entity

**File:** `src/entities/user.entity.ts` (finiq-api)

The `users` DB table has a real `company_id uuid` column. The entity must declare it properly.

**Find:**
```typescript
  // todo: fix this part to type-check
  // @Column({ nullable: true })
  // company_id: string;
  company_id?: string = '9d034353-d658-4fa5-b5a1-e46253cdbc0c';
```

**Replace with:**
```typescript
  @Column({ name: 'company_id', type: 'uuid', nullable: true })
  company_id: string | null;
```

This makes TypeORM read `company_id` from the actual DB row for every user. No more hardcoded UUID.

---

### 13.4 — Fix A6 + A5: Fix Logo Fetch in `generateAuthResponse` and Store It on Login

**Step 1 — Fix the backend logo lookup to use `roles[].company_id`**

**File:** `src/modules/auth/authentication.service.ts`

The current code calls `findCompanyDetail(user.company_id)` where `user.company_id` was the hardcoded UUID. After fix A4, `user.company_id` will be the real value from the DB. But there's a safer, more explicit approach: use `roles[0].company_id` which comes from `user_profiles` and is always correct.

**Find:**
```typescript
    // Safety check: only attempt to fetch the logo if company_id exists
    let logo_base64: string | null = null;
    if (user.company_id) {
      const companyDetail = await this.repository.findCompanyDetail(
        user.company_id,
      );
      logo_base64 = companyDetail?.logo_base64 || null;
    }
```

**Replace with:**
```typescript
    // Use company_id from the user's profile (from user_profiles table) — most reliable source.
    // Falls back to user.company_id (now a real DB column after entity fix).
    const companyIdForLogo =
      roles.find((r) => r.company_id)?.company_id ?? user.company_id ?? null;

    let logo_base64: string | null = null;
    if (companyIdForLogo) {
      try {
        const companyDetail = await this.repository.findCompanyDetail(companyIdForLogo);
        logo_base64 = companyDetail?.logo_base64 || null;
      } catch (err) {
        this.logger.warn(`Could not fetch company logo for ${companyIdForLogo}: ${err}`);
      }
    }
```

**Step 2 — Uncomment logo storage in distributor login page**

**File:** `src/app/(auth)/distributor-portal/page.tsx`

**Find:**
```typescript
      if (response.success) {
        // Updated to pass 'staff' and the user's ID
        setAuthCookies(
          response.data.access_token,
          response.data.refresh_token,
          "staff",
          response.data.user.id,
        );
        router.push("/distributor");
      }
```

**Replace with:**
```typescript
      if (response.success) {
        // Store company logo so both sidebars can display it without an extra API call
        if (response.data.user.company_logo) {
          try {
            localStorage.setItem("company_logo_base64", response.data.user.company_logo);
          } catch (_) {}
        }

        setAuthCookies(
          response.data.access_token,
          response.data.refresh_token,
          "staff",
          response.data.user.id,
        );
        router.push("/distributor");
      }
```

---

### 13.5 — Fix A2 + A3: Investor Refresh Token — Add to Backend and Frontend

**The situation:** The `investors` DB table has no `refresh_token` or `refresh_token_expires_at` columns. Adding a full investor refresh flow requires a DB migration + backend service + frontend wiring. Here is the complete implementation.

#### Step 1 — DB Migration

Run this SQL once on your PostgreSQL database:

```sql
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS refresh_token       VARCHAR  DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS refresh_token_expires_at TIMESTAMPTZ DEFAULT NULL;
```

Verify:
```sql
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'investors' AND column_name LIKE '%refresh%';
```

Expected output:
```
refresh_token                | character varying
refresh_token_expires_at     | timestamp with time zone
```

#### Step 2 — Update Investor Entity

**File:** `src/entities/investor.entity.ts` (finiq-api)

Add these two columns after the existing `password_hash` column:

```typescript
  @Column({ name: 'password_hash', type: 'varchar', nullable: true, length: 255, select: false })
  password_hash?: string | null;

  // ── ADD THESE TWO ──────────────────────────────────────
  @Column({ name: 'refresh_token', type: 'varchar', nullable: true, select: false })
  refresh_token?: string | null;

  @Column({ name: 'refresh_token_expires_at', type: 'timestamp with time zone', nullable: true })
  refresh_token_expires_at?: Date | null;
  // ── END ADD ─────────────────────────────────────────────

  @Column({ name: 'must_change_password', type: 'boolean', default: false })
  must_change_password: boolean;
```

#### Step 3 — Update Investor Auth Service

**File:** `src/modules/investor-auth/investor-auth.service.ts`

Add these imports at the top if not already present:
```typescript
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
```

Add `ConfigService` to the constructor:
```typescript
constructor(
  @InjectRepository(Investor)
  private readonly investorRepo: Repository<Investor>,
  private readonly repository: AuthenticationRepository,
  private readonly jwtService: JwtService,
  private readonly configService: ConfigService,  // ← ADD THIS
) {}
```

Add `ConfigService` to the module imports in `investor-auth.module.ts`:
```typescript
imports: [
  TypeOrmModule.forFeature([Investor]),
  AuthenticationModule,
  ConfigModule,          // ← ADD THIS if not already imported
  JwtModule.registerAsync({ ... }),
],
```

**Replace the entire `login` method and add a new `refreshToken` method:**

```typescript
async login(dto: LoginInvestorDto) {
  const { identifier, password } = dto;

  // Load investor with relations AND the normally-excluded refresh_token column
  const investor = await this.investorRepo
    .createQueryBuilder('investor')
    .addSelect('investor.refresh_token')
    .addSelect('investor.password_hash')
    .leftJoinAndSelect('investor.company', 'company')
    .leftJoinAndSelect('company.details', 'details')
    .where('investor.username = :id OR investor.email = :id', { id: identifier })
    .getOne();

  if (!investor) {
    throw new UnauthorizedException('Invalid credentials');
  }

  if (!investor.password_hash) {
    throw new UnauthorizedException(
      'Please ask your distributor to generate credentials first',
    );
  }

  const isPasswordValid = await bcrypt.compare(password, investor.password_hash);
  if (!isPasswordValid) {
    throw new UnauthorizedException('Invalid credentials');
  }

  return this.generateInvestorAuthResponse(investor);
}

async refreshToken(investorId: string, refreshToken: string) {
  const investor = await this.investorRepo
    .createQueryBuilder('investor')
    .addSelect('investor.refresh_token')
    .addSelect('investor.refresh_token_expires_at')
    .leftJoinAndSelect('investor.company', 'company')
    .leftJoinAndSelect('company.details', 'details')
    .where('investor.id = :id', { id: investorId })
    .getOne();

  if (!investor) {
    throw new UnauthorizedException('Investor not found');
  }

  const hashedToken = crypto
    .createHash('sha256')
    .update(refreshToken)
    .digest('hex');

  if (investor.refresh_token !== hashedToken) {
    // Possible token theft — clear stored token
    await this.investorRepo.update(investor.id, {
      refresh_token: null as any,
      refresh_token_expires_at: null as any,
    });
    throw new UnauthorizedException('Invalid refresh token — session invalidated');
  }

  if (
    investor.refresh_token_expires_at &&
    investor.refresh_token_expires_at < new Date()
  ) {
    await this.investorRepo.update(investor.id, {
      refresh_token: null as any,
      refresh_token_expires_at: null as any,
    });
    throw new UnauthorizedException('Refresh token expired');
  }

  return this.generateInvestorAuthResponse(investor);
}

// ── Private helper ─────────────────────────────────────────────────────────
private async generateInvestorAuthResponse(investor: any) {
  const refreshExpiryDays =
    this.configService.get<number>('JWT_REFRESH_TOKEN_EXPIRATION_DAYS') || 7;

  const payload = {
    investor_id: investor.id,
    mobile: investor.mobile,
    username: investor.username,
    email: investor.email,
    company_id: investor.company_id,
  };

  const accessToken = this.jwtService.sign(payload);

  // Generate and store hashed refresh token
  const rawRefreshToken = crypto.randomBytes(64).toString('hex');
  const hashedRefreshToken = crypto
    .createHash('sha256')
    .update(rawRefreshToken)
    .digest('hex');
  const refreshExpiresAt = new Date(
    Date.now() + refreshExpiryDays * 24 * 60 * 60 * 1000,
  );

  await this.investorRepo.update(investor.id, {
    refresh_token: hashedRefreshToken,
    refresh_token_expires_at: refreshExpiresAt,
  });

  const logo_base64 = investor.company?.details?.logo_base64 || null;

  return {
    access_token: accessToken,
    refresh_token: rawRefreshToken,    // raw token sent to client
    investor: {
      id: investor.id,
      name: investor.name,
      mobile: investor.mobile,
      email: investor.email,
      logo_base64,
    },
  };
}
```

#### Step 4 — Add Refresh Endpoint to Investor Auth Controller

**File:** `src/modules/investor-auth/investor-auth.controller.ts`

Add a new `RefreshInvestorTokenDto` DTO first. Create it inside `src/modules/investor-auth/dto/investor-auth.dto.ts`:

```typescript
// Add at the bottom of the file
export class RefreshInvestorTokenDto {
  @IsString()
  @IsNotEmpty()
  investor_id: string;

  @IsString()
  @IsNotEmpty()
  refresh_token: string;
}
```

Then add the endpoint to the controller:

```typescript
// Add import
import { ..., RefreshInvestorTokenDto } from './dto/investor-auth.dto';

// Add after the existing @Post('login') method:
@Post('refresh')
@HttpCode(HttpStatus.OK)
async refreshToken(@Body() dto: RefreshInvestorTokenDto) {
  const result = await this.service.refreshToken(dto.investor_id, dto.refresh_token);
  return ResponseFormatter.success(result, 'Token refreshed successfully');
}
```

---

### 13.6 — Fix A2: Store Investor Cookies Properly on Login

**File:** `src/app/(auth)/login/page.tsx`

The investor login currently calls `setAuthCookies(actualToken, undefined, "investor")` — no refresh token, no user ID.

**Find:**
```typescript
      const actualToken = response.data?.access_token;

      if (actualToken) {
        setAuthCookies(actualToken, undefined, "investor");
      } else {
        throw new Error(
          "API connected, but access_token was missing in the data object.",
        );
      }

      router.push("/investor");
```

**Replace with:**
```typescript
      const actualToken = response.data?.access_token;
      const refreshToken = response.data?.refresh_token;
      const investorId = response.data?.investor?.id;

      if (!actualToken) {
        throw new Error("API connected, but access_token was missing in the data object.");
      }

      // Store company logo so InvestorSidebar can display it without extra API calls
      if (response.data?.investor?.logo_base64) {
        try {
          localStorage.setItem("company_logo_base64", response.data.investor.logo_base64);
        } catch (_) {}
      }

      // Store access token, refresh token, and investor ID for auto-refresh
      setAuthCookies(actualToken, refreshToken, "investor", investorId);

      router.push("/investor");
```

---

### 13.7 — Fix A7: Fix `apiClient` Refresh Interceptor to Use Portal-Correct Endpoint

**File:** `src/lib/apiClient.ts`

The interceptor hardcodes `/api/auth/refresh` regardless of portal. Investor refresh must go to `/api/investor-auth/refresh`.

**Find:**
```typescript
          // Execute refresh token request
          refreshPromise = fetch(`${baseUrl}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: userId,
              refresh_token: refreshToken,
            }),
          })
```

**Replace with:**
```typescript
          // Use the correct refresh endpoint per portal type
          const refreshEndpoint =
            portal === "investor"
              ? `${baseUrl}/investor-auth/refresh`
              : `${baseUrl}/auth/refresh`;

          // Field names differ per portal: investors use 'investor_id', staff use 'user_id'
          const refreshBody =
            portal === "investor"
              ? { investor_id: userId, refresh_token: refreshToken }
              : { user_id: userId, refresh_token: refreshToken };

          // Execute refresh token request
          refreshPromise = fetch(refreshEndpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(refreshBody),
          })
```

The rest of the refresh interceptor (cookie update, retry logic) remains unchanged.

---

### 13.8 — Fix: `authService.refreshToken` Function in `auth.service.ts`

**File:** `src/services/auth.service.ts` (finiq frontend)

Add an investor refresh function:

```typescript
refreshInvestorToken: async (investor_id: string, refresh_token: string): Promise<any> => {
  return apiClient.post<any>('/investor-auth/refresh', { investor_id, refresh_token });
},
```

---

### 13.9 — Auth Fix Implementation Order

Follow this exact sequence:

```
Step 1 — DB Migration (run SQL from §13.5 Step 1)
  ▶ Verify: investors table has refresh_token and refresh_token_expires_at columns

Step 2 — Backend
  2a. user.entity.ts       — uncomment company_id @Column (§13.3)
  2b. investor.entity.ts   — add refresh_token and refresh_token_expires_at @Column (§13.5 Step 2)
  2c. investor-auth.service.ts — replace login(), add refreshToken(), add generateInvestorAuthResponse() (§13.5 Step 3)
  2d. investor-auth.dto.ts — add RefreshInvestorTokenDto (§13.5 Step 4)
  2e. investor-auth.controller.ts — add POST refresh endpoint (§13.5 Step 4)
  2f. investor-auth.module.ts — add ConfigModule to imports
  2g. authentication.service.ts — fix company logo lookup in generateAuthResponse (§13.4 Step 1)
  ▶ Restart NestJS. Test:
      - POST /api/auth/verify-otp → response includes company_logo (not null)
      - POST /api/investor-auth/login → response now includes refresh_token

Step 3 — Frontend: New Proxy Routes
  3a. Create src/app/api/auth/[...path]/route.ts (§13.2)
  3b. Create src/app/api/investor-auth/[...path]/route.ts (§13.2)
  ▶ Test: POST /api/auth/refresh from browser → returns 200 (not 404)

Step 4 — Frontend: Cookie Storage Fixes
  4a. distributor-portal/page.tsx — uncomment logo storage, verify setAuthCookies called with all 4 args (§13.4 Step 2)
  4b. login/page.tsx — store refresh token, user ID, and logo on investor login (§13.6)
  ▶ Test: Log in as distributor → DevTools Application → Cookies → staff-refresh-token and staff-user-id exist
  ▶ Test: Log in as investor → investor-refresh-token and investor-user-id exist

Step 5 — Frontend: Refresh Interceptor Fix
  5a. apiClient.ts — fix refresh endpoint per portal (§13.7)
  ▶ Test: Log in, wait for access token to expire (set JWT_ACCESS_TOKEN_EXPIRATION=10s for testing),
    make an API call → should silently refresh and retry without redirecting to login
```

---

### 13.10 — End-to-End Token Refresh Test

#### Staff (Distributor) Refresh Flow

1. Log in as distributor via OTP
2. Open DevTools → Application → Cookies
3. Verify `staff-auth-token`, `staff-refresh-token`, `staff-user-id` all exist
4. For testing: temporarily set `JWT_ACCESS_TOKEN_EXPIRATION=30s` in `.env` and restart NestJS
5. Wait 31 seconds
6. Navigate to any distributor page (triggers an API call)
7. **Verify:** In Network tab, you see `POST /api/auth/refresh` returning 200
8. **Verify:** The original API call is retried and succeeds
9. **Verify:** `staff-auth-token` cookie has been updated to a new value
10. **Verify:** You are NOT redirected to the login page

#### Investor Refresh Flow

1. Log in as investor
2. Open DevTools → Application → Cookies
3. Verify `investor-auth-token`, `investor-refresh-token`, `investor-user-id` all exist
4. Wait for access token to expire
5. Navigate or trigger an API call on the investor portal
6. **Verify:** `POST /api/investor-auth/refresh` fires and returns 200
7. **Verify:** Investor stays logged in

#### Logo Display Test

1. Log in as distributor
2. Open DevTools → Application → Local Storage
3. **Verify:** `company_logo_base64` key exists with a non-null value (base64 string or URL)
4. **Verify:** The distributor sidebar renders the company logo
5. Log in as investor of the same company
6. **Verify:** `company_logo_base64` is set in localStorage
7. **Verify:** The investor sidebar renders the company logo

#### Refresh Token Expiry Test (7-Day Boundary)

1. Set `JWT_REFRESH_TOKEN_EXPIRATION_DAYS=0.0001` (approximately 9 seconds) in `.env`
2. Log in, wait ~10 seconds
3. Try to use the app
4. **Verify:** `POST /api/auth/refresh` returns 401 with "Refresh token expired"
5. **Verify:** `apiClient` catches the failed refresh, clears all cookies, and redirects to the login page
6. **Verify:** User is NOT stuck in an infinite redirect loop

---

### 13.11 — Summary: All Files Changed for Auth & Logo

**finiq-api (NestJS):**

| File | Change |
|------|--------|
| `src/entities/user.entity.ts` | Uncomment `@Column company_id` — remove hardcoded default |
| `src/entities/investor.entity.ts` | Add `refresh_token` and `refresh_token_expires_at` columns |
| `src/modules/investor-auth/investor-auth.service.ts` | Replace `login()`, add `refreshToken()`, add `generateInvestorAuthResponse()`, inject `ConfigService` |
| `src/modules/investor-auth/dto/investor-auth.dto.ts` | Add `RefreshInvestorTokenDto` |
| `src/modules/investor-auth/investor-auth.controller.ts` | Add `POST refresh` endpoint |
| `src/modules/investor-auth/investor-auth.module.ts` | Add `ConfigModule` to imports |
| `src/modules/auth/authentication.service.ts` | Fix logo lookup to use `roles[].company_id` |

**finiq (Next.js):**

| File | Change |
|------|--------|
| `src/app/api/auth/[...path]/route.ts` | **CREATE** — proxy for all staff auth endpoints |
| `src/app/api/investor-auth/[...path]/route.ts` | **CREATE** — proxy for all investor auth endpoints |
| `src/app/(auth)/distributor-portal/page.tsx` | Uncomment company_logo storage; verify setAuthCookies passes user ID |
| `src/app/(auth)/login/page.tsx` | Store refresh_token, investor_id, and logo on login |
| `src/lib/apiClient.ts` | Fix refresh interceptor to use portal-correct endpoint and field names |
| `src/services/auth.service.ts` | Add `refreshInvestorToken` function (optional — interceptor handles it automatically) |
