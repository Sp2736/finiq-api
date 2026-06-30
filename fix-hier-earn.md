# Hierarchy Earnings — Fix "Group By Investor" Bug

## Summary of the bug

On the **Hierarchy Earnings** page (`/distributor/reports/hierarchy`), toggling
the top filter from **AMC** to **Investor** correctly calls the backend with
`groupBy=investor`, and the backend correctly returns data under the key
`investor_wise_brokerage` (confirmed via live API response — see sample
below). However, the **frontend mapper ignores `investor_wise_brokerage`
entirely** and only ever reads `amc_wise_brokerage`. As a result, when
grouped by Investor, every broker row renders with **zero gross/paid/net and
an empty breakdown**, even though the API returned real data.

This is a **frontend-only bug**. The backend (`detailed-summary` endpoint
with `groupBy=investor`) is already correct and does not need to change.

### Confirmed working API response (for reference)

`GET /api/brokerage-distribution/detailed-summary?fromDate=2026-02-01&toDate=2026-02-28&groupBy=investor`

```json
{
  "success": true,
  "message": "Success",
  "data": {
    "total_gross_brokerage_report": 1781160.8001,
    "total_paid_brokerage_report": 1263.12,
    "total_net_brokerage_report": 1779897.68,
    "sub_brokers": [
      {
        "broker_type": "SUB",
        "sub_broker_id": "1b27343d-c80e-4dfa-b840-1e3cc2be7d1f",
        "main_broker_id": "3660908c-34d0-492e-b544-ea0c40fbb756",
        "sub_total_paid": 73.22,
        "sub_broker_name": "Murtaza Bhaisaheb",
        "sub_total_gross": 146.4351,
        "main_broker_name": "Krutarth Desai",
        "share_percentage": 50,
        "investor_wise_brokerage": [
          {
            "investor_id": "bfe6951f-0c6f-44e9-a505-1168e4a013fe",
            "investor_name": "Sakina Hanzalah Bhaisahebh",
            "net_brokerage": 17.55,
            "paid_brokerage": 17.55,
            "total_brokerage": 35.0992
          },
          {
            "investor_id": "4fdfcd9b-dde3-462f-af08-6e24bc1d9036",
            "investor_name": "Barodawala Husseini",
            "net_brokerage": 55.67,
            "paid_brokerage": 55.67,
            "total_brokerage": 111.3359
          }
        ]
      }
    ]
  },
  "timestamp": "2026-06-30T09:54:23.630Z"
}
```

Compare this to the `groupBy=amc` shape, which nests breakdown rows under
`amc_wise_brokerage` with keys `amc_name`, `total_brokerage`,
`paid_brokerage`, `net_brokerage` instead of `investor_id` /
`investor_name`. **Both breakdown arrays share the same numeric field names**
(`total_brokerage`, `paid_brokerage`, `net_brokerage`) — only the "label"
field differs (`amc_name` vs `investor_name`, plus investor rows also carry
an `investor_id`).

---

## Root cause — exact file & line

**File:** `frontend/src/components/distributor/BrokerageDashboard.tsx`

The `mapHierarchyData` function (top of file, ~line 16) is hardcoded to only
ever read `broker.amc_wise_brokerage`:

```ts
const mapHierarchyData = (subBrokers: any[]) => {
  if (!subBrokers || !Array.isArray(subBrokers)) return [];

  return subBrokers.map((broker, index) => {
    let totalGross = 0;
    let totalPaid = 0;

    const amcBreakdown = (broker.amc_wise_brokerage || []).map((amc: any, i: number) => {
      totalGross += amc.total_brokerage || 0;
      totalPaid += amc.paid_brokerage || 0;

      return {
        id: `amc-${index}-${i}`,
        amcName: amc.amc_name || "Uncategorized AMC",
        gross: amc.total_brokerage || 0,
        paid: amc.paid_brokerage || 0,
        paidSub: 0 
      };
    });
    // ...
  });
};
```

When the API response instead contains `investor_wise_brokerage` (which it
does whenever `groupBy=investor`), `broker.amc_wise_brokerage` is
`undefined`, so `amcBreakdown` is always `[]`, `totalGross`/`totalPaid` stay
`0`, and the row renders with no expandable breakdown and zero values for
every sub-broker — exactly the symptom reported.

