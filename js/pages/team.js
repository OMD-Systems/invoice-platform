/* =============================================================
   Team — Master-Detail Employee Management + Inline Hours + Invoice
   Invoice Platform · OMD Systems
   Replaces: Dashboard, Timesheet, Employees
   ============================================================= */

/* ── Ensure showToast is available ── */
if (typeof showToast === 'undefined') {
  function showToast(message, type) {
    type = type || 'success';
    var existing = document.querySelectorAll('.fury-toast');
    for (var i = 0; i < existing.length; i++) existing[i].remove();
    var toast = document.createElement('div');
    toast.className = 'fury-toast fury-toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { toast.classList.add('show'); }, 10);
    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }
}

const Team = {
  title: 'Team',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  searchQuery: '',

  /* ── Cached data ── */
  allEmployees: [],
  employees: [],
  selectedId: null,
  projects: [],
  timesheets: [],     // for selected employee
  allTimesheets: [],   // for all employees (summary)
  invoices: [],
  teams: [],
  teamMembers: {},
  hoursConfig: null,
  billedTo: null,
  defaultTerms: '',

  /* ── Constants ── */
  MONTH_NAMES: [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ],

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  async render(container, ctx) {
    container.innerHTML = this.template();
    this.bindEvents(container, ctx);
    await this.loadData(ctx);
    this.renderEmployeeList(container);
    // Auto-select first employee
    if (this.employees.length > 0 && !this.selectedId) {
      this.selectedId = this.employees[0].id;
    }
    if (this.selectedId) {
      await this.loadEmployeeDetails(this.selectedId);
      this.renderDetail(container);
    }
    this.highlightSelected(container);
  },

  /* ═══════════════════════════════════════════════════════
     TEMPLATE
     ═══════════════════════════════════════════════════════ */
  template() {
    var self = this;
    var monthOptions = '';
    for (var m = 1; m <= 12; m++) {
      monthOptions +=
        '<option value="' + m + '"' + (m === self.month ? ' selected' : '') + '>' +
        self.MONTH_NAMES[m - 1] + '</option>';
    }

    var yearOptions = '';
    var currentYear = new Date().getFullYear();
    for (var y = currentYear - 2; y <= currentYear + 1; y++) {
      yearOptions +=
        '<option value="' + y + '"' + (y === self.year ? ' selected' : '') + '>' +
        y + '</option>';
    }

    return '' +
      '<div class="team-page">' +

      /* ── LEFT: Employee List ── */
      '<div class="team-list">' +
      '<div class="team-list-header">' +
      '<input type="text" class="fury-input team-search" id="team-search" ' +
      'placeholder="Search employees..." />' +
      '<div class="team-period">' +
      '<select class="fury-select fury-select-sm" id="team-month">' + monthOptions + '</select>' +
      '<select class="fury-select fury-select-sm" id="team-year">' + yearOptions + '</select>' +
      '</div>' +
      '</div>' +
      '<div class="team-list-body" id="team-list-body">' +
      '<div class="loading" style="padding:40px">Loading...</div>' +
      '</div>' +
      '<div class="team-list-footer">' +
      '<label class="fury-btn fury-btn-secondary fury-btn-sm team-upload-btn" id="team-upload-label">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
      ' Upload Timesheet' +
      '<input type="file" accept=".xlsx,.xls" id="team-upload-file" style="display:none" />' +
      '</label>' +
      '</div>' +
      '</div>' +

      /* ── RIGHT: Detail Panel ── */
      '<div class="team-detail" id="team-detail">' +
      '<div class="team-detail-empty">' +
      '<div style="font-size:48px;margin-bottom:12px;opacity:0.3">&#x1F465;</div>' +
      '<div style="color:var(--fury-text-muted)">Select an employee from the list</div>' +
      '</div>' +
      '</div>' +

      '</div>' +

      /* ── Modal ── */
      '<div class="fury-modal-overlay" id="team-modal-overlay">' +
      '<div class="fury-modal" id="team-modal"></div>' +
      '</div>';
  },

  /* ═══════════════════════════════════════════════════════
     LOAD DATA
     ═══════════════════════════════════════════════════════ */
  async loadData(ctx) {
    var self = this;
    try {
      // Load employees
      if (ctx.role === 'admin') {
        var empResult = await DB.getEmployees();
        self.allEmployees = (empResult && empResult.data) || [];
      } else if (ctx.role === 'lead') {
        var tmResult = await DB.getTeamMembersByLead(ctx.user.email);
        var teamMemberData = (tmResult && tmResult.data) || [];
        if (teamMemberData.length > 0) {
          var memberIds = {};
          for (var tm = 0; tm < teamMemberData.length; tm++) {
            memberIds[teamMemberData[tm].employee_id] = true;
          }
          var allResult = await DB.getEmployees();
          self.allEmployees = ((allResult && allResult.data) || []).filter(function (emp) {
            return memberIds[emp.id];
          });
        } else {
          self.allEmployees = [];
        }
      } else {
        var viewerResult = await DB.getEmployees();
        self.allEmployees = (viewerResult && viewerResult.data) || [];
      }

      // Sort: active first, then by name
      self.allEmployees.sort(function (a, b) {
        if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
        return (a.name || '').localeCompare(b.name || '');
      });

      self.applySearch();

      // Load projects
      var projResult = await DB.getProjects();
      self.projects = (projResult && projResult.data) || [];

      // Load all timesheets for period (for summary)
      var tsResult = await DB.getTimesheets(self.month, self.year);
      self.allTimesheets = (tsResult && tsResult.data) || [];

      // Load invoices for period
      var invResult = await DB.getInvoices({ month: self.month, year: self.year });
      self.invoices = (invResult && invResult.data) || [];

      // Load teams
      var teamsResult = await DB.getTeams();
      self.teams = (teamsResult && teamsResult.data) || [];

      // Load working hours config (table may not exist yet)
      try {
        var whResult = await DB.getWorkingHoursConfig(self.month, self.year);
        self.hoursConfig = (whResult && whResult.data) || null;
      } catch (whErr) {
        console.warn('[Team] working_hours_config not available:', whErr.message);
        self.hoursConfig = null;
      }

      // Load billed_to
      var btResult = await DB.getSetting('billed_to');
      if (btResult && btResult.data) {
        self.billedTo = typeof btResult.data === 'string' ? JSON.parse(btResult.data) : btResult.data;
      }

      // Load payment terms
      var ptResult = await DB.getSetting('payment_terms');
      if (ptResult && ptResult.data) {
        var ptData = typeof ptResult.data === 'string' ? JSON.parse(ptResult.data) : ptResult.data;
        self.defaultTerms = ptData.text || '';
      }

      console.log('[Team] loadData done — employees:', self.allEmployees.length,
        'projects:', self.projects.length,
        'timesheets:', self.allTimesheets.length,
        'invoices:', self.invoices.length,
        'role:', ctx.role);

    } catch (err) {
      console.error('[Team] loadData error:', err);
    }
  },

  /* ── Search filter ── */
  applySearch() {
    var q = this.searchQuery.toLowerCase().trim();
    if (!q) {
      this.employees = this.allEmployees.slice();
      return;
    }
    this.employees = this.allEmployees.filter(function (emp) {
      var name = (emp.name || '').toLowerCase();
      var pin = (emp.pin || '').toLowerCase();
      return name.indexOf(q) !== -1 || pin.indexOf(q) !== -1;
    });
  },

  /* ═══════════════════════════════════════════════════════
     EMPLOYEE LIST (Left Panel)
     ═══════════════════════════════════════════════════════ */
  renderEmployeeList(container) {
    var self = this;
    var body = container.querySelector('#team-list-body');
    if (!body) return;

    if (self.employees.length === 0) {
      body.innerHTML =
        '<div style="padding:40px;text-align:center;color:var(--fury-text-muted)">' +
        (self.searchQuery ? 'No employees match your search.' : 'No employees found.') +
        '</div>';
      return;
    }

    var html = '';
    for (var i = 0; i < self.employees.length; i++) {
      var emp = self.employees[i];

      // Get hours for this employee
      var totalHours = 0;
      for (var t = 0; t < self.allTimesheets.length; t++) {
        if (self.allTimesheets[t].employee_id === emp.id) {
          totalHours += parseFloat(self.allTimesheets[t].hours) || 0;
        }
      }

      // Get invoice status
      var invoice = null;
      for (var inv = 0; inv < self.invoices.length; inv++) {
        if (self.invoices[inv].employee_id === emp.id) {
          invoice = self.invoices[inv];
          break;
        }
      }

      // Contract type badge
      var contractType = emp.contract_type || 'Contractor';
      var ctBadgeClass = contractType === 'Full-Time' ? 'team-badge-ft'
        : contractType === 'Part-Time' ? 'team-badge-pt'
          : 'team-badge-ctr';
      var ctLabel = contractType === 'Full-Time' ? 'FT'
        : contractType === 'Part-Time' ? 'PT'
          : 'CTR';

      // Status dot
      var statusClass = emp.is_active ? 'team-status-active' : 'team-status-inactive';

      // Rate display
      var rate = parseFloat(emp.rate_usd) || 0;
      var rateStr = rate > 0 ? '$' + rate.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '';

      // Invoice status indicator
      var invIndicator = '';
      if (invoice) {
        var invClass = invoice.status === 'paid' ? 'team-inv-paid'
          : invoice.status === 'sent' ? 'team-inv-sent'
            : 'team-inv-draft';
        invIndicator = '<span class="team-inv-dot ' + invClass + '"></span>';
      }

      var isSelected = emp.id === self.selectedId;

      html +=
        '<div class="team-list-item' + (isSelected ? ' active' : '') + '" data-id="' + emp.id + '">' +
        '<div class="team-list-item-top">' +
        '<span class="team-status-dot ' + statusClass + '"></span>' +
        '<span class="team-list-name">' + self.escapeHtml(emp.name) + '</span>' +
        invIndicator +
        '</div>' +
        '<div class="team-list-item-bottom">' +
        '<span class="team-badge ' + ctBadgeClass + '">' + ctLabel + '</span>' +
        '<span class="team-list-rate">' + rateStr + '</span>' +
        (totalHours > 0 ? '<span class="team-list-hours">' + totalHours.toFixed(0) + 'h</span>' : '') +
        '</div>' +
        '</div>';
    }

    body.innerHTML = html;
  },

  /* ── Highlight selected item ── */
  highlightSelected(container) {
    var items = container.querySelectorAll('.team-list-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('active', items[i].getAttribute('data-id') === this.selectedId);
    }
  },

  /* ═══════════════════════════════════════════════════════
     EMPLOYEE DETAIL (Right Panel)
     ═══════════════════════════════════════════════════════ */
  async loadEmployeeDetails(employeeId) {
    var self = this;
    // Get timesheets for this employee in current period
    self.timesheets = self.allTimesheets.filter(function (ts) {
      return ts.employee_id === employeeId;
    });
  },

  renderDetail(container) {
    var self = this;
    var panel = container.querySelector('#team-detail');
    if (!panel) return;

    var emp = self.findEmployee(self.selectedId);
    if (!emp) {
      panel.innerHTML =
        '<div class="team-detail-empty">' +
        '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" style="opacity:0.15;margin-bottom:16px">' +
        '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>' +
        '<path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>' +
        '</svg>' +
        '<div style="color:var(--fury-text-secondary);font-size:14px;font-weight:500">Select an employee</div>' +
        '<div style="color:var(--fury-text-muted);font-size:12px;margin-top:4px">Click on a name in the list to view details</div>' +
        '</div>';
      return;
    }

    // Rate info
    var rate = parseFloat(emp.rate_usd) || 0;
    var contractType = emp.contract_type || 'Contractor';
    var ctBadge = contractType === 'Full-Time' ? 'FT'
      : contractType === 'Part-Time' ? 'PT' : 'CTR';
    var isHourly = emp.employee_type === 'Hourly Contractor';
    var rateStr = isHourly
      ? '$' + rate.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '/hr'
      : '$' + rate.toLocaleString('en-US', { minimumFractionDigits: 0 }) + '/mo';

    // Calculate regular hours
    var regularHours = self.calculateRegularHours();
    var regularDays = self.getWorkingDays();

    // Aggregate hours by project
    var projectHoursMap = {};
    var totalHours = 0;
    for (var t = 0; t < self.timesheets.length; t++) {
      var ts = self.timesheets[t];
      totalHours += parseFloat(ts.hours) || 0;
      projectHoursMap[ts.project_id] = (projectHoursMap[ts.project_id] || 0) + (parseFloat(ts.hours) || 0);
    }

    var diff = totalHours - regularHours;
    var diffClass = diff > 0 ? 'team-diff-over' : diff < 0 ? 'team-diff-under' : 'team-diff-zero';
    var diffStr = diff > 0 ? '+' + diff.toFixed(0) + 'h' : diff < 0 ? diff.toFixed(0) + 'h' : '0h';
    var hoursPercent = regularHours > 0 ? Math.min(Math.round((totalHours / regularHours) * 100), 150) : 0;
    var progressClass = hoursPercent >= 100 ? 'team-progress-full' : hoursPercent >= 75 ? 'team-progress-good' : 'team-progress-low';

    // Invoice for this employee
    var invoice = self.getEmployeeInvoice(emp.id);
    var isAdmin = App.role === 'admin';
    var isAdminOrLead = App.role === 'admin' || App.role === 'lead';

    // Avatar initials
    var nameParts = (emp.name || '').split(/[\s,]+/).filter(Boolean);
    var initials = nameParts.length >= 2
      ? (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase()
      : (nameParts[0] || 'U').charAt(0).toUpperCase();

    // ── Build HTML ──
    var html = '';

    // ═══ HEADER ═══
    html +=
      '<div class="td-header">' +
      '<div class="td-header-left">' +
      '<div class="td-avatar">' + initials + '</div>' +
      '<div class="td-header-info">' +
      '<h2 class="td-name">' + self.escapeHtml(emp.name) + '</h2>' +
      '<div class="td-meta">' +
      '<span class="team-badge team-badge-' + ctBadge.toLowerCase() + '">' + ctBadge + '</span>' +
      '<span class="td-rate">' + rateStr + '</span>' +
      '</div>' +
      '</div>' +
      '</div>' +
      (isAdmin
        ? '<button class="fury-btn fury-btn-secondary fury-btn-sm" id="team-btn-edit">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        ' Edit' +
        '</button>'
        : '') +
      '</div>';

    // ═══ CONTACT & DOCUMENTS ═══
    html +=
      '<div class="td-section">' +
      '<div class="td-section-title">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>' +
      ' Contact & Documents' +
      '</div>' +
      '<div class="td-contact-grid">' +
      // Email
      '<div class="td-contact-item">' +
      '<div class="td-contact-label">Email</div>' +
      (emp.work_email
        ? '<a href="mailto:' + self.escapeHtml(emp.work_email) + '" class="td-contact-link">' + self.escapeHtml(emp.work_email) + '</a>'
        : '<span class="td-contact-empty">Not assigned</span>') +
      '</div>' +
      // Phone
      '<div class="td-contact-item">' +
      '<div class="td-contact-label">Phone</div>' +
      (emp.phone
        ? '<a href="tel:' + self.escapeHtml(emp.phone) + '" class="td-contact-link">' + self.escapeHtml(emp.phone) + '</a>'
        : '<span class="td-contact-empty">&#8212;</span>') +
      '</div>' +
      '</div>' +
      // Documents row
      '<div class="td-docs-row">' +
      self._renderDocCard('Contract', emp.contract_uploaded_at, 'team-btn-contract', 'team-file-contract', isAdmin) +
      self._renderDocCard('NDA', emp.nda_uploaded_at, 'team-btn-nda', 'team-file-nda', isAdmin) +
      '</div>' +
      '</div>';

    // ═══ WORKING HOURS ═══
    html +=
      '<div class="td-section">' +
      '<div class="td-section-title">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
      ' Working Hours' +
      '<span class="td-period-label">' + self.MONTH_NAMES[self.month - 1] + ' ' + self.year + '</span>' +
      '</div>' +
      // Hours summary bar
      '<div class="td-hours-summary">' +
      '<div class="td-hours-stats">' +
      '<span class="td-hours-logged" id="team-total-hours">' + totalHours.toFixed(0) + 'h</span>' +
      '<span class="td-hours-separator">/</span>' +
      '<span class="td-hours-standard">' + regularHours + 'h</span>' +
      '<span class="td-hours-info">(' + regularDays + ' days)</span>' +
      '<span class="' + diffClass + '" id="team-diff-hours" style="margin-left:auto;font-weight:600;font-size:13px">' + diffStr + '</span>' +
      '</div>' +
      '<div class="td-progress">' +
      '<div class="td-progress-bar ' + progressClass + '" style="width:' + Math.min(hoursPercent, 100) + '%" id="team-progress-bar"></div>' +
      '</div>' +
      '</div>';

    if (self.projects.length === 0) {
      html +=
        '<div class="td-hours-empty">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="opacity:0.4"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>' +
        ' No projects configured' +
        '</div>';
    } else {
      if (!isAdminOrLead) {
        html +=
          '<div class="td-readonly-hint">' +
          '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
          ' View only' +
          '</div>';
      }

      html += '<div class="td-hours-grid">';
      for (var p = 0; p < self.projects.length; p++) {
        var proj = self.projects[p];
        var projHours = projectHoursMap[proj.id] || 0;
        html +=
          '<div class="td-hours-row">' +
          '<span class="td-hours-project">' + self.escapeHtml(proj.code) + '</span>' +
          '<input type="number" class="td-hours-input team-hours-input" ' +
          'data-project-id="' + proj.id + '" ' +
          'value="' + (projHours > 0 ? projHours : '') + '" ' +
          'min="0" max="999" step="0.5" placeholder="0" ' +
          (isAdminOrLead ? '' : 'disabled') + ' />' +
          '</div>';
      }
      html += '</div>';

      if (isAdminOrLead) {
        html +=
          '<button class="fury-btn fury-btn-primary fury-btn-sm td-save-btn" id="team-btn-save-hours">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>' +
          ' Save Hours' +
          '</button>';
      }
    }

    html += '</div>';

    // ═══ INVOICE ═══
    html +=
      '<div class="td-section td-section-last">' +
      '<div class="td-section-title">' +
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' +
      ' Invoice' +
      '<span class="td-period-label">' + self.MONTH_NAMES[self.month - 1] + ' ' + self.year + '</span>' +
      '</div>';

    if (invoice) {
      var invStatus = invoice.status || 'draft';
      var invTotal = parseFloat(invoice.total_usd) || 0;
      var statusBadge = self._statusBadge(invStatus);
      var invNumber = invoice.invoice_number || '';

      html +=
        '<div class="td-invoice-card td-invoice-' + invStatus + '">' +
        '<div class="td-invoice-top">' +
        '<div class="td-invoice-amount">$' + invTotal.toLocaleString('en-US', { minimumFractionDigits: 2 }) + '</div>' +
        statusBadge +
        '</div>' +
        '<div class="td-invoice-detail">' +
        (invNumber ? '<span class="td-invoice-num">#' + self.escapeHtml(String(invNumber)) + '</span>' : '') +
        '<span class="td-invoice-calc">' +
        totalHours.toFixed(0) + 'h' +
        (isHourly ? ' &times; $' + rate.toFixed(2) + '/hr' : ' (monthly rate)') +
        '</span>' +
        '</div>' +
        '<div class="td-invoice-actions">' +
        '<button class="fury-btn fury-btn-secondary fury-btn-sm" id="team-btn-preview" data-fury-tooltip="Preview invoice">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>' +
        ' Preview' +
        '</button>' +
        '<button class="fury-btn fury-btn-secondary fury-btn-sm" id="team-btn-download" data-fury-tooltip="Download DOCX">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
        ' DOCX' +
        '</button>' +
        (invStatus === 'draft' || invStatus === 'generated'
          ? '<button class="fury-btn fury-btn-primary fury-btn-sm" id="team-btn-mark-sent">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>' +
          ' Mark Sent' +
          '</button>'
          : '') +
        (invStatus === 'sent'
          ? '<button class="fury-btn fury-btn-success fury-btn-sm" id="team-btn-mark-paid">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
          ' Mark Paid' +
          '</button>'
          : '') +
        '</div>' +
        '</div>';
    } else {
      html +=
        '<div class="td-invoice-empty">' +
        '<div class="td-invoice-empty-icon">' +
        '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>' +
        '</div>' +
        '<div class="td-invoice-empty-text">No invoice for this period</div>' +
        (isAdminOrLead
          ? '<button class="fury-btn fury-btn-primary td-generate-btn" id="team-btn-generate">' +
          '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>' +
          ' Generate Invoice' +
          '</button>'
          : '') +
        '</div>';
    }

    html += '</div>';

    panel.innerHTML = html;
    self.bindDetailEvents(container);
  },

  /* ── Helper: render document card ── */
  _renderDocCard(label, uploadedAt, btnId, fileId, isAdmin) {
    if (uploadedAt) {
      return (
        '<div class="td-doc-card td-doc-ok">' +
        '<div class="td-doc-icon">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        '</div>' +
        '<div class="td-doc-info">' +
        '<span class="td-doc-label">' + label + '</span>' +
        '<span class="td-doc-status">Uploaded</span>' +
        '</div>' +
        '<button class="td-doc-action" id="' + btnId + '" data-fury-tooltip="Download ' + label + '">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' +
        '</button>' +
        '</div>'
      );
    }
    if (isAdmin) {
      return (
        '<label class="td-doc-card td-doc-missing td-doc-upload">' +
        '<div class="td-doc-icon">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>' +
        '</div>' +
        '<div class="td-doc-info">' +
        '<span class="td-doc-label">' + label + '</span>' +
        '<span class="td-doc-status td-doc-status-missing">Upload PDF</span>' +
        '</div>' +
        '<input type="file" accept=".pdf" id="' + fileId + '" style="display:none" />' +
        '</label>'
      );
    }
    return (
      '<div class="td-doc-card td-doc-missing">' +
      '<div class="td-doc-icon">' +
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>' +
      '</div>' +
      '<div class="td-doc-info">' +
      '<span class="td-doc-label">' + label + '</span>' +
      '<span class="td-doc-status td-doc-status-missing">Not uploaded</span>' +
      '</div>' +
      '</div>'
    );
  },

  /* ═══════════════════════════════════════════════════════
     EVENTS
     ═══════════════════════════════════════════════════════ */
  bindEvents(container, ctx) {
    var self = this;

    // Search
    var searchInput = container.querySelector('#team-search');
    var searchTimeout = null;
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var val = this.value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function () {
          self.searchQuery = val;
          self.applySearch();
          self.renderEmployeeList(container);
          self.highlightSelected(container);
        }, 200);
      });
    }

    // Month/Year change
    var monthSelect = container.querySelector('#team-month');
    var yearSelect = container.querySelector('#team-year');
    if (monthSelect) {
      monthSelect.addEventListener('change', function () {
        var select = this;
        self._autoSaveDirtyHours(container).then(function () {
          self.month = parseInt(select.value, 10);
          self.onPeriodChange(container, ctx);
        });
      });
    }
    if (yearSelect) {
      yearSelect.addEventListener('change', function () {
        var select = this;
        self._autoSaveDirtyHours(container).then(function () {
          self.year = parseInt(select.value, 10);
          self.onPeriodChange(container, ctx);
        });
      });
    }

    // Employee list click (delegated)
    var listBody = container.querySelector('#team-list-body');
    if (listBody) {
      listBody.addEventListener('click', function (e) {
        var item = e.target.closest('.team-list-item');
        if (!item) return;
        var empId = item.getAttribute('data-id');
        if (empId && empId !== self.selectedId) {
          self._autoSaveDirtyHours(container).then(function () {
            self.selectedId = empId;
            self.highlightSelected(container);
            self.loadEmployeeDetails(empId).then(function () {
              self.renderDetail(container);
            });
          });
        }
      });
    }

    // Upload timesheet
    var uploadFile = container.querySelector('#team-upload-file');
    if (uploadFile) {
      uploadFile.addEventListener('change', function () {
        if (this.files && this.files[0]) {
          self.handleUploadTimesheet(this.files[0], container, ctx);
          this.value = '';
        }
      });
    }

    // Modal overlay close
    var overlay = container.querySelector('#team-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          overlay.classList.remove('active');
        }
      });
    }

    // Escape key
    self._escHandler = function (e) {
      if (e.key === 'Escape') {
        var ol = container.querySelector('#team-modal-overlay');
        if (ol) ol.classList.remove('active');
      }
    };
    document.addEventListener('keydown', self._escHandler);
  },

  /* ── Detail panel events (rebound on each render) ── */
  bindDetailEvents(container) {
    var self = this;
    var emp = self.findEmployee(self.selectedId);
    if (!emp) return;

    // Edit button
    var editBtn = container.querySelector('#team-btn-edit');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        self.showEditModal(emp, container);
      });
    }

    // Contract download
    var contractBtn = container.querySelector('#team-btn-contract');
    if (contractBtn) {
      contractBtn.addEventListener('click', async function () {
        var result = await DB.getContractUrl(emp.id);
        if (result && result.data) {
          window.open(result.data, '_blank');
        } else {
          showToast('Failed to get contract URL', 'error');
        }
      });
    }

    // Contract upload
    var contractFile = container.querySelector('#team-file-contract');
    if (contractFile) {
      contractFile.addEventListener('change', async function () {
        if (this.files && this.files[0]) {
          var result = await DB.uploadContract(emp.id, this.files[0]);
          if (result && !result.error) {
            showToast('Contract uploaded', 'success');
            // Refresh employee data
            var empResult = await DB.getEmployee(emp.id);
            if (empResult && empResult.data) {
              self.updateEmployeeInCache(empResult.data);
            }
            self.renderDetail(container);
          } else {
            showToast('Upload failed: ' + ((result && result.error && result.error.message) || 'Unknown'), 'error');
          }
        }
      });
    }

    // NDA download
    var ndaBtn = container.querySelector('#team-btn-nda');
    if (ndaBtn) {
      ndaBtn.addEventListener('click', async function () {
        var result = await DB.getNdaUrl(emp.id);
        if (result && result.data) {
          window.open(result.data, '_blank');
        } else {
          showToast('Failed to get NDA URL', 'error');
        }
      });
    }

    // NDA upload
    var ndaFile = container.querySelector('#team-file-nda');
    if (ndaFile) {
      ndaFile.addEventListener('change', async function () {
        if (this.files && this.files[0]) {
          var result = await DB.uploadNda(emp.id, this.files[0]);
          if (result && !result.error) {
            showToast('NDA uploaded', 'success');
            var empResult = await DB.getEmployee(emp.id);
            if (empResult && empResult.data) {
              self.updateEmployeeInCache(empResult.data);
            }
            self.renderDetail(container);
          } else {
            showToast('Upload failed: ' + ((result && result.error && result.error.message) || 'Unknown'), 'error');
          }
        }
      });
    }

    // Hours input live calc
    var hoursInputs = container.querySelectorAll('.team-hours-input');
    for (var hi = 0; hi < hoursInputs.length; hi++) {
      hoursInputs[hi].addEventListener('input', function () {
        self.recalcHours(container);
      });
    }

    // Save hours
    var saveHoursBtn = container.querySelector('#team-btn-save-hours');
    if (saveHoursBtn) {
      saveHoursBtn.addEventListener('click', function () {
        self.handleSaveHours(container);
      });
    }

    // Generate invoice
    var generateBtn = container.querySelector('#team-btn-generate');
    if (generateBtn) {
      generateBtn.addEventListener('click', function () {
        self.handleGenerateInvoice(container);
      });
    }

    // Preview invoice
    var previewBtn = container.querySelector('#team-btn-preview');
    if (previewBtn) {
      previewBtn.addEventListener('click', function () {
        self.handlePreviewInvoice(container);
      });
    }

    // Download DOCX
    var downloadBtn = container.querySelector('#team-btn-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        self.handleDownloadInvoice();
      });
    }

    // Mark sent
    var markSentBtn = container.querySelector('#team-btn-mark-sent');
    if (markSentBtn) {
      markSentBtn.addEventListener('click', function () {
        self.handleStatusChange('sent', container);
      });
    }

    // Mark paid
    var markPaidBtn = container.querySelector('#team-btn-mark-paid');
    if (markPaidBtn) {
      markPaidBtn.addEventListener('click', function () {
        self.handleStatusChange('paid', container);
      });
    }
  },

  /* ═══════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════ */

  /* ── Recalc hours on input ── */
  recalcHours(container) {
    var inputs = container.querySelectorAll('.team-hours-input');
    var total = 0;
    for (var i = 0; i < inputs.length; i++) {
      total += parseFloat(inputs[i].value) || 0;
    }

    var regularHours = this.calculateRegularHours();
    var diff = total - regularHours;
    var diffClass = diff > 0 ? 'team-diff-over' : diff < 0 ? 'team-diff-under' : 'team-diff-zero';
    var diffStr = diff > 0 ? '+' + diff.toFixed(0) + 'h' : diff < 0 ? diff.toFixed(0) + 'h' : '0h';

    var totalEl = container.querySelector('#team-total-hours');
    var diffEl = container.querySelector('#team-diff-hours');
    if (totalEl) totalEl.textContent = total.toFixed(0) + 'h';
    if (diffEl) diffEl.innerHTML = '<span class="' + diffClass + '">' + diffStr + '</span>';

    // Update progress bar
    var progressBar = container.querySelector('#team-progress-bar');
    if (progressBar && regularHours > 0) {
      var pct = Math.min(Math.round((total / regularHours) * 100), 100);
      progressBar.style.width = pct + '%';
      progressBar.className = 'td-progress-bar ' +
        (pct >= 100 ? 'team-progress-full' : pct >= 75 ? 'team-progress-good' : 'team-progress-low');
    }
  },

  /* ── Save hours ── */
  async handleSaveHours(container) {
    var self = this;
    var emp = self.findEmployee(self.selectedId);
    if (!emp) return;

    var inputs = container.querySelectorAll('.team-hours-input');
    var rows = [];
    var userId = App.user ? App.user.id : null;

    for (var i = 0; i < inputs.length; i++) {
      var projectId = inputs[i].getAttribute('data-project-id');
      var hours = parseFloat(inputs[i].value) || 0;
      if (hours > 0 || self.timesheets.some(function (ts) { return ts.project_id === projectId; })) {
        rows.push({
          employee_id: emp.id,
          project_id: projectId,
          month: self.month,
          year: self.year,
          hours: hours,
          created_by: userId
        });
      }
    }

    if (rows.length === 0) {
      showToast('No hours to save.', 'error');
      return;
    }

    var btn = container.querySelector('#team-btn-save-hours');
    if (btn) { btn.disabled = true; btn.textContent = 'Saving...'; }

    try {
      var result = await DB.upsertTimesheets(rows);
      if (result && result.error) throw new Error(result.error.message);

      showToast('Hours saved!', 'success');

      // Refresh timesheets
      var tsResult = await DB.getTimesheets(self.month, self.year);
      self.allTimesheets = (tsResult && tsResult.data) || [];
      self.timesheets = self.allTimesheets.filter(function (ts) {
        return ts.employee_id === emp.id;
      });

      // Refresh list (to update hours display)
      self.renderEmployeeList(container);
      self.highlightSelected(container);
    } catch (err) {
      console.error('[Team] save hours error:', err);
      showToast('Error saving hours: ' + (err.message || 'Unknown'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Save Hours'; }
    }
  },

  /* ── Generate invoice ── */
  async handleGenerateInvoice(container) {
    var self = this;
    var emp = self.findEmployee(self.selectedId);
    if (!emp) return;

    var btn = container.querySelector('#team-btn-generate');
    if (btn) { btn.disabled = true; btn.textContent = 'Generating...'; }

    try {
      var result = await DB.generateInvoice(emp.id, self.month, self.year);
      if (result && result.error) throw new Error(result.error.message || 'Failed to generate');

      showToast('Invoice generated!', 'success');

      // Refresh invoices
      var invResult = await DB.getInvoices({ month: self.month, year: self.year });
      self.invoices = (invResult && invResult.data) || [];

      // Re-render detail and list
      self.renderDetail(container);
      self.renderEmployeeList(container);
      self.highlightSelected(container);
    } catch (err) {
      console.error('[Team] generate invoice error:', err);
      showToast('Error: ' + (err.message || 'Unknown'), 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Generate Invoice'; }
    }
  },

  /* ── Preview invoice ── */
  handlePreviewInvoice(container) {
    var self = this;
    var emp = self.findEmployee(self.selectedId);
    var invoice = self.getEmployeeInvoice(emp.id);
    if (!invoice || !emp) return;

    if (typeof InvoicePreview !== 'undefined' && typeof InvoicePreview.render === 'function') {
      var overlay = container.querySelector('#team-modal-overlay');
      var modal = container.querySelector('#team-modal');
      if (overlay && modal) {
        modal.innerHTML =
          '<div style="padding:0;max-width:800px;width:100%;max-height:90vh;overflow:auto;background:white;border-radius:8px">' +
          '<div style="display:flex;justify-content:flex-end;padding:8px;background:#111114;border-radius:8px 8px 0 0">' +
          '<button class="fury-btn fury-btn-secondary fury-btn-sm" id="team-preview-close">&times; Close</button>' +
          '</div>' +
          '<div id="team-preview-content" style="padding:20px"></div>' +
          '</div>';
        overlay.classList.add('active');

        var previewContainer = modal.querySelector('#team-preview-content');
        InvoicePreview.render(previewContainer, invoice, emp, self.billedTo, self.defaultTerms);

        var closeBtn = modal.querySelector('#team-preview-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', function () {
            overlay.classList.remove('active');
          });
        }
      }
    } else {
      showToast('Preview module not available', 'error');
    }
  },

  /* ── Download DOCX ── */
  async handleDownloadInvoice() {
    var self = this;
    var emp = self.findEmployee(self.selectedId);
    var invoice = self.getEmployeeInvoice(emp.id);
    if (!invoice || !emp) return;

    if (typeof InvoiceDocx !== 'undefined' && typeof InvoiceDocx.downloadInvoice === 'function') {
      try {
        var items = (invoice.invoice_items || []).map(function (it) {
          return {
            description: it.description || '',
            price: it.price_usd || 0,
            qty: it.qty || 1,
            total: it.total_usd || 0,
          };
        });
        var invoiceData = {
          employee: emp,
          invoiceNumber: invoice.invoice_number || '',
          invoiceDate: invoice.invoice_date || '',
          dueDays: 15,
          items: items,
          subtotal: invoice.subtotal_usd || 0,
          discount: invoice.discount_usd || 0,
          tax: invoice.tax_usd || 0,
          taxRate: invoice.tax_rate || 0,
          total: invoice.total_usd || 0,
          billedTo: self.billedTo || {},
          terms: self.defaultTerms || '',
        };
        await InvoiceDocx.downloadInvoice(invoiceData);
        showToast('DOCX downloaded!', 'success');
      } catch (err) {
        showToast('Download failed: ' + (err.message || 'Unknown'), 'error');
      }
    } else {
      showToast('DOCX module not available', 'error');
    }
  },

  /* ── Status change (mark sent / mark paid) ── */
  async handleStatusChange(newStatus, container) {
    var self = this;
    var emp = self.findEmployee(self.selectedId);
    var invoice = self.getEmployeeInvoice(emp.id);
    if (!invoice) return;

    try {
      var result = await DB.updateInvoiceStatus(invoice.id, newStatus);
      if (result && result.error) throw new Error(result.error.message);

      showToast('Invoice marked as ' + newStatus, 'success');

      // Refresh
      var invResult = await DB.getInvoices({ month: self.month, year: self.year });
      self.invoices = (invResult && invResult.data) || [];
      self.renderDetail(container);
      self.renderEmployeeList(container);
      self.highlightSelected(container);
    } catch (err) {
      showToast('Error: ' + (err.message || 'Unknown'), 'error');
    }
  },

  /* ── Upload timesheet XLSX ── */
  async handleUploadTimesheet(file, container, ctx) {
    var self = this;

    if (typeof TimesheetParser === 'undefined') {
      showToast('Timesheet parser not available', 'error');
      return;
    }

    try {
      showToast('Parsing timesheet...', 'success');
      var parsed = await TimesheetParser.parse(file);
      var result = await DB.uploadTimesheets(parsed, self.month, self.year);

      if (result && result.error) throw new Error(result.error.message);

      var imported = (result && result.data && result.data.imported) || 0;
      showToast('Imported ' + imported + ' timesheet entries', 'success');

      // Reload
      await self.loadData(ctx);
      self.renderEmployeeList(container);
      self.highlightSelected(container);
      if (self.selectedId) {
        await self.loadEmployeeDetails(self.selectedId);
        self.renderDetail(container);
      }
    } catch (err) {
      console.error('[Team] upload error:', err);
      showToast('Upload failed: ' + (err.message || 'Unknown error'), 'error');
    }
  },

  /* ── Dirty hours check + auto-save ── */
  _hasDirtyHours(container) {
    var inputs = container.querySelectorAll('.team-hours-input');
    for (var i = 0; i < inputs.length; i++) {
      var projectId = inputs[i].getAttribute('data-project-id');
      var inputVal = parseFloat(inputs[i].value) || 0;
      var savedVal = 0;
      for (var t = 0; t < this.timesheets.length; t++) {
        if (this.timesheets[t].project_id === projectId) {
          savedVal = parseFloat(this.timesheets[t].hours) || 0;
          break;
        }
      }
      if (Math.abs(inputVal - savedVal) > 0.001) return true;
    }
    return false;
  },

  async _autoSaveDirtyHours(container) {
    if (!this._hasDirtyHours(container)) return;
    try {
      await this.handleSaveHours(container);
    } catch (err) {
      console.error('[Team] auto-save failed:', err);
    }
  },

  /* ── Cleanup on page leave ── */
  destroy() {
    if (this._escHandler) {
      document.removeEventListener('keydown', this._escHandler);
      this._escHandler = null;
    }
  },

  /* ── Period change ── */
  async onPeriodChange(container, ctx) {
    var self = this;
    var detail = container.querySelector('#team-detail');
    if (detail) {
      detail.innerHTML = '<div class="loading" style="padding:40px">Loading...</div>';
    }

    await self.loadData(ctx);
    self.renderEmployeeList(container);
    self.highlightSelected(container);

    if (self.selectedId) {
      await self.loadEmployeeDetails(self.selectedId);
      self.renderDetail(container);
    }
  },

  /* ═══════════════════════════════════════════════════════
     EDIT MODAL (reuses employees.js modal pattern)
     ═══════════════════════════════════════════════════════ */
  showEditModal(employee, container) {
    var self = this;
    var overlay = container.querySelector('#team-modal-overlay');
    var modal = container.querySelector('#team-modal');
    if (!overlay || !modal) return;

    var emp = employee || {};
    var isNew = !employee;

    modal.innerHTML = '' +
      '<div class="fury-modal-header">' +
      '<span class="fury-modal-title">' + (isNew ? 'Add Employee' : 'Edit Employee') + '</span>' +
      '<button class="fury-modal-close" id="team-modal-close">&times;</button>' +
      '</div>' +
      '<div class="fury-modal-body" style="padding: 24px; max-height: 70vh; overflow-y: auto;">' +

      '<div class="fury-modal-section" style="margin-bottom: 24px;">' +
      '<div class="fury-modal-section-title" style="font-size: 14px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; border-bottom: 1px solid #374151; padding-bottom: 8px;">Basic Information</div>' +
      '<div class="fury-form-row">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">PIN</label>' +
      '<input type="text" class="fury-input" id="team-f-pin" maxlength="4" value="' + self.escapeHtml(emp.pin || '') + '" />' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Name</label>' +
      '<input type="text" class="fury-input" id="team-f-name" value="' + self.escapeHtml(emp.name || '') + '" />' +
      '</div>' +
      '</div>' +
      '<div class="fury-form-group fury-mt-2">' +
      '<label class="fury-label">Full Name (Latin)</label>' +
      '<input type="text" class="fury-input" id="team-f-full-name" value="' + self.escapeHtml(emp.full_name_lat || '') + '" />' +
      '</div>' +
      '<div class="fury-form-group fury-mt-2">' +
      '<label class="fury-label">Work Email</label>' +
      '<input type="email" class="fury-input" id="team-f-work-email" placeholder="name@omdsystems.com" value="' + self.escapeHtml(emp.work_email || '') + '" />' +
      '</div>' +
      '<div class="fury-form-group fury-mt-2">' +
      '<label class="fury-label">Phone</label>' +
      '<input type="text" class="fury-input" id="team-f-phone" value="' + self.escapeHtml(emp.phone || '') + '" />' +
      '</div>' +
      '<div class="fury-form-group fury-mt-2">' +
      '<label class="fury-label">Address</label>' +
      '<textarea class="fury-textarea" id="team-f-address">' + self.escapeHtml(emp.address || '') + '</textarea>' +
      '</div>' +
      '</div>' +

      '<div class="fury-modal-section" style="margin-bottom: 24px;">' +
      '<div class="fury-modal-section-title" style="font-size: 14px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; border-bottom: 1px solid #374151; padding-bottom: 8px;">Banking</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">IBAN</label>' +
      '<input type="text" class="fury-input" id="team-f-iban" value="' + self.escapeHtml(emp.iban || '') + '" />' +
      '</div>' +
      '<div class="fury-form-row fury-mt-2">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">SWIFT</label>' +
      '<input type="text" class="fury-input" id="team-f-swift" value="' + self.escapeHtml(emp.swift || 'UNJSUAUKXXX') + '" />' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Bank Name</label>' +
      '<input type="text" class="fury-input" id="team-f-bank" value="' + self.escapeHtml(emp.bank_name || 'JSC UNIVERSAL BANK, KYIV, UKRAINE') + '" />' +
      '</div>' +
      '</div>' +
      '<div class="fury-form-group fury-mt-2">' +
      '<label class="fury-label">Receiver Name</label>' +
      '<input type="text" class="fury-input" id="team-f-receiver" value="' + self.escapeHtml(emp.receiver_name || '') + '" />' +
      '</div>' +
      '</div>' +

      '<div class="fury-modal-section">' +
      '<div class="fury-modal-section-title" style="font-size: 14px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; border-bottom: 1px solid #374151; padding-bottom: 8px;">Contract & Rate</div>' +
      '<div class="fury-form-row">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Rate (USD)</label>' +
      '<input type="number" class="fury-input" id="team-f-rate" step="0.01" value="' + (emp.rate_usd || '') + '" />' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Contract Type</label>' +
      '<select class="fury-select" id="team-f-contract-type">' +
      '<option value="Contractor"' + ((emp.contract_type || 'Contractor') === 'Contractor' ? ' selected' : '') + '>Contractor</option>' +
      '<option value="Full-Time"' + (emp.contract_type === 'Full-Time' ? ' selected' : '') + '>Full-Time</option>' +
      '<option value="Part-Time"' + (emp.contract_type === 'Part-Time' ? ' selected' : '') + '>Part-Time</option>' +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="fury-form-row fury-mt-2">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Employee Type</label>' +
      '<select class="fury-select" id="team-f-emp-type">' +
      '<option value="FTE"' + (emp.employee_type !== 'Hourly Contractor' ? ' selected' : '') + '>FTE</option>' +
      '<option value="Hourly Contractor"' + (emp.employee_type === 'Hourly Contractor' ? ' selected' : '') + '>Hourly Contractor</option>' +
      '</select>' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Invoice Format</label>' +
      '<select class="fury-select" id="team-f-inv-format">' +
      '<option value="WS"' + ((emp.invoice_format || 'WS') === 'WS' ? ' selected' : '') + '>WS</option>' +
      '<option value="FOP"' + (emp.invoice_format === 'FOP' ? ' selected' : '') + '>FOP</option>' +
      '<option value="CUSTOM"' + (emp.invoice_format === 'CUSTOM' ? ' selected' : '') + '>CUSTOM</option>' +
      '</select>' +
      '</div>' +
      '</div>' +
      '<div class="fury-form-row fury-mt-2">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Invoice Prefix</label>' +
      '<input type="text" class="fury-input" id="team-f-inv-prefix" value="' + self.escapeHtml(emp.invoice_prefix || 'WS-Invoice') + '" />' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Next Invoice #</label>' +
      '<input type="number" class="fury-input" id="team-f-next-inv" min="1" value="' + (emp.next_invoice_number || 1) + '" />' +
      '</div>' +
      '</div>' +
      '<div class="fury-form-group fury-mt-2">' +
      '<label class="fury-label">Service Description</label>' +
      '<input type="text" class="fury-input" id="team-f-service" value="' + self.escapeHtml(emp.service_description || 'UAV Systems Development Services') + '" />' +
      '</div>' +
      '<div class="fury-checkbox-group fury-mt-2">' +
      '<input type="checkbox" id="team-f-active" ' + (emp.is_active !== false ? 'checked' : '') + ' />' +
      '<label class="fury-checkbox-label" for="team-f-active">Active</label>' +
      '</div>' +
      '</div>' +

      '</div>' +
      '<div class="fury-modal-footer">' +
      '<button class="fury-btn fury-btn-secondary" id="team-modal-cancel">Cancel</button>' +
      '<button class="fury-btn fury-btn-primary" id="team-modal-save">' + (isNew ? 'Add' : 'Save') + '</button>' +
      '</div>';

    overlay.classList.add('active');

    // Bind modal buttons
    modal.querySelector('#team-modal-close').addEventListener('click', function () { overlay.classList.remove('active'); });
    modal.querySelector('#team-modal-cancel').addEventListener('click', function () { overlay.classList.remove('active'); });
    modal.querySelector('#team-modal-save').addEventListener('click', function () {
      self.handleEditSave(employee, container);
    });
  },

  async handleEditSave(existingEmployee, container) {
    var self = this;
    var modal = container.querySelector('#team-modal');
    var overlay = container.querySelector('#team-modal-overlay');
    if (!modal) return;

    var data = {
      pin: (modal.querySelector('#team-f-pin').value || '').trim(),
      name: (modal.querySelector('#team-f-name').value || '').trim(),
      full_name_lat: (modal.querySelector('#team-f-full-name').value || '').trim(),
      work_email: (modal.querySelector('#team-f-work-email').value || '').trim() || null,
      phone: (modal.querySelector('#team-f-phone').value || '').trim(),
      address: (modal.querySelector('#team-f-address').value || '').trim(),
      iban: (modal.querySelector('#team-f-iban').value || '').trim(),
      swift: (modal.querySelector('#team-f-swift').value || '').trim(),
      bank_name: (modal.querySelector('#team-f-bank').value || '').trim(),
      receiver_name: (modal.querySelector('#team-f-receiver').value || '').trim(),
      rate_usd: parseFloat(modal.querySelector('#team-f-rate').value) || null,
      contract_type: modal.querySelector('#team-f-contract-type').value,
      employee_type: modal.querySelector('#team-f-emp-type').value,
      invoice_format: modal.querySelector('#team-f-inv-format').value,
      invoice_prefix: (modal.querySelector('#team-f-inv-prefix').value || '').trim(),
      next_invoice_number: parseInt(modal.querySelector('#team-f-next-inv').value, 10) || 1,
      service_description: (modal.querySelector('#team-f-service').value || '').trim(),
      is_active: modal.querySelector('#team-f-active').checked
    };

    if (!data.name) {
      showToast('Name is required', 'error');
      return;
    }

    try {
      if (existingEmployee) {
        data.id = existingEmployee.id;
      }
      var result = await DB.upsertEmployee(data);
      if (result && result.error) throw new Error(result.error.message);

      showToast(existingEmployee ? 'Employee updated' : 'Employee added', 'success');
      overlay.classList.remove('active');

      // Update cache
      if (result && result.data) {
        self.updateEmployeeInCache(result.data);
      }

      self.renderEmployeeList(container);
      self.highlightSelected(container);
      if (self.selectedId) {
        self.renderDetail(container);
      }
    } catch (err) {
      showToast('Error: ' + (err.message || 'Unknown'), 'error');
    }
  },

  /* ═══════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════ */

  findEmployee(id) {
    for (var i = 0; i < this.allEmployees.length; i++) {
      if (this.allEmployees[i].id === id) return this.allEmployees[i];
    }
    return null;
  },

  getEmployeeInvoice(empId) {
    for (var i = 0; i < this.invoices.length; i++) {
      if (this.invoices[i].employee_id === empId) return this.invoices[i];
    }
    return null;
  },

  updateEmployeeInCache(updatedEmp) {
    for (var i = 0; i < this.allEmployees.length; i++) {
      if (this.allEmployees[i].id === updatedEmp.id) {
        this.allEmployees[i] = updatedEmp;
        break;
      }
    }
    this.applySearch();
  },

  getWorkingDays() {
    if (this.hoursConfig && this.hoursConfig.working_days) {
      return this.hoursConfig.working_days;
    }
    // Auto-calculate
    var days = 0;
    var daysInMonth = new Date(this.year, this.month, 0).getDate();
    for (var d = 1; d <= daysInMonth; d++) {
      var dow = new Date(this.year, this.month - 1, d).getDay();
      if (dow !== 0 && dow !== 6) days++;
    }
    return days;
  },

  calculateRegularHours() {
    if (this.hoursConfig) {
      var hpd = parseFloat(this.hoursConfig.hours_per_day) || 8;
      var adj = parseFloat(this.hoursConfig.adjustment_hours) || 0;
      return (this.hoursConfig.working_days * hpd) + adj;
    }
    return this.getWorkingDays() * 8;
  },

  _statusBadge(status) {
    var map = {
      'draft': { cls: 'fury-badge fury-badge-neutral', label: 'Draft' },
      'generated': { cls: 'fury-badge fury-badge-info', label: 'Generated' },
      'sent': { cls: 'fury-badge fury-badge-warning', label: 'Sent' },
      'paid': { cls: 'fury-badge fury-badge-success', label: 'Paid' },
    };
    var info = map[status] || map['draft'];
    return '<span class="' + info.cls + '">' + info.label + '</span>';
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};
