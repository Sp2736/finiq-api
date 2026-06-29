# FinIQ — Export Architecture Refactor
**Task Guide for Autonomous Agents**

---

## Overview

Three report exports (Capital Gains, Holdings, Transactions) currently follow a wasteful two-round-trip pattern:

```
Frontend fetches data from API  →  API returns data to frontend
Frontend POSTs that same data back to API  →  API formats & returns file
```

The export endpoints (`POST /api/capital-gains/export`, `POST /api/investors/holdings-export`, `POST /api/investors/transactions-export`) should not exist in their current form. They accept the full data payload from the frontend, format it, and send back a file — but the server already *has* or can *fetch* that data internally.

**Target architecture:** The frontend sends only a small parameter object (investor ID + date range). The server fetches data, formats it, and streams the file in one request. No data echoing.

---

## Repositories

| Repo | Branch | Purpose |
|---|---|---|
| `sp2736/finiq` | `main` | Next.js 16 + Tailwind v4 frontend |
| `sp2736/finiq-api` | `master` | NestJS + PostgreSQL backend |

---

## Current Architecture (What Exists Today)

### Capital Gains Export

**Frontend flow (`src/lib/capitalGainsExport.ts` + `ClientHoldingsView.tsx`):**
1. `handleExportCG()` calls `distributorService.getCapitalGains({ investor_id, start_date, end_date })` → hits `POST /api/investors/capital-gains`
2. Maps the response through `mapBackendToExportFormat()`
3. Calls `exportCapitalGains(format, mappedData, periodLabel, DISTRIBUTOR_INFO)` in `src/lib/capitalGainsExport.ts`
4. That function POSTs `{ format, data: mappedData, fy: periodLabel, distributorInfo }` to `POST /api/capital-gains/export`
5. Server receives the full pre-mapped data blob, generates file, returns buffer

**Backend (`src/modules/capital-gains/`):**
- `capital-gains.controller.ts` — two endpoints: `POST /` (data fetch) and `POST /export` (accepts data, generates file)
- `capital-gains.service.ts` — calls `get_capital_gains($1, $2, $3)` PostgreSQL function and groups results
- `capital-gains-export.service.ts` — uses ExcelJS + jsPDF/autoTable to generate Excel and PDF

**Capital Gains also has a date selector UI with three modes in `ClientHoldingsView.tsx`:**
- **FY** — Financial Year (e.g. `2024-25`); `getFYDates()` converts to `{ start_date: "2024-04-01", end_date: "2025-03-31" }`
- **CY** — Calendar Year (e.g. `2024`); maps to `{ start_date: "2024-01-01", end_date: "2024-12-31" }`
- **CUSTOM** — User-entered ISO date strings (`customStartDate`, `customEndDate`)

The `periodLabel` string is passed through to the export as the `fy` parameter (used in the file name and report header).

---

### Holdings (Portfolio Valuation) Export

**Frontend flow (`src/lib/portfolioExport.ts` + `ClientHoldingsView.tsx`):**
1. `ClientHoldingsView.tsx` already holds `portfolioData` (fetched on mount via `getHoldingsReport`)
2. On export click: calls `generatePortfolioValuationPDF(portfolioData, DISTRIBUTOR_INFO)` from `src/lib/portfolioExport.ts`
3. That function POSTs `{ clientData: portfolioData, distributorInfo }` to `POST /api/investors/holdings-export`
4. Server receives full holdings JSON, generates PDF, returns buffer

**Backend (`src/modules/investors/`):**
- `investors.controller.ts` → `@Post('holdings-export')` — accepts `{ clientData, distributorInfo }`, passes to `InvestorsExportService.generatePortfolioValuationPDF()`
- `investors-export.service.ts` — jsPDF/autoTable PDF generator, ~550 lines

---

### Transactions Export

**Frontend flow (`src/lib/transactionReportExport.ts` + `ClientHoldingsView.tsx`):**
1. `handleTransactionExport()` calls `distributorService.getTransactionReport(clientId)` → hits `POST /api/investors/transaction-report`
2. On success: calls `exportTransactionReport(res.data, DISTRIBUTOR_INFO)` from `src/lib/transactionReportExport.ts`
3. That function POSTs `{ data: res.data, distributorInfo }` to `POST /api/investors/transactions-export`
4. Server receives full transaction data, generates PDF, returns buffer