Downstream, `DesktopBrokerageTable.tsx` and `MobileBrokerageOverview.tsx`
also hardcode the labels **"AMC Name"**, **"AMC Commission Ledger"**, and
**"AMC Breakdown"** in their JSX, and read `amc.amcName` specifically. These
need to become breakdown-mode-aware so the UI makes sense when grouped by
Investor too.

---

## Fix plan (files to touch)

1. `frontend/src/components/distributor/BrokerageDashboard.tsx`
   - Make `mapHierarchyData` accept a `groupBy` mode and read from the
     correct array (`amc_wise_brokerage` vs `investor_wise_brokerage`).
   - Normalize each breakdown row into a **generic shape** (`name`, `gross`,
     `paid`, `paidSub`) instead of an AMC-specific shape, so the table/mobile
     components can render either mode without caring which one it is.
   - Pass `activeGroup` down to `DesktopBrokerageTable` and
     `MobileBrokerageOverview` so they can render dynamic header labels.

2. `frontend/src/components/distributor/DesktopBrokerageTable.tsx`
   - Accept a `groupLabel` prop (e.g. `"AMC"` or `"Investor"`).
   - Replace hardcoded `"AMC Name"`, `"AMC Commission Ledger"` text with the
     dynamic label.
   - Replace `amc.amcName` with the generic `amc.name` field.

3. `frontend/src/components/distributor/MobileBrokerageOverview.tsx`
   - Same as above: accept `groupLabel`, replace `"AMC Breakdown"` heading
     and `amc.amcName` with generic equivalents.

No backend changes are required. No changes to
`frontend/src/services/distributor.service.ts` are required either — it
already sends `groupBy=investor` correctly.

---

## Step-by-step implementation

### Step 1 — `BrokerageDashboard.tsx`: make the mapper group-aware

Replace the entire `mapHierarchyData` function with a version that takes a
second argument indicating which breakdown array to read, and emits a
generic breakdown shape:

```ts
// Mapper to translate API Response into UI format.
// `groupBy` is "AMC" or "Investor" (matches activeGroup state values).
const mapHierarchyData = (subBrokers: any[], groupBy: string) => {
  if (!subBrokers || !Array.isArray(subBrokers)) return [];

  const isInvestorGroup = groupBy === "Investor";

  return subBrokers.map((broker, index) => {
    let totalGross = 0;
    let totalPaid = 0;

    const rawBreakdown = isInvestorGroup
      ? broker.investor_wise_brokerage
      : broker.amc_wise_brokerage;

    const breakdown = (rawBreakdown || []).map((item: any, i: number) => {
      totalGross += item.total_brokerage || 0;
      totalPaid += item.paid_brokerage || 0;

      return {
        id: isInvestorGroup
          ? (item.investor_id || `investor-${index}-${i}`)
          : `amc-${index}-${i}`,
        name: isInvestorGroup
          ? (item.investor_name || "Unnamed Investor")
          : (item.amc_name || "Uncategorized AMC"),
        gross: item.total_brokerage || 0,
        paid: item.paid_brokerage || 0,
        paidSub: 0,
      };
    });

    return {
      id: broker.sub_broker_id || `broker-${index}`,
      user: broker.sub_broker_name || "Unnamed Client",
      type: broker.broker_type === "DIRECT" ? "Direct Client" : "Sub-Broker",
      template: broker.share_percentage ? `${broker.share_percentage}% Share` : "Standard",
      gross: totalGross,
      paid: totalPaid,
      paidSub: 0,
      amcBreakdown: breakdown, // keep this key name — both child components already read it
      children: []
    };
  });
};
```

> Note: we keep the field name `amcBreakdown` on the mapped object (rather
> than renaming it) to minimize the diff in `DesktopBrokerageTable.tsx` /
> `MobileBrokerageOverview.tsx`, which both already destructure
> `user.amcBreakdown`. Only the **items inside** that array change shape
> (`name` instead of `amcName`).

### Step 2 — `BrokerageDashboard.tsx`: pass `activeGroup` into the mapper call

