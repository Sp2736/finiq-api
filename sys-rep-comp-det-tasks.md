# Systematic Transactions Report + Company-Details Cleanup — Task Spec

This document is the single source of truth for a set of backend + frontend changes to the
FinIQ codebase (NestJS backend in `backend/`, Next.js frontend in `frontend/`). It is written
so an autonomous coding agent can execute it end-to-end without further clarification. Follow
the tasks **in order** — later tasks depend on earlier ones. Every task lists: the problem,
the exact files involved, the implementation plan, and acceptance criteria.

> NOTE for the agent: before writing code, open every file referenced in a task and re-confirm
> current line numbers/content, since line numbers will have drifted from when this spec was
> written. Search by symbol name (function name, variable name) rather than trusting exact
> line numbers.

---

## TASK 0 — Orientation (read-only, do this first)

Read and understand these files completely before touching anything:

- `backend/src/modules/sips/sips.service.ts` (the `getSystematicReport` method — this is the
  core of the systematic transactions backend logic)
- `backend/src/modules/sips/sips.controller.ts`
- `backend/src/modules/sips/dto/get-sips-query.dto.ts`
- `frontend/src/app/distributor/reports/systematic-transactions/page.tsx` (the whole page —
  it currently fetches everything once and does all filtering/grouping client-side)
- `frontend/src/services/distributor.service.ts` (find `getSystematicReport` and the
  `SystematicReportPayload` / `SystematicReportItem` types)
- `frontend/src/lib/systematicReportExport.ts` (client-side jsPDF generation — to be replaced
  by a backend export endpoint, mirroring the existing pattern)
- `backend/src/modules/investors/transactions-export.service.ts` and
  `backend/src/modules/investors/investors.controller.ts` (`exportTransactions` method) — this
  is the **reference pattern** for "backend generates the PDF and streams it" that Task 4 must
  replicate for the systematic report.
- `backend/src/modules/capital-gains/capital-gains-export.service.ts` and
  `capital-gains.controller.ts` — second reference pattern, more elaborate (grouping, totals
  bands), useful since the systematic report also has a "Group By" feature.
