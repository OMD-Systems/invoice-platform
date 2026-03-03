# QA Report — Invoice Platform
**Date:** 2026-03-03
**Agents:** 15/15 completed
**Total findings:** 151 unique (deduplicated)

---

## CRITICAL (9)

| # | Module | File:Line | Description |
|---|--------|-----------|-------------|
| 1 | CSS | `invoice-print.css:542-924` | `@media screen` block inside `media="print"` file — **383 lines dead code**. Screen styles for `.invoice-preview` never apply. Invoice preview modal lacks proper styling on screen. |
| 2 | Validation | `team.js:1465,1475,1480` | `typeof Validation !== 'undefined'` — if validation.js fails to load, **all validation silently skipped**. Email, IBAN, SWIFT accepted without check. |
| 3 | Validation | `settings.js:1008,1273,1569` | Same — validation conditional, fails open. |
| 4 | Validation | `invoices.js` (entire) | **Zero calls** to `Validation.*`. Invoice number, discount, tax validated inline or not at all. |
| 5 | Validation | `expenses.js:744-800` | **Zero calls** to `Validation.*`. All validation inline, inconsistent. |
| 6 | DB | `db.js:94` | `getEmployees()` SELECT missing `rate_usd` — all rate calculations return 0. Affects team.js, invoices.js, settlements. |
| 7 | Invoices | `invoices.js:268-269` | Summary tab uses filtered `self.invoices` — if status filter != 'all', KPI and summary are incomplete. |
| 8 | CSS | `invoice-print.css:8` | Redundant `@media print` wrapper inside `media="print"` file — 536 lines of unnecessary nesting. |
| 9 | DB | `db.js:94` | `getEmployees()` SELECT missing `address, phone, iban, swift, bank_name, receiver_name` — employee details show "---" everywhere. |

---

## HIGH (32)

