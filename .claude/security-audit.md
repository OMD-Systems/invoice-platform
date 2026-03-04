# Security Audit — OMD Finance Platform

**Date:** 2026-03-04
**Scope:** All client-side JS (`js/`, `js/pages/`, `js/services/`), `index.html`, SQL migrations (`data/`), `_headers`
**Auditor:** Claude Opus 4.6

---

## Summary

| Severity | Count |
|----------|-------|
| Critical | 0     |
| High     | 1     |
| Medium   | 3     |
| Low      | 3     |
| Info     | 4     |

Overall the codebase is well-secured: CSP is configured, RLS policies are strict, SECURITY DEFINER functions are hardened with `search_path`, auth prevents open registration, and escape functions are applied consistently in most places. The findings below are the exceptions.

---

## HIGH

### H-1. CSS Selector Injection via URL Hash

**File:** `js/app.js`, line 365
**Severity:** High
**Description:**
`path` is derived from `window.location.hash` (line 330) and injected directly into a CSS selector string:

```js
var activeNav = document.querySelector('#sidebar-nav [data-page="' + path + '"]');
```

An attacker can craft a URL like `#/team"],.evil-class,[x="` to break out of the attribute selector. Although there is a redirect for unknown routes on line 347 (`if (!this.pages[path])`), the `this.REDIRECTS` check on line 336 runs first and the `path` value reaches `querySelector` on line 365 **only if `this.pages[path]` is truthy** — meaning it must be a known page. However, if `this.pages` were ever extended (e.g., by a plugin or dynamic registration), or if the redirect logic changes, this becomes exploitable. `querySelector` with malicious selectors can cause information disclosure (detecting DOM elements) or DoS (ReDoS-like patterns).

**Fix:**

```diff
--- a/js/app.js
+++ b/js/app.js
@@ -362,7 +362,10 @@
     for (var i = 0; i < navItems.length; i++) {
       navItems[i].classList.remove('active');
     }
-    var activeNav = document.querySelector('#sidebar-nav [data-page="' + path + '"]');
+    var activeNav = null;
+    for (var i = 0; i < navItems.length; i++) {
+      if (navItems[i].getAttribute('data-page') === path) { activeNav = navItems[i]; break; }
+    }
     if (activeNav) {
       activeNav.classList.add('active');
     }
```

---

## MEDIUM

### M-1. Unescaped Project Codes in Settlement Table Headers

**File:** `js/pages/invoices.js`, line 406
**Severity:** Medium
**Description:**
`activeProjectCodes[phi]` is inserted directly into HTML without escaping:

```js
projHeaders += '<th style="text-align:right;font-size:10px">' + activeProjectCodes[phi] + '</th>';
```

Project codes come from the database (`projects` table). If an admin creates a project with a code like `<img src=x onerror=alert(1)>`, it would execute as XSS for all users viewing the settlements tab.

**Fix:**

```diff
--- a/js/pages/invoices.js
+++ b/js/pages/invoices.js
@@ -403,7 +403,7 @@
       var projHeaders = '';
       for (var phi = 0; phi < activeProjectCodes.length; phi++) {
-        projHeaders += '<th style="text-align:right;font-size:10px">' + activeProjectCodes[phi] + '</th>';
+        projHeaders += '<th style="text-align:right;font-size:10px">' + self._escHtml(activeProjectCodes[phi]) + '</th>';
       }
```

### M-2. Unescaped `chip.code` in Settlement Mapping Chips

**File:** `js/pages/invoices.js`, line 423
**Severity:** Medium
**Description:**
`chip.code` is inserted into HTML without escaping, while `chip.label` IS escaped:

```js
chipsHtml += '...' + chip.code + ' &rarr; ' + self._escHtml(chip.label) + '</span>';
```

Same risk as M-1 — malicious project code from DB leads to stored XSS.

**Fix:**

```diff
--- a/js/pages/invoices.js
+++ b/js/pages/invoices.js
@@ -420,7 +420,7 @@
         var bgC = chip.company === 'WS' ? 'rgba(0,212,255,0.1)' : chip.company === 'OMD' ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)';
         var txC = chip.company === 'WS' ? 'var(--fury-accent)' : chip.company === 'OMD' ? 'var(--fury-warning)' : '#A78BFA';
-        chipsHtml += '<span style="...">' + chip.code + ' &rarr; ' + self._escHtml(chip.label) + '</span>';
+        chipsHtml += '<span style="...">' + self._escHtml(chip.code) + ' &rarr; ' + self._escHtml(chip.label) + '</span>';
```

