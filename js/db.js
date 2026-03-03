// ============================================================
// OMD Finance Platform — Supabase Database Client
// db.js — All CRUD operations for the invoice platform
// Requires: config.js (CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY)
// ============================================================

const DB = {
  client: null,

  /**
   * Initialize the Supabase client.
   * Call this once on app load.
   * @param {string} [url] - Supabase project URL (defaults to CONFIG.SUPABASE_URL)
   * @param {string} [key] - Supabase anon/public key (defaults to CONFIG.SUPABASE_ANON_KEY)
   */
  init(url, key) {
    const supabaseUrl = url || CONFIG.SUPABASE_URL;
    const supabaseKey = key || CONFIG.SUPABASE_ANON_KEY;
    this.client = supabase.createClient(supabaseUrl, supabaseKey);
  },

  // ----------------------------------------------------------
  // AUTH / PROFILE HELPERS
  // ----------------------------------------------------------

  /**
   * Get the role for a given email from the profiles table.
   * @param {string} email
   * @returns {Promise<{data: string|null, error: object|null}>}
   */
  async getUserRole(email) {
    // Primary: read role from JWT app_metadata (set via Admin API, no RLS issues)
    try {
      const { data: { session } } = await this.client.auth.getSession();
      const appRole = session?.user?.app_metadata?.role;
      if (appRole) {
        // Role resolved from JWT
        return { data: appRole, error: null };
      }
    } catch (e) {
      console.warn('[DB] JWT app_metadata check failed:', e);
    }

    // Fallback: direct query (may fail if profiles RLS is recursive)
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('role')
        .eq('email', email)
        .maybeSingle();

      // Role resolved from profiles query

      if (error) return { data: null, error };
      if (!data) return { data: null, error: { message: 'No profile found for ' + email } };
      return { data: data.role, error: null };
    } catch (err) {
      console.error('[DB] getUserRole exception:', err);
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Get the full profile for a user by their auth user ID.
   * @param {string} userId - UUID from auth.users
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getProfile(userId) {
    try {
      const { data, error } = await this.client
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // EMPLOYEES
  // ----------------------------------------------------------

  /**
   * Get all active employees, ordered by name.
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getEmployees() {
    try {
      const { data, error } = await this.client
        .from('employees')
        .select('id, pin, name, full_name_lat, employee_type, contract_type, is_active, work_email, email, invoice_format, invoice_prefix, next_invoice_number, service_description, contract_uploaded_at, nda_uploaded_at, created_at')
        .eq('is_active', true)
        .order('name', { ascending: true });

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  /**
   * Get a single employee by ID.
   * @param {string} id - Employee UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getEmployee(id) {
    try {
      // Full select needed for admin edit form
      const { data, error } = await this.client
        .from('employees')
        .select('*')
        .eq('id', id)
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Create or update an employee. If data.id is provided, updates; otherwise inserts.
   * @param {object} employeeData
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async upsertEmployee(employeeData) {
    try {
      var allowed = ['id', 'pin', 'name', 'full_name_lat', 'employee_type', 'contract_type',
        'is_active', 'work_email', 'email', 'phone', 'address', 'rate_usd', 'iban', 'swift',
        'bank_name', 'receiver_name', 'invoice_format', 'invoice_prefix', 'next_invoice_number',
        'service_description'];
      var cleaned = {};
      for (var i = 0; i < allowed.length; i++) {
        if (employeeData[allowed[i]] !== undefined) cleaned[allowed[i]] = employeeData[allowed[i]];
      }

      const { data, error } = await this.client
        .from('employees')
        .upsert(cleaned, { onConflict: 'id' })
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Get all employees that belong to a lead's team.
   * @param {string} leadEmail - The team lead's email
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getTeamEmployees(leadEmail) {
    try {
      // First, find the team for this lead
      const { data: team, error: teamError } = await this.client
        .from('teams')
        .select('id')
        .eq('lead_email', leadEmail)
        .single();

      if (teamError) return { data: [], error: teamError };

      // Get employee IDs from team_members
      const { data: members, error: membersError } = await this.client
        .from('team_members')
        .select('employee_id')
        .eq('team_id', team.id);

      if (membersError) return { data: [], error: membersError };

      if (!members || members.length === 0) {
        return { data: [], error: null };
      }

      const employeeIds = members.map(m => m.employee_id);

      // Fetch the actual employee records
      const { data, error } = await this.client
        .from('employees')
        .select('id, pin, name, full_name_lat, employee_type, contract_type, is_active, work_email, email, invoice_format, invoice_prefix, next_invoice_number, service_description, contract_uploaded_at, nda_uploaded_at, created_at')
        .in('id', employeeIds)
        .eq('is_active', true)
        .order('name', { ascending: true });

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // TEAMS
  // ----------------------------------------------------------

  /**
   * Get all teams with their lead info.
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getTeams() {
    try {
      const { data, error } = await this.client
        .from('teams')
        .select('*')
        .order('name', { ascending: true });

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  /**
   * Get the team where the given email is the lead.
   * @param {string} leadEmail
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getTeam(leadEmail) {
    try {
      const { data, error } = await this.client
        .from('teams')
        .select('*')
        .eq('lead_email', leadEmail)
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Get all members of a team (with employee details).
   * @param {string} teamId - Team UUID
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getTeamMembers(teamId) {
    try {
      const { data, error } = await this.client
        .from('team_members')
        .select('*, employees(id, pin, name, full_name_lat, employee_type, is_active, work_email, rate_usd, invoice_format)')
        .eq('team_id', teamId);

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // PROJECTS
  // ----------------------------------------------------------

  /**
   * Get all active projects, ordered by name.
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getProjects() {
    try {
      const { data, error } = await this.client
        .from('projects')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // TIMESHEETS
  // ----------------------------------------------------------

  /**
   * Get timesheets for a given month/year, optionally filtered by employee IDs.
   * Includes project info via join.
   * @param {number} month - 1-12
   * @param {number} year - e.g. 2026
   * @param {string[]} [employeeIds] - Optional array of employee UUIDs
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getTimesheets(month, year, employeeIds) {
    try {
      let query = this.client
        .from('timesheets')
        .select(`
          id, employee_id, project_id, month, year, hours, created_by, created_at,
          employees ( id, pin, name ),
          projects ( id, name, code, company )
        `)
        .eq('month', month)
        .eq('year', year);

      if (employeeIds && employeeIds.length > 0) {
        query = query.in('employee_id', employeeIds);
      }

      query = query.order('employee_id', { ascending: true });

      const { data, error } = await query;

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  /**
   * Insert or update a timesheet row. Uses the unique constraint
   * (employee_id, project_id, month, year) for conflict resolution.
   * @param {object} timesheetData - { employee_id, project_id, month, year, hours, created_by }
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async upsertTimesheet(timesheetData) {
    try {
      const { data, error } = await this.client
        .from('timesheets')
        .upsert(timesheetData, {
          onConflict: 'employee_id,project_id,month,year'
        })
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Get aggregated timesheet summary for a month/year, grouped by employee.
   * Returns total hours per employee across all projects.
   * @param {number} month
   * @param {number} year
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getTimesheetSummary(month, year) {
    try {
      const { data, error } = await this.client
        .from('timesheets')
        .select(`
          employee_id,
          hours,
          employees ( id, pin, name, rate_usd, employee_type )
        `)
        .eq('month', month)
        .eq('year', year);

      if (error) return { data: [], error };

      // Aggregate hours by employee in JS
      const summaryMap = {};
      for (const row of (data || [])) {
        const empId = row.employee_id;
        if (!summaryMap[empId]) {
          summaryMap[empId] = {
            employee_id: empId,
            employee: row.employees,
            total_hours: 0,
            entries: []
          };
        }
        summaryMap[empId].total_hours += parseFloat(row.hours) || 0;
        summaryMap[empId].entries.push(row);
      }

      const summary = Object.values(summaryMap).sort((a, b) =>
        (a.employee?.name || '').localeCompare(b.employee?.name || '')
      );

      return { data: summary, error: null };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // INVOICES
  // ----------------------------------------------------------

  /**
   * Get invoices with optional filters. Includes employee and items.
   * @param {object} [filters] - { month, year, employee_id, status, format_type }
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getInvoices(filters = {}) {
    try {
      let query = this.client
        .from('invoices')
        .select(`
          *,
          employees ( id, pin, name, full_name_lat, invoice_prefix, invoice_format, address, phone, iban, swift, bank_name, receiver_name ),
          invoice_items ( id, item_order, description, price_usd, qty, total_usd )
        `);

      if (filters.month !== undefined) {
        query = query.eq('month', filters.month);
      }
      if (filters.year !== undefined) {
        query = query.eq('year', filters.year);
      }
      if (filters.employee_id) {
        query = query.eq('employee_id', filters.employee_id);
      }
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.format_type) {
        query = query.eq('format_type', filters.format_type);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  /**
   * Delete an existing invoice (Admin only).
   * @param {string} invoiceId
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async deleteInvoice(invoiceId) {
    try {
      const { data, error } = await this.client
        .from('invoices')
        .delete()
        .eq('id', invoiceId)
        .select()
        .single();
      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Create a new invoice along with its line items in a single transaction-like flow.
   * Also increments the employee's next_invoice_number.
   * @param {object} invoiceData - Invoice fields (without id)
   * @param {Array} items - Array of { description, price_usd, qty, total_usd, item_order }
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async createInvoice(invoiceData, items = []) {
    try {
      // Use the newly created atomic RPC function
      // Ensure invoice_number is integer (UI may pass formatted string like "WS-001")
      var invNum = invoiceData.invoice_number;
      if (typeof invNum === 'string') {
        invNum = parseInt(invNum.replace(/\D/g, '')) || 1;
      }

      const { data: invoiceId, error: rpcError } = await this.client.rpc('create_invoice_atomic', {
        p_employee_id: invoiceData.employee_id,
        p_invoice_number: invNum,
        p_invoice_date: invoiceData.invoice_date,
        p_month: invoiceData.month,
        p_year: invoiceData.year,
        p_format_type: invoiceData.format_type,
        p_subtotal_usd: invoiceData.subtotal_usd,
        p_total_usd: invoiceData.total_usd,
        p_status: invoiceData.status || 'draft',
        p_discount_usd: invoiceData.discount_usd || 0,
        p_tax_usd: invoiceData.tax_usd || 0,
        p_items: items.map((item, index) => ({
          item_order: item.item_order || index + 1,
          description: item.description,
          price_usd: item.price_usd,
          qty: item.qty || 1,
          total_usd: item.total_usd
        }))
      });

      if (rpcError) return { data: null, error: rpcError };

      // Return the full invoice with items
      const { data: fullInvoice, error: fetchError } = await this.client
        .from('invoices')
        .select(`
          *,
          employees ( id, name, full_name_lat, invoice_prefix, invoice_format, address, phone, iban, swift, bank_name, receiver_name ),
          invoice_items ( id, item_order, description, price_usd, qty, total_usd )
        `)
        .eq('id', invoiceId)
        .single();

      if (fetchError) return { data: null, error: fetchError };
      return { data: fullInvoice, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Update the status of an invoice.
   * @param {string} id - Invoice UUID
   * @param {string} status - 'draft' | 'generated' | 'sent' | 'paid'
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async updateInvoiceStatus(id, status) {
    try {
      const { data, error } = await this.client
        .from('invoices')
        .update({ status })
        .eq('id', id)
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Get the next invoice number for an employee.
   * Reads from employees.next_invoice_number.
   * @param {string} employeeId - Employee UUID
   * @param {string} [formatType] - Not used for number lookup but kept for API consistency
   * @returns {Promise<{data: number|null, error: object|null}>}
   */
  async getNextInvoiceNumber(employeeId, formatType) {
    try {
      const { data, error } = await this.client
        .from('employees')
        .select('next_invoice_number, invoice_prefix')
        .eq('id', employeeId)
        .single();

      if (error) return { data: null, error };
      return {
        data: {
          number: data.next_invoice_number,
          prefix: data.invoice_prefix
        },
        error: null
      };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // INVOICE ITEMS
  // ----------------------------------------------------------

  /**
   * Get all line items for a specific invoice, ordered by item_order.
   * @param {string} invoiceId - Invoice UUID
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getInvoiceItems(invoiceId) {
    try {
      const { data, error } = await this.client
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('item_order', { ascending: true });

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // EXPENSES
  // ----------------------------------------------------------

  /**
   * Get all expenses for a specific invoice.
   * @param {string} invoiceId - Invoice UUID
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getExpenses(invoiceId) {
    try {
      const { data, error } = await this.client
        .from('expenses')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: true });

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  /**
   * Create or update an expense. If data.id is provided, updates; otherwise inserts.
   * @param {object} expenseData
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async upsertExpense(expenseData) {
    try {
      var allowed = ['id', 'invoice_id', 'category', 'description', 'amount_uah', 'amount_usd', 'exchange_rate', 'expense_date'];
      var cleaned = {};
      for (var i = 0; i < allowed.length; i++) {
        if (expenseData[allowed[i]] !== undefined) cleaned[allowed[i]] = expenseData[allowed[i]];
      }

      const { data, error } = await this.client
        .from('expenses')
        .upsert(cleaned, { onConflict: 'id' })
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Delete an expense by ID.
   * @param {string} id - Expense UUID
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async deleteExpense(id) {
    try {
      const { data, error } = await this.client
        .from('expenses')
        .delete()
        .eq('id', id)
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------------

  /**
   * Get a setting value by its key.
   * @param {string} key - Setting key (e.g. 'billed_to', 'uah_usd_rate')
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getSetting(key) {
    try {
      const { data, error } = await this.client
        .from('settings')
        .select('value')
        .eq('key', key)
        .maybeSingle();

      if (error) return { data: null, error };
      return { data: data ? data.value : null, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Set (upsert) a setting value.
   * @param {string} key
   * @param {object} value - JSONB value
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async setSetting(key, value) {
    try {
      const { data, error } = await this.client
        .from('settings')
        .upsert(
          { key, value, updated_at: new Date().toISOString() },
          { onConflict: 'key' }
        )
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // MONTH LOCKS
  // ----------------------------------------------------------

  /**
   * Check if a given month/year is locked.
   * @param {number} month
   * @param {number} year
   * @returns {Promise<{data: boolean, error: object|null}>}
   */
  async isMonthLocked(month, year) {
    try {
      const { data, error } = await this.client
        .from('month_locks')
        .select('month, year')
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      if (error) return { data: false, error };
      return { data: !!data, error: null };
    } catch (err) {
      return { data: false, error: { message: err.message } };
    }
  },

  /**
   * Lock a month (admin only). Inserts a row into month_locks.
   * @param {number} month
   * @param {number} year
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async lockMonth(month, year) {
    try {
      const { data: session } = await this.client.auth.getSession();
      const userId = session?.session?.user?.id;

      const { data, error } = await this.client
        .from('month_locks')
        .insert({ month, year, locked_by: userId })
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Unlock a month (admin only). Deletes the row from month_locks.
   * @param {number} month
   * @param {number} year
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async unlockMonth(month, year) {
    try {
      const { data, error } = await this.client
        .from('month_locks')
        .delete()
        .eq('month', month)
        .eq('year', year)
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // CONVENIENCE METHODS (used by page modules)
  // ----------------------------------------------------------

  /**
   * Get team members by lead email. Returns array of { employee_id, ... }.
   * @param {string} leadEmail
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getTeamMembersByLead(leadEmail) {
    try {
      const { data: team, error: teamError } = await this.client
        .from('teams')
        .select('id')
        .eq('lead_email', leadEmail)
        .maybeSingle();

      if (teamError) return { data: [], error: teamError };
      if (!team) return { data: [], error: null };

      const { data, error } = await this.client
        .from('team_members')
        .select('employee_id')
        .eq('team_id', team.id);

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  /**
   * Batch upsert timesheets. Accepts array of timesheet rows.
   * @param {Array} rows - Array of { employee_id, project_id, month, year, hours, created_by }
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async upsertTimesheets(rows) {
    try {
      if (!rows || rows.length === 0) return { data: [], error: null };

      const { data, error } = await this.client
        .from('timesheets')
        .upsert(rows, {
          onConflict: 'employee_id,project_id,month,year'
        })
        .select();

      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  /**
   * Generate an invoice for an employee based on their timesheet data.
   * Creates invoice + line items from timesheet hours.
   * @param {string} employeeId
   * @param {number} month
   * @param {number} year
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async generateInvoice(employeeId, month, year) {
    try {
      // Full select needed — invoice generation requires bank details (iban, swift, bank_name, receiver_name, address, phone)
      const { data: emp, error: empErr } = await this.client
        .from('employees')
        .select('*')
        .eq('id', employeeId)
        .single();

      if (empErr || !emp) return { data: null, error: empErr || { message: 'Employee not found' } };

      // Get timesheet entries for this employee + period
      const { data: timesheets, error: tsErr } = await this.client
        .from('timesheets')
        .select('*, projects ( id, name, code )')
        .eq('employee_id', employeeId)
        .eq('month', month)
        .eq('year', year);

      if (tsErr) return { data: null, error: tsErr };

      // Check for existing invoice (UNIQUE constraint: employee_id, month, year, format_type)
      var formatType = emp.invoice_format || 'WS';
      var { data: existingInv } = await this.client
        .from('invoices')
        .select('id')
        .eq('employee_id', employeeId)
        .eq('month', month)
        .eq('year', year)
        .eq('format_type', formatType)
        .maybeSingle();

      if (existingInv) {
        return { data: null, error: { message: 'Invoice already exists for this employee/period. Delete the existing invoice first or edit it on the Invoices page.' } };
      }

      // Get working hours configuration to determine standard hours for monthly employees
      var whRet = await this.getWorkingHoursConfig(month, year);
      var config = whRet && whRet.data ? whRet.data : null;
      var expectedHours = config ? (config.working_days || 21) * (config.hours_per_day || 8) : 21 * 8; // default 168 hours

      // Calculate total hours and build line items
      var totalHours = 0;
      var items = [];
      var order = 1;
      var rate = parseFloat(emp.rate_usd) || parseFloat(emp.hourly_rate) || 0;
      var empType = emp.employee_type || 'monthly';
      var isHourly = empType === 'Hourly Contractor' || empType === 'hourly';

      for (var i = 0; i < (timesheets || []).length; i++) {
        var ts = timesheets[i];
        var hours = parseFloat(ts.hours) || 0;
        if (hours <= 0) continue;

        totalHours += hours;
        var projectName = ts.projects ? ts.projects.name : ('Project ' + ts.project_id);

        var itemTotal = 0;
        var itemPrice = rate;

        if (isHourly) {
          // Pure hourly
          itemTotal = hours * rate;
        } else {
          // Monthly fractional
          if (expectedHours > 0) {
            itemTotal = rate * (hours / expectedHours);
          } else {
            itemTotal = rate; // fallback if expectedHours = 0
          }
        }

        items.push({
          item_order: order++,
          description: projectName + ' — ' + hours + ' hours',
          price_usd: itemPrice,
          qty: isHourly ? hours : (expectedHours > 0 ? (hours / expectedHours) : 1), // Optional: represent fractional or direct hours
          total_usd: Math.round(itemTotal * 100) / 100
        });
      }

      // Get next invoice number (INTEGER in DB)
      var nextNum = emp.next_invoice_number || 1;

      var subtotalUsd = items.reduce(function (sum, it) { return sum + it.total_usd; }, 0);
      subtotalUsd = Math.round(subtotalUsd * 100) / 100;
      var today = new Date().toISOString().split('T')[0];

      var invoiceData = {
        employee_id: employeeId,
        invoice_number: nextNum,
        month: month,
        year: year,
        format_type: emp.invoice_format || 'WS',
        subtotal_usd: subtotalUsd,
        total_usd: subtotalUsd,
        status: 'draft',
        invoice_date: today
      };

      return await this.createInvoice(invoiceData, items);
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // CONTRACTS & NDA (Supabase Storage)
  // ----------------------------------------------------------

  /**
   * Upload a contract PDF for an employee.
   * @param {string} employeeId
   * @param {File} file - PDF file
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async uploadContract(employeeId, file) {
    try {
      var path = employeeId + '/contract.pdf';
      var { data, error } = await this.client.storage
        .from('contracts')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' });

      if (error) return { data: null, error };

      // Update timestamp on employee
      await this.client
        .from('employees')
        .update({ contract_uploaded_at: new Date().toISOString() })
        .eq('id', employeeId);

      return { data, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Get a signed URL for an employee's contract PDF.
   * @param {string} employeeId
   * @returns {Promise<{data: string|null, error: object|null}>}
   */
  async getContractUrl(employeeId) {
    try {
      var path = employeeId + '/contract.pdf';
      var { data, error } = await this.client.storage
        .from('contracts')
        .createSignedUrl(path, 3600); // 1 hour

      if (error) return { data: null, error };
      return { data: data.signedUrl, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Upload an NDA PDF for an employee.
   * @param {string} employeeId
   * @param {File} file - PDF file
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async uploadNda(employeeId, file) {
    try {
      var path = employeeId + '/nda.pdf';
      var { data, error } = await this.client.storage
        .from('documents')
        .upload(path, file, { upsert: true, contentType: 'application/pdf' });

      if (error) return { data: null, error };

      // Update timestamp on employee
      await this.client
        .from('employees')
        .update({ nda_uploaded_at: new Date().toISOString() })
        .eq('id', employeeId);

      return { data, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Get a signed URL for an employee's NDA PDF.
   * @param {string} employeeId
   * @returns {Promise<{data: string|null, error: object|null}>}
   */
  async getNdaUrl(employeeId) {
    try {
      var path = employeeId + '/nda.pdf';
      var { data, error } = await this.client.storage
        .from('documents')
        .createSignedUrl(path, 3600);

      if (error) return { data: null, error };
      return { data: data.signedUrl, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // EMAIL REQUESTS
  // ----------------------------------------------------------

  /**
   * Create a new email request for an employee.
   * @param {string} employeeId
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async createEmailRequest(employeeId) {
    try {
      var { data: session } = await this.client.auth.getSession();
      var userId = session?.session?.user?.id || null;

      var { data, error } = await this.client
        .from('email_requests')
        .insert({
          employee_id: employeeId,
          requested_by: userId,
          status: 'pending'
        })
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Get all email requests, optionally filtered by status.
   * @param {string} [status] - 'pending', 'approved', 'rejected', 'created'
   * @returns {Promise<{data: Array, error: object|null}>}
   */
  async getEmailRequests(status) {
    try {
      var query = this.client
        .from('email_requests')
        .select('*, employees ( id, name, work_email )')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      var { data, error } = await query;
      return { data: data || [], error };
    } catch (err) {
      return { data: [], error: { message: err.message } };
    }
  },

  /**
   * Update an email request (approve/reject/mark created).
   * @param {string} id - Email request UUID
   * @param {object} updates - { status, admin_note }
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async updateEmailRequest(id, updates) {
    try {
      var allowed = ['status', 'admin_note', 'updated_at'];
      var cleaned = { updated_at: new Date().toISOString() };
      for (var i = 0; i < allowed.length; i++) {
        if (updates[allowed[i]] !== undefined) cleaned[allowed[i]] = updates[allowed[i]];
      }

      var { data, error } = await this.client
        .from('email_requests')
        .update(cleaned)
        .eq('id', id)
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  // ----------------------------------------------------------
  // WORKING HOURS CONFIG
  // ----------------------------------------------------------

  /**
   * Get working hours config for a month/year.
   * @param {number} month
   * @param {number} year
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async getWorkingHoursConfig(month, year) {
    try {
      var { data, error } = await this.client
        .from('working_hours_config')
        .select('*')
        .eq('month', month)
        .eq('year', year)
        .maybeSingle();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Upsert working hours config for a month/year.
   * @param {object} config - { month, year, working_days, hours_per_day, adjustment_hours, notes }
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async upsertWorkingHoursConfig(config) {
    try {
      var { data, error } = await this.client
        .from('working_hours_config')
        .upsert(config, { onConflict: 'month,year' })
        .select()
        .single();

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Upload parsed timesheet data (from TimesheetParser) to DB.
   * @param {object} parsedData - { timesheets, employees, metadata } from TimesheetParser.parse()
   * @param {number} month
   * @param {number} year
   * @returns {Promise<{data: object, error: object|null}>}
   */
  async uploadTimesheets(parsedData, month, year) {
    try {
      if (typeof TimesheetParser !== 'undefined' && typeof TimesheetParser.importToDb === 'function') {
        var { data: session } = await this.client.auth.getSession();
        var userId = session?.session?.user?.id || null;
        var result = await TimesheetParser.importToDb(parsedData.timesheets, month, year, userId);
        return { data: result, error: null };
      }

      // Fallback: manual import
      return { data: { imported: 0, skipped: 0, errors: ['TimesheetParser not available'] }, error: null };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  }
};

