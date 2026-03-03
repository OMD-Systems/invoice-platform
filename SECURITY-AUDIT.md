# Security Audit Report — OMD Finance Platform

**Date:** 2026-03-03
**Audited by:** 15 specialized security agents (Claude Opus 4.6)
**Scope:** Full-stack audit — frontend JS, Supabase RLS/SQL, deployment, privacy

---

## Executive Summary

Обнаружено **47 уязвимостей**: 7 CRITICAL, 14 HIGH, 18 MEDIUM, 8 LOW.

Критические проблемы связаны с:
- Утечка GitHub PAT токена в remote URL
- Открытая регистрация + полный доступ к PII всех сотрудников
- SECURITY DEFINER функции без проверки ролей
- Публичный репозиторий с финансовыми данными

---

## CRITICAL (7)

### C1. GitHub PAT токен в .git/config
**Вектор:** Remote URL содержит `ghp_q7UoD...` — полный доступ к GitHub-аккаунту.
**Действие:** НЕМЕДЛЕННО отозвать токен в GitHub Settings > Developer settings > PAT. Перейти на SSH.

### C2. Публичный репозиторий с финансовыми данными
**Вектор:** Репо `OMD-Systems/invoice-platform` — PUBLIC. Содержит seed.sql с реальными названиями проектов, config.js с Supabase credentials.
**Действие:** `gh repo edit --visibility private`

### C3. Открытая регистрация (shouldCreateUser: true)
**Файл:** `js/auth.js:86`
**Вектор:** Любой email может зарегистрироваться → роль `viewer` → доступ ко всем SELECT-политикам с `USING(true)`.
**Действие:** Установить `shouldCreateUser: false` или настроить domain whitelist в Supabase Auth.

### C4. create_invoice_atomic() без проверки роли
**Файл:** `data/migration-003-security-fixes.sql:12-63`
**Вектор:** SECURITY DEFINER обходит RLS. Любой authenticated (включая viewer) может создать инвойс на любого сотрудника на любую сумму.
**Действие:** Добавить `IF NOT public.is_admin_or_lead() THEN RAISE EXCEPTION` внутри функции.

### C5. increment_invoice_number() — SECURITY DEFINER без GRANT
**Файл:** `data/seed.sql:693-707`
**Вектор:** Доступна даже `anon` роли (по умолчанию GRANT TO public). Модифицирует данные employees.
**Действие:** `REVOKE ALL ON FUNCTION increment_invoice_number FROM public; GRANT EXECUTE TO authenticated;` + проверка роли.

### C6. Все authenticated видят ВСЕ PII сотрудников
**Файлы:** `seed.sql:118-120` (RLS `USING(true)`) + `db.js` (`select('*')`)
**Вектор:** Viewer видит IBAN, SWIFT, rate_usd, address, phone всех сотрудников. В комбинации с C3 — любой внешний человек.
**Действие:** Ограничить SELECT employees для viewer (только свои данные). Заменить `select('*')` на конкретные поля.

### C7. Временный пароль отображается в toast и alert
**Файл:** `js/pages/settings.js:1283-1286`
**Вектор:** `showToast('User created! Temp password: ' + tempPassword)` — видно на экране 3 секунды, может быть захвачено скриншотом.
**Действие:** Копировать в clipboard или отправлять на email.

---

## HIGH (14)

### H1. Отсутствие Content Security Policy (CSP)
Нет ни `<meta>` CSP, ни HTTP-заголовка. XSS-атаки не ограничены.

### H2. Отсутствие security headers
Нет X-Frame-Options (clickjacking), X-Content-Type-Options, HSTS, Referrer-Policy.

### H3. SheetJS CDN без SRI integrity hash
`index.html:626` — единственный CDN-скрипт без SRI. Supply chain attack vector.

### H4. Плавающая версия Supabase JS (@2)
`index.html:617` — при обновлении на CDN SRI-хеш перестанет совпадать → сломается приложение.

### H5. invoices_delete_policy — lead удаляет ЛЮБОЙ инвойс
`migration-006-delete-policy.sql:9-11` — `is_admin_or_lead()` без team-scoping.

### H6. profiles_update_own позволяет менять role
`migration-002` — нет `WITH CHECK` ограничения на поле `role`. Защищает только триггер.

### H7. admin_create_user() — прямой INSERT в auth.users
`migration-005-admin-create-user.sql` — обходит Supabase GoTrue. Хрупко при обновлениях.

### H8. Month Lock не enforced на уровне DB
Нет триггеров на timesheets/invoices для проверки month_locks. Обход через консоль/API.

### H9. Invoice status без state machine
Нет ограничений на переходы: `paid` → `draft` возможен. Lead может выставить `paid`.

### H10. console.log утекает PII
`db.js:37,52`, `team.js:207-211` — email, роль, данные запросов в DevTools.

### H11. ON DELETE CASCADE на финансовых данных
`seed.sql:369` — удаление employee каскадно удалит ВСЕ инвойсы и таймшиты.

### H12. Конфликтующие триггеры на email_requests
`seed.sql` vs `migration-001` — два триггера с разной логикой на одну таблицу.

### H13. Нет IBAN/SWIFT валидации
`team.js:1269-1274` — банковские реквизиты принимают любую строку.