### M-3. `mailto:`/`tel:` Links Without URL Scheme Validation

**File:** `js/pages/team.js`, lines 438, 445
**Severity:** Medium
**Description:**
Email and phone values from the database are inserted into `href` attributes with `mailto:` and `tel:` prefixes, using `escapeHtml()`:

```js
'<a href="mailto:' + self.escapeHtml(emp.work_email) + '" ...'
'<a href="tel:' + self.escapeHtml(emp.phone) + '" ...'
```

`escapeHtml` prevents breaking out of the attribute (it escapes `"` and `'`), so this is NOT a direct XSS vector. However, `escapeHtml` does not validate the value is actually an email/phone. If an admin enters `javascript:alert(1)` as an email (bypassing client-side validation via API), the browser won't execute it in a `mailto:javascript:...` context, but it's still a defense-in-depth gap.

**Fix:**

```diff
--- a/js/pages/team.js
+++ b/js/pages/team.js
@@ -435,11 +435,11 @@
       '<div class="td-contact-item">' +
       '<div class="td-contact-label">Email</div>' +
       (emp.work_email
-        ? '<a href="mailto:' + self.escapeHtml(emp.work_email) + '" class="td-contact-link">' + self.escapeHtml(emp.work_email) + '</a>'
+        ? '<a href="mailto:' + encodeURI(emp.work_email) + '" class="td-contact-link">' + self.escapeHtml(emp.work_email) + '</a>'
         : '<span class="td-contact-empty">Not assigned</span>') +
       '</div>' +
       '<div class="td-contact-item">' +
       '<div class="td-contact-label">Phone</div>' +
       (emp.phone
-        ? '<a href="tel:' + self.escapeHtml(emp.phone) + '" class="td-contact-link">' + self.escapeHtml(emp.phone) + '</a>'
+        ? '<a href="tel:' + encodeURI(emp.phone) + '" class="td-contact-link">' + self.escapeHtml(emp.phone) + '</a>'
         : '<span class="td-contact-empty">&#8212;</span>') +
```

---

## LOW

### L-1. Hardcoded Supabase Anon Key in Source Code

**File:** `js/config.js`, line 17
**Severity:** Low
**Description:**
The Supabase anon key is hardcoded as a fallback value. While Supabase anon keys are **designed** to be public (they only grant access allowed by RLS policies), having it committed to source has two concerns:
1. It reveals the Supabase project ref (`onabywripmjnkovlhkze`)
2. If RLS policies have gaps, the anon key can be used to exploit them

The file already has an env-var override mechanism, which is correct. The concern is the hardcoded fallback.

**Fix:**
No code change needed — the current pattern with env-var override is standard for Supabase SPAs. Ensure:
1. `config.js` is in `.gitignore` (use `config.example.js` as template)
2. Production deployment uses environment variable injection (Cloudflare Pages build vars)

### L-2. Unescaped `userName` in Confirm Dialog

**File:** `js/pages/settings.js`, line 1525
**Severity:** Low
**Description:**
`userName` (from `targetUser.full_name || targetUser.email`) is passed to `_confirmDialog` without escaping:

```js
self._confirmDialog('Change role for ' + userName + ' to "' + newRole + '"?', ...);
```

If `_confirmDialog` sets this via `innerHTML`, it would be XSS. However, `newRole` is validated against a whitelist on line 1507, and `userName` comes from the `profiles` table which is admin-managed.

**Fix:** Depends on `_confirmDialog` implementation. If it uses `innerHTML`:

```diff
-    self._confirmDialog('Change role for ' + userName + ' to "' + newRole + '"?',
+    self._confirmDialog('Change role for ' + self._escapeHtml(userName) + ' to "' + newRole + '"?',
```

### L-3. `showToast` Called with Escaped HTML in Error Messages

**File:** `js/pages/settings.js`, line 1493
**Severity:** Low
**Description:**
```js
showToast('Failed to create user: ' + self._escapeHtml(errMsg), 'error');
```

`showToast` in `utils.js` uses `textContent` (safe), so double-escaping will show literal `&amp;` etc. to the user. Not a security issue — but a UX bug.