Inside the `useEffect`'s `fetchPromise`, update the call site:

```ts
// BEFORE
if (res.success && res.data) {
  const mappedData = mapHierarchyData(res.data.sub_brokers || []);
  globalHierarchyCache.set(currentCacheKey, mappedData);
  return mappedData;
} else {
  throw new Error(res.message || "Failed to load hierarchy data");
}
```

```ts
// AFTER
if (res.success && res.data) {
  const mappedData = mapHierarchyData(res.data.sub_brokers || [], activeGroup);
  globalHierarchyCache.set(currentCacheKey, mappedData);
  return mappedData;
} else {
  throw new Error(res.message || "Failed to load hierarchy data");
}
```

### Step 3 — `BrokerageDashboard.tsx`: pass `groupLabel` down to the table components

Find the two render call sites near the bottom of the file:

```tsx
<DesktopBrokerageTable data={filteredData} totals={totals} />
```

```tsx
<MobileBrokerageOverview data={filteredData} totals={totals} />
```

Update both to also pass the current group:

```tsx
<DesktopBrokerageTable data={filteredData} totals={totals} groupLabel={activeGroup} />
```

```tsx
<MobileBrokerageOverview data={filteredData} totals={totals} groupLabel={activeGroup} />
```

(`activeGroup` is already in scope as component state — `"AMC"` or
`"Investor"`.)

### Step 4 — `DesktopBrokerageTable.tsx`: accept `groupLabel` and use it

Update the component signature:

```ts
// BEFORE
export default function DesktopBrokerageTable({ data, totals }: { data: any[], totals: any }) {
```

```ts
// AFTER
export default function DesktopBrokerageTable({ data, totals, groupLabel = "AMC" }: { data: any[], totals: any, groupLabel?: string }) {
```

Replace the hardcoded breakdown section header text:

```tsx
// BEFORE
<h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--fin-brand-700)] flex items-center gap-2">
  <svg ...>...</svg>
  AMC Commission Ledger
</h4>
```

```tsx
// AFTER
<h4 className="text-[10px] font-bold uppercase tracking-widest text-[var(--fin-brand-700)] flex items-center gap-2">
  <svg ...>...</svg>
  {groupLabel} Commission Ledger
</h4>
```

Replace the breakdown table's column header:

```tsx
// BEFORE
<th className="p-2 w-[25%] pl-4">AMC Name</th>
```

```tsx
// AFTER
<th className="p-2 w-[25%] pl-4">{groupLabel} Name</th>
```

Replace the row label cell — change `amc.amcName` to `amc.name`:

```tsx
// BEFORE
<td className="p-2 w-[25%] pl-4 font-bold text-[var(--fin-table-row-text)]">{amc.amcName}</td>
```

```tsx
// AFTER
<td className="p-2 w-[25%] pl-4 font-bold text-[var(--fin-table-row-text)]">{amc.name}</td>
```

(Everything else in this file — `amc.gross`, `amc.paid`, `amc.paidSub` — is
already generic and needs no change, since Step 1 normalizes those fields
identically for both AMC and Investor breakdowns.)

### Step 5 — `MobileBrokerageOverview.tsx`: accept `groupLabel` and use it

Update the component signature:

```ts
// BEFORE
export default function MobileBrokerageOverview({ data, totals }: { data: any[], totals: any }) {
```

```ts
// AFTER
export default function MobileBrokerageOverview({ data, totals, groupLabel = "AMC" }: { data: any[], totals: any, groupLabel?: string }) {
```

Replace the breakdown section heading:

```tsx
// BEFORE
<h4 className="text-[10px] font-black text-[var(--fin-brand-700)] uppercase tracking-widest">AMC Breakdown</h4>
```

```tsx
// AFTER
<h4 className="text-[10px] font-black text-[var(--fin-brand-700)] uppercase tracking-widest">{groupLabel} Breakdown</h4>
```

Replace the per-item label — change `amc.amcName` to `amc.name`:

```tsx
// BEFORE
<h5 className="font-bold text-xs text-[var(--fin-heading-tertiary)]">{amc.amcName}</h5>
```

