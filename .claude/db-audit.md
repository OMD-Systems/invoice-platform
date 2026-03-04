# DB Layer Audit — db.js + SQL Migrations

Date: 2026-03-04

## FIXED in db.js

### CRITICAL
1. **deleteInvoice: redundant manual cascade + no atomicity** — Убрал ручное удаление invoice_items (ON DELETE CASCADE делает это автоматически). Старый код мог удалить items, но упасть на удалении invoice, оставив сиротские записи. Добавлена проверка что invoice существовал.

2. **upsertEmployee/upsertExpense: upsert с auto-generated UUID** — `onConflict: 'id'` при отсутствии id вызывал непредсказуемое поведение. Заменено на явный `insert` (без id) / `update` (с id).

3. **generateInvoice: sequential queries -> parallel** — 3 последовательных запроса (employee, timesheets, working_hours_config) теперь выполняются через `Promise.all`.

### HIGH
4. **lockMonth: PK violation при повторной блокировке** — `insert` заменён на `upsert` с `onConflict: 'month,year'`.

5. **unlockMonth: `.single()` на пустом результате** — Заменён на `.maybeSingle()` + информативная ошибка если месяц не был заблокирован.

6. **uploadContract/uploadNda: silent fail при обновлении timestamp** — Ошибка `employees.update` теперь логируется.

7. **deleteExpense: `.single()` на несуществующей записи** — Заменён на `.maybeSingle()` + проверка существования.

### MEDIUM
8. **upsertEmployee: не включал `avatar_url`** — Добавлен в allowed-поля (колонка из migration-010).

9. **upsertEmployee/upsertExpense: string vs number** — Добавлена явная конвертация `rate_usd`, `next_invoice_number`, `amount_uah`, `amount_usd`, `exchange_rate`.

10. **upsertExpense: отсутствие `invoice_id` при создании** — Добавлена валидация: invoice_id обязателен для новых расходов.

11. **upsertWorkingHoursConfig: нет фильтрации полей** — Добавлен whitelist + конвертация типов + валидация обязательных полей.

12. **setSetting: нет проверки key** — Добавлена валидация.

13. **uploadContract/uploadNda: нет проверки параметров** — Добавлена проверка employeeId и file.

14. **init: нет проверки SDK загрузки** — Добавлена проверка `supabase.createClient` (линтер/хук).

15. **getTeamEmployees: N+1 (3 запроса)** — Заменён на 1 запрос с `!inner` joins через team_members.

## FIXED in SQL (migration-011)

16. **expenses.expense_date отсутствует** — Колонка используется в `upsertExpense`, но не существовала в schema. Добавлена `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS expense_date DATE`.

17. **Missing indexes** — Добавлены:
   - `idx_teams_lead_email` — используется во всех RLS-политиках для lead
   - `idx_invoices_employee_period_format` — для duplicate check в generateInvoice
   - `idx_profiles_email` — для getUserRole fallback
   - `idx_employees_personal_email` — для RLS policy (employees.email)
   - `idx_timesheets_created_by` — для аудит-запросов

## NOT FIXED (advisory)

### RLS implications
- `profiles_select_policy` (migration-005) использует `is_admin_or_lead()` — lead видит ВСЕ данные всех сотрудников, не только своей команды. Это by design, но стоит учитывать.
- `create_invoice_atomic` — SECURITY DEFINER, обходит RLS. Но имеет внутреннюю проверку ролей. OK.
- `employees_update_lead` policy использует subquery на profiles/teams/team_members — может быть медленным. Индекс на teams.lead_email (migration-011) поможет.

### Consistency issues
- `getInvoices` с `filters.month === 0` не будет фильтровать (проверка `!== undefined`), что корректно, но 0 — невалидный месяц. Вызывающий код должен проверять.
- `getTimesheetSummary` агрегирует в JS вместо SQL. При больших объёмах — перенести в RPC или view. Пока некритично.

### Schema notes
- `invoice_items.qty` изменён на `NUMERIC(10,4)` (migration-009) — OK для дробных qty.
- `timesheets.project_id ON DELETE RESTRICT` (migration-008) — правильно, проект нельзя удалить если есть timesheets.
- `invoices.employee_id ON DELETE RESTRICT` (migration-008) — сотрудник нельзя удалить если есть invoices. Но `email_requests.employee_id ON DELETE CASCADE` — requests удаляются при удалении сотрудника. Inconsistent, но допустимо.

### Return value consistency
- Все функции единообразно возвращают `{data, error}` — OK.
- Catch блоки нормализуют ошибки в `{message: err.message}` — OK.

### Auth user context
- `createInvoice` → RPC с `auth.uid()` для `created_by` — OK.
- `lockMonth` → читает session для `locked_by` — OK.
- `createEmailRequest` → читает session для `requested_by` — OK.
- Нет явной проверки `this.client` на null в методах. Если `init()` не вызван — будет TypeError.