**Backend (`src/modules/investors/`):**
- `investors.controller.ts` → `@Post('transaction-report')` (data fetch) and `@Post('transactions-export')` (accepts data, generates file)
- `transactions-export.service.ts` — jsPDF/autoTable PDF generator, ~300 lines
- `investors-holdings.service.ts` → `getTransactionReport(investorId)` — fetches from DB

---

## Target Architecture (What to Build)

Each export becomes a **single endpoint** that accepts only query parameters (IDs + dates), fetches data internally by calling the existing service methods, and streams the file.

### New Endpoint Map

| Report | Old (remove) | New (create) |
|---|---|---|
| Capital Gains PDF | `POST /api/capital-gains/export` | `POST /api/capital-gains/export/pdf` |
| Capital Gains Excel | `POST /api/capital-gains/export` | `POST /api/capital-gains/export/excel` |
| Holdings PDF | `POST /api/investors/holdings-export` | `GET /api/investors/:id/holdings/export` |
| Transactions PDF | `POST /api/investors/transactions-export` | `GET /api/investors/:id/transactions/export` |

> **Design note:** Combining Capital Gains PDF + Excel into one endpoint with a `format` query param (`?format=pdf` or `?format=excel`) is acceptable and preferred.

---

## Detailed Backend Changes (`sp2736/finiq-api`)

### 1. Capital Gains — Merge Data Fetch + Export

**File: `src/modules/capital-gains/capital-gains.controller.ts`**

Remove the existing `@Post('export')` endpoint.

Add a new endpoint:

```typescript
@Post('export')
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.OK)
async exportCapitalGains(
  @Body()
  body: {
    investor_id: string;
    from_date: string;
    to_date: string;
    period_label: string;          // e.g. "FY 2024-25" | "CY 2024" | "2024-01-01 to 2024-06-30"
    format: 'pdf' | 'excel';
    distributor_info?: any;
  },
  @Req() req: any,
  @Res() res: Response,
) {
  // 1. Auth / ownership check (identical to existing @Post('capital-gains') in investors.controller.ts)
  const userSnapshot = req.user;
  // ... replicate the same role-check logic from investors.controller.ts @Post('capital-gains')

  // 2. Fetch data using the existing service
  const result = await this.capitalGainsService.getCapitalGains(
    body.investor_id,
    body.from_date,
    body.to_date,
  );

  // 3. Generate file using the existing export service
  const buffer = await this.capitalGainsExportService.exportCapitalGains(
    body.format,
    result,              // pass the already-structured result directly
    body.period_label,
    body.distributor_info,
  );

  // 4. Stream file
  const investorNameFormatted = /* same name-formatting logic as before */ ...;
  const ext = body.format === 'excel' ? 'xlsx' : 'pdf';
  const contentType = body.format === 'excel'
    ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    : 'application/pdf';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="Capital_Gains_${investorNameFormatted}_${body.period_label}.${ext}"`);
  res.send(buffer);
}
```

**Important:** The `capitalGainsExportService.exportCapitalGains()` currently receives a pre-mapped frontend payload. You must verify the shape that `capitalGainsService.getCapitalGains()` returns vs. what `capitalGainsExportService.exportCapitalGains()` expects.

- `capitalGainsService.getCapitalGains()` returns:
  ```ts
  { investor_id, investor_name, gains_data: Array<{ folio_number, scheme_name, isin_no, transactions: [...] }> }
  ```
- `capitalGainsExportService.exportCapitalGains()` currently receives a **frontend-mapped** object whose shape is determined by `mapBackendToExportFormat()` in `ClientHoldingsView.tsx`.

**You must read `mapBackendToExportFormat()` in `ClientHoldingsView.tsx` carefully** and either:
  - **(Option A — preferred)** Update `capitalGainsExportService` to consume the raw service response shape directly (eliminate the mapping layer entirely), **OR**
  - **(Option B)** Move `mapBackendToExportFormat()` logic into `capitalGainsService.getCapitalGains()` or a dedicated mapper in the backend.

Option A is simpler. Audit every field accessed inside `capitalGainsExportService.ts` (look for `data.investorDetails`, `data.gains_data`, transaction field names, etc.) and align them to the DB response shape.

---

### 2. Holdings Export — Merge Data Fetch + Export

**File: `src/modules/investors/investors.controller.ts`**

Remove the existing `@Post('holdings-export')` endpoint body that accepts `clientData`.

Change it to:

```typescript
@Get(':id/holdings/export')
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.OK)
async exportHoldings(
  @Param('id') investorId: string,
  @Query('distributor_info') distributorInfoJson: string,
  @Req() req: any,
  @Res() res: Response,
) {
  // Auth check — same as existing @Get(':id/holdings')
  const userSnapshot = req.user;
  // ... replicate ownership/role check

  // Fetch holdings data internally
  const holdingsData = await this.holdingsService.getHoldingsReport(investorId);

  // Parse optional distributor branding (passed as JSON-encoded query param, or use a default)
  const distributorInfo = distributorInfoJson ? JSON.parse(distributorInfoJson) : undefined;

  const buffer = await this.investorsExportService.generatePortfolioValuationPDF(
    holdingsData,
    distributorInfo,
  );

  const rawName = holdingsData.investor_name || 'Investor';
  const investorNameFormatted = /* same formatting */ ...;
  const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${investorNameFormatted}_Holdings_${today}.pdf"`);
  res.send(buffer);
}
```

> **Note on distributor branding:** `distributorInfo` (logo base64, name, address) is frontend-specific config (`DISTRIBUTOR_INFO` constant in `ClientHoldingsView.tsx`). Since it's static per company, it should eventually come from the company record in the database. For now, pass it as a compact JSON query parameter. Alternatively, look it up from `CompanyDetail` entity using the authenticated user's company ID — that is the ideal long-term approach.

---

### 3. Transactions Export — Merge Data Fetch + Export

**File: `src/modules/investors/investors.controller.ts`**

Remove the existing `@Post('transactions-export')` endpoint body that accepts `data`.

Change it to:

```typescript
@Get(':id/transactions/export')
@UseGuards(JwtAuthGuard)
@HttpCode(HttpStatus.OK)
async exportTransactions(
  @Param('id') investorId: string,
  @Query('distributor_info') distributorInfoJson: string,
  @Req() req: any,
  @Res() res: Response,
) {
  // Auth check — replicate the same ownership/role logic from @Post('transaction-report')
  const userSnapshot = req.user;
  // ...

  // Fetch transaction data internally
  const txnData = await this.holdingsService.getTransactionReport(investorId);

  const distributorInfo = distributorInfoJson ? JSON.parse(distributorInfoJson) : undefined;

  const buffer = await this.transactionsExportService.generatePDF(txnData, distributorInfo);

  const rawName = txnData?.investor_name || 'Investor';
  const investorNameFormatted = /* same formatting */ ...;
  const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '_');

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${investorNameFormatted}_Transactions_${today}.pdf"`);
  res.send(buffer);
}
```

---

### 4. Module Registration

**File: `src/modules/capital-gains/capital-gains.module.ts`**

Ensure `CapitalGainsService` and `CapitalGainsExportService` are both provided (they already are — verify no new imports are needed).

**File: `src/modules/investors/investors.module.ts`**

Ensure `InvestorsHoldingsService`, `InvestorsExportService`, and `TransactionsExportService` are all provided in the module. Add any missing providers.

---

## Detailed Frontend Changes (`sp2736/finiq`)

### 1. `src/lib/capitalGainsExport.ts` — Replace Entirely

The current file POSTs pre-mapped data. Replace with a thin wrapper that sends only parameters:

```typescript
import { apiClient } from './apiClient';

/**
 * Triggers a server-side Capital Gains export.
 * The server fetches, maps, and formats the data — no data echoing.
 */