```tsx
// AFTER
<h5 className="font-bold text-xs text-[var(--fin-heading-tertiary)]">{amc.name}</h5>
```

(Optional polish: the `Building2` icon imported at the top of this file
visually implies "AMC" — if you want, swap it for a `User`/`Users` icon from
`lucide-react` when `groupLabel === "Investor"`. Not required to fix the
bug, purely cosmetic. If you do this, import `User` alongside `Building2`
from `'lucide-react'` and conditionally render
`{groupLabel === "Investor" ? <User .../> : <Building2 .../>}`.)

---

## Step 6 — Do NOT touch (sanity boundaries)

To avoid scope creep / accidental regressions, explicitly do **not** modify:

- `backend/src/modules/brokerage-distribution/brokerage-distribution.service.ts`
  — the `investorQuery` SQL and `getDetailedBrokerageDistribution` mapping
  logic are already correct and match the confirmed API response above.
- `backend/src/modules/brokerage-distribution/brokerage-distribution.controller.ts`
  — `groupBy` query param plumbing is already correct.
- `frontend/src/services/distributor.service.ts` — `getBrokerageSummary`
  already converts `"Investor"/"client"/"family"` → `groupBy=investor`
  correctly.
- The `flattenHierarchy` helper functions in both table components — leave
  as-is, they're unrelated to this bug (no `children` are ever populated by
  the API today).

---

## Verification checklist

1. Start the frontend, navigate to **Distributor → Reports → Hierarchy
   Earnings**.
2. With the **AMC** tab selected (default), confirm rows still render
   exactly as before (regression check — this mode must be unaffected).
3. Switch to the **Investor** tab.
4. Confirm each sub-broker row now shows non-zero **Gross Brokerage**,
   **Paid Brokerage**, and **Net Receivable** matching the values implied by
   summing that broker's `investor_wise_brokerage` array from the API
   response (e.g. for `sub_broker_id =
   1b27343d-c80e-4dfa-b840-1e3cc2be7d1f`, gross should equal `146.4351` and
   paid should equal `73.22`, matching `sub_total_gross` /
   `sub_total_paid` from the API).
5. Click/expand a row — confirm the breakdown panel now appears (it was
   previously not shown at all because `hasAmc` was always `false` under
   Investor grouping), titled **"Investor Commission Ledger"** /
   **"Investor Breakdown"**, listing each investor by name with their own
   gross/paid/net figures.
6. Confirm the **KPI cards** at the top (Gross Brokerage, Paid Brokerage,
   Net Receivable) also update correctly when switching to Investor mode —
   these derive from `totals`, which is computed from `filteredData`, which
   now correctly carries non-zero `gross`/`paid` once Step 1 is fixed.
7. Switch back to **AMC** — confirm everything still renders correctly
   (cache keys are `${activeGroup}-${fromDate}-${toDate}`, so AMC and
   Investor results are cached independently and won't collide).
8. Test **Export** (Excel) while in Investor mode — confirm the exported
   spreadsheet's Gross/Paid/Net columns are populated (it reads from
   `filteredData` / `totals`, same fix applies automatically, no separate
   change needed in the export code).
9. Open browser DevTools → confirm no console errors/warnings about
   undefined properties (e.g. `Cannot read properties of undefined
   (reading 'amcName')`).

---

## Why this approach (vs. alternatives)

- We kept the **API contract unchanged** (`amc_wise_brokerage` /
  `investor_wise_brokerage` stay as the backend's two distinct key names per
  `groupBy` mode) since the backend is already correct and other consumers
  (e.g. `getSubBrokerAmcAggregation`, which explicitly relies on
  `amc_wise_brokerage` for its own AMC-specific aggregation at line ~197 of
  `brokerage-distribution.service.ts`) depend on that exact shape. Renaming
  backend fields would be a wider, riskier change for no benefit.
- We kept the **mapped UI object's key name** (`amcBreakdown`) unchanged to
  minimize the diff surface in the two render components, and only
  generalized the **item shape inside** that array (`amcName` → `name`).
  This is the smallest possible change that fixes the bug while making the
  breakdown table/cards correctly label themselves per mode.