### H14. Нет proper email валидации
Все проверки — примитивный `indexOf('@')`. Проходит `"@."`.

---

## MEDIUM (18)

| # | Находка | Файл |
|---|---------|------|
| M1 | `_escHtml()` не экранирует `'` | invoices.js:518-521 |
| M2 | Supabase error.message утекает в UI | settings.js, invoices.js (10+ мест) |
| M3 | Нет лимитов длины строк ни на одном поле | Все формы |
| M4 | Negative amounts принимаются (rate, discount, tax) | team.js, invoices.js, expenses.js |
| M5 | Нет field whitelist в upsertEmployee | db.js:128-140 |
| M6 | Нет пагинации на массовых запросах | db.js (getEmployees, getInvoices) |
| M7 | OTP rate-limit только клиентский (сбрасывается F5) | auth.js:8-9 |
| M8 | Нет onAuthStateChange listener | app.js |
| M9 | Race condition при навигации (async без mutex) | app.js |
| M10 | Stale role до token refresh (~1 час) | app.js, db.js |
| M11 | InvoicePreview.render вместо .show (silent failure) | team.js:1037 |
| M12 | Async render() присваивается в innerHTML | invoices.js:765 |
| M13 | Нет UNIQUE(employee_id, invoice_number) | seed.sql |
| M14 | Два файла migration-005 без системы версионирования | data/ |
| M15 | Google Fonts — GDPR (IP tracking) | fury.css:1 |
| M16 | Файлы без санитизации имён | numbering.js:72-93 |
| M17 | Batch download без лимита | invoices.js:1106-1123 |
| M18 | Print stylesheet раскрывает IBAN/SWIFT | invoice-print.css |

---

## LOW (8)

| # | Находка |
|---|---------|
| L1 | Данные singleton-страниц не очищаются при logout |
| L2 | DOM с данными остаётся после logout (скрыт) |
| L3 | PIN field type="text" вместо type="password" |
| L4 | SECURITY DEFINER без SET search_path |
| L5 | Empty catch blocks suppress errors |
| L6 | alert() вместо нормального error UI (15+ мест) |
| L7 | Мёртвый код: increment_invoice_number(), export.js (частично) |
| L8 | Нет robots.txt для финансового приложения |

---

## Remaining Manual Actions

### Must Do (manual, cannot be automated)
1. **Отозвать GitHub PAT** `ghp_q7UoD...` в GitHub Settings > Developer settings > PAT
2. **Сделать репо private**: `gh repo edit OMD-Systems/invoice-platform --visibility private`
3. **Применить SQL миграции** в Supabase SQL Editor:
   - `data/migration-007-rpc-security.sql` — роли в RPC, DELETE policy, search_path
   - `data/migration-008-constraints.sql` — триггеры, CHECK, FK RESTRICT, state machine
4. **Audit logging таблица** — требует архитектурного решения (отложено)

---

## All Fixes Applied (Complete List)

### SQL Migrations (need to run in Supabase)
- `migration-007-rpc-security.sql` — role checks in create_invoice_atomic, increment_invoice_number; team-scoped delete policy; SET search_path on all SECURITY DEFINER; profiles_update_own WITH CHECK
- `migration-008-constraints.sql` — month_locks triggers on timesheets/invoices; CHECK >= 0 on amounts/hours/rates; ON DELETE RESTRICT; invoice status state machine; UNIQUE(employee_id, invoice_number)

### Authentication & Authorization
- `shouldCreateUser: false` in auth.js (closed open registration)
- `onAuthStateChange` listener in app.js (session expiry detection)
- `clearAppState()` method for proper logout cleanup
- Stale role refresh on TOKEN_REFRESHED event

### Input Validation
- New `js/validation.js` module: email regex, IBAN mod-97, SWIFT format, numeric range, string length, filename sanitization
- team.js: employee edit — email, rate, IBAN, SWIFT, invoice number validation
- team.js: hours — range 0-744
- invoices.js: invoice number, date, discount, tax, line item prices/qty validation
- expenses.js: amounts >= 0, exchange rate > 0, description max 500 chars
- settings.js: proper email validation (replaced indexOf), project code/name limits

### XSS & Error Handling
- `_escHtml()` — added single quote escaping
- All Supabase error.message replaced with generic user messages (39 places)
- Temp password: clipboard copy instead of toast/alert display
- app.js page load error — generic message, no err.message in HTML
- Removed all console.log with PII (db.js, team.js)
- Deleted tmp_check.js (leaked employee data)

### API & Data Exposure
- `select('*')` replaced with specific field lists (getEmployees, getTeamEmployees)
- Field whitelists added: upsertEmployee (20 fields), upsertExpense (8 fields), updateEmailRequest (3 fields)

### Frontend Security
- CSP meta tag with script-src, style-src, connect-src, frame-ancestors
- X-Content-Type-Options nosniff meta tag
- Async render() bug fixed in invoices.js tab switching
- InvoicePreview.render → .show (silent failure fix)
- Singleton data cleared on destroy() (team.js)
- DOM cleared on logout

### Deployment & Infrastructure
- `_headers` file with X-Frame-Options, HSTS, Referrer-Policy, Permissions-Policy
- SRI integrity hash for SheetJS CDN
- robots.txt with Disallow: /
- Filename sanitization in numbering.js
- PAT removed from git remote URL
- .gitignore updated