export const exportCapitalGains = async (
  format: 'pdf' | 'excel',
  investorId: string,
  fromDate: string,          // ISO date string e.g. "2024-04-01"
  toDate: string,            // ISO date string e.g. "2025-03-31"
  periodLabel: string,       // e.g. "FY 2024-25"
  distributorInfo: any,
): Promise<void> => {
  const blob = await apiClient.postBlob('/capital-gains/export', {
    investor_id: investorId,
    from_date: fromDate,
    to_date: toDate,
    period_label: periodLabel,
    format,
    distributor_info: distributorInfo,
  });

  const ext = format === 'excel' ? 'xlsx' : 'pdf';
  const investorNameFormatted = 'Capital_Gains'; // server sets the full filename in Content-Disposition; this is just a fallback
  const filename = `${investorNameFormatted}_${periodLabel}.${ext}`;

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
```

### 2. `src/lib/portfolioExport.ts` — Replace Entirely

```typescript
import { apiClient } from './apiClient';

/**
 * Triggers a server-side Holdings PDF export.
 * Accepts only the investor ID; server fetches data internally.
 */
export const generatePortfolioValuationPDF = async (
  investorId: string,
  distributorInfo?: any,
): Promise<void> => {
  const params = distributorInfo
    ? `?distributor_info=${encodeURIComponent(JSON.stringify(distributorInfo))}`
    : '';

  const blob = await apiClient.getBlob(`/investors/${investorId}/holdings/export${params}`);

  const filename = `Holdings_Report.pdf`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
```

> **Note:** `apiClient` may not have a `getBlob()` method — check `src/lib/apiClient.ts`. If missing, add it analogous to `postBlob()` but using GET with `responseType: 'blob'`.

### 3. `src/lib/transactionReportExport.ts` — Replace Entirely

```typescript
import { apiClient } from './apiClient';

/**
 * Triggers a server-side Transactions PDF export.
 * Accepts only the investor ID; server fetches data internally.
 */
export const exportTransactionReport = async (
  investorId: string,
  distributorInfo?: any,
): Promise<void> => {
  const params = distributorInfo
    ? `?distributor_info=${encodeURIComponent(JSON.stringify(distributorInfo))}`
    : '';

  const blob = await apiClient.getBlob(`/investors/${investorId}/transactions/export${params}`);

  const filename = `Transactions_Report.pdf`;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};
```

### 4. `src/components/distributor/clients/ClientHoldingsView.tsx` — Update Call Sites

#### Capital Gains export (`handleExportCG`)

Remove the first round-trip call to `distributorService.getCapitalGains()` entirely. The new `exportCapitalGains()` handles it internally. Simplify to:

```typescript
const handleExportCG = async (format: 'pdf' | 'excel') => {
  // ... same date-range computation (FY / CY / CUSTOM logic stays identical) ...

  setExportingFormat(format);
  try {
    await exportCapitalGains(
      format,
      clientId,        // investorId — was previously fetched and re-passed
      start_date,
      end_date,
      periodLabel,
      DISTRIBUTOR_INFO,
    );
    setIsCGModalOpen(false);
  } catch (err: any) {
    setCGNotif({ type: 'error', message: err?.message || 'Export failed.' });
  } finally {
    setExportingFormat(null);
  }
};
```

Also remove the `mapBackendToExportFormat` call and any import of it (it's no longer needed on the frontend).

#### Holdings export (inline call to `generatePortfolioValuationPDF`)

Find the call site (search for `generatePortfolioValuationPDF(` in the file). It currently receives `portfolioData` (the full data object). Change it to pass only `clientId`:

```typescript
await generatePortfolioValuationPDF(clientId, DISTRIBUTOR_INFO);
```

#### Transactions export (`handleTransactionExport`)

Remove the first round-trip call to `distributorService.getTransactionReport()`. Simplify:

```typescript
const handleTransactionExport = async () => {
  setIsExportingTxn(true);
  try {
    await exportTransactionReport(clientId, DISTRIBUTOR_INFO);
  } catch (err: any) {
    setCGNotif({ type: 'error', message: err?.message || 'Export failed.' });
  } finally {
    setIsExportingTxn(false);
  }
};
```

### 5. `src/services/distributor.service.ts` — Remove Dead Methods

After the above changes, `getCapitalGains` and `getTransactionReport` in `distributor.service.ts` are only called from the export handlers (which no longer need them). Verify they are unused elsewhere before removing. If unused, delete them. If used in other places (e.g. display-only views), keep them but do not call them from export handlers.

---

## Data Shape Alignment (Critical — Do Not Skip)

The most error-prone part is ensuring `capitalGainsExportService.exportCapitalGains()` accepts the raw shape returned by `capitalGainsService.getCapitalGains()`.

### What `getCapitalGains()` returns

```ts
{
  investor_id: string,
  investor_name: string,
  gains_data: Array<{
    folio_number: string,
    scheme_name: string,
    isin_no: string,
    transactions: Array<{
      // all DB columns except folio_number, scheme_name, isin_no, investor_name, investor_id
      // includes: purchase_date, purchase_nav, purchase_units, sale_date, sale_nav,
      //           sale_units, purchase_cost, sale_value, short_term_gain, long_term_gain, etc.
    }>
  }>
}
```

### What `capitalGainsExportService` currently expects

Audit every field access inside `capital-gains-export.service.ts`. Look for patterns like:
- `data.investorDetails?.name` → map to `data.investor_name`
- `data.gainsData` or `data.gains_data` — verify which casing it uses
- Transaction field names (camelCase vs snake_case)

**Fix approach:** Update `capital-gains-export.service.ts` to read directly from the snake_case DB shape. This is Option A and is strongly preferred over adding a server-side mapper.

### What `investorsExportService.generatePortfolioValuationPDF()` expects

This currently receives whatever the frontend's `portfolioData` contains (the full holdings report from `GET /api/investors/holdings`). Since `holdingsService.getHoldingsReport()` already returns that same shape (it is the source), no mapping change is needed here.

### What `transactionsExportService.generatePDF()` expects

Its JSDoc comment states it expects:
```
{ investor_name, mobile_no, email, transactions: [...] }
```
This is exactly what `holdingsService.getTransactionReport()` returns. No mapping change needed.

---

## `apiClient` — Ensure `getBlob()` Exists

Open `src/lib/apiClient.ts`. If `getBlob(url)` does not exist, add it:

```typescript
getBlob: async (url: string): Promise<Blob> => {
  const response = await axiosInstance.get(url, { responseType: 'blob' });
  return response.data;
},
```

(Adapt to the existing axios/fetch abstraction pattern already in that file.)

---

## Files to Change — Summary Checklist

### `sp2736/finiq-api` (backend)

- [ ] `src/modules/capital-gains/capital-gains.controller.ts`
  - Remove `@Post('export')` that accepts full data
  - Add new `@Post('export')` that accepts `{ investor_id, from_date, to_date, period_label, format, distributor_info? }` and fetches + formats internally
- [ ] `src/modules/capital-gains/capital-gains-export.service.ts`
  - Update field access to read from `capitalGainsService.getCapitalGains()` shape (snake_case, `investor_name` not `investorDetails.name`, etc.)
- [ ] `src/modules/investors/investors.controller.ts`
  - Remove `@Post('holdings-export')` that accepts `clientData`
  - Add `@Get(':id/holdings/export')` that fetches data internally
  - Remove `@Post('transactions-export')` that accepts `data`
  - Add `@Get(':id/transactions/export')` that fetches data internally
- [ ] `src/modules/investors/investors.module.ts`
  - Verify all services (`InvestorsHoldingsService`, `InvestorsExportService`, `TransactionsExportService`) are registered

### `sp2736/finiq` (frontend)

- [ ] `src/lib/capitalGainsExport.ts` — rewrite: pass params only, no data payload
- [ ] `src/lib/portfolioExport.ts` — rewrite: pass `investorId` only
- [ ] `src/lib/transactionReportExport.ts` — rewrite: pass `investorId` only
- [ ] `src/lib/apiClient.ts` — add `getBlob()` if missing
- [ ] `src/components/distributor/clients/ClientHoldingsView.tsx`
  - `handleExportCG`: remove `distributorService.getCapitalGains()` call + `mapBackendToExportFormat()` call; pass params to new `exportCapitalGains()`
  - Holdings export call: change `generatePortfolioValuationPDF(portfolioData, DISTRIBUTOR_INFO)` → `generatePortfolioValuationPDF(clientId, DISTRIBUTOR_INFO)`
  - `handleTransactionExport`: remove `distributorService.getTransactionReport()` call; pass `clientId` directly
- [ ] `src/services/distributor.service.ts` — remove `getCapitalGains` and `getTransactionReport` if no longer used elsewhere

---

## Constraints & Reminders

- **Do not change** the PDF/Excel generation logic inside the export services. Only the data sourcing changes.
- **Do not change** the Capital Gains date selector UI (FY / CY / CUSTOM modes). The date resolution logic in `handleExportCG` stays on the frontend; only the fetch+export calls are merged server-side.
- **Auth guards** on new endpoints must be at least as strict as the original two endpoints they replace. Replicate the exact role-check logic verbatim.
- **The `distributor_info` branding object** (`DISTRIBUTOR_INFO` constant in `ClientHoldingsView.tsx`) contains a base64 logo and may be large. If query-string encoding causes URL length issues for the GET endpoints, switch to POST with a small body like `{ distributor_info: ... }` for those endpoints.
- **Filename generation** can stay on the server side (set via `Content-Disposition` header). The frontend `a.download` fallback is fine as a generic name.
- **TypeScript types:** Add a proper DTO class or interface for each new endpoint's body/query parameters in NestJS. Add `@IsString()`, `@IsIn(['pdf', 'excel'])`, etc. validation decorators consistent with existing code patterns.
- **Do not break** the investor self-service portal (`/investor` routes). The `GET /api/investors/holdings` endpoint (used for the display view) is separate from the new export endpoint and must not be touched.