| # | Module | File:Line | Description |
|---|--------|-----------|-------------|
| 1 | Auth | `auth.js` | `onAuthStateChange` subscription stored but never unsubscribed — memory leak on repeated login/logout. |
| 2 | Auth | `auth.js` | OTP deadlock: if `verifyOtp` fails after `sendOtp`, user locked until token expires. No resend mechanism. |
| 3 | Team | `team.js:1012-1013` | `handleDeleteInvoice`: `emp.id` accessed BEFORE null-check `!emp` — TypeError crash. |
| 4 | Team | `team.js:1181-1182` | `handleStatusChange`: `emp.id` without null-check — TypeError crash. |
| 5 | Team | `team.js:1502` | `updateEmployeeInCache` doesn't add new employee to `allEmployees` — new employee invisible until page reload. |
| 6 | Team | `team.js:279,350` | `emp.rate_usd` always undefined (not in SELECT) — rate shows 0 in list. |
| 7 | Team | `team.js:431` | `emp.phone` always undefined (not in SELECT) — phone always "---". |
| 8 | Invoices | `invoices.js:1315` | **Hardcoded exchange rate `41.50`** in expense modal. Should be `this.exchangeRate`. |
| 9 | Invoices | `invoices.js:983-1001` | Status change: no revert on error, badge not re-rendered on success. |
| 10 | Invoices | `invoices.js:541` | Export summary: empty prefix produces `"-001"` in xlsx. |
| 11 | Invoices | `invoices.js:1112-1114` | Batch download: race condition. Each `_handleDownload` removes previous overlay before print completes. |
| 12 | Router | `app.js:295` | **Race condition on fast navigation.** No mutex — concurrent `render()` calls corrupt `currentPage`. |
| 13 | Router | `app.js:71` | `TOKEN_REFRESHED` reads role from `app_metadata` only, while `init` uses `DB.getUserRole()` (fallback to profiles table). Desync. |
| 14 | Router | `app.js:149` | `clearAppState()` refs `Expenses.allExpenses` — doesn't exist. Real data `Expenses.expenses` survives logout. |
| 15 | Router | `app.js:129-154` | `clearAppState()` doesn't clear Settings, partial Invoices — data leak between users. |
| 16 | Settings | `settings.js:1282` | Weak temp password: `Math.random().toString(36)` — not cryptographically secure. |
| 17 | Settings | `settings.js:1300` | Temp password in `prompt()` fallback — visible to scripts, may be lost. |
| 18 | Settings | `settings.js:1295-1298` | `clipboard.writeText()` no `.catch()` — on reject, toast says "copied" but password is lost forever. |
| 19 | Settings | `settings.js:1323-1352` | **No self-demotion protection.** Admin can change own role to viewer, losing all access. No "last admin" check. |
| 20 | Settlements | `settlements.js:100` | Employees with 0 hours skipped — but if they have a paid invoice, their payment is lost from settlements. |
| 21 | Settlements | `settlements.js:107` | `hourly_rate` fallback missing. `DB.generateInvoice` uses `rate_usd || hourly_rate`, Settlements uses only `rate_usd`. |
| 22 | Settlements | `settlements.js:111` | Employee type matching inconsistent (`'hourly' || 'Hourly Contractor'`) — no normalization. |
| 23 | Expenses | | N+1 queries: each expense fetches employee separately. |
| 24 | Expenses | | Direct `DB.client` access bypasses abstraction layer. |
| 25 | Expenses | | No server-side filtering — all expenses loaded, filtered client-side. |
| 26 | Validation | `validation.js:158-181` | `showFieldError/clearFieldError/clearAllErrors` — **never used anywhere**. Dead code. |
| 27 | Validation | | Inconsistency: team.js uses `Validation.*`, invoices.js and expenses.js don't use it at all. |
| 28 | Validation | `expenses.js:749-750` | `parseFloat(value) || 0` — text input silently becomes 0. |
| 29 | Validation | `invoices.js:1388` | Invoice number read as string, `Validation.isValidInvoiceNumber` never called. Can enter "ABC". |
| 30 | Security | `app.js:195,249` | Login form shows raw `err.message` — may leak Supabase error internals. |
| 31 | CSS | `fury.css` | No styles for `.invoice-preview` on screen (consequence of CRITICAL #1). |
| 32 | CSS | `fury.css` | No `.closing` animation for modals — appears with fade, disappears instantly. |

---

## MEDIUM (48)

| # | Module | File:Line | Description |
|---|--------|-----------|-------------|
| 1 | Team | `team.js:1169` | `handleDownloadInvoice` no `typeof InvoicePreview` check (unlike preview). |
| 2 | Team | `team.js:198,204` | `JSON.parse(btResult.data)` without try/catch — invalid JSON crashes loadData. |
| 3 | Team | `team.js:1562` | `hoursConfig.working_days` used without fallback — 0 causes division by zero. |
| 4 | Team | `team.js:56,730` | `bindEvents` adds `_escHandler` without removing previous — listener leak on re-render. |
| 5 | Team | `team.js:95,163` | `getEmployees()` filters `is_active=true`, but code sorts by `is_active` — dead logic. |
| 6 | Invoices | `invoices.js:1509-1568` | `_saveInvoice` (draft): no toast on success. User gets no confirmation. |
| 7 | Invoices | `invoices.js:1646-1653` | `_saveAndDownload`: reload runs parallel to print setTimeout. UI may flash. |
| 8 | Invoices | `invoices.js:1870-1876` | `destroy()` removes ALL `.fury-modal-overlay` — may kill other modules' modals. |
| 9 | Invoices | `invoices.js:1417-1436` | No description length limit — can paste 100KB text. |
| 10 | Invoices | `invoices.js:1509-1537` | `_saveInvoice` doesn't fetch full employee data — draft preview lacks bank details. |
| 11 | Router | `app.js:149` | `Expenses.allExpenses` doesn't exist — should be `Expenses.expenses`. |
| 12 | Router | `settings.js` | No `destroy()` method — modals linger in DOM after navigation. |
| 13 | Router | `app.js:64-78` | `onAuthStateChange` subscription may duplicate on re-login. |
| 14 | Settings | `settings.js:662` | Exchange rate 0 saved without validation — can break UAH calculations. |
| 15 | Settings | `settings.js:671-672` | `subtract_hours` no server-side validation. HTML `max="40"` bypassable. |
| 16 | Settings | `settings.js:936-944` | Project upsert no duplicate code check. |
| 17 | Settings | `settings.js:541-546` | N+1 queries for team members — sequential await per team. |
| 18 | Settings | `settings.js:1008` | Validation conditional (`typeof Validation !== 'undefined'`). |
| 19 | Settings | `settings.js:1513-1524` | Email requests loaded after render — UI flicker. |
| 20 | Settings | `settings.js:1715` | `adjustment_hours` allows negative without limit. |
| 21 | Settlements | `settlements.js:114-120` | Monthly: proportion can exceed 1.0 (hours > expected). No cap. |
| 22 | Settlements | `invoices.js:22,213` | `hoursAdjustment` loaded but never used. Dead code or forgotten logic. |
| 23 | Settlements | `settlements.js:64` | `expectedHours` may differ between settlements and `DB.generateInvoice`. |
| 24 | Settlements | `settlements.js:74-80` | `total_usd` may not reflect discount if not updated. |
| 25 | Validation | `validation.js:94` | `isInRange`: `parseFloat("123abc")` passes. Infinity passes. Need `isFinite()`. |
| 26 | Validation | `validation.js:104` | `isNonNegative`: same Infinity/partial-parse issue. |
| 27 | Validation | `validation.js:127` | `sanitizeFileName`: `"....test"` → `"..test"` (non-recursive). No null byte filter. |
| 28 | Validation | `validation.js:140` | `isValidInvoiceNumber`: no max value limit. |
| 29 | Validation | `invoices.js:1417-1436` | No description length limit on line items. |
| 30 | Validation | `team.js:1460-1463` | Employee name — no length limit. |
| 31 | Validation | `team.js:1454-1457` | `invoice_prefix` — no format/length validation. |
| 32 | Validation | `settings.js:1282` | Temp password pattern predictable: always ends with `Ac1!`. |
| 33 | Validation | `numbering.js:6` vs `validation.js:127` | Duplicate `sanitizeFileName` with different implementations. |
| 34 | CSS | `fury.css:797,1981` | Z-index conflict: `.loading-overlay` (9999) blocks modals (1000). |
| 35 | CSS | `fury.css:2069` | `.fury-select-sm` no base definition — inconsistent height. |
| 36 | CSS | `fury.css` | No light mode support — dark only, ignores `prefers-color-scheme`. |
| 37 | CSS | `fury.css:1511-1524` | `.nav-item` defined twice (index.html inline + fury.css) with conflicting values. |
| 38 | Data | `team.js:1082` | `handlePreviewInvoice` passes raw ISO date (YYYY-MM-DD) instead of formatted. |
| 39 | Data | `team.js:1155` | `handleDownloadInvoice` — same raw ISO date issue. |
| 40 | Data | `invoices.js:1509-1537` | Draft save: `collectModalData` employee has empty bank fields (SELECT issue). |
| 41 | Data | `db.js:94` vs `invoices.js:1128` | `getEmployees` JOIN missing `rate_usd` — generate modal shows $0.00. |
| 42 | InvoiceDocx | | Timezone bugs: `new Date()` local vs UTC can shift invoice date by 1 day. |
| 43 | InvoiceDocx | | Hardcoded fallbacks for billing info. |
| 44 | InvoicePreview | | Minor formatting differences vs DOCX output. |
| 45 | Expenses | | No pagination — all expenses loaded at once. |
| 46 | Expenses | | No server-side search/filter. |
| 47 | DB | | Rate_usd missing from getEmployees() — affects all downstream. |
| 48 | Auth | | Missing Settings cleanup on session end. |

---

## LOW (38)

| # | Module | Description |
|---|--------|-------------|
| 1 | Team | `taxRate` inconsistency: string in preview, number in download. |
| 2 | Team | `billedTo` fallback inconsistency: `{name:'',address:''}` vs `{}`. |
| 3 | Team | `dueDays: 15` hardcoded, not from settings. |
| 4 | Team | `btn.textContent` overwrites SVG icons (Save, Delete, Generate buttons). |
| 5 | Invoices | Duplicate `_escHtml` and `_escapeHtml` methods. |
| 6 | Invoices | Duplicate `_formatCurrency` defined twice. |
| 7 | Invoices | Duplicate `_statusBadgeHtml` and `_statusBadge` (overdue support differs). |
| 8 | Invoices | Line item price pre-filled with full amount (qty change unintuitive). |
| 9 | Invoices | `_handleDownload` not async (inconsistent with others). |
| 10 | Invoices | month/year init at module load — stale after midnight. |
| 11 | Router | Double `#` URL handling fragile. |
| 12 | Router | Sidebar initial active state hardcoded to Team. |
| 13 | Router | Role-based nav only for Settings. |
| 14 | Router | Escape handler leak when destroy() called with open modal. |
| 15 | Router | Search debounce timeout not cleared on destroy. |
| 16 | Settings | Dead loop in `_showMembersModal`. |
| 17 | Settings | Duplicate `_escapeHtml`/`_escapeAttr` (less safe than `Utils.`). |
| 18 | Settings | Singleton stale data on re-navigation. |
| 19 | Settings | Race: bindEvents before loadData completes. |
| 20 | Settings | `monthNames` duplicated 3 times. |
| 21 | Settings | `due_days || 7` hides valid 0. |
| 22 | Settings | Modal cancel without `type="button"`. |
| 23 | Settlements | Non-strict `!=` comparison for total_usd. |
| 24 | Settlements | Double-rounding in cost distribution. |
| 25 | Settlements | Repeated rounding of companyCost. |
| 26 | Settlements | Exchange rate unused in settlements (USD only). |
| 27 | Settlements | `loadMapping()` called on every `calculate()`. |
| 28 | Validation | Email regex allows `user@b` (no TLD). |
| 29 | Validation | Email allows `test@-.com` (invalid per RFC). |
| 30 | Validation | IBAN no per-country length check. |
| 31 | Validation | SWIFT accepts `12345678` (digits where letters required). |
| 32 | Validation | `isWithinLength` accepts empty string. |
| 33 | Validation | `sanitizeFileName` allows leading spaces → empty name. |
| 34 | Validation | 5 functions never called: `isInRange`, `isNonNegative`, `isWithinLength`, `sanitizeFileName`, `isValidInvoiceNumber`. |
| 35 | Validation | Project code regex inline (not in Validation module). |
| 36 | CSS | `@import` Google Fonts blocks render. |
| 37 | CSS | CSP `style-src 'unsafe-inline'` weakens protection. |
| 38 | CSS | Calibri font not available on macOS/Linux for print. |

---

## INFO (9)

| # | Module | Description |
|---|--------|-------------|
| 1 | Settings | Temp password pattern ends with `Ac1!` (predictable suffix). |
| 2 | Settings | Dashboard route redirects to Team — no KPI dashboard exists. |
| 3 | Invoices | `invoicePayload` created twice (duplicate code). |
| 4 | Invoices | `taxRate: '0'` string vs number inconsistency. |
| 5 | Settlements | "X owes WS" assumption — only works for current business model. |
| 6 | CSS | Z-index map verified — no overlaps between dropdown/tooltip/modal. |
| 7 | CSS | SRI hashes verified for all 4 CDN dependencies. |
| 8 | CSS | Script load order verified — correct dependency chain. |
| 9 | Security | 13/14 post-audit fixes verified. Only login error message leakage remains. |

---

## Summary by Module

| Module | CRITICAL | HIGH | MEDIUM | LOW | INFO | Total |
|--------|----------|------|--------|-----|------|-------|
| Validation | 4 | 6 | 9 | 5 | 0 | 24 |
| Invoices page | 1 | 4 | 5 | 6 | 2 | 18 |
| Team page | 0 | 5 | 5 | 4 | 0 | 14 |
| Router/App | 0 | 4 | 3 | 5 | 0 | 12 |
| Settings | 0 | 4 | 7 | 7 | 2 | 20 |
| Settlements | 0 | 3 | 4 | 5 | 1 | 13 |
| CSS/UI | 2 | 2 | 4 | 3 | 3 | 14 |
| DB Layer | 2 | 0 | 1 | 0 | 0 | 3 |
| Expenses | 0 | 3 | 2 | 0 | 0 | 5 |
| Auth | 0 | 2 | 2 | 0 | 0 | 4 |
| Data flow | 0 | 0 | 5 | 0 | 0 | 5 |
| InvoiceDocx | 0 | 0 | 2 | 0 | 0 | 2 |
| InvoicePreview | 0 | 0 | 1 | 0 | 0 | 1 |
| Security | 0 | 1 | 0 | 0 | 1 | 2 |
| **TOTAL** | **9** | **34** | **50** | **35** | **9** | **137** |

---

## Dead Code & Unused Files (14 findings)

| # | File | Type | Description |
|---|------|------|-------------|
| 1 | `js/services/export.js` | Dead file | `ExportService` loaded in index.html but zero methods called anywhere. |
| 2 | `js/services/invoice-docx.js` | Partially dead | Only used as DOCX fallback. Main path is PDF now. CDN `docx@9.6.0` (58KB) + `FileSaver.js` (8KB) loaded for this fallback only. |
| 3 | `run_migration.js` | Unused file | Stub script, never executed. Dev artifact. |
| 4 | `data/combined-migrations.sql` | Outdated | Contains only migrations 002+003. Missing 004-009. Misleading. |
| 5 | `data/migration-005-*.sql` | Duplicate numbers | Two files numbered 005 with different logic. |
| 6 | `data/seed.sql` | Outdated | Year constraint 2030 vs migrations 2040. Old RLS policies conflict with later migrations. |
| 7 | `js/utils.js` | 4 dead functions | `escapeAttr`, `formatCurrency`, `sanitizeForSelector`, `isPositiveNumber` — never called. `escapeHtml` also unused (pages have own). Only `isValidEmail` used (in auth.js). |
| 8 | `js/validation.js` | 12/14 dead | Only `isValidEmail`, `isValidIBAN`, `isValidSWIFT` used. 11 other functions never called. |
| 9 | `js/services/numbering.js` | 3 dead functions | `getNextFormattedNumber`, `isNumberUsed`, `incrementNumber` — never called externally. |
| 10 | `js/services/settlements.js` | 2 dead functions | `formatForTable`, `verify` — never called. |
| 11 | `css/fury.css` | ~65 unused classes | Login, sidebar, progress, radio, pagination, tag, avatar, utility classes — not used in HTML/JS. |
| 12 | CDN: `docx` + `FileSaver` | Unused CDN | Only used in DOCX fallback path. If DOCX removed, both libraries unnecessary. |
| 13 | `seed.sql:693` | Dead SQL | `increment_invoice_number()` — `create_invoice_atomic` handles increment internally. |
| 14 | `Utils.isValidEmail` vs `Validation.isValidEmail` | Duplication | Different regex, used in different places. |

---

## Top 5 Fix Priorities

1. **`db.js:94` — Add `rate_usd` to `getEmployees()` SELECT** (CRITICAL)
   All invoice amounts = $0 without this. Affects team.js, invoices.js, settlements.

2. **`invoice-print.css` — Move screen styles out of `media="print"` file** (CRITICAL)
   383 lines of dead CSS. Invoice preview modal has no proper screen styling.

3. **Validation integration** — Make validation non-optional (CRITICAL)
   Remove `typeof Validation !== 'undefined'` guards. Add `Validation.*` calls to invoices.js and expenses.js.

4. **`app.js` — Navigation race condition + clearAppState** (HIGH)
   Add navigation mutex. Fix `Expenses.allExpenses` → `Expenses.expenses`. Clear all singleton data.

5. **`settings.js` — Crypto-safe temp passwords** (HIGH)
   Replace `Math.random()` with `crypto.getRandomValues()`. Add `.catch()` on clipboard.