- `backend/src/entities/cams-scheme-detail.entity.ts` (note the `amc` column — this holds the
  AMC's human-readable name for CAMS) and `backend/src/entities/karvy-scheme-detail.entity.ts`
  (note the `amc_name` column — same purpose for KARVY).
- `backend/src/modules/auth/authentication.service.ts` (`generateAuthResponse` method) and
  `backend/src/modules/auth/authentication.repository.ts` (`findCompanyDetail`) — this is how
  the company logo is currently fetched at login time and returned in the OTP-verify response.
- `backend/src/entities/company.entity.ts` and `backend/src/entities/company-detail.entity.ts`
  — the two tables that hold all company info (name/email/phone live on `companies`;
  address/logo live on `company_details`).
- `frontend/src/app/(auth)/distributor-portal/page.tsx` — where `company_logo` from the login
  response is currently written to `localStorage` under the key `company-logo-dis`.
- `frontend/src/services/auth.service.ts` — `VerifyOtpData` / `LoginResponse` types.
- `frontend/src/components/distributor/clients/ClientHoldingsView.tsx` — the file that
  currently defines and uses the hardcoded `DISTRIBUTOR_INFO` object (search for
  `DISTRIBUTOR_INFO` in this file). This is one of (at least) two places `DISTRIBUTOR_INFO` is
  hardcoded — the other is `frontend/src/lib/systematicReportExport.ts`. Use
  `grep -rn "DISTRIBUTOR_INFO" frontend/src` to find all usages before starting Task 5.
- `frontend/src/lib/transactionReportExport.ts` — the established pattern for how an export
  helper merges `localStorage` data with a `distributorInfo` prop and POSTs it to a backend
  export endpoint. Task 5's new helper should follow this same shape.

---

## TASK 1 — Replace AMC code with AMC name in the Systematic Transactions report

### Problem
In `backend/src/modules/sips/sips.service.ts`, the `getSystematicReport` method currently
selects `cd.amc_code AS amc_code` (CAMS) and `kr.fund_code AS amc_code` (KARVY), and the
two `// todo:` comments explicitly call out the fix needed:

```ts
// todo: join cams with cams_scheme_details on amc_code, to fetch the amc as amc_name
// todo: join karvy with karvy_scheme_details on amc_code, to fetch the amc as amc_name
```

The frontend then displays `item.amc_code` (or the raw AMC code) wherever "AMC" is shown,
instead of a human-readable AMC name. This must be fixed end-to-end: backend query, backend
mapping, frontend display, frontend grouping ("Group By → AMC"), and PDF export.

### Backend implementation

1. Open `backend/src/modules/sips/sips.service.ts`, locate the `getSystematicReport` method,
   and the raw SQL `query` string defined with the `combined` CTE (CAMS `UNION ALL` KARVY).

2. **CAMS branch**: join `cams_sip_stp_details cd` to `cams_scheme_details csd` on AMC code.
   Inspect `cams_sip_stp_details` columns (find its entity at
   `backend/src/entities/cams-sip-stp-detail.entity.ts` if present, otherwise inspect via the
   existing query which already references `cd.amc_code` and `cd.scheme_code`) to confirm the
   scheme-code column name used for the join (it should match `sch_code` on
   `cams_scheme_details`). The join condition must use **both** `amc_code` and the scheme code,
   matching the `@Unique(['amc_code', 'sch_code'])` constraint on `CamsSchemeDetail`:

   ```sql
   LEFT JOIN cams_scheme_details csd
     ON csd.amc_code = cd.amc_code
     AND csd.sch_code = cd.scheme_code
   ```

   Replace the old `cd.amc_code AS amc_code` select with:

   ```sql
   COALESCE(csd.amc, cd.amc_code) AS amc_name
   ```

   (fallback to the raw code if no scheme-detail match is found, so nothing silently disappears).

3. **KARVY branch**: join `karvy_sip_registrations kr` to `karvy_scheme_details ksd` on
   `product_code`. Inspect `karvy_sip_registrations` (used elsewhere in this file via
   `kr.fund_code`, `kr.product_code` if present — verify the actual column name for the
   product/scheme code on `karvy_sip_registrations`, it may be `product_code` or
   `scheme_code`; cross-check against `backend/src/modules/cams-sip-stp-details` and
   `karvy-scheme-details` repository/service files for existing join patterns elsewhere in the
   codebase, e.g. `backend/src/modules/sips/sips.service.ts`'s `getInvestorSips` /
   `getCompanySipSummary` methods which already join `karvy_investor_master_data.product_code`
   to other KARVY tables — reuse the same column name here):

   ```sql
   LEFT JOIN karvy_scheme_details ksd
     ON ksd.product_code = kr.product_code
   ```

   Replace `kr.fund_code AS amc_code` with:

   ```sql
   COALESCE(ksd.amc_name, kr.fund_code) AS amc_name
   ```

4. Update the final `.map()` at the end of `getSystematicReport` (where the function builds the
   plain object returned to the controller) — rename the output field from `amc_code` to
   `amc_name`:

   ```ts
   amc_name: r.amc_name || 'Unknown',
   ```

   Remove the old `amc_code: r.amc_code || 'Unknown'` line. **Search the rest of this file and
   the controller for any other reference to `amc_code` in this method's output and update
   them.**

5. Delete the two `// todo:` comments — they're now resolved.

6. Double check that adding the `LEFT JOIN` does not duplicate rows. Both `cams_scheme_details`
   (`@Unique(['amc_code', 'sch_code'])`) and `karvy_scheme_details`
   (`@Index(['product_code'])`, `product_code` is `unique: true` per the entity) are 1-row-per-
   scheme tables, so a `LEFT JOIN` on those exact keys is safe and will not fan out rows. Keep
   the existing `SELECT DISTINCT ON (trxn_no)` safeguard in place regardless.

### Frontend implementation

1. In `frontend/src/services/distributor.service.ts`, find the `SystematicReportItem`
   interface/type (or wherever the systematic report's TypeScript shape is declared) and
   rename the `amc_code` field to `amc_name`.

2. In `frontend/src/app/distributor/reports/systematic-transactions/page.tsx`:
   - Find the `groupedReportData` `useMemo` block. It currently has:
     ```ts
     else if (appliedGroupBy === "AMC") key = item.amc_code || "Unknown AMC";
     ```
     Change to:
     ```ts
     else if (appliedGroupBy === "AMC") key = item.amc_name || "Unknown AMC";
     ```
   - Search the whole file for any other `.amc_code` reference (e.g. if AMC is rendered as a
     column/badge in the table or mobile card view — grep the file for `amc_code` to be sure)
     and rename to `.amc_name`.
   - If the table currently does NOT render an AMC column at all, **add one** (table header
     "AMC" + a `<td>` rendering `item.amc_name`, plus the matching block in the mobile card
     view) — Group By AMC is meaningless to a user if the AMC value is never shown anywhere in
     the row/card. Place it sensibly near the Scheme Name column.

3. In `frontend/src/lib/systematicReportExport.ts` (only if Task 4 below has NOT yet removed
   this file — see Task 4, this file is being replaced by a backend export; if Task 4 is done
   first, skip this step entirely and instead make this same `amc_code` → `amc_name` fix
   directly inside the new backend PDF export service built in Task 4):
   - Find every reference to `amc_code` in the PDF table-building logic and rename to
     `amc_name`.

### Acceptance criteria
- The raw SQL query in `sips.service.ts` no longer selects `amc_code`/`fund_code` as the AMC
  identifier; it selects a joined, human-readable AMC name aliased `amc_name`, with a safe
  fallback to the raw code.
- The two `// todo:` comments are gone.
- `Group By → AMC` groups by the real AMC name, not the raw code.
- The AMC name (not code) is visible somewhere in the table/card UI.
- The exported PDF (after Task 4) shows the AMC name, not the code.

---

## TASK 2 — Audit other filters for "code vs name" issues

### Problem
The user suspects AMC isn't the only filter currently exposing an internal code instead of a
human-readable name. Every filter on the Systematic Transactions page and its backend query
must be audited.

### Steps

1. In `frontend/src/app/distributor/reports/systematic-transactions/page.tsx`, list every
   filter currently exposed: **Investor**, **Status (Mode)**, **Type (SIP/STP/SWP)**,
   **Registrar (CAMS/KARVY)**, **Group By (None/Client/AMC/Scheme/Registrar)**.

2. For each, check whether the *value the filter operates on* and the *value displayed to the
   user* are both human-readable:
   - **Investor**: already uses `investor_name` via `toTitleCase()` — fine, no code involved.
   - **Status/Mode**: derived client-side from dates/`termination_date` into words like
     "Running"/"Terminated"/"Expired" — already human-readable, fine.
   - **Type**: `SIP`/`STP`/`SWP` are short business-domain codes, not arbitrary internal IDs —
     these are intentionally code-like and used as-is across the whole app (DB columns,
     `aut_trntyp` mapping in the backend query already converts single-letter `P`/`SO`/`R` into
     these readable type values) — **no change needed**.
   - **Registrar**: `CAMS`/`KARVY` are already the literal source names — **no change needed**.
   - **Scheme** (used only in Group By): confirm `item.scheme_name` is already a real name
     (it is — `cd.scheme AS scheme_name` / `kr.scheme_name AS scheme_name` in the backend
     query) — **no change needed**.
   - **AMC**: fixed in Task 1.
   - **Folio Number, Transaction Number (trxn_no)**: these are legitimately codes/identifiers
     by nature (not "names" with a hidden lookup table) — leave as-is.

3. Also check the backend `getSystematicReport` method's `registrar` filter logic
   (`camsCondition`/`karvyCondition`) and the `arnIds` filter (`company_arns_filter` CTE) —
   confirm these operate on UUIDs/internal codes that are never rendered directly to the user
   (the investor-facing "ARN" filter, if exposed anywhere in the UI, should show ARN
   number/name rather than the raw `company_arns.id` UUID — grep
   `frontend/src/app/distributor/reports/systematic-transactions/page.tsx` for any "ARN"
   selector; if one exists, ensure it shows a human label, not a UUID. If no ARN selector
   currently exists in the UI for this page, no action is needed here — `arnIds` is only used
   internally by the API contract).

4. Document findings as a short comment block at the top of
   `frontend/src/app/distributor/reports/systematic-transactions/page.tsx` summarizing: "AMC
   now shows amc_name (joined from scheme-details tables); all other filters already operate on
   human-readable values; Type/Registrar codes are intentional domain vocabulary."

### Acceptance criteria
- A clear, written confirmation (in code comments and/or a short note in the PR description)
  that every filter on this page has been checked, with AMC being the only one that needed a
  fix (handled in Task 1).

---

## TASK 3 — Make the Systematic Transactions API filter server-side (stop "fetch all, filter on frontend")

### Problem
`handleGenerateReport` in
`frontend/src/app/distributor/reports/systematic-transactions/page.tsx` calls
`distributorService.getSystematicReport(payload)` where `payload` only ever contains `types`
and `registrar` — **never** `status`/`mode`, **never** `investorId`. The full unfiltered (or
barely filtered) dataset is fetched every time, and `status` filtering + investor filtering
happen entirely in the `filteredReportData` `useMemo` on the client. This must move server-side
so the API only returns the rows that should be displayed.

### Backend implementation

1. In `backend/src/modules/sips/sips.service.ts`, `getSystematicReport` already accepts
   `user, type, status, arnIds, registrar`. It already supports a `status` parameter mapped to
   4 values: `CURRENTLY_RUNNING`, `FORTHCOMING`, `PREMATURELY_TERMINATED`, `DUE_TO_MATURITY`.
   The frontend's `MODES` array, however, has more values than the backend supports:
   `["All", "Running", "Forthcoming", "Terminated", "Procured", "Matured", "Expired",
   "Deleted", "Status", "Analysis"]`. Reconcile these:
   - Keep backend support for: `CURRENTLY_RUNNING` (frontend "Running"), `FORTHCOMING`
     (frontend "Forthcoming"), `PREMATURELY_TERMINATED` (frontend "Terminated"),
     `DUE_TO_MATURITY` (frontend "Expired"/"Matured" — pick "Expired" as the canonical label
     used by `getStatusBadge` elsewhere in the page, and treat "Matured" as an alias of the
     same backend value if the design wants to keep both labels, OR simplify the frontend
     `MODES` list down to exactly the 4 statuses the backend actually understands, dropping
     "Procured", "Deleted", "Status", "Analysis" which have no backend implementation and
     appear to be dead/placeholder UI options). **Decision: simplify `MODES` on the frontend to
     `["All", "Running", "Forthcoming", "Terminated", "Expired"]`** — this keeps the UI honest
     about what the API can actually filter, matching the 4 backend-supported statuses, and
     removes filter options that silently did nothing before.
   - Add a small mapping function/object in the frontend page that converts the UI label to the
     backend's expected uppercase-with-underscore status string, e.g.:
     ```ts
     const STATUS_FILTER_MAP: Record<string, string> = {
       Running: "CURRENTLY_RUNNING",
       Forthcoming: "FORTHCOMING",
       Terminated: "PREMATURELY_TERMINATED",
       Expired: "DUE_TO_MATURITY",
     };
     ```

2. Add **investor filtering** to the backend. The frontend currently filters
   `toTitleCase(item.investor_name) === appliedInvestorId` client-side. Add a new optional
   parameter to `getSystematicReport(user, type, status, arnIds, registrar, investorName?)`
   (or, cleaner, pass an `investorId` if the investor selector can be wired to actual investor
   IDs — inspect `distributorService.downloadInvestorList` to see whether the returned investor
   objects include a stable `id`; the current frontend code maps
   `{ id: toTitleCase(inv.name), name: toTitleCase(inv.name) }` which **discards the real ID**
   and uses the name as a pseudo-ID — this is fragile (duplicate names collide) and should be
   fixed as part of this task):
   - Update the investor-list mapping in
     `frontend/src/app/distributor/reports/systematic-transactions/page.tsx`'s
     `fetchAllInvestors` effect to keep the **real** investor ID:
     ```ts
     const mapped = response.data.data.map((inv: any) => ({
       id: inv.id,
       name: toTitleCase(inv.name),
     }));
     ```
     (dedupe by `id`, not by `name`, in the `Array.from(new Map(...))` call directly below it).
   - In the backend SQL, add an optional `AND combined.investor_name ILIKE $N` clause if you
     keep name-based filtering, OR (preferred, since IDs are now available) join through to an
     investor id column if the underlying CAMS/KARVY tables expose one (check
     `cams_investor_static_details.investor_id` / `karvy_investor_master_data.investor_id`,
     both of which are already joined-from in other methods in this same service file, e.g.
     `getCompanySipSummary`). Filtering by `investor_id` is strictly more correct than filtering
     by name (handles duplicate investor names safely). Add the investor_id join + WHERE clause
     similarly to how `arnIds`/`registrar` filters are conditionally appended (`hasArnFilter`
     pattern) — only apply the filter when a non-`"ALL"` investor id is supplied.

3. Update `backend/src/modules/sips/sips.controller.ts`'s `getSystematicReport` POST handler to
   pull the new `investorId` (or `investorName`) field out of `req.body` and pass it through to
   the service call.

4. Update `backend/src/modules/sips/dto/get-sips-query.dto.ts` if a DTO/validation class exists
   for this body — add the new optional field with proper `@IsOptional()`/`@IsUUID()` (or
   `@IsString()`) decorators, matching the existing style used for `arnIds`/`registrar` in that
   file.

### Frontend implementation

1. In `frontend/src/services/distributor.service.ts`, extend `SystematicReportPayload` (find
   its type definition) to include the new optional fields: `status?: string` and
   `investorId?: string` (in addition to the existing `types`/`registrar`).

2. Rewrite `handleGenerateReport` in
   `frontend/src/app/distributor/reports/systematic-transactions/page.tsx` to build a complete
   payload from **all** active filters, not just type/registrar:

   ```ts
   const handleGenerateReport = async () => {
     setIsLoading(true);
     setHasSearched(true);

     setAppliedInvestorId(selectedInvestorId);
     setAppliedMode(selectedMode);
     setAppliedType(selectedType);
     setAppliedGroupBy(selectedGroupBy);

     try {
       const payload: any = {};
       if (selectedType !== "All") payload.types = [selectedType];
       if (selectedRegistrar !== "All") payload.registrar = selectedRegistrar;
       if (selectedMode !== "All" && STATUS_FILTER_MAP[selectedMode]) {
         payload.status = STATUS_FILTER_MAP[selectedMode];
       }
       if (selectedInvestorId !== "ALL") payload.investorId = selectedInvestorId;

       const response = await distributorService.getSystematicReport(payload);
       if (response.success && response.data) {
         setReportData(response.data);
       } else {
         setReportData([]);
       }
     } catch (error) {
       console.error("Failed to fetch systematic reports", error);
       setReportData([]);
     } finally {
       setIsLoading(false);
     }
   };
   ```

   Note `getSystematicReport`'s service signature in `distributor.service.ts` already accepts
   `types: string[]`, so passing `[selectedType]` (singular selection) is consistent with the
   existing API shape, which iterates `typesToFetch` server-side — no backend change needed
   there since the existing controller body already destructures `type` as a single string;
   confirm whether the controller expects `type` (singular) or `types` (array) by re-reading
   `sips.controller.ts` and `sips.service.ts`'s parameter list (`type?: string` is singular in
   the service signature) — **align the frontend payload key name (`types` vs `type`) with
   whatever the controller/service actually destructures**; fix any mismatch found (the current
   frontend code already sends `payload.types = [selectedType]` while the service signature is
   `type?: string` singular — this is an existing bug to fix as well: either change the
   controller to accept an array and loop, or change the frontend to send a single string. The
   **simplest, least invasive fix**: change frontend to send `payload.type = selectedType`
   (singular string) to match the existing service signature, since the service already handles
   `type ? [type.toUpperCase()] : ['SIP','STP','SWP']` for a singular `type`).

3. **Remove all client-side filtering** for type/status/investor — once the backend returns
   exactly the right rows, `filteredReportData` should become simply:
   ```ts
   const filteredReportData = reportData;
   ```
   (or remove the `useMemo` entirely and use `reportData` directly throughout the JSX). Keep
   `groupedReportData`'s grouping logic (`Group By`) as a pure client-side aggregation of
   whatever the server already returned — that part is legitimate post-fetch transformation,
   not filtering, and grouping does not need its own API call.

4. Confirm the "Generate" button still triggers exactly one API call with the complete filter
   set, and that changing only the Group By selector (without re-clicking Generate) does NOT
   trigger any new network call — it should only re-run the client-side `groupedReportData`
   memo against already-fetched, already-filtered data. (Check whether Group By currently
   requires clicking Generate to take effect, or updates live — preserve existing UX behavior
   here, just ensure no redundant network calls happen.)

### Acceptance criteria
- Selecting a Status/Mode, Investor, Type, or Registrar filter and clicking "Generate" results
  in exactly one POST to `/sips/systematic-report` whose body includes all active filters.
- The returned `reportData` requires no further client-side filtering by type/status/investor.
- The investor dropdown filters by real investor ID, not by a name-as-pseudo-ID hack.
- No behavior regression: empty-state messaging, loading states, and the existing "must click
  Generate before any data shows" UX all continue to work.

---

## TASK 4 — Move Systematic Report PDF export to the backend (match Holdings/Transactions/Capital-Gains pattern)

### Problem
`frontend/src/lib/systematicReportExport.ts` builds the systematic-transactions PDF entirely
client-side with `jsPDF`/`jspdf-autotable`, including a hardcoded `DISTRIBUTOR_INFO` constant.
Every other report (Holdings, Transactions, Capital Gains) generates its PDF **server-side**
and streams the finished file back via a dedicated `POST .../export` endpoint. Systematic
Report must follow the same architecture.

### Reference pattern to copy
Use `backend/src/modules/investors/transactions-export.service.ts` (`TransactionsExportService`,
~315 lines) as the primary template — it's the simplest of the three existing export services
and structurally closest to what's needed here (header, identity band, one data table, totals
band, footer). Pull in ideas from `capital-gains-export.service.ts` only for the **grouping**
support (since Systematic Report has a "Group By" feature that Transactions Report does not).

### Backend implementation

1. **Create** `backend/src/modules/sips/systematic-report-export.service.ts`:
   - `@Injectable()` class `SystematicReportExportService` with a single public method:
     ```ts
     public generatePDF(
       items: any[],
       opts: {
         type: string;           // "All" | "SIP" | "STP" | "SWP"
         investorLabel: string;  // "All Investors" or a specific investor name
         groupBy: string;        // "None" | "Client" | "AMC" | "Scheme" | "Registrar"
       },
       distributorInfo?: any,
     ): Buffer
     ```
   - Reuse the exact same design-token palette (`const C = {...}`) and `fmt`/`fmtDate`/
     `toTitleCase` helpers as `transactions-export.service.ts`, so all exported PDFs in the app
     look visually consistent (navy/steel-blue/white).
   - Header: distributor logo (from `distributorInfo.logoBase64`, same `addImage` pattern as
     `transactions-export.service.ts`'s `drawHeader`) + title text `"Systematic Transactions
     Report"` + a subtitle line showing the active Type filter (e.g. "Type: SIP" or "Type: All")
     + generated date.
   - Identity/summary band: investor label (`opts.investorLabel`), total record count, and (if
     `distributorInfo` has `name`/`address`/`phone`/`email`) the distributor's own contact block
     right-aligned (mirror `drawInvestorBand` in the reference file, but also render the
     distributor's name/address since this report is distributor-facing, not strictly an
     investor's own contact-info band like the Transactions report is).
   - **Table mode** (when `opts.groupBy === "None"`): one `autoTable` call with columns: Trxn
     No, Type, AMC Name, Scheme Name, Folio No, Amount, Start Date, End Date, Status, Registrar
     (Source). Map `item.amc_name` (per Task 1), format dates with `fmtDate`, format amount with
     `fmt`, derive the Status text the same way the frontend's `getStatusBadge` does
     (termination_date → "Terminated"; end_date in the past → "Expired"; else "Running") — keep
     this status-derivation logic in **one place** ideally; since the frontend will still need
     it for on-screen badges, just duplicate the same 3-branch logic server-side in this export
     service (it's small and stable).
   - **Grouped mode** (when `opts.groupBy !== "None"`): instead of (or in addition to, depending
     on product preference — match what the current client-side `generateSystematicPDF`
     function did for grouped exports; inspect the rest of
     `frontend/src/lib/systematicReportExport.ts` beyond what was already viewed, specifically
     how it currently renders `groupedData`, and replicate that exact visual structure
     server-side) the detail table, render a summary table: Group Name, Mandate Count, Total
     Amount — sorted by Total Amount descending, matching the existing
     `groupedReportData.sort((a, b) => b.totalAmount - a.totalAmount)` logic from the frontend
     page.
   - Totals band + page-number footer, same approach as
     `transactions-export.service.ts`'s `drawTotalsBand`/`drawFooters`.
   - Empty-state handling (no rows) mirroring `drawEmptyState`.

2. **Add export endpoint** to `backend/src/modules/sips/sips.controller.ts`:
   ```ts
   @Post('systematic-report/export')
   @HttpCode(HttpStatus.OK)
   async exportSystematicReport(
     @Body() body: any,
     @Req() req: any,
     @Res() res: any,
   ) {
     if (req.user?.type === 'investor') {
       throw new ForbiddenException('Only distributors can access this endpoint');
     }
     const { type, status, arnIds, registrar, investorId, investorLabel, groupBy, distributor_info } = body;

     const report = await this.sipsService.getSystematicReport(
       req.user, type, status, arnIds, registrar, investorId,
     );

     const pdfBuffer = this.systematicReportExportService.generatePDF(
       report,
       {
         type: type || 'All',
         investorLabel: investorLabel || 'All Investors',
         groupBy: groupBy || 'None',
       },
       distributor_info,
     );

     res.set({
       'Content-Type': 'application/pdf',
       'Content-Disposition': 'attachment; filename="systematic-transactions-report.pdf"',
       'Content-Length': pdfBuffer.length,
     });
     res.end(pdfBuffer);
   }
   ```
   (Re-check exact header/response conventions against `exportTransactions` in
   `investors.controller.ts` and replicate them precisely — including any
   `@UseGuards(JwtAuthGuard)` decorator already applied at the controller class level for
   `SipsController`, error handling style, and how `res` is typed/injected.)

3. Inject `SystematicReportExportService` into `SipsController`'s constructor, and register the
   new service as a provider in `backend/src/modules/sips/sips.module.ts`.

4. **Group-by-aware totals**: the report must compute "total amount" and "mandate count" per
   group **inside the service**, mirroring exactly the math currently done in the frontend's
   `groupedReportData` `useMemo` (count += 1, totalAmount += Number(item.amount) || 0, grouped
   by Client/AMC/Scheme/Registrar — use `investor_name`/`amc_name`/`scheme_name`/`source`
   respectively as the group key, with the same `"Unknown X"` fallback labels used today).

### Frontend implementation

1. **Delete** `frontend/src/lib/systematicReportExport.ts` (or, if other files still import
   `toTitleCase`/`DISTRIBUTOR_INFO` from it, move `toTitleCase` into a shared utils module
   first — check for cross-imports with `grep -rn "from.*systematicReportExport" frontend/src`
   before deleting; `toTitleCase` is used inside
   `frontend/src/app/distributor/reports/systematic-transactions/page.tsx` itself, so move it
   to e.g. `frontend/src/lib/utils.ts` or a shared `stringUtils.ts` and update the import in
   the page file accordingly).

2. **Create** `frontend/src/lib/systematicReportPdfExport.ts` (new file, following exactly the
   shape of `frontend/src/lib/transactionReportExport.ts`):
   ```ts
   import { apiClient } from "./apiClient";

   export const exportSystematicReportPDF = async (
     payload: {
       type?: string;
       status?: string;
       registrar?: string;
       investorId?: string;
       investorLabel?: string;
       groupBy?: string;
     },
     distributorInfo?: any,
   ): Promise<void> => {
     try {
       const storedLogo = typeof window !== 'undefined'
         ? (localStorage.getItem('company-logo-dis') || localStorage.getItem('company-logo-inv'))
         : null;

       let finalDistributorInfo = distributorInfo || {};
       if (storedLogo) {
         finalDistributorInfo = { ...finalDistributorInfo, logoBase64: storedLogo };
       }

       const body = {
         ...payload,
         distributor_info: Object.keys(finalDistributorInfo).length > 0 ? finalDistributorInfo : undefined,
       };

       const blob = await apiClient.postBlob('/sips/systematic-report/export', body);

       const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
       const filename = `Systematic-Transactions-Report_${today}.pdf`;

       const url = window.URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       a.download = filename;
       document.body.appendChild(a);
       a.click();
       document.body.removeChild(a);
       window.URL.revokeObjectURL(url);
     } catch (error) {
       console.error('Failed to export Systematic Transactions report:', error);
       throw error;
     }
   };
   ```
   (Confirm `apiClient.postBlob` exists and matches this exact call signature by inspecting
   `frontend/src/lib/apiClient.ts` — it's already used by `transactionReportExport.ts`.)

3. In `frontend/src/app/distributor/reports/systematic-transactions/page.tsx`, replace the
   `handleExportPDF` function body. It currently calls the client-side `generateSystematicPDF`
   synchronously; change it to call the new async backend export helper with the **currently
   applied** filters (not the currently *selected-but-not-yet-applied* ones — use the
   `applied*` state variables, matching what's actually on screen):
   ```ts
   const handleExportPDF = async () => {
     if (appliedGroupBy === "None" && filteredReportData.length === 0) return;
     if (appliedGroupBy !== "None" && (!groupedReportData || groupedReportData.length === 0)) return;

     setIsExportingPdf(true); // add this loading state if it doesn't already exist
     try {
       const investorLabel =
         appliedInvestorId === "ALL"
           ? "All Investors"
           : dynamicInvestors.find((inv) => inv.id === appliedInvestorId)?.name || "All Investors";

       await exportSystematicReportPDF({
         type: appliedType !== "All" ? appliedType : undefined,
         status: appliedMode !== "All" ? STATUS_FILTER_MAP[appliedMode] : undefined,
         registrar: selectedRegistrar !== "All" ? selectedRegistrar : undefined,
         investorId: appliedInvestorId !== "ALL" ? appliedInvestorId : undefined,
         investorLabel,
         groupBy: appliedGroupBy,
       });
     } catch (error) {
       console.error("Export failed:", error);
       // surface an error notification using whatever existing notification pattern this page (or a sibling page like ClientHoldingsView) already uses
     } finally {
       setIsExportingPdf(false);
     }
   };
   ```
   Add an `isExportingPdf` boolean state (mirroring `isExportingTxn`/`isExportingPdf` patterns
   already used in `ClientHoldingsView.tsx`) and wire it into the Export PDF button's
   `disabled`/spinner state, matching the existing UX conventions used elsewhere in the app for
   async export buttons.

4. Remove the now-unused `import { generateSystematicPDF, toTitleCase } from "@/lib/systematicReportExport";`
   line and replace with the new imports (`exportSystematicReportPDF` from the new lib file,
   `toTitleCase` from its new shared location).

### Acceptance criteria
- Clicking "Export PDF" triggers a `POST /sips/systematic-report/export` request and downloads
  a server-generated PDF; no `jsPDF`/`jspdf-autotable` code runs in the browser for this report
  anymore.
- The exported PDF visually matches the existing navy/steel-blue/white design language used by
  Holdings/Transactions/Capital-Gains exports.
- Grouped exports (`Group By != None`) render a group-summary table server-side identical in
  numbers (count, total amount, sort order) to what the old client-side `groupedReportData`
  computed.
- The PDF shows AMC **name** (Task 1), not AMC code.
- `frontend/src/lib/systematicReportExport.ts` no longer exists (or is fully deprecated/unused).

---

## TASK 5 — Replace hardcoded `DISTRIBUTOR_INFO` with real company details loaded at login (BONUS)

### Problem
`frontend/src/components/distributor/clients/ClientHoldingsView.tsx` (and, before Task 4, also
`frontend/src/lib/systematicReportExport.ts`) hardcodes:
```ts
const DISTRIBUTOR_INFO = {
  name: "SHRINATHJI INVESTMENT",
  address: "527, 5 TH FLOOR, NAVRANG COMPLEX., RAOPURA, VADODARA-390001",
  email: "shrinathjiinvestment@gmail.com",
  phone: "9879786067",
  logoBase64: "...",
};
```
This is wrong for any company other than this one hardcoded tenant. The **logo** is already
correctly fetched per-company at login (`generateAuthResponse` in
`authentication.service.ts` → `findCompanyDetail` → `logo_base64`) and cached in
`localStorage` under `company-logo-dis`. The same approach must be extended to **name,
address, email, phone** — all fetched from the database via the company id, not hardcoded.

### Backend implementation

1. In `backend/src/modules/auth/authentication.repository.ts`, extend (or add alongside)
   `findCompanyDetail` to also fetch the parent `Company` row's `name`/`email`/`phone_number`
   (these live on the `companies` table per `company.entity.ts`, not on `company_details`).
   Two options — pick the cleaner one given the existing `CompanyDetail` ↔ `Company` relation
   (`CompanyDetail.company` is a `@OneToOne` back-reference to `Company`):
   - **Option A (preferred)**: use the existing `companyDetailRepo.findOne` call but add
     `relations: ['company']` so `companyDetail.company.name`,
     `companyDetail.company.email`, `companyDetail.company.phone_number` become available on
     the same query result, no second query needed.
   - **Option B**: inject `@InjectRepository(Company)` separately and run a second lookup by
     `companyId`. Use this only if relation-loading via Option A proves awkward given how
     `CompanyDetail.company` is currently declared (it uses string-based lazy type references
     — confirm TypeORM can actually traverse this relation before committing to Option A; if
     not, fall back to Option B).

2. In `backend/src/modules/auth/authentication.service.ts`, `generateAuthResponse`: alongside
   the existing `logo_base64` lookup, build a `company_info` object:
   ```ts
   let companyInfo: {
     name: string | null;
     address: string | null;
     email: string | null;
     phone: string | null;
   } | null = null;

   if (companyIdForLogo) {
     try {
       const companyDetail = await this.repository.findCompanyDetail(companyIdForLogo);
       logo_base64 = companyDetail?.logo_base64 || null;
       if (companyDetail) {
         const addressParts = [
           companyDetail.address_line1,
           companyDetail.address_line2,
           companyDetail.city,
           companyDetail.state,
           companyDetail.pincode,
         ].filter(Boolean);
         companyInfo = {
           name: companyDetail.company?.name || null,
           address: addressParts.join(', ') || null,
           email: companyDetail.company?.email || null,
           phone: companyDetail.company?.phone_number || null,
         };
       }
     } catch (err) {
       this.logger.warn(`Could not fetch company details for ${companyIdForLogo}: ${err}`);
     }
   }
   ```
   (Adjust field access to whatever relation-loading approach Step 1 actually settled on.)

3. Add `company_info: companyInfo` to the object returned from `generateAuthResponse` alongside
   the existing `access_token`, `refresh_token`, `company_logo`.

4. Confirm `sendOtp`/`verifyOtp` controller methods in
   `backend/src/modules/auth/authentication.controller.ts` (or wherever they live — check the
   `auth` module's controller file) pass through whatever `generateAuthResponse` returns without
   stripping fields — they likely already spread the whole object into the HTTP response, but
   verify this explicitly.

5. **Investor-side parity**: check whether `backend/src/modules/investor-auth/investor-auth.service.ts`
   has an equivalent login flow that also returns `logo_base64` (the earlier `grep` for
   `logoBase64` showed this file references it) and apply the identical `company_info`
   enrichment there too, for consistency, since `ClientHoldingsView.tsx` is reachable from
   distributor flows where investor-side login data isn't relevant — but if any export action
   is ever triggered from an investor-facing page that also currently relies on
   `DISTRIBUTOR_INFO`, that page would need the same data shape. Check
   `frontend/src/app/investor/reports/systematic-transactions` (found during orientation) for
   any analogous hardcoded company-info usage and fix it the same way if present.

### Frontend implementation

1. In `frontend/src/services/auth.service.ts`:
   - Extend `VerifyOtpData` to add:
     ```ts
     company_info?: {
       name: string | null;
       address: string | null;
       email: string | null;
       phone: string | null;
     } | null;
     ```

2. In `frontend/src/app/(auth)/distributor-portal/page.tsx`, alongside the existing
   `localStorage.setItem("company-logo-dis", response.data.company_logo)` call, add:
   ```ts
   if (response.data.company_info) {
     try {
       localStorage.setItem("company-info-dis", JSON.stringify(response.data.company_info));
     } catch (_) {}
   }
   ```
   (Same try/catch defensive pattern already used for the logo, for consistency and to avoid
   breaking login on `localStorage` quota/availability issues in restrictive browser contexts.)

3. Check `frontend/src/app/(auth)/login/page.tsx` (the other auth entry point found during
   orientation — likely the investor login or a combined login screen) for a parallel
   `company-logo-inv` (or similar) localStorage write, and add the matching `company-info-inv`
   write there too, for symmetry, **only if** that flow's backend response actually includes
   `company_info` per the investor-auth backend change in step 5 above.

4. **Create a small shared helper** `frontend/src/lib/companyInfo.ts`:
   ```ts
   export interface StoredCompanyInfo {
     name: string | null;
     address: string | null;
     email: string | null;
     phone: string | null;
   }

   export const getStoredCompanyInfo = (): StoredCompanyInfo | null => {
     if (typeof window === 'undefined') return null;
     try {
       const raw =
         localStorage.getItem('company-info-dis') ||
         localStorage.getItem('company-info-inv');
       return raw ? JSON.parse(raw) : null;
     } catch {
       return null;
     }
   };

   export const getStoredCompanyLogo = (): string | null => {
     if (typeof window === 'undefined') return null;
     return localStorage.getItem('company-logo-dis') || localStorage.getItem('company-logo-inv');
   };

   export const buildDistributorInfoPayload = (): Record<string, any> => {
     const info = getStoredCompanyInfo();
     const logo = getStoredCompanyLogo();
     const payload: Record<string, any> = {};
     if (info?.name) payload.name = info.name;
     if (info?.address) payload.address = info.address;
     if (info?.email) payload.email = info.email;
     if (info?.phone) payload.phone = info.phone;
     if (logo) payload.logoBase64 = logo;
     return payload;
   };
   ```

5. **Replace every usage of the hardcoded `DISTRIBUTOR_INFO`** with
   `buildDistributorInfoPayload()`:
   - `frontend/src/components/distributor/clients/ClientHoldingsView.tsx`: delete the
     hardcoded `const DISTRIBUTOR_INFO = {...}` block entirely. At each of its 3 call sites
     found during orientation (capital gains export, transaction export, holdings/portfolio
     PDF export — the 3 places shown by the earlier `grep -n "DISTRIBUTOR_INFO"` output),
     replace `DISTRIBUTOR_INFO` with `buildDistributorInfoPayload()` (call it fresh at each
     export-button click, not memoized, so it always reflects the latest `localStorage` state).
     Add `import { buildDistributorInfoPayload } from "@/lib/companyInfo";` at the top of the
     file.
   - `frontend/src/lib/systematicReportPdfExport.ts` (the new file created in Task 4): instead
     of taking a `distributorInfo` parameter that the caller must separately assemble, have it
     call `buildDistributorInfoPayload()` internally as the base, merged with anything
     explicitly passed in (explicit args win, in case a caller ever needs to override). Update
     its signature/body accordingly:
     ```ts
     import { buildDistributorInfoPayload } from "./companyInfo";
     // ...
     const finalDistributorInfo = { ...buildDistributorInfoPayload(), ...(distributorInfo || {}) };
     ```
     This also makes the manual `storedLogo` lookup block in that file (and in
     `transactionReportExport.ts`, `capitalGainsExport.ts`, `portfolioExport.ts` — all found
     during orientation's `grep` for `logoBase64`) **redundant** once `companyInfo.ts`
     centralizes it. As a follow-on cleanup (still part of this bonus task, since it's the same
     root cause), update those other 3 export lib files
     (`frontend/src/lib/transactionReportExport.ts`, `frontend/src/lib/capitalGainsExport.ts`,
     `frontend/src/lib/portfolioExport.ts`) to use `buildDistributorInfoPayload()` too instead
     of their own inline `localStorage.getItem('company-logo-dis')` lookups, for one single
     source of truth.

6. **Backend payload shape note**: the backend export services (`transactions-export.service.ts`,
   `capital-gains-export.service.ts`, the new `systematic-report-export.service.ts` from Task 4)
   already accept a generic `distributorInfo?: any` object and read `.logoBase64`, and (in the
   capital-gains one, check this) likely also `.name`/`.address`/`.email`/`.phone` for the
   header/contact band. Confirm each backend export service correctly reads all 5 fields
   (`name`, `address`, `email`, `phone`, `logoBase64`) from whatever `distributor_info` object
   the frontend now sends via `buildDistributorInfoPayload()` — since the payload shape is
   unchanged (same field names as the old hardcoded `DISTRIBUTOR_INFO` object), **no backend
   export-service code should need to change** for this step; this is purely a "stop hardcoding
   on the frontend, source from localStorage which is itself sourced from the DB at login"
   fix. Double-check this assumption is true by re-reading
   `capital-gains-export.service.ts`'s header-drawing code for the exact property names it
   expects.

### Acceptance criteria
- No file in `frontend/src` contains a hardcoded `DISTRIBUTOR_INFO` constant with literal
  company name/address/email/phone/logo values anymore.
- Logging in as a distributor for **any** company (not just the one previously hardcoded)
  produces exported PDFs that show that company's real name/address/email/phone/logo, sourced
  from the `companies`/`company_details` tables via the company id already present on the JWT.
- `company_info` is fetched once at login (same call as the existing logo fetch — no extra
  network round trip) and cached in `localStorage`, consistent with how the logo is already
  handled.
- All PDF-export call sites (Holdings, Transactions, Capital Gains, Systematic Report) source
  distributor contact info from the same single helper function.

---

## Execution order summary

1. Task 1 — AMC name backend join + frontend display (foundation for Task 4's export columns).
2. Task 2 — audit pass, mostly documentation/verification, very low risk.
3. Task 3 — server-side filtering for the main report fetch (independent of Task 4, but should
   land before Task 4 so the export endpoint can reuse the now-correctly-filtered service
   method signature).
4. Task 4 — backend PDF export for Systematic Report, depends on Task 1 (AMC name) and Task 3
   (filter parameters) being in place.
5. Task 5 — bonus: real company details from DB instead of hardcoded `DISTRIBUTOR_INFO`,
   touches the export call sites added/modified in Task 4 plus the 3 pre-existing export lib
   files and `ClientHoldingsView.tsx`.

## General engineering constraints for every task
- Do not break any existing, unrelated report flows (Holdings, Transactions, Capital Gains) —
  these are explicitly used as **read-only reference patterns**, not to be modified except
  where Task 5 deliberately asks for the shared `companyInfo.ts` helper to be wired in.
- Preserve all existing authorization checks (`JwtAuthGuard`, `req.user.type === 'investor'`
  forbidden checks, broker-access checks) exactly as they exist today on every controller
  method touched.
- Match existing code style: NestJS services using raw `DataSource.query()` for these
  CAMS/KARVY union queries (do not introduce a TypeORM QueryBuilder rewrite — keep using raw
  SQL consistent with the rest of `sips.service.ts`).
- Match existing PDF visual style (`C` color tokens, fonts, spacing) across every export.
- After each task, run the backend build (`npm run build` or equivalent in `backend/`) and the
  frontend type-check (`npm run build` or `tsc --noEmit` in `frontend/`) to catch type errors
  introduced by field renames (e.g. `amc_code` → `amc_name`).
