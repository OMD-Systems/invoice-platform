/* ═══════════════════════════════════════════════════════
   Invoices — Invoice Management Page
   Invoice Platform · OMD Systems
   List view with filtering, generation, preview & download.
   ═══════════════════════════════════════════════════════ */

const Invoices = {
  title: 'Invoices',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  statusFilter: 'all',
  employeeFilter: 'all',
  activeTab: 'invoices',
  invoices: [],
  employees: [],
  timesheetMap: {},
  timesheets: [],
  projects: [],
  billedTo: null,
  defaultTerms: '',
  exchangeRate: 42.16,
  hoursAdjustment: 0,

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  async render(container, ctx) {
    container.innerHTML = this.template();
    this.bindEvents(container, ctx);
    await this.loadData(ctx);
    await this.renderActiveTab(container);
  },

  /* ═══════════════════════════════════════════════════════
     TEMPLATE
     ═══════════════════════════════════════════════════════ */
  template: function () {
    var monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    var monthOptions = '';
    for (var m = 1; m <= 12; m++) {
      var mSel = m === this.month ? ' selected' : '';
      monthOptions += '<option value="' + m + '"' + mSel + '>' + monthNames[m - 1] + '</option>';
    }

    var yearOptions = '';
    var currentYear = new Date().getFullYear();
    for (var y = currentYear - 3; y <= currentYear + 1; y++) {
      var ySel = y === this.year ? ' selected' : '';
      yearOptions += '<option value="' + y + '"' + ySel + '>' + y + '</option>';
    }

    return (
      '<div class="invoices-page">' +

      /* ── Tabs ── */
      '<div class="fury-tabs fury-mb-3">' +
      '<button class="fury-tab' + (this.activeTab === 'invoices' ? ' active' : '') + '" data-inv-tab="invoices">All Invoices</button>' +
      '<button class="fury-tab' + (this.activeTab === 'summary' ? ' active' : '') + '" data-inv-tab="summary">Monthly Summary</button>' +
      '<button class="fury-tab' + (this.activeTab === 'settlements' ? ' active' : '') + '" data-inv-tab="settlements">Settlements</button>' +
      '</div>' +

      /* ── Tab Content Container ── */
      '<div id="inv-tab-content">' +

      /* ── Filters Row ── */
      '<div class="fury-flex-between fury-mb-3" style="flex-wrap: wrap; gap: 12px;">' +
      '<div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">' +
      '<label class="fury-text-sm" style="color: var(--fury-text-secondary); font-weight: 500;">Period:</label>' +
      '<select class="fury-select" id="inv-month" style="width: 140px;">' + monthOptions + '</select>' +
      '<select class="fury-select" id="inv-year" style="width: 100px;">' + yearOptions + '</select>' +
      '<select class="fury-select" id="inv-status" style="width: 130px;">' +
      '<option value="all"' + (this.statusFilter === 'all' ? ' selected' : '') + '>All Status</option>' +
      '<option value="draft"' + (this.statusFilter === 'draft' ? ' selected' : '') + '>Draft</option>' +
      '<option value="generated"' + (this.statusFilter === 'generated' ? ' selected' : '') + '>Generated</option>' +
      '<option value="sent"' + (this.statusFilter === 'sent' ? ' selected' : '') + '>Sent</option>' +
      '<option value="paid"' + (this.statusFilter === 'paid' ? ' selected' : '') + '>Paid</option>' +
      '</select>' +
      '<select class="fury-select" id="inv-employee" style="width: 170px;">' +
      '<option value="all">All Employees</option>' +
      '</select>' +
      '</div>' +
      '<div style="display: flex; align-items: center; gap: 8px;">' +
      (App.role === 'admin' ?
        '<button class="fury-btn fury-btn-sm" id="btn-delete-selected" disabled style="background-color: var(--fury-danger); border-color: var(--fury-danger); color: white;">' +
        'Delete Selected' +
        '</button>'
        : '') +
      '<button class="fury-btn fury-btn-primary fury-btn-sm" id="btn-generate-selected" disabled>' +
      'Generate Selected' +
      '</button>' +
      '<button class="fury-btn fury-btn-secondary fury-btn-sm" id="btn-batch-download" disabled>' +
      'Download All DOCX' +
      '</button>' +
      '</div>' +
      '</div>' +

      /* ── Invoice Table ── */
      '<div class="fury-card" style="padding: 0; overflow-x: auto;">' +
      '<table class="fury-table" id="inv-table">' +
      '<thead>' +
      '<tr>' +
      '<th style="width: 36px; text-align: center;"><input type="checkbox" id="inv-select-all" title="Select all"></th>' +
      '<th>Employee</th>' +
      '<th>Invoice #</th>' +
      '<th>Date</th>' +
      '<th style="text-align: center;">Items</th>' +
      '<th style="text-align: right;">Total</th>' +
      '<th style="text-align: center;">Status</th>' +
      '<th style="text-align: center;">Actions</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody id="inv-tbody">' +
      '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--fury-text-muted);">Loading invoices...</td></tr>' +
      '</tbody>' +
      '</table>' +
      '</div>' +

      /* ── Pending Section ── */
      '<div id="inv-pending-section" class="fury-mt-3" style="display: none;">' +
      '<h3 style="color: var(--fury-text-secondary); font-size: 14px; font-weight: 600; margin-bottom: 12px;">' +
      'Pending (no invoice this month)' +
      '</h3>' +
      '<div class="fury-card" style="padding: 0; overflow-x: auto;">' +
      '<table class="fury-table">' +
      '<thead>' +
      '<tr>' +
      '<th style="width: 36px; text-align: center;"><input type="checkbox" id="inv-select-all-pending" title="Select all pending"></th>' +
      '<th>Employee</th>' +
      '<th style="text-align: right;">Hours</th>' +
      '<th style="text-align: right;">Rate (USD)</th>' +
      '<th style="text-align: right;">Est. Amount</th>' +
      '<th style="text-align: center;">Action</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody id="inv-pending-tbody"></tbody>' +
      '</table>' +
      '</div>' +
      '</div>' +

      '</div>' + /* inv-tab-content */

      '</div>'
    );
  },

  /* ═══════════════════════════════════════════════════════
     LOAD DATA
     ═══════════════════════════════════════════════════════ */
  async loadData(ctx) {
    try {
      var role = ctx.role || App.role;
      var user = ctx.user || App.user;

      // Load employees (filtered for leads)
      var empResult;
      if (role === 'admin') {
        empResult = await DB.getEmployees();
      } else {
        empResult = await DB.getTeamEmployees(user.email);
      }
      this.employees = (empResult && empResult.data) ? empResult.data : [];

      // Load invoices for selected month/year
      var invFilters = { month: this.month, year: this.year };
      if (this.statusFilter !== 'all') {
        invFilters.status = this.statusFilter;
      }
      if (this.employeeFilter !== 'all') {
        invFilters.employee_id = this.employeeFilter;
      }
      var invResult = await DB.getInvoices(invFilters);
      this.invoices = (invResult && invResult.data) ? invResult.data : [];

      // Load timesheet summary to know hours per employee
      var tsResult = await DB.getTimesheetSummary(this.month, this.year);
      var tsSummary = (tsResult && tsResult.data) ? tsResult.data : [];
      this.timesheetMap = {};
      for (var t = 0; t < tsSummary.length; t++) {
        this.timesheetMap[tsSummary[t].employee_id] = tsSummary[t];
      }

      // Load billedTo setting
      var btResult = await DB.getSetting('billed_to');
      this.billedTo = (btResult && btResult.data) ? btResult.data : { name: '', address: '' };

      // Load default terms
      var termsResult = await DB.getSetting('invoice_terms');
      this.defaultTerms = (termsResult && termsResult.data) ? termsResult.data : 'Payment is due within 15 days of invoice date.';

      // Load timesheets + projects for Summary/Settlements tabs
      var tsFullResult = await DB.getTimesheets(this.month, this.year);
      this.timesheets = (tsFullResult && tsFullResult.data) || [];

      var projResult = await DB.getProjects();
      this.projects = (projResult && projResult.data) || [];

      // Exchange rate
      var rateResult = await DB.getSetting('uah_usd_rate');
      if (rateResult && rateResult.data) {
        var rateData = typeof rateResult.data === 'string' ? JSON.parse(rateResult.data) : rateResult.data;
        if (rateData.rate) this.exchangeRate = parseFloat(rateData.rate) || 42.16;
      }

      // Hours adjustment
      try {
        var adjResult = await DB.getSetting('working_hours_adjustment');
        if (adjResult && adjResult.data) {
          var adjData = typeof adjResult.data === 'string' ? JSON.parse(adjResult.data) : adjResult.data;
          if (adjData.subtract_hours) this.hoursAdjustment = parseInt(adjData.subtract_hours) || 0;
        }
      } catch (e) { /* default 0 */ }

      // Working hours config for the month
      try {
        var whResult = await DB.getWorkingHoursConfig(this.month, this.year);
        if (whResult && whResult.data) {
          this.workingDays = whResult.data.working_days || 21;
          this.hoursPerDay = whResult.data.hours_per_day || 8;
        } else {
          this.workingDays = 21;
          this.hoursPerDay = 8;
        }
      } catch (e) {
        this.workingDays = 21;
        this.hoursPerDay = 8;
      }

    } catch (err) {
      console.error('[Invoices] loadData error:', err);
      this.employees = [];
      this.invoices = [];
      this.timesheetMap = {};
    }
  },

  /* ═══════════════════════════════════════════════════════
     RENDER ACTIVE TAB
     ═══════════════════════════════════════════════════════ */
  async renderActiveTab(container) {
    var tabContent = container.querySelector('#inv-tab-content');
    if (!tabContent) return;

    switch (this.activeTab) {
      case 'summary':
        tabContent.innerHTML = '';
        await this._renderSummaryTab(tabContent);
        break;
      case 'settlements':
        tabContent.innerHTML = '';
        this._renderSettlementsTab(tabContent);
        break;
      default:
        // Show existing invoice content (already in template)
        this.updateTable(container);
        break;
    }
  },

  /* ═══════════════════════════════════════════════════════
     SUMMARY TAB (from reports.js)
     ═══════════════════════════════════════════════════════ */
  async _renderSummaryTab(content) {
    var self = this;
    // Use unfiltered invoices for summary (load all if currently filtered)
    var invoices = self.invoices;
    if (self.statusFilter !== 'all' || self.employeeFilter !== 'all') {
      // Fetch all invoices for accurate summary
      try {
        var allResult = await DB.getInvoices({ month: self.month, year: self.year });
        invoices = (allResult && allResult.data) || self.invoices;
      } catch (e) { /* fallback to filtered */ }
    }

    // Calculate KPIs
    var totalInvoiced = 0;
    var amounts = [];
    for (var i = 0; i < invoices.length; i++) {
      var total = parseFloat(invoices[i].total_usd) || 0;
      totalInvoiced += total;
      amounts.push(total);
    }
    var avgPerPerson = invoices.length > 0 ? totalInvoiced / invoices.length : 0;
    var highest = amounts.length > 0 ? Math.max.apply(null, amounts) : 0;
    var lowest = amounts.length > 0 ? Math.min.apply(null, amounts) : 0;

    // Count by status
    var statusCounts = { draft: 0, generated: 0, sent: 0, paid: 0 };
    for (var s = 0; s < invoices.length; s++) {
      var status = invoices[s].status || 'draft';
      if (statusCounts[status] !== undefined) statusCounts[status]++;
    }

    var kpiHtml =
      '<div class="fury-grid-4 fury-mb-3">' +
      self._kpiCard('Total Invoiced', self._formatCurrency(totalInvoiced), 'fury-kpi-accent') +
      self._kpiCard('Avg per Person', self._formatCurrency(avgPerPerson), '') +
      self._kpiCard('Highest Invoice', self._formatCurrency(highest), '') +
      self._kpiCard('Lowest Invoice', self._formatCurrency(lowest), '') +
      '</div>';

    var statusHtml =
      '<div class="fury-flex fury-gap-3 fury-mb-3">' +
      '<span class="fury-badge fury-badge-neutral">' + statusCounts.draft + ' Draft</span>' +
      '<span class="fury-badge fury-badge-info">' + statusCounts.generated + ' Generated</span>' +
      '<span class="fury-badge fury-badge-warning">' + statusCounts.sent + ' Sent</span>' +
      '<span class="fury-badge fury-badge-success">' + statusCounts.paid + ' Paid</span>' +
      '</div>';

    // Summary table
    var tableHtml =
      '<div class="fury-card" style="padding:0;overflow:hidden">' +
      '<div class="fury-card-header" style="padding:16px 24px;margin-bottom:0">' +
      '<h3 style="font-size:14px;font-weight:600;color:var(--fury-text)">Invoice Summary</h3>' +
      '<button class="fury-btn fury-btn-secondary fury-btn-sm" id="btn-export-summary">Export .xlsx</button>' +
      '</div>' +
      '<div style="overflow-x:auto"><table class="fury-table"><thead><tr>' +
      '<th style="width:40px">#</th><th>Employee</th><th>Invoice #</th><th>Date</th>' +
      '<th style="text-align:right">Subtotal ($)</th><th style="text-align:right">Discount ($)</th>' +
      '<th style="text-align:right">Total ($)</th><th style="text-align:center">Status</th>' +
      '</tr></thead><tbody>';

    if (invoices.length === 0) {
      tableHtml += '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--fury-text-muted)">No invoices for this period.</td></tr>';
    } else {
      var sorted = invoices.slice().sort(function (a, b) {
        return ((a.employees && a.employees.name) || '').localeCompare((b.employees && b.employees.name) || '');
      });
      for (var r = 0; r < sorted.length; r++) {
        var inv = sorted[r];
        var empName = (inv.employees && inv.employees.name) || 'Unknown';
        var prefix = (inv.employees && inv.employees.invoice_prefix) || '';
        var invNum = prefix ? prefix + '-' + inv.invoice_number : String(inv.invoice_number);
        var subtotal = parseFloat(inv.subtotal_usd) || 0;
        var discount = parseFloat(inv.discount_usd) || 0;
        var invTotal = parseFloat(inv.total_usd) || 0;

        tableHtml +=
          '<tr><td style="color:var(--fury-text-muted)">' + (r + 1) + '</td>' +
          '<td style="font-weight:500">' + self._escHtml(empName) + '</td>' +
          '<td><span class="fury-badge fury-badge-info">' + self._escHtml(invNum) + '</span></td>' +
          '<td style="color:var(--fury-text-secondary)">' + self._escHtml(inv.invoice_date ? self._formatDate(inv.invoice_date) : '') + '</td>' +
          '<td style="text-align:right;font-variant-numeric:tabular-nums">' + self._formatCurrency(subtotal) + '</td>' +
          '<td style="text-align:right;color:var(--fury-text-secondary)">' + (discount > 0 ? '-' + self._formatCurrency(discount) : '$0.00') + '</td>' +
          '<td style="text-align:right;font-weight:600">' + self._formatCurrency(invTotal) + '</td>' +
          '<td style="text-align:center">' + self._statusBadgeHtml(inv.status || 'draft') + '</td></tr>';
      }
      // Grand total
      tableHtml +=
        '<tr style="background:var(--fury-bg);border-top:2px solid var(--fury-accent)">' +
        '<td colspan="4" style="font-weight:700;color:var(--fury-accent)">GRAND TOTAL</td>' +
        '<td style="text-align:right;font-weight:600">' +
        self._formatCurrency(invoices.reduce(function (s, inv) { return s + (parseFloat(inv.subtotal_usd) || 0); }, 0)) + '</td>' +
        '<td style="text-align:right;color:var(--fury-text-secondary)">-' +
        self._formatCurrency(invoices.reduce(function (s, inv) { return s + (parseFloat(inv.discount_usd) || 0); }, 0)) + '</td>' +
        '<td style="text-align:right;font-weight:700;color:var(--fury-accent);font-size:15px">' +
        self._formatCurrency(totalInvoiced) + '</td><td></td></tr>';
    }
    tableHtml += '</tbody></table></div></div>';

    content.innerHTML = kpiHtml + statusHtml + tableHtml;

    // Bind export
    var exportBtn = content.querySelector('#btn-export-summary');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        self._exportSummaryXlsx();
      });
    }
  },

  /* ═══════════════════════════════════════════════════════
     SETTLEMENTS TAB (from reports.js)
     ═══════════════════════════════════════════════════════ */
  async _renderSettlementsTab(content) {
    var self = this;
    content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--fury-text-muted)">Calculating settlements...</div>';

    try {
      if (typeof Settlements === 'undefined') {
        content.innerHTML = '<div class="fury-card" style="padding:24px;text-align:center;color:var(--fury-text-muted)">Settlements module not available.</div>';
        return;
      }

      var expectedHours = (self.workingDays || 21) * (self.hoursPerDay || 8);
      var settlementData = await Settlements.calculate(
        self.month, self.year, self.employees, self.timesheets, self.invoices, expectedHours
      );

      var activeProjectCodes = Settlements.getActiveProjectCodes(settlementData);
      var companies = Settlements.getActiveCompanies(settlementData);
      var detailed = Settlements.formatForDetailedTable(settlementData, activeProjectCodes, companies);
      var rows = detailed.rows;
      var companyTotals = detailed.companyTotals;
      var grandTotal = detailed.grandTotal;

      // Build table
      var projHeaders = '';
      for (var phi = 0; phi < activeProjectCodes.length; phi++) {
        projHeaders += '<th style="text-align:right;font-size:10px">' + activeProjectCodes[phi] + '</th>';
      }
      var compHeaders = '';
      for (var chi = 0; chi < companies.length; chi++) {
        compHeaders += '<th style="text-align:right;font-size:10px;background:rgba(0,212,255,0.05)">' +
          self._escHtml(Settlements.getCompanyLabel(companies[chi])) + '</th>';
      }

      // Mapping chips
      var chips = Settlements.getMappingChips();
      var chipsHtml = '<div class="fury-card fury-mb-3" style="padding:16px">' +
        '<h3 style="font-size:14px;font-weight:600;margin-bottom:8px">Project-to-Company Mapping</h3>' +
        '<div class="fury-flex fury-gap-3" style="flex-wrap:wrap">';
      for (var ci = 0; ci < chips.length; ci++) {
        var chip = chips[ci];
        var bgC = chip.company === 'WS' ? 'rgba(0,212,255,0.1)' : chip.company === 'OMD' ? 'rgba(245,158,11,0.1)' : 'rgba(139,92,246,0.1)';
        var txC = chip.company === 'WS' ? 'var(--fury-accent)' : chip.company === 'OMD' ? 'var(--fury-warning)' : '#A78BFA';
        chipsHtml += '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;border-radius:var(--fury-radius-full);font-size:12px;font-weight:500;background:' + bgC + ';color:' + txC + '">' + chip.code + ' &rarr; ' + self._escHtml(chip.label) + '</span>';
      }
      chipsHtml += '</div></div>';

      var tableHtml =
        '<div class="fury-card" style="padding:0;overflow:hidden">' +
        '<div class="fury-card-header" style="padding:16px 24px;margin-bottom:0">' +
        '<h3 style="font-size:14px;font-weight:600">Cost Allocation</h3>' +
        '<button class="fury-btn fury-btn-secondary fury-btn-sm" id="btn-export-settlements">Export .xlsx</button>' +
        '</div>' +
        '<div style="overflow-x:auto"><table class="fury-table" style="font-size:13px"><thead><tr>' +
        '<th>Employee</th><th style="text-align:right">Total Paid</th><th style="text-align:right">Hours</th>' +
        projHeaders + compHeaders +
        '</tr></thead><tbody>';

      if (rows.length === 0) {
        tableHtml += '<tr><td colspan="' + (3 + activeProjectCodes.length + companies.length) + '" style="text-align:center;padding:40px;color:var(--fury-text-muted)">No data for this period.</td></tr>';
      } else {
        for (var ri = 0; ri < rows.length; ri++) {
          var row = rows[ri];
          var projCells = '';
          for (var pci = 0; pci < activeProjectCodes.length; pci++) {
            var alloc = row.projectAllocations[activeProjectCodes[pci]];
            projCells += '<td style="text-align:right;font-variant-numeric:tabular-nums">' +
              (alloc.cost > 0 ? self._formatCurrency(alloc.cost) : '<span style="color:var(--fury-text-muted)">-</span>') + '</td>';
          }
          var compCells = '';
          for (var cci = 0; cci < companies.length; cci++) {
            var cc = row.companyAllocations[companies[cci]] || 0;
            compCells += '<td style="text-align:right;font-weight:600;background:rgba(0,212,255,0.03)">' +
              (cc > 0 ? self._formatCurrency(cc) : '-') + '</td>';
          }
          tableHtml += '<tr><td style="font-weight:500">' + self._escHtml(row.employee.name) + '</td>' +
            '<td style="text-align:right;font-weight:600">' + self._formatCurrency(row.totalPaid) + '</td>' +
            '<td style="text-align:right;color:var(--fury-text-secondary)">' + row.totalHours.toFixed(1) + '</td>' +
            projCells + compCells + '</tr>';
        }
        // Total row
        var ptCells = '';
        for (var ptci = 0; ptci < activeProjectCodes.length; ptci++) {
          ptCells += '<td style="text-align:right;font-weight:700;color:var(--fury-accent)">' +
            self._formatCurrency(detailed.projectTotals[activeProjectCodes[ptci]] || 0) + '</td>';
        }
        var ctCells = '';
        for (var ctci = 0; ctci < companies.length; ctci++) {
          ctCells += '<td style="text-align:right;font-weight:700;color:var(--fury-accent);background:rgba(0,212,255,0.05)">' +
            self._formatCurrency(companyTotals[companies[ctci]] || 0) + '</td>';
        }
        tableHtml += '<tr style="background:var(--fury-bg);border-top:2px solid var(--fury-accent)">' +
          '<td style="font-weight:700;color:var(--fury-accent)">TOTAL</td>' +
          '<td style="text-align:right;font-weight:700;color:var(--fury-accent)">' + self._formatCurrency(grandTotal) + '</td>' +
          '<td></td>' + ptCells + ctCells + '</tr>';
      }
      tableHtml += '</tbody></table></div></div>';

      // Settlement cards
      var cardsHtml = '';
      if (rows.length > 0 && companies.length > 1) {
        cardsHtml = '<div class="fury-grid-' + Math.min(companies.length, 4) + ' fury-mt-3">';
        for (var sci = 0; sci < companies.length; sci++) {
          var cCode = companies[sci];
          var cLabel = Settlements.getCompanyLabel(cCode);
          var cTotal = companyTotals[cCode] || 0;
          var cPct = grandTotal > 0 ? ((cTotal / grandTotal) * 100).toFixed(1) : '0.0';
          cardsHtml += '<div class="fury-card"><h4 style="font-size:12px;font-weight:600;text-transform:uppercase;color:var(--fury-text-secondary);margin-bottom:8px">' +
            self._escHtml(cLabel) + '</h4><div class="fury-kpi-value" style="font-size:24px;margin-bottom:4px">' + self._formatCurrency(cTotal) + '</div>' +
            '<div style="font-size:12px;color:var(--fury-text-muted)">' + cPct + '% of total</div></div>';
        }
        cardsHtml += '</div>';

        // Net settlement
        cardsHtml += '<div class="fury-card fury-mt-3"><h3 style="font-size:14px;font-weight:600;margin-bottom:12px">Inter-Company Settlement</h3>' +
          '<div class="fury-grid-' + Math.min(companies.length - 1, 3) + '">';
        for (var nsi = 0; nsi < companies.length; nsi++) {
          if (companies[nsi] === 'WS') continue;
          cardsHtml += '<div style="padding:16px;border:1px solid var(--fury-border);border-radius:var(--fury-radius);background:var(--fury-elevated)">' +
            '<div style="font-size:12px;color:var(--fury-text-secondary);margin-bottom:4px">' + self._escHtml(Settlements.getCompanyLabel(companies[nsi])) + ' owes WS</div>' +
            '<div style="font-size:22px;font-weight:700;color:var(--fury-success)">' + self._formatCurrency(companyTotals[companies[nsi]] || 0) + '</div></div>';
        }
        cardsHtml += '</div></div>';
      }

      content.innerHTML = chipsHtml + tableHtml + cardsHtml;

      // Export button
      var expBtn = content.querySelector('#btn-export-settlements');
      if (expBtn) {
        expBtn.addEventListener('click', function () {
          self._exportSettlementsXlsx(detailed, activeProjectCodes, companies);
        });
      }
    } catch (err) {
      console.error('[Invoices] settlements error:', err);
      content.innerHTML = '<div class="fury-card" style="padding:24px;text-align:center;color:var(--fury-danger)">Failed to load settlements. Please try again.</div>';
    }
  },

  /* ── Summary/Settlements helpers ── */
  _kpiCard(label, value, extraClass) {
    return '<div class="fury-kpi ' + (extraClass || '') + '"><span class="fury-kpi-value">' + value + '</span><span class="fury-kpi-label">' + label + '</span></div>';
  },
  _formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return '$0.00';
    return '$' + Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },
  _escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  },
  _statusBadgeHtml(status) {
    var m = { draft: 'neutral', generated: 'info', sent: 'warning', paid: 'success' };
    var l = { draft: 'Draft', generated: 'Generated', sent: 'Sent', paid: 'Paid' };
    return '<span class="fury-badge fury-badge-' + (m[status] || 'neutral') + '">' + (l[status] || 'Draft') + '</span>';
  },
  _exportSummaryXlsx() {
    var self = this;
    if (typeof XLSX === 'undefined') { showToast('XLSX library not loaded', 'error'); return; }
    if (self.invoices.length === 0) { showToast('No data to export', 'error'); return; }
    try {
      var header = ['#', 'Employee', 'Invoice #', 'Date', 'Subtotal ($)', 'Discount ($)', 'Total ($)', 'Status'];
      var wsData = [header];
      var sorted = self.invoices.slice().sort(function (a, b) {
        return ((a.employees && a.employees.name) || '').localeCompare((b.employees && b.employees.name) || '');
      });
      var gt = 0;
      for (var i = 0; i < sorted.length; i++) {
        var inv = sorted[i];
        var t = parseFloat(inv.total_usd) || 0; gt += t;
        var prefix = (inv.employees && inv.employees.invoice_prefix) || '';
        var invNum = prefix ? prefix + '-' + inv.invoice_number : String(inv.invoice_number);
        wsData.push([i + 1, (inv.employees && inv.employees.name) || '', invNum,
        inv.invoice_date || '', parseFloat(inv.subtotal_usd) || 0, parseFloat(inv.discount_usd) || 0, t, (inv.status || 'draft')]);
      }
      wsData.push([]); wsData.push(['', 'GRAND TOTAL', '', '', '', '', gt, '']);
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, self.MONTH_NAMES[self.month - 1] + ' ' + self.year);
      XLSX.writeFile(wb, 'Invoice_Summary_' + self.year + '-' + String(self.month).padStart(2, '0') + '.xlsx');
      showToast('Exported!', 'success');
    } catch (err) { console.error('[Invoices] export error:', err); showToast('Export failed. Please try again.', 'error'); }
  },
  MONTH_NAMES: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  _exportSettlementsXlsx(detailed, activeCodes, companies) {
    if (typeof XLSX === 'undefined' || typeof Settlements === 'undefined') return;
    try {
      var exp = Settlements.formatForExport(detailed, activeCodes, companies);
      var wsData = [exp.header]; for (var i = 0; i < exp.dataRows.length; i++) wsData.push(exp.dataRows[i]);
      wsData.push([]); wsData.push(exp.totalRow);
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(wsData), 'Settlements');
      XLSX.writeFile(wb, 'Settlements_' + this.year + '-' + String(this.month).padStart(2, '0') + '.xlsx');
      showToast('Exported!', 'success');
    } catch (err) { console.error('[Invoices] settlements export error:', err); showToast('Export failed. Please try again.', 'error'); }
  },

  /* ═══════════════════════════════════════════════════════
     UPDATE TABLE
     ═══════════════════════════════════════════════════════ */
  updateTable: function (container) {
    this._populateEmployeeFilter(container);
    this._renderInvoiceRows(container);
    this._renderPendingRows(container);
    this._updateBatchButtons(container);
  },

  /* ── Populate Employee Filter Dropdown ── */
  _populateEmployeeFilter: function (container) {
    var select = container.querySelector('#inv-employee');
    if (!select) return;

    // Preserve current value
    var currentVal = this.employeeFilter;
    var html = '<option value="all">All Employees</option>';
    for (var i = 0; i < this.employees.length; i++) {
      var emp = this.employees[i];
      var name = emp.full_name_lat || emp.name || emp.email || 'Unknown';
      var sel = emp.id === currentVal ? ' selected' : '';
      html += '<option value="' + emp.id + '"' + sel + '>' + this._escapeHtml(name) + '</option>';
    }
    select.innerHTML = html;
  },

  /* ── Render Invoice Rows ── */
  _renderInvoiceRows: function (container) {
    var tbody = container.querySelector('#inv-tbody');
    if (!tbody) return;

    if (this.invoices.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--fury-text-muted);">' +
        'No invoices found for the selected period.' +
        '</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < this.invoices.length; i++) {
      var inv = this.invoices[i];
      var emp = inv.employees || {};
      var empName = emp.full_name_lat || emp.name || 'Unknown';
      var items = inv.invoice_items || [];
      var itemCount = items.length;
      var total = inv.total_usd != null ? inv.total_usd : (inv.total != null ? inv.total : 0);
      var invNumber = inv.invoice_number || '—';
      var invDate = inv.invoice_date ? this._formatDate(inv.invoice_date) : '—';
      var status = inv.status || 'draft';

      html +=
        '<tr data-invoice-id="' + inv.id + '">' +
        '<td style="text-align: center;">' +
        '<input type="checkbox" class="inv-row-check" data-invoice-id="' + inv.id + '">' +
        '</td>' +
        '<td>' + this._escapeHtml(empName) + '</td>' +
        '<td style="font-variant-numeric: tabular-nums;">' + this._escapeHtml(invNumber) + '</td>' +
        '<td>' + invDate + '</td>' +
        '<td style="text-align: center;">' + itemCount + '</td>' +
        '<td style="text-align: right; font-weight: 600; font-variant-numeric: tabular-nums;">' +
        this._formatCurrency(total) +
        '</td>' +
        '<td style="text-align: center;">' + this._statusBadge(status) + '</td>' +
        '<td style="text-align: center; white-space: nowrap;">' +
        '<div style="display: inline-flex; gap: 4px;">' +
        '<button class="fury-btn fury-btn-ghost fury-btn-sm fury-btn-icon inv-act-preview" ' +
        'data-invoice-id="' + inv.id + '" title="Preview">' +
        '&#x1F441;' +
        '</button>' +
        '<button class="fury-btn fury-btn-ghost fury-btn-sm fury-btn-icon inv-act-download" ' +
        'data-invoice-id="' + inv.id + '" title="Save PDF">' +
        '&#x2B07;' +
        '</button>' +
        '<select class="fury-select inv-act-status" ' +
        'data-invoice-id="' + inv.id + '" ' +
        'style="width: 110px; height: 31px; font-size: 12px;">' +
        '<option value="draft"' + (status === 'draft' ? ' selected' : '') + '>Draft</option>' +
        '<option value="generated"' + (status === 'generated' ? ' selected' : '') + '>Generated</option>' +
        '<option value="sent"' + (status === 'sent' ? ' selected' : '') + '>Sent</option>' +
        '<option value="paid"' + (status === 'paid' ? ' selected' : '') + '>Paid</option>' +
        '</select>' +
        (App.role === 'admin' ?
          '<button class="fury-btn fury-btn-ghost fury-btn-sm fury-btn-icon inv-act-delete" ' +
          'data-invoice-id="' + inv.id + '" title="Delete Invoice" style="color:var(--fury-danger)">' +
          '&#x1F5D1;' +
          '</button>'
          : '') +
        '</div>' +
        '</td>' +
        '</tr>';
    }

    tbody.innerHTML = html;
  },

  /* ── Render Pending Rows (employees without invoices) ── */
  _renderPendingRows: function (container) {
    var section = container.querySelector('#inv-pending-section');
    var tbody = container.querySelector('#inv-pending-tbody');
    if (!section || !tbody) return;

    // Build a set of employee IDs that already have invoices this period
    var invoicedIds = {};
    for (var i = 0; i < this.invoices.length; i++) {
      invoicedIds[this.invoices[i].employee_id] = true;
    }

    // Filter employees: not invoiced, optionally matching employee filter
    var pending = [];
    for (var e = 0; e < this.employees.length; e++) {
      var emp = this.employees[e];
      if (invoicedIds[emp.id]) continue;
      if (this.employeeFilter !== 'all' && emp.id !== this.employeeFilter) continue;
      pending.push(emp);
    }

    if (pending.length === 0) {
      section.style.display = 'none';
      return;
    }

    section.style.display = '';
    var html = '';
    for (var p = 0; p < pending.length; p++) {
      var pe = pending[p];
      var name = pe.full_name_lat || pe.name || pe.email || 'Unknown';
      var ts = this.timesheetMap[pe.id];
      var hours = ts ? ts.total_hours : 0;
      var rate = pe.rate_usd || pe.hourly_rate || 0;
      var empType = pe.employee_type || 'monthly';
      var estAmount = 0;
      if (empType === 'hourly' || empType === 'Hourly Contractor') {
        estAmount = hours * rate;
      } else {
        var expectedHours = (this.workingDays || 21) * (this.hoursPerDay || 8);
        if (ts && expectedHours > 0) {
          estAmount = rate * (hours / expectedHours);
        } else {
          estAmount = rate;
        }
      }

      html +=
        '<tr data-employee-id="' + pe.id + '">' +
        '<td style="text-align: center;">' +
        '<input type="checkbox" class="inv-pending-check" data-employee-id="' + pe.id + '">' +
        '</td>' +
        '<td>' + this._escapeHtml(name) + '</td>' +
        '<td style="text-align: right; font-variant-numeric: tabular-nums;">' + hours.toFixed(1) + '</td>' +
        '<td style="text-align: right; font-variant-numeric: tabular-nums;">' + this._formatCurrency(rate) + '</td>' +
        '<td style="text-align: right; font-weight: 600; font-variant-numeric: tabular-nums;">' +
        this._formatCurrency(estAmount) +
        '</td>' +
        '<td style="text-align: center;">' +
        '<button class="fury-btn fury-btn-primary fury-btn-sm inv-act-generate" ' +
        'data-employee-id="' + pe.id + '" ' +
        'data-employee-name="' + this._escapeAttr(name) + '">' +
        'Generate' +
        '</button>' +
        '</td>' +
        '</tr>';
    }

    tbody.innerHTML = html;
  },

  /* ── Update batch action button states ── */
  _updateBatchButtons: function (container) {
    var genBtn = container.querySelector('#btn-generate-selected');
    var dlBtn = container.querySelector('#btn-batch-download');
    var delSelBtn = container.querySelector('#btn-delete-selected');

    var pendingChecks = container.querySelectorAll('.inv-pending-check:checked');
    if (genBtn) genBtn.disabled = pendingChecks.length === 0;

    var invChecks = container.querySelectorAll('.inv-row-check:checked');
    if (delSelBtn) delSelBtn.disabled = invChecks.length === 0;

    if (dlBtn) dlBtn.disabled = this.invoices.length === 0;
  },

  /* ═══════════════════════════════════════════════════════
     BIND EVENTS
     ═══════════════════════════════════════════════════════ */
  bindEvents: function (container, ctx) {
    var self = this;

    // ── Tab switching ──
    var tabs = container.querySelectorAll('.fury-tab[data-inv-tab]');
    for (var ti = 0; ti < tabs.length; ti++) {
      tabs[ti].addEventListener('click', async function () {
        var clickedTab = this.getAttribute('data-inv-tab');
        if (self.activeTab === clickedTab) return;

        self.activeTab = clickedTab;
        if (clickedTab === 'invoices') {
          // Re-render entire page to restore destroyed DOM template and events
          await self.render(container, ctx);
          return;
        }

        for (var j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
        this.classList.add('active');
        await self.renderActiveTab(container);
      });
    }

    // ── Filter changes ──
    var monthSel = container.querySelector('#inv-month');
    var yearSel = container.querySelector('#inv-year');
    var statusSel = container.querySelector('#inv-status');
    var empSel = container.querySelector('#inv-employee');

    if (monthSel) {
      monthSel.addEventListener('change', function () {
        self.month = parseInt(this.value, 10);
        self._reload(container, ctx);
      });
    }
    if (yearSel) {
      yearSel.addEventListener('change', function () {
        self.year = parseInt(this.value, 10);
        self._reload(container, ctx);
      });
    }
    if (statusSel) {
      statusSel.addEventListener('change', function () {
        self.statusFilter = this.value;
        self._reload(container, ctx);
      });
    }
    if (empSel) {
      empSel.addEventListener('change', function () {
        self.employeeFilter = this.value;
        self._reload(container, ctx);
      });
    }

    // ── Select all (invoices) ──
    var selectAll = container.querySelector('#inv-select-all');
    if (selectAll) {
      selectAll.addEventListener('change', function () {
        var checks = container.querySelectorAll('.inv-row-check');
        for (var i = 0; i < checks.length; i++) {
          checks[i].checked = this.checked;
        }
        self._updateBatchButtons(container);
      });
    }

    // ── Select all (pending) ──
    var selectAllPending = container.querySelector('#inv-select-all-pending');
    if (selectAllPending) {
      selectAllPending.addEventListener('change', function () {
        var checks = container.querySelectorAll('.inv-pending-check');
        for (var i = 0; i < checks.length; i++) {
          checks[i].checked = this.checked;
        }
        self._updateBatchButtons(container);
      });
    }

    // Individual checkboxes
    container.addEventListener('change', function (e) {
      if (e.target.classList.contains('inv-row-check') || e.target.classList.contains('inv-pending-check')) {
        self._updateBatchButtons(container);
      }
    });

    // ── Generate Selected ──
    var genBtn = container.querySelector('#btn-generate-selected');
    if (genBtn) {
      genBtn.addEventListener('click', function () {
        self._handleGenerateSelected(container, ctx);
      });
    }

    // ── Batch Download ──
    var dlBtn = container.querySelector('#btn-batch-download');
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        self._handleBatchDownload(container, ctx);
      });
    }

    // ── Bulk Delete ──
    var delSelBtn = container.querySelector('#btn-delete-selected');
    if (delSelBtn) {
      delSelBtn.addEventListener('click', function () {
        self._handleDeleteSelected(container, ctx);
      });
    }

    // ── Invoice row actions (Delegated) ──
    var tbody = container.querySelector('#inv-tbody');
    console.log('[Invoices] binding tbody click handler, tbody found:', !!tbody, 'App.role:', App.role);
    if (tbody) {
      tbody.addEventListener('click', async function (e) {
        console.log('[Invoices] tbody click, target:', e.target.tagName, e.target.className);
        // Preview
        var btnPreview = e.target.closest('.inv-act-preview');
        if (btnPreview) {
          var id = btnPreview.getAttribute('data-invoice-id');
          await self._handlePreview(id);
          return;
        }

        // Download
        var btnDl = e.target.closest('.inv-act-download');
        if (btnDl) {
          var did = btnDl.getAttribute('data-invoice-id');
          await self._handleDownload(did);
          return;
        }

        // Delete
        var btnDel = e.target.closest('.inv-act-delete');
        if (btnDel) {
          var delId = btnDel.getAttribute('data-invoice-id');
          console.log('[Invoices] delete clicked, id:', delId);
          if (!delId) { console.error('[Invoices] no invoice id on button'); return; }
          var confirmed = confirm('Are you sure you want to permanently delete this invoice?');
          console.log('[Invoices] confirm result:', confirmed);
          if (confirmed) {
            var btnOriginalHtml = btnDel.innerHTML;
            btnDel.innerHTML = '...';
            btnDel.disabled = true;
            try {
              console.log('[Invoices] calling DB.deleteInvoice...');
              var result = await DB.deleteInvoice(delId);
              console.log('[Invoices] delete result:', JSON.stringify(result));
              if (result && result.error) throw new Error(result.error.message);
              showToast('Invoice deleted', 'success');
              await self._reload(container, ctx);
            } catch (err) {
              console.error('[Invoices] delete error:', err);
              showToast('Failed to delete: ' + err.message, 'error');
              btnDel.innerHTML = btnOriginalHtml;
              btnDel.disabled = false;
            }
          }
          return;
        }
      });

      // Status change (select)
      tbody.addEventListener('change', function (e) {
        var target = e.target.closest('.inv-act-status');
        if (target) {
          var invIdStatus = target.getAttribute('data-invoice-id');
          var newStatus = target.value;
          self._handleStatusChange(invIdStatus, newStatus, container, ctx);
        }
      });
    }

    // ── Delegated clicks on pending table ──
    var pendingTbody = container.querySelector('#inv-pending-tbody');
    if (pendingTbody) {
      pendingTbody.addEventListener('click', function (e) {
        var genBtn = e.target.closest('.inv-act-generate');
        if (genBtn) {
          var empId = genBtn.getAttribute('data-employee-id');
          var empName = genBtn.getAttribute('data-employee-name');
          self._handleGenerate(empId, empName, container, ctx);
        }
      });
    }
  },

  /* ═══════════════════════════════════════════════════════
     RELOAD DATA
     ═══════════════════════════════════════════════════════ */
  async _reload(container, ctx) {
    var tbody = container.querySelector('#inv-tbody');
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--fury-text-muted);">' +
        'Loading invoices...</td></tr>';
    }
    var pendingSection = container.querySelector('#inv-pending-section');
    if (pendingSection) pendingSection.style.display = 'none';

    await this.loadData(ctx);
    await this.renderActiveTab(container);
  },

  /* ═══════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════ */

  /* ── Preview an invoice ── */
  _handlePreview: function (invoiceId) {
    var inv = this._findInvoice(invoiceId);
    if (!inv) {
      showToast('Invoice not found', 'error');
      return;
    }

    var previewData = this._buildPreviewData(inv);
    InvoicePreview.show(previewData);
  },

  /* ── Download PDF for a single invoice (via print dialog) ── */
  _handleDownload: function (invoiceId) {
    var inv = this._findInvoice(invoiceId);
    if (!inv) {
      showToast('Invoice not found', 'error');
      return;
    }

    var previewData = this._buildPreviewData(inv);
    InvoicePreview.show(previewData);
    // Auto-trigger print for PDF save
    setTimeout(function () {
      var previewOverlay = document.querySelector('.invoice-preview-overlay');
      if (previewOverlay && typeof InvoicePreview._printInvoice === 'function') {
        InvoicePreview._printInvoice(previewOverlay);
      }
    }, 300);
  },

  /* ── Status change ── */
  async _handleStatusChange(invoiceId, newStatus, container, ctx) {
    var target = container.querySelector('.inv-act-status[data-invoice-id="' + invoiceId + '"]');
    if (target) target.disabled = true;
    try {
      var result = await DB.updateInvoiceStatus(invoiceId, newStatus);
      if (!result || result.error) {
        console.error('[Invoices] Status change error:', result.error);
        showToast('Failed to update status. Please try again.', 'error');
        return;
      }
      // Update local data
      for (var i = 0; i < this.invoices.length; i++) {
        if (this.invoices[i].id === invoiceId) {
          this.invoices[i].status = newStatus;
          break;
        }
      }
      this.updateTable(container);
    } catch (err) {
      console.error('[Invoices] Status change error:', err);
      showToast('Failed to update status. Please try again.', 'error');
    } finally {
      if (target) target.disabled = false;
    }
  },

  /* ── Generate invoice for a single employee ── */
  async _handleGenerate(employeeId, employeeName, container, ctx) {
    var emp = this._findEmployee(employeeId);
    if (!emp) {
      showToast('Employee not found', 'error');
      return;
    }
    this.showGenerateModal(emp, container, ctx);
  },

  /* ── Generate for selected pending employees ── */
  async _handleGenerateSelected(container, ctx) {
    var checks = container.querySelectorAll('.inv-pending-check:checked');
    if (checks.length === 0) {
      showToast('Please select at least one pending employee', 'error');
      return;
    }

    var ids = [];
    for (var i = 0; i < checks.length; i++) {
      ids.push(checks[i].getAttribute('data-employee-id'));
    }

    if (!confirm('Generate invoices for ' + ids.length + ' employee(s)?')) return;

    var btn = container.querySelector('#btn-generate-selected');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generating...';
    }

    var errors = [];
    for (var j = 0; j < ids.length; j++) {
      var emp = this._findEmployee(ids[j]);
      if (!emp) continue;
      try {
        await this._autoGenerateInvoice(emp, ctx);
      } catch (err) {
        var eName = emp.full_name_lat || emp.name || 'Unknown';
        errors.push(eName + ': generation failed');
      }
    }

    if (errors.length > 0) {
      showToast('Some invoices failed to generate', 'error');
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Generate Selected';
    }

    await this._reload(container, ctx);
  },

  /* ── Delete selected invoices ── */
  async _handleDeleteSelected(container, ctx) {
    if (App.role !== 'admin') return;

    var checks = container.querySelectorAll('.inv-row-check:checked');
    if (checks.length === 0) return;

    if (!confirm('Are you sure you want to permanently delete ' + checks.length + ' selected invoice(s)?')) return;

    var btn = container.querySelector('#btn-delete-selected');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Deleting...';
    }

    var errors = [];
    var deletedCount = 0;

    for (var i = 0; i < checks.length; i++) {
      var id = checks[i].getAttribute('data-invoice-id');
      try {
        var result = await DB.deleteInvoice(id);
        if (result && result.error) throw new Error(result.error.message);
        deletedCount++;
      } catch (err) {
        errors.push(id + ': deletion failed');
      }
    }

    if (errors.length > 0) {
      showToast('Some deletions failed', 'error');
    } else if (deletedCount > 0) {
      showToast(deletedCount + ' invoice(s) deleted', 'success');
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Delete Selected';
    }

    await this._reload(container, ctx);
  },

  /* ── Batch download ── */
  _handleBatchDownload: async function (container, ctx) {
    try {
      if (typeof InvoiceDocx !== 'undefined' && InvoiceDocx.downloadBatch) {
        var allData = [];
        for (var i = 0; i < this.invoices.length; i++) {
          allData.push(this._buildPreviewData(this.invoices[i]));
        }
        await InvoiceDocx.downloadBatch(allData);
      } else {
        for (var j = 0; j < this.invoices.length; j++) {
          await this._handleDownload(this.invoices[j].id);
        }
      }
    } catch (err) {
      console.error('[Invoices] batch download error:', err);
      showToast('Batch download failed. Please try again.', 'error');
    }
  },

  /* ═══════════════════════════════════════════════════════
     GENERATE MODAL
     ═══════════════════════════════════════════════════════ */
  showGenerateModal: function (employee, container, ctx) {
    var self = this;
    var empName = employee.full_name_lat || employee.name || 'Unknown';
    var rate = employee.rate_usd || employee.hourly_rate || 0;
    var ts = this.timesheetMap[employee.id];
    var hours = ts ? ts.total_hours : 0;
    var serviceDesc = employee.service_description || employee.position || 'Software Development Services';
    var empType = employee.employee_type || 'monthly';

    // Prorate math dynamically
    var estimatedAmount = 0;
    if (empType === 'hourly' || empType === 'Hourly Contractor') {
      estimatedAmount = rate * hours;
    } else {
      var expectedHours = (this.workingDays || 21) * (this.hoursPerDay || 8);
      if (ts && expectedHours > 0) {
        estimatedAmount = rate * (hours / expectedHours);
      } else {
        estimatedAmount = rate;
      }
    }

    var prefix = employee.invoice_prefix || '';
    var nextNum = employee.next_invoice_number || 1;
    var invoiceNumber = Numbering.formatNumber(prefix, nextNum);

    // Last day of selected month
    var lastDay = new Date(this.year, this.month, 0);
    var invDateStr = this._toISODate(lastDay);

    // Remove existing modal
    var existing = document.querySelector('.invoice-generate-overlay');
    if (existing) existing.remove();

    // Build modal
    var overlay = document.createElement('div');
    overlay.className = 'fury-modal-overlay invoice-generate-overlay';

    overlay.innerHTML =
      '<div class="fury-modal" style="max-width: 680px; max-height: 92vh;">' +
      '<div class="fury-modal-header">' +
      '<span class="fury-modal-title">Generate Invoice</span>' +
      '<button class="fury-modal-close" id="gen-close" title="Close">&times;</button>' +
      '</div>' +
      '<div class="fury-modal-body" style="overflow-y: auto;">' +

      /* Employee info (read-only) */
      '<div class="fury-form-group">' +
      '<label class="fury-label">Employee</label>' +
      '<input class="fury-input" type="text" value="' + this._escapeAttr(empName) + '" readonly style="opacity: 0.7;">' +
      '</div>' +

      /* Invoice Number & Date */
      '<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Invoice Number</label>' +
      '<input class="fury-input" type="text" id="gen-inv-number" value="' + this._escapeAttr(invoiceNumber) + '">' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Invoice Date</label>' +
      '<input class="fury-input" type="date" id="gen-inv-date" value="' + invDateStr + '">' +
      '</div>' +
      '</div>' +

      /* Line Items */
      '<div class="fury-form-group">' +
      '<label class="fury-label">Line Items</label>' +
      '<div id="gen-line-items">' +
      '<div class="gen-line-item" style="display: grid; grid-template-columns: 1fr 100px 60px 100px 32px; gap: 8px; align-items: center; margin-bottom: 8px;">' +
      '<input class="fury-input gen-li-desc" type="text" placeholder="Description" value="' + this._escapeAttr(serviceDesc) + '">' +
      '<input class="fury-input gen-li-price" type="number" step="0.01" placeholder="Price" value="' + estimatedAmount.toFixed(2) + '">' +
      '<input class="fury-input gen-li-qty" type="number" step="1" min="1" placeholder="QTY" value="1">' +
      '<input class="fury-input gen-li-total" type="text" readonly value="' + estimatedAmount.toFixed(2) + '" style="text-align: right; opacity: 0.7;">' +
      '<span></span>' +
      '</div>' +
      '</div>' +
      '<button class="fury-btn fury-btn-ghost fury-btn-sm" id="gen-add-item" style="margin-top: 4px;">+ Add Line Item</button>' +
      '</div>' +

      /* Expenses */
      '<div class="fury-form-group">' +
      '<label class="fury-label">Additional Expenses</label>' +
      '<div id="gen-expenses"></div>' +
      '<button class="fury-btn fury-btn-ghost fury-btn-sm" id="gen-add-expense" style="margin-top: 4px;">+ Add Expense</button>' +
      '</div>' +

      /* Totals */
      '<div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-top: 8px;">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Subtotal</label>' +
      '<input class="fury-input" type="text" id="gen-subtotal" readonly value="' + estimatedAmount.toFixed(2) + '" style="text-align: right; opacity: 0.7;">' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Discount</label>' +
      '<input class="fury-input" type="number" step="0.01" id="gen-discount" value="0">' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Tax</label>' +
      '<input class="fury-input" type="number" step="0.01" id="gen-tax" value="0">' +
      '</div>' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" style="font-size: 14px; color: var(--fury-text);">Total</label>' +
      '<input class="fury-input" type="text" id="gen-total" readonly ' +
      'value="$' + estimatedAmount.toFixed(2) + '" ' +
      'style="text-align: right; font-size: 18px; font-weight: 700; color: var(--fury-accent); opacity: 1;">' +
      '</div>' +

      '</div>' + // end modal body
      '<div class="fury-modal-footer">' +
      '<button class="fury-btn fury-btn-ghost" id="gen-cancel">Cancel</button>' +
      '<button class="fury-btn fury-btn-secondary" id="gen-preview">Preview</button>' +
      '<button class="fury-btn fury-btn-secondary" id="gen-save-draft">Save Draft</button>' +
      '<button class="fury-btn fury-btn-primary" id="gen-download">Generate &amp; Save PDF</button>' +
      '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    document.body.classList.add('fury-modal-open');
    requestAnimationFrame(function () { overlay.classList.add('active'); });

    // ── Modal event bindings ──

    // Close
    var escHandler = function (e) {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escHandler);
        closeModal();
      }
    };
    var closeModal = function () {
      document.removeEventListener('keydown', escHandler);
      document.body.classList.remove('fury-modal-open');
      overlay.classList.remove('active');
      setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 260);
    };
    document.addEventListener('keydown', escHandler);

    overlay.querySelector('#gen-close').addEventListener('click', closeModal);
    overlay.querySelector('#gen-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    // Recalculate totals on any input change
    var recalc = function () { self._recalcTotals(overlay); };

    overlay.addEventListener('input', function (e) {
      var t = e.target;
      if (t.classList.contains('gen-li-price') || t.classList.contains('gen-li-qty')) {
        // Update line item total
        var row = t.closest('.gen-line-item');
        if (row) {
          var price = parseFloat(row.querySelector('.gen-li-price').value) || 0;
          var qty = parseFloat(row.querySelector('.gen-li-qty').value) || 1;
          row.querySelector('.gen-li-total').value = (price * qty).toFixed(2);
        }
      }
      recalc();
    });

    // Add line item
    overlay.querySelector('#gen-add-item').addEventListener('click', function () {
      var itemsContainer = overlay.querySelector('#gen-line-items');
      var newItem = document.createElement('div');
      newItem.className = 'gen-line-item';
      newItem.style.cssText = 'display: grid; grid-template-columns: 1fr 100px 60px 100px 32px; gap: 8px; align-items: center; margin-bottom: 8px;';
      newItem.innerHTML =
        '<input class="fury-input gen-li-desc" type="text" placeholder="Description">' +
        '<input class="fury-input gen-li-price" type="number" step="0.01" placeholder="Price" value="0">' +
        '<input class="fury-input gen-li-qty" type="number" step="1" min="1" placeholder="QTY" value="1">' +
        '<input class="fury-input gen-li-total" type="text" readonly value="0.00" style="text-align: right; opacity: 0.7;">' +
        '<button class="fury-btn fury-btn-ghost fury-btn-sm fury-btn-icon gen-remove-item" ' +
        'style="color: var(--fury-danger); font-size: 16px;" title="Remove">&times;</button>';
      itemsContainer.appendChild(newItem);
    });

    // Remove line item (delegated)
    overlay.querySelector('#gen-line-items').addEventListener('click', function (e) {
      if (e.target.classList.contains('gen-remove-item')) {
        e.target.closest('.gen-line-item').remove();
        recalc();
      }
    });

    // Add expense
    overlay.querySelector('#gen-add-expense').addEventListener('click', function () {
      var expContainer = overlay.querySelector('#gen-expenses');
      var newExp = document.createElement('div');
      newExp.className = 'gen-expense-item';
      newExp.style.cssText = 'display: grid; grid-template-columns: 120px 1fr 80px 80px 80px 32px; gap: 8px; align-items: center; margin-bottom: 8px;';
      newExp.innerHTML =
        '<select class="fury-select gen-exp-cat" style="height: 36px;">' +
        '<option value="travel">Travel</option>' +
        '<option value="software">Software</option>' +
        '<option value="hardware">Hardware</option>' +
        '<option value="office">Office</option>' +
        '<option value="other">Other</option>' +
        '</select>' +
        '<input class="fury-input gen-exp-desc" type="text" placeholder="Description">' +
        '<input class="fury-input gen-exp-uah" type="number" step="0.01" placeholder="UAH" value="0">' +
        '<input class="fury-input gen-exp-rate" type="number" step="0.0001" placeholder="Rate" value="' + self.exchangeRate + '">' +
        '<input class="fury-input gen-exp-usd" type="text" readonly value="0.00" style="text-align: right; opacity: 0.7;">' +
        '<button class="fury-btn fury-btn-ghost fury-btn-sm fury-btn-icon gen-remove-expense" ' +
        'style="color: var(--fury-danger); font-size: 16px;" title="Remove">&times;</button>';
      expContainer.appendChild(newExp);
    });

    // Remove expense (delegated)
    overlay.querySelector('#gen-expenses').addEventListener('click', function (e) {
      if (e.target.classList.contains('gen-remove-expense')) {
        e.target.closest('.gen-expense-item').remove();
        recalc();
      }
    });

    // Expense UAH/Rate change -> auto-calc USD
    overlay.querySelector('#gen-expenses').addEventListener('input', function (e) {
      var t = e.target;
      if (t.classList.contains('gen-exp-uah') || t.classList.contains('gen-exp-rate')) {
        var row = t.closest('.gen-expense-item');
        if (row) {
          var uah = parseFloat(row.querySelector('.gen-exp-uah').value) || 0;
          var xrate = parseFloat(row.querySelector('.gen-exp-rate').value) || 1;
          row.querySelector('.gen-exp-usd').value = xrate > 0 ? (uah / xrate).toFixed(2) : '0.00';
        }
      }
      recalc();
    });

    // Preview
    overlay.querySelector('#gen-preview').addEventListener('click', function () {
      var modalData = self.collectModalData(overlay, employee);
      if (!modalData) return;
      InvoicePreview.show(modalData);
    });

    // Save Draft
    overlay.querySelector('#gen-save-draft').addEventListener('click', function () {
      self._saveInvoice(overlay, employee, 'draft', container, ctx, closeModal);
    });

    // Generate & Download DOCX
    overlay.querySelector('#gen-download').addEventListener('click', function () {
      self._saveAndDownload(overlay, employee, container, ctx, closeModal);
    });
  },

  /* ── Recalculate Totals ── */
  _recalcTotals: function (overlay) {
    var subtotal = 0;

    // Sum line items
    var liTotals = overlay.querySelectorAll('.gen-li-total');
    for (var i = 0; i < liTotals.length; i++) {
      subtotal += parseFloat(liTotals[i].value) || 0;
    }

    // Sum expenses USD
    var expUsd = overlay.querySelectorAll('.gen-exp-usd');
    for (var j = 0; j < expUsd.length; j++) {
      subtotal += parseFloat(expUsd[j].value) || 0;
    }

    var discount = parseFloat(overlay.querySelector('#gen-discount').value) || 0;
    var tax = parseFloat(overlay.querySelector('#gen-tax').value) || 0;
    var total = subtotal - discount + tax;

    overlay.querySelector('#gen-subtotal').value = subtotal.toFixed(2);
    overlay.querySelector('#gen-total').value = '$' + total.toFixed(2);
  },

  /* ── Collect Modal Data ── */
  collectModalData: function (overlay, employee) {
    var invNumber = overlay.querySelector('#gen-inv-number').value.trim();
    var invDate = overlay.querySelector('#gen-inv-date').value;
    var discount = parseFloat(overlay.querySelector('#gen-discount').value) || 0;
    var tax = parseFloat(overlay.querySelector('#gen-tax').value) || 0;

    // Validation
    if (!invNumber) {
      showToast('Invoice number is required', 'error');
      return null;
    }
    if (!invDate) {
      showToast('Invoice date is required', 'error');
      return null;
    }
    if (discount < 0) {
      showToast('Discount cannot be negative', 'error');
      return null;
    }
    if (tax < 0) {
      showToast('Tax rate cannot be negative', 'error');
      return null;
    }

    // Collect line items
    // Fields: description, price, qty, total — matches InvoiceDocx (item.price, item.qty)
    // and InvoicePreview (item.price, item.total) expected shape
    var items = [];
    var liRows = overlay.querySelectorAll('.gen-line-item');
    for (var i = 0; i < liRows.length; i++) {
      var desc = liRows[i].querySelector('.gen-li-desc').value.trim();
      var price = parseFloat(liRows[i].querySelector('.gen-li-price').value) || 0;
      var qty = parseFloat(liRows[i].querySelector('.gen-li-qty').value) || 1;
      var totalVal = parseFloat(liRows[i].querySelector('.gen-li-total').value) || 0;
      if (price < 0) {
        showToast('Line item price cannot be negative', 'error');
        return null;
      }
      if (qty <= 0) {
        showToast('Line item quantity must be positive', 'error');
        return null;
      }
      if (desc || price > 0) {
        items.push({
          description: desc || 'Service',
          price: price,
          qty: qty,
          total: totalVal
        });
      }
    }

    // Collect expenses as additional line items
    var expRows = overlay.querySelectorAll('.gen-expense-item');
    for (var j = 0; j < expRows.length; j++) {
      var cat = expRows[j].querySelector('.gen-exp-cat').value;
      var expDesc = expRows[j].querySelector('.gen-exp-desc').value.trim();
      var expUsd = parseFloat(expRows[j].querySelector('.gen-exp-usd').value) || 0;
      if (expUsd > 0) {
        items.push({
          description: 'Expense (' + cat + ')' + (expDesc ? ': ' + expDesc : ''),
          price: expUsd,
          qty: 1,
          total: expUsd
        });
      }
    }

    var subtotal = 0;
    for (var k = 0; k < items.length; k++) {
      subtotal += items[k].total;
    }

    if (discount > subtotal) {
      showToast('Discount cannot exceed subtotal', 'error');
      return null;
    }

    var total = subtotal - discount + tax;

    // Format the invoice date for display
    var dateDisplay = invDate;
    if (invDate) {
      var parts = invDate.split('-');
      if (parts.length === 3) {
        var monthNames = [
          'January', 'February', 'March', 'April', 'May', 'June',
          'July', 'August', 'September', 'October', 'November', 'December'
        ];
        dateDisplay = monthNames[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
      }
    }

    return {
      employee: {
        full_name_lat: employee.full_name_lat || employee.name || '',
        address: employee.address || '',
        phone: employee.phone || '',
        iban: employee.iban || '',
        swift: employee.swift || '',
        receiver_name: employee.receiver_name || employee.full_name_lat || '',
        bank_name: employee.bank_name || '',
        invoice_format: employee.invoice_format || 'WS',
        invoice_prefix: employee.invoice_prefix || ''
      },
      billedTo: this.billedTo || { name: '', address: '' },
      invoiceNumber: invNumber,
      invoiceDate: dateDisplay,
      invoiceDateISO: invDate,
      dueDays: 15,
      items: items,
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      taxRate: '0',
      total: total,
      terms: this.defaultTerms,
      status: 'draft'
    };
  },

  /* ── Save invoice to DB ── */
  async _saveInvoice(overlay, employee, status, container, ctx, closeCallback) {
    var data = this.collectModalData(overlay, employee);
    if (!data) return null;

    if (!data.items || data.items.length === 0) {
      showToast('At least one line item is required', 'error');
      return null;
    }

    var saveBtn = overlay.querySelector('#gen-save-draft');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      var invoicePayload = {
        employee_id: employee.id,
        invoice_number: data.invoiceNumber,
        invoice_date: data.invoiceDateISO,
        month: this.month,
        year: this.year,
        total_usd: data.total,
        subtotal_usd: data.subtotal,
        discount_usd: data.discount,
        tax_usd: data.tax,
        status: status,
        format_type: employee.invoice_format || 'standard'
      };

      var itemsPayload = data.items.map(function (item, idx) {
        return {
          item_order: idx + 1,
          description: item.description,
          price_usd: item.price,
          qty: item.qty,
          total_usd: item.total
        };
      });

      var result = await DB.createInvoice(invoicePayload, itemsPayload);
      if (!result || result.error) {
        console.error('[Invoices] Save error:', result && result.error);
        showToast('Failed to save invoice. Please try again.', 'error');
        return null;
      }

      if (closeCallback) closeCallback();
      showToast('Invoice saved!', 'success');
      await this._reload(container, ctx);
      return result.data;
    } catch (err) {
      console.error('[Invoices] Save error:', err);
      showToast('Failed to save invoice. Please try again.', 'error');
      return null;
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Draft';
      }
    }
  },

  /* ── Save and Download DOCX ── */
  async _saveAndDownload(overlay, employee, container, ctx, closeCallback) {
    var data = this.collectModalData(overlay, employee);
    if (!data) return null;

    if (!data.items || data.items.length === 0) {
      showToast('At least one line item is required', 'error');
      return null;
    }

    var dlBtn = overlay.querySelector('#gen-download');
    if (dlBtn) {
      dlBtn.disabled = true;
      dlBtn.textContent = 'Generating...';
    }

    try {
      // Fetch full employee data (with bank details) for preview/PDF
      var fullEmp = employee;
      try {
        var empResult = await DB.getEmployee(employee.id);
        if (empResult && empResult.data) fullEmp = empResult.data;
      } catch (e) { /* use cached employee as fallback */ }

      // Rebuild data.employee with full details
      data.employee = {
        full_name_lat: fullEmp.full_name_lat || fullEmp.name || '',
        address: fullEmp.address || '',
        phone: fullEmp.phone || '',
        iban: fullEmp.iban || '',
        swift: fullEmp.swift || '',
        receiver_name: fullEmp.receiver_name || fullEmp.full_name_lat || '',
        bank_name: fullEmp.bank_name || '',
        invoice_format: fullEmp.invoice_format || 'WS',
        invoice_prefix: fullEmp.invoice_prefix || ''
      };

      // Save to DB with 'generated' status
      var invoicePayload = {
        employee_id: employee.id,
        invoice_number: data.invoiceNumber,
        invoice_date: data.invoiceDateISO,
        month: this.month,
        year: this.year,
        total_usd: data.total,
        subtotal_usd: data.subtotal,
        discount_usd: data.discount,
        tax_usd: data.tax,
        status: 'generated',
        format_type: fullEmp.invoice_format || 'standard'
      };

      var itemsPayload = data.items.map(function (item, idx) {
        return {
          item_order: idx + 1,
          description: item.description,
          price_usd: item.price,
          qty: item.qty,
          total_usd: item.total
        };
      });

      var result = await DB.createInvoice(invoicePayload, itemsPayload);
      if (!result || result.error) {
        console.error('[Invoices] Generate & download save error:', result && result.error);
        showToast('Failed to save invoice. Please try again.', 'error');
        return;
      }

      // Close the generate modal
      if (closeCallback) closeCallback();

      // Show preview and auto-trigger print for PDF
      InvoicePreview.show(data);
      // Small delay to let the DOM render, then auto-print
      setTimeout(function () {
        var previewOverlay = document.querySelector('.invoice-preview-overlay');
        if (previewOverlay && typeof InvoicePreview._printInvoice === 'function') {
          InvoicePreview._printInvoice(previewOverlay);
        }
      }, 300);

      await this._reload(container, ctx);
    } catch (err) {
      console.error('[Invoices] Generate & download error:', err);
      showToast('Failed to generate invoice. Please try again.', 'error');
    } finally {
      if (dlBtn) {
        dlBtn.disabled = false;
        dlBtn.textContent = 'Generate & Save PDF';
      }
    }
  },

  /* ── Auto-generate (for batch "Generate Selected") ── */
  async _autoGenerateInvoice(employee, ctx) {
    var ts = this.timesheetMap[employee.id];
    var hours = ts ? ts.total_hours : 0;
    var rate = employee.rate_usd || employee.hourly_rate || 0;
    var empType = employee.employee_type || 'monthly';

    var amount = 0;
    if (empType === 'hourly' || empType === 'Hourly Contractor') {
      amount = rate * hours;
    } else {
      var expectedHours = (this.workingDays || 21) * (this.hoursPerDay || 8);
      if (ts && expectedHours > 0) {
        amount = rate * (hours / expectedHours);
      } else {
        amount = rate;
      }
    }
    var serviceDesc = employee.service_description || employee.position || 'Software Development Services';

    // Get next available invoice number via Numbering service (skips used numbers)
    var numInfo = await Numbering.getNextAvailableNumber(employee.id);
    var invoiceNumber = numInfo.formatted;

    // Last day of month
    var lastDay = new Date(this.year, this.month, 0);
    var invDate = this._toISODate(lastDay);

    var invoicePayload = {
      employee_id: employee.id,
      invoice_number: invoiceNumber,
      invoice_date: invDate,
      month: this.month,
      year: this.year,
      total_usd: amount,
      subtotal_usd: amount,
      discount_usd: 0,
      tax_usd: 0,
      status: 'generated',
      format_type: employee.invoice_format || 'standard'
    };

    var itemsPayload = [{
      item_order: 1,
      description: serviceDesc,
      price_usd: amount,
      qty: 1,
      total_usd: amount
    }];

    var result = await DB.createInvoice(invoicePayload, itemsPayload);
    if (!result || result.error) {
      throw new Error(result && result.error ? result.error.message : 'DB error');
    }

    return result.data;
  },

  /* ═══════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════ */

  /* ── Build preview data from an existing invoice record ── */
  /* Field mapping: DB invoice_items → preview/DOCX data object
   *   DB column         →  preview field   →  consumed by
   *   it.description    →  description     →  InvoiceDocx (item.description), InvoicePreview (item.description)
   *   it.price_usd      →  price           →  InvoiceDocx (item.price), InvoicePreview (item.price)
   *   it.qty            →  qty             →  InvoiceDocx (item.qty), InvoicePreview (item.qty)
   *   it.total_usd      →  total           →  InvoiceDocx (item.price * item.qty fallback), InvoicePreview (item.total)
   *   it.item_order     →  item_order      →  used for sorting only, not passed to services
   */
  _buildPreviewData: function (inv) {
    var emp = inv.employees || {};
    var items = (inv.invoice_items || []).map(function (it) {
      return {
        description: it.description || '',
        price: it.price_usd || 0,       // DB: price_usd → DOCX/Preview: price
        qty: it.qty || 1,
        total: it.total_usd || 0,        // DB: total_usd → DOCX/Preview: total
        item_order: it.item_order || 0   // kept for sorting, not used by services
      };
    });

    // Sort by item_order (from DB)
    items.sort(function (a, b) { return (a.item_order || 0) - (b.item_order || 0); });

    var subtotal = inv.subtotal_usd || 0;
    var discount = inv.discount_usd || 0;
    var tax = inv.tax_usd || 0;
    var total = inv.total_usd != null ? inv.total_usd : (inv.total != null ? inv.total : 0);

    // Recalculate subtotal from items if not stored
    if (!subtotal && items.length > 0) {
      subtotal = 0;
      for (var i = 0; i < items.length; i++) {
        subtotal += items[i].total;
      }
    }

    return {
      employee: {
        full_name_lat: emp.full_name_lat || emp.name || '',
        address: emp.address || '',
        phone: emp.phone || '',
        iban: emp.iban || '',
        swift: emp.swift || '',
        receiver_name: emp.receiver_name || emp.full_name_lat || '',
        bank_name: emp.bank_name || '',
        invoice_format: inv.format_type || emp.invoice_format || 'WS',
        invoice_prefix: emp.invoice_prefix || ''
      },
      billedTo: this.billedTo || { name: '', address: '' },
      invoiceNumber: inv.invoice_number || '',
      invoiceDate: inv.invoice_date ? this._formatDate(inv.invoice_date) : '',
      dueDays: 15,
      items: items,
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      taxRate: '0',
      total: total,
      terms: this.defaultTerms,
      status: inv.status || 'draft'
    };
  },

  /* ── Find an invoice by ID in local array ── */
  _findInvoice: function (id) {
    for (var i = 0; i < this.invoices.length; i++) {
      if (this.invoices[i].id === id) return this.invoices[i];
    }
    return null;
  },

  /* ── Find an employee by ID in local array ── */
  _findEmployee: function (id) {
    for (var i = 0; i < this.employees.length; i++) {
      if (this.employees[i].id === id) return this.employees[i];
    }
    return null;
  },

  /* ── Status badge HTML ── */
  _statusBadge: function (status) {
    var map = {
      'draft': { cls: 'fury-badge fury-badge-neutral', label: 'Draft' },
      'generated': { cls: 'fury-badge fury-badge-info', label: 'Generated' },
      'sent': { cls: 'fury-badge fury-badge-warning', label: 'Sent' },
      'paid': { cls: 'fury-badge fury-badge-success', label: 'Paid' },
      'overdue': { cls: 'fury-badge fury-badge-danger', label: 'Overdue' }
    };
    var info = map[status] || map['draft'];
    return '<span class="' + info.cls + '">' + info.label + '</span>';
  },

  /* ── Format currency ── */
  _formatCurrency: function (amount) {
    if (amount == null || isNaN(amount)) return '$0.00';
    return '$' + Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  },

  /* ── Format date string (YYYY-MM-DD -> "Mon DD, YYYY") ── */
  _formatDate: function (dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    var monthNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return monthNames[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  },

  /* ── Date to ISO format (YYYY-MM-DD) ── */
  _toISODate: function (date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  },

  /* ── Escape HTML ── */
  _escapeHtml: function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /* ── Escape attribute ── */
  _escapeAttr: function (str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /* ── Cleanup on page leave ── */
  destroy() {
    // Remove any generate modal overlays left in document.body
    var overlays = document.querySelectorAll('.invoice-generate-overlay, .invoice-preview-overlay');
    for (var i = 0; i < overlays.length; i++) {
      if (overlays[i].parentNode === document.body) {
        overlays[i].remove();
      }
    }
  }
};
