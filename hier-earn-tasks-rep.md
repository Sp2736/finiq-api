# Prompt for Antigravity Agent — Hierarchy Earnings Excel Export

I want you to improve the Excel export for the **"Hierarchy Earnings"** report in this codebase. Before changing anything, find and read the actual code that generates this report (search for terms like `Hierarchy Earnings`, `hierarchy-earnings`, `hierarchyEarnings`, or the export/report service that builds it — it likely uses `exceljs`). Confirm the real implementation rather than assuming.

## Context — current report structure

The exported sheet has these columns:
`User | Type | Gross Rec. (Rs.) | Paid (Self) (Rs.) | Total Paid (Rs.) | Net Rec. (Rs.)`

Rows are a 2-level hierarchy:
- **Parent rows** — `Sub-Broker` or `Direct Client` (top of each group, no indent)
- **Child rows** — indented with a `↳` prefix, and typed either `AMC` or `Investor` depending on which variant of the report was requested
- A final **`GRAND TOTALS`** row sums all columns

There are two variants of this same report:
1. Child rows broken down by **AMC** (mutual fund company)
2. Child rows broken down by **Investor**

## Task 1 — Fix file naming

Currently both variants are likely exported with the same generic filename pattern (e.g. `Hierarchy_Earnings_<startDate>_to_<endDate>.xlsx`). Find where the filename is generated and update it so the name reflects which breakdown was requested, keeping the existing date format:

- AMC breakdown → `Hierarchy_Earnings_by_AMC_<startDate>_to_<endDate>.xlsx`
- Investor breakdown → `Hierarchy_Earnings_by_Investor_<startDate>_to_<endDate>.xlsx`

Use whatever the existing date-range format string already is (currently looks like `YYYY-MM-DD_to_YYYY-MM-DD`). Don't hardcode this twice — derive the suffix from the same report-type flag/enum that already determines whether child rows are AMC or Investor, so the naming can never drift out of sync with the content.

## Task 2 — Polish the Excel formatting (blue-shades-only palette)

Some basic styling already exists (dark header row, italic indented child rows). Build on it — don't strip it out — and bring it up to a polished, presentation-ready standard. **Use only shades of blue/navy/grey-blue across the whole sheet — no greens, golds, reds, or unrelated accent colors anywhere, including the totals row.** This needs to look like a fintech SaaS export, not a generic spreadsheet.

Use this exact palette (hex codes, all from the same blue family, just varying in darkness):

| Role | Fill color | Text color |
|---|---|---|
| Header row (column titles) | `#0F2850` (dark navy — matches existing header) | `#FFFFFF` bold |
| Parent rows (Sub-Broker / Direct Client) | `#D6E0F0` (pale steel blue) | `#0F2850` bold |
| Child rows — odd | `#FFFFFF` (white) | `#475569` italic (keep existing) |
| Child rows — even (alternating stripe) | `#F4F7FC` (near-white blue tint) | `#475569` italic |
| Grand totals row | `#1E3A6E` (medium-dark blue, lighter than header so it doesn't compete) | `#FFFFFF` bold |
| Borders / gridlines | `#B8C9E6` (light blue-grey) thin lines throughout | — |

**Header row**
- Bold white text on `#0F2850` fill (already correct — keep it)
- Freeze the header row (freeze pane below row 1)
- Enable autofilter on the header row
- Set a comfortable row height

**Parent rows (Sub-Broker / Direct Client)**
- Bold text in `#0F2850`
- Fill `#D6E0F0` so each group visually stands out from its children
- A thin `#B8C9E6` top border to separate one group from the previous group's last child row

**Child rows (AMC / Investor)**
- Keep the indent and italic styling, text color `#475569`
- Alternate row fill between `#FFFFFF` and `#F4F7FC` within each group for readability on long lists — both are subtle enough not to compete with the parent row shading

**Numbers**
- All four amount columns (`Gross Rec.`, `Paid (Self)`, `Total Paid`, `Net Rec.`) right-aligned, formatted as `#,##0.00`
- Consider a ₹/Rs. prefix in the number format if it doesn't clutter the column

**Grand totals row**
- Bold white text on `#1E3A6E` fill — distinct from both the header and the parent rows, but still strictly within the blue family
- A medium `#0F2850` top border to clearly separate it from the data above

**General**
- Sensible column widths (auto-fit or fixed widths sized to the longest realistic name, e.g. `User` column wide enough for full names with the `↳` indent)
- Thin `#B8C9E6` borders around the full table for a clean grid
- Turn off default gridlines outside the table if the library supports it
- Font: keep Calibri 11 for consistency with the rest of the app's exports
- Do not introduce any color outside this palette anywhere in the sheet (no traffic-light status colors, no green/red for positive/negative values) — everything stays in blue tones, varying shade/saturation conveys hierarchy instead of hue

**Optional but nice if low-effort**
- A small title block above the table: report name (AMC or Investor breakdown), the date range, and "Generated on <date>" — title text in `#0F2850`, on the same `#FFFFFF`/`#F4F7FC` background as the body
- Print setup: landscape orientation, fit columns to one page width, if exceljs/the library makes this trivial

## Constraints

- Apply this styling logic in one shared place if both report variants (AMC/Investor) go through the same export function — don't duplicate styling code per variant.
- Don't change the underlying data/aggregation logic, only filenames and presentation/styling.
- Test by generating both variants and confirming filenames and visual formatting are correct before considering this done.