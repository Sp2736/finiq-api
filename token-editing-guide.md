# Token Editing Guide — Remove Duplicate User Data, Move `company_logo` into JWT

## Goal

Today `verify-otp` / `refresh` / investor `login` responses send the **same
user data twice**:

1. Once **encoded inside `access_token`** (JWT payload: `sub`, `phone_number`,
   `roles`, `company_id`, etc.)
2. Once again as a **plain `user` / `investor` object** in the JSON response
   body (`id`, `phone_number`, `roles`, `company_logo`, …)

This duplicates payload size and creates two sources of truth. We will:

- Stop sending the separate `user` / `investor` object in the API response.
- Put `company_logo` **inside the JWT payload** itself (so the token becomes
  the single source of truth for everything the frontend needs right after
  login).
- Update the frontend to **decode the JWT** to get `roles`, `phone_number`,
  `company_id`, and `company_logo`, and to keep saving the logo to
  `localStorage` exactly as it does today (just sourced from the decoded
  token instead of `response.data.user`).

This applies to **both** auth flows:

- Staff / Distributor / Admin auth — `backend/src/modules/auth/authentication.service.ts`
- Investor auth — `backend/src/modules/investor-auth/investor-auth.service.ts`

---

## 0. Files you will touch

Backend:
- `backend/src/modules/auth/authentication.service.ts`
- `backend/src/modules/auth/jwt.strategy.ts` (read-only check, see Step 4)
- `backend/src/modules/investor-auth/investor-auth.service.ts`

Frontend:
- `frontend/src/services/auth.service.ts`
- `frontend/src/lib/authClient.ts`
- `frontend/src/app/(auth)/distributor-portal/page.tsx`
- `frontend/src/app/(auth)/admin-portal/page.tsx`
- `frontend/src/app/(auth)/login/page.tsx` (investor login)
- Any other file currently reading `response.data.user.*` or
  `response.data.investor.*` for `roles`, `phone_number`, or `company_logo`
  (search before/after, see Step 6).

---

## 1. Backend — Staff/Distributor/Admin auth (`authentication.service.ts`)

Open `backend/src/modules/auth/authentication.service.ts` and find the
private method `generateAuthResponse(user, profiles)`.

### 1.1 Add `company_logo` to the JWT payload

Currently the payload built for signing is:

```ts
const payload = {
  sub: user.id,
  phone_number: user.phone_number,
  roles: roles,
  company_id: user.company_id,
};
```

The logo lookup (`logo_base64`) happens **after** this payload is built and
the token is signed. Move the logo lookup to happen **before** signing, and
add it to the payload:

```ts
// Use company_id from the user's profile (from user_profiles table) — most reliable source.
// Falls back to user.company_id.
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

const payload = {
  sub: user.id,
  phone_number: user.phone_number,
  roles: roles,
  company_id: user.company_id,
  company_logo: logo_base64,
};
```

> ⚠️ Move the whole `companyIdForLogo` / `logo_base64` block **above** the
> `const payload = {...}` declaration (it currently sits below the
> `jwtService.sign(...)` call). Delete the old standalone block once moved.

### 1.2 Sign the token with the new payload (no other change needed)

```ts
const access_token = this.jwtService.sign(payload as any, {
  expiresIn: accessTokenExpiry as any,
});
```

This part stays the same — `payload` now simply contains `company_logo` too.

### 1.3 Remove the duplicate `user` object from the returned response

Replace the final `return { ... }` block:

```ts
// BEFORE
return {
  access_token,
  refresh_token,
  user: {
    id: user.id,
    phone_number: user.phone_number,
    roles: roles,
    company_logo: logo_base64,
  },
};
```

```ts
// AFTER
return {
  access_token,
  refresh_token,
};
```

All of `id`, `phone_number`, `roles`, `company_id`, and `company_logo` are
now available to the frontend **only** by decoding `access_token`. `user.id`
is the same value as the JWT's `sub` claim — frontend code that previously
used `response.data.user.id` must now use the decoded `sub` claim (see
Step 5).

### 1.4 Double check `getMe()` is untouched

`getMe(userId)` is a separate endpoint (`/auth/me` or similar) that still
hits the DB directly — **do not change it**. It's not part of the
verify-otp/refresh duplication and is fine as-is.

---

## 2. Backend — Investor auth (`investor-auth.service.ts`)

Open `backend/src/modules/investor-auth/investor-auth.service.ts` and find
`generateInvestorAuthResponse(investor)`.

### 2.1 Add `logo_base64` to the JWT payload

```ts
// BEFORE
private async generateInvestorAuthResponse(investor: any) {
  const payload = {
    investor_id: investor.id,
    mobile: investor.mobile,
    username: investor.username,
    email: investor.email,
    company_id: investor.company_id,
  };

  const accessToken = this.jwtService.sign(payload);
  const logo_base64 = investor.company?.details?.logo_base64 || null;

  return {
    access_token: accessToken,
    investor: {
      id: investor.id,
      name: investor.name,
      mobile: investor.mobile,
      email: investor.email,
      logo_base64: logo_base64,
    },
  };
}
```

```ts
// AFTER
private async generateInvestorAuthResponse(investor: any) {
  const logo_base64 = investor.company?.details?.logo_base64 || null;

  const payload = {
    investor_id: investor.id,
    mobile: investor.mobile,
    username: investor.username,
    email: investor.email,
    company_id: investor.company_id,
    name: investor.name,
    logo_base64: logo_base64,
  };

  const accessToken = this.jwtService.sign(payload);

  return {
    access_token: accessToken,
  };
}
```

> Note: `investor.name` is added to the payload too, since the old `investor`
> object exposed `name` and the frontend will need it from somewhere now
> that the object is gone. If `name` is not needed anywhere on the frontend,
> you may omit it — but check Step 6 first.

---

## 3. Backend sanity checks before moving to frontend

1. Run `npm run build` (or `tsc --noEmit`) inside `backend/` — confirm no
   type errors from the removed `user` / `investor` response fields (some
   DTOs/interfaces in `dto/auth.dto.ts` or `dto/investor-auth.dto.ts` may
   declare the response shape — update those interfaces too if they exist).
2. Search the whole backend for any other place reading
   `response.user.company_logo`, `.user.roles`, `.investor.logo_base64`, etc.
   (e.g. logging, tests):
   ```bash
   grep -rn "\.user\.\|\.investor\." backend/src --include=*.ts
   ```
3. Manually hit `POST /api/auth/verify-otp` with Postman/curl and confirm the
   response body now looks like:
   ```json
   {
     "success": true,
     "message": "Authentication successful",
     "data": {
       "access_token": "...",
       "refresh_token": "..."
     },
     "timestamp": "..."
   }
   ```
4. Decode the new `access_token` (e.g. on jwt.io) and confirm it now
   contains `company_logo` (staff/admin flow) or `logo_base64` (investor
   flow) alongside the existing claims.

---

## 4. Backend — confirm `jwt.strategy.ts` still works (no change required)

`backend/src/modules/auth/jwt.strategy.ts` reads `payload.sub`,
`payload.phone_number`, `payload.roles`, `payload.company_id` to build
`req.user`. Adding `company_logo` to the payload does **not** break this —
JWT payloads can carry extra claims freely. No edits needed here, just
confirm by reading the file that nothing destructures the payload in a way
that would choke on an extra key (it won't, plain object spread/access is
safe).

---

## 5. Frontend — add a JWT decode helper

Add a tiny, dependency-free JWT decoder (no need to install `jwt-decode` —
this is a base64url decode of the payload segment, no signature
verification needed client-side since we already trust our own backend's
token).

In `frontend/src/lib/authClient.ts`, add:

```ts
// ─── JWT DECODING ─────────────────────────────────────────────────────────
export interface DecodedStaffToken {
  sub: string;
  phone_number: string;
  roles: Array<{
    id: string;
    role: string;
    tenant_id: string | null;
    company_id: string | null;
    company_name: string | null;
    first_name: string | null;
    last_name: string | null;
  }>;
  company_id: string | null;
  company_logo?: string | null;
  iat: number;
  exp: number;
}

export interface DecodedInvestorToken {
  investor_id: string;
  mobile: string;
  username?: string | null;
  email?: string | null;
  company_id: string | null;
  name?: string | null;
  logo_base64?: string | null;
  iat: number;
  exp: number;
}

/**
 * Decodes a JWT payload WITHOUT verifying the signature.
 * Safe for client-side use because the token always originates from our own
 * backend (signature is verified server-side on every protected request).
 */
export function decodeJwt<T = Record<string, unknown>>(token: string): T | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(jsonPayload) as T;
  } catch (err) {
    console.error("Failed to decode JWT:", err);
    return null;
  }
}
```

---

## 6. Frontend — update the response types (`auth.service.ts`)

Open `frontend/src/services/auth.service.ts` and simplify the response
shapes to match the new backend payload (no more `user` / `investor`
objects):

```ts
export interface VerifyOtpData {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    access_token: string;
  };
}
```

Remove the now-unused `UserRole` interface only if nothing else imports it;
otherwise leave it (search first: `grep -rn "UserRole" frontend/src`).

---

## 7. Frontend — Distributor portal (`distributor-portal/page.tsx`)

Replace the block that reads `response.data.user.company_logo` with logic
that decodes the access token:

```ts
import { setAuthCookies, decodeJwt, DecodedStaffToken } from "@/lib/authClient";
```

```ts
// BEFORE
const response = await authService.verifyOtp(fullPhone, otp);

// Store company logo so both sidebars can display it without an extra API call
if (response.data?.user?.company_logo) {
  try {
    localStorage.setItem("company-logo-dis", response.data.user.company_logo);
  } catch (_) {}
}

if (response.success) {
  setAuthCookies(
    response.data.access_token,
    response.data.refresh_token,
    "staff",
    response.data.user.id,
  );
  router.push("/distributor");
}
```

```ts
// AFTER
const response = await authService.verifyOtp(fullPhone, otp);

if (response.success) {
  const decoded = decodeJwt<DecodedStaffToken>(response.data.access_token);

  // Store company logo so both sidebars can display it without an extra API call
  if (decoded?.company_logo) {
    try {
      localStorage.setItem("company-logo-dis", decoded.company_logo);
    } catch (_) {}
  }

  setAuthCookies(
    response.data.access_token,
    response.data.refresh_token,
    "staff",
    decoded?.sub, // was response.data.user.id — same value, now read from JWT `sub`
  );
  router.push("/distributor");
}
```

---

## 8. Frontend — Admin portal (`admin-portal/page.tsx`)

This page never stored the logo previously, so only the `user.id` /
`response.data.user` dependency (if any) needs review. As written, it only
uses `access_token` and `refresh_token` directly, so:

```ts
import { setAuthCookies } from "@/lib/authClient";
```

```ts
// No change needed for the token call itself:
const response = await authService.verifyOtp(fullPhone, otp);
if (response.success) {
  setAuthCookies(response.data.access_token, response.data.refresh_token);
  router.push("/admin");
}
```

This still works unchanged since it never read `response.data.user`. If you
want the admin portal to also cache the company logo (FinIQ admin won't
generally have a `company_id`, but `COMPANY_ADMIN` role might), optionally
add the same decode-and-store logic as Step 7, using a key such as
`"company-logo-admin"`.

---

## 9. Frontend — Investor login (`login/page.tsx`)

```ts
import { setAuthCookies, decodeJwt, DecodedInvestorToken } from "@/lib/authClient";
```

```ts
// BEFORE
const response = await authService.loginInvestor(identifier, password);

if (response.data?.investor?.logo_base64) {
  localStorage.setItem("company-logo-inv", response.data.investor.logo_base64);
}

const actualToken = response.data?.access_token;
if (!actualToken) {
  throw new Error("API connected, but access_token was missing in the data object.");
}

if (response.data?.investor?.logo_base64) {
  try {
    localStorage.setItem("company-logo-inv", response.data.investor.logo_base64);
  } catch (_) {}
}

setAuthCookies(actualToken, undefined, "investor");
router.push("/investor");
```

```ts
// AFTER
const response = await authService.loginInvestor(identifier, password);

const actualToken = response.data?.access_token;
if (!actualToken) {
  throw new Error("API connected, but access_token was missing in the data object.");
}

const decoded = decodeJwt<DecodedInvestorToken>(actualToken);

// Store company logo so InvestorSidebar can display it without extra API calls
if (decoded?.logo_base64) {
  try {
    localStorage.setItem("company-logo-inv", decoded.logo_base64);
  } catch (_) {}
}

setAuthCookies(actualToken, undefined, "investor");
router.push("/investor");
```

(Note: this also removes the original code's accidental duplicate
`localStorage.setItem("company-logo-inv", ...)` call that ran twice — now it
runs exactly once.)

---

## 10. Search for any other consumer of the removed `user` / `investor` fields

Before declaring this done, run these searches across the **whole frontend**
(`frontend/src`) and **whole backend** (`backend/src`) and fix every hit:

```bash
grep -rn "\.data\.user\b" frontend/src --include=*.ts --include=*.tsx
grep -rn "\.data\.investor\b" frontend/src --include=*.ts --include=*.tsx
grep -rn "response\.data\.user\.\|response\.data\.investor\." frontend/src
grep -rn "VerifyOtpData\|LoginResponse" frontend/src
```

Common places that might also reference the old shape (verify each one
exists in this repo and fix if so):
- Any `refreshToken` handler that reads `response.data.user.id` after
  calling `authService.refreshToken(...)`.
- Any component reading `roles` from a stored response object instead of
  decoding the token (e.g. role-based route guards/sidebars) — these should
  switch to reading roles via `decodeJwt(token).roles` from the
  cookie-stored `access_token` (see `getCookieNames` in `authClient.ts` for
  the cookie name per portal), not from a vanished response field.

---

## 11. End-to-end verification checklist

1. **Backend**: `npm run build` passes with zero TypeScript errors in both
   `backend/src/modules/auth/` and `backend/src/modules/investor-auth/`.
2. **Backend**: Call `POST /api/auth/send-otp` then `POST /api/auth/verify-otp`
   — response body contains only `access_token` + `refresh_token`, no `user`
   key.
3. **Backend**: Decode the returned `access_token` (jwt.io or
   `node -e "console.log(JSON.parse(Buffer.from('<payload-segment>','base64').toString()))"`)
   and confirm it includes `company_logo` with the base64 PNG string.
4. **Backend**: Call `POST /api/investor-auth/login` — response body
   contains only `access_token`, no `investor` key; decoded token contains
   `logo_base64`.
5. **Backend**: Call the refresh endpoint
   (`refreshAccessTokenForUser` → likely `POST /api/auth/refresh`) and
   confirm the new token also carries `company_logo` (it reuses
   `generateAuthResponse`, so this should be automatic).
6. **Frontend**: `npm run build` / `npm run lint` passes with zero type
   errors (no more `Property 'user' does not exist on type ...`).
7. **Frontend**: Log in via Distributor portal → DevTools → Application →
   Local Storage → confirm `company-logo-dis` is populated with the same
   base64 string that's inside the JWT (compare manually once).
8. **Frontend**: Log in via Investor portal → confirm `company-logo-inv` is
   populated the same way.
9. **Frontend**: Confirm sidebars / logo `<img>` components that read
   `localStorage.getItem("company-logo-dis" | "company-logo-inv")` still
   render the logo correctly (no behavioral change expected here — only the
   *source* of the value changed, not the storage mechanism).
10. **Network tab**: Compare response payload size before/after for
    `verify-otp` and `login` — body should be visibly smaller since user
    data is no longer duplicated outside the token.

---

## 12. Summary of the conceptual change

| Before | After |
|---|---|
| `access_token` (JWT) contains `sub`, `phone_number`, `roles`, `company_id` | `access_token` (JWT) contains `sub`, `phone_number`, `roles`, `company_id`, **`company_logo`** |
| Response body also contains a full `user` (or `investor`) object duplicating `id`, `phone_number`, `roles`, plus `company_logo`/`logo_base64` | Response body contains **only** `access_token` (+ `refresh_token` where applicable) |
| Frontend reads `response.data.user.company_logo` to populate `localStorage` | Frontend **decodes the JWT** (`decodeJwt(access_token)`) and reads `company_logo` from the decoded payload to populate `localStorage` |
| Frontend reads `response.data.user.id` for cookie storage | Frontend reads decoded JWT's `sub` claim instead |

This removes the redundant round-trip of identical user data while keeping
all existing downstream behavior (cookies set the same way, localStorage
populated the same way, redirects unchanged) fully intact.