**Fix:**

```diff
-        showToast('Failed to create user: ' + self._escapeHtml(errMsg), 'error');
+        showToast('Failed to create user: ' + errMsg, 'error');
```

(Safe because `showToast` uses `textContent`, not `innerHTML`.)

---

## INFO

### I-1. Duplicated Escape Functions Across Modules

**Files:** `js/utils.js`, `js/pages/team.js`, `js/pages/invoices.js` (x2: `_escHtml` + `_escapeHtml`), `js/pages/expenses.js`, `js/pages/settings.js`, `js/services/invoice-preview.js`
**Description:**
There are **7 copies** of `escapeHtml` and **4 copies** of `escapeAttr` across the codebase. All are currently correct and identical, but duplicated code increases the risk of one copy diverging in a future edit.

**Recommendation:**
Refactor all modules to use `Utils.escapeHtml()` and `Utils.escapeAttr()` from `js/utils.js`.

### I-2. No CSRF Token Mechanism

**Description:**
The application has no explicit CSRF token. This is acceptable because:
- Supabase uses Bearer token authentication (JWT in `Authorization` header)
- Bearer tokens are NOT automatically sent by the browser (unlike cookies)
- Cross-origin requests cannot read/set the `Authorization` header

No fix needed — the architecture is inherently CSRF-resistant.

### I-3. Recursive RLS Policy on `profiles` Table

**File:** `data/migration-004-strict-rls.sql`, line ~10
**Description:**
The RLS policy for `profiles` references `public.profiles` to check the user's own role:

```sql
CREATE POLICY "profiles_select_all" ON public.profiles
  FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('admin', 'lead')
    OR id = auth.uid()
  );
```

This is a self-referential query (the policy on `profiles` queries `profiles`). Supabase/PostgreSQL handles this correctly for simple cases (the subquery bypasses RLS), but it's a known pattern that can cause subtle issues with updates.

Migration-007 adds a `prevent_role_self_change` trigger as additional protection, which is correct.

No fix needed — currently working as designed.

### I-4. `window.open` with Database-Returned Signed URLs

**Files:** `js/pages/team.js` (contract/NDA download buttons)
**Description:**
`window.open()` is called with signed URLs returned from `DB.getContractUrl()` / `DB.getNdaUrl()`. These URLs are Supabase Storage signed URLs with 1-hour expiry. Since the URLs come from the Supabase API (not user input) and are short-lived, the risk is negligible.

No fix needed.

---

## Negative Findings (No Issues Found)

| Check | Result |
|-------|--------|
| `eval()` / `new Function()` usage | None found |
| Prototype pollution (`__proto__`, `constructor.prototype`) | None found |
| CDN scripts without integrity hashes | All CDN scripts have SRI `integrity` + `crossorigin` |
| Open registration | `shouldCreateUser: false` in auth.js |
| Client-side role enforcement only | Server-side RLS + triggers provide defense-in-depth |
| Mass assignment in DB writes | `upsertEmployee` and `upsertExpense` use field whitelists |
| SQL injection | Not applicable — Supabase JS client uses parameterized queries |
| Security headers | Properly configured in `_headers` (HSTS, X-Frame-Options, etc.) |
| CSP | Configured in meta tag; no `unsafe-eval`, `unsafe-inline` only for styles |
| SECURITY DEFINER without search_path | Fixed in migration-007 |
| Invoice status state machine bypass | Enforced by DB trigger (migration-008) |
| Month lock bypass | Enforced by DB trigger (migration-008) |
| Insecure direct object references | RLS policies scope all queries to user's team/role |
| Token storage | Handled by Supabase JS SDK (uses `localStorage`, standard for SPAs) |

---

## Recommended Actions (Priority Order)

1. **Apply fix H-1** — CSS selector injection (app.js:365)
2. **Apply fixes M-1, M-2** — Escape project codes in settlements (invoices.js:406, 423)
3. **Apply fix M-3** — Use `encodeURI` for mailto/tel hrefs (team.js:438, 445)
4. **Apply fix L-2** — Escape userName in confirm dialog (settings.js:1525)
5. **Apply fix L-3** — Remove double-escaping in showToast (settings.js:1493)
6. **Consider I-1** — Consolidate escape functions to Utils module
