/* =============================================================
   Reports — Analytics & Inter-Company Settlements
   Invoice Platform · OMD Systems
   ============================================================= */

const Reports = {
  title: 'Reports',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  activeReport: 'summary',

  /* ── Cached data ── */
  employees: [],
  invoices: [],
  timesheets: [],
  projects: [],
  settings: {},
  exchangeRate: 42.16,

  /* ── Main Render ── */
  async render(container, ctx) {
    container.innerHTML = this.template();
    this.bindEvents(container, ctx);
    await this.loadData(ctx);
    this.renderActiveReport(container);
  },

  /* ── HTML Template ── */
  template() {
    var self = this;
    var monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    var monthOptions = '';
    for (var m = 1; m <= 12; m++) {
      monthOptions +=
        '<option value="' + m + '"' + (m === self.month ? ' selected' : '') + '>' +
        monthNames[m - 1] +
        '</option>';
    }

    var yearOptions = '';
    var currentYear = new Date().getFullYear();
    for (var y = currentYear - 3; y <= currentYear + 1; y++) {
      yearOptions +=
        '<option value="' + y + '"' + (y === self.year ? ' selected' : '') + '>' +
        y +
        '</option>';
    }

    return (
      '<div class="reports-page">' +

      /* ── Period Selector ── */
      '<div class="fury-flex-between fury-mb-3">' +
        '<div class="fury-flex fury-gap-3">' +
          '<select class="fury-select" id="rpt-month" style="width:auto">' + monthOptions + '</select>' +
          '<select class="fury-select" id="rpt-year" style="width:auto">' + yearOptions + '</select>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--fury-text-muted)" id="rpt-updated"></div>' +
      '</div>' +

      /* ── Report Tabs ── */
      '<div class="fury-tabs fury-mb-3">' +
        '<button class="fury-tab active" data-report="summary">Monthly Summary</button>' +
        '<button class="fury-tab" data-report="settlements">Inter-Company Settlements</button>' +
        '<button class="fury-tab" data-report="utilization">Team Utilization</button>' +
      '</div>' +

      /* ── Report Content ── */
      '<div id="report-content">' +
        '<div style="text-align:center;padding:40px;color:var(--fury-text-muted)">Loading reports...</div>' +
      '</div>' +

      '</div>'
    );
  },

  /* ── Load Data ── */
  async loadData(ctx) {
    var self = this;

    try {
      // Load employees
      var empResult = await DB.getEmployees();
      self.employees = (empResult && empResult.data) ? empResult.data : [];

      // Load projects
      var projResult = await DB.getProjects();
      self.projects = (projResult && projResult.data) ? projResult.data : [];

      // Load timesheets with project info
      var tsResult = await DB.getTimesheets(self.month, self.year);
      self.timesheets = (tsResult && tsResult.data) ? tsResult.data : [];

      // Load invoices with employee and items
      var invResult = await DB.getInvoices({
        month: self.month,
        year: self.year,
      });
      self.invoices = (invResult && invResult.data) ? invResult.data : [];

      // Load exchange rate
      var rateResult = await DB.getSetting('uah_usd_rate');
      if (rateResult && rateResult.data) {
        var rateData = typeof rateResult.data === 'string'
          ? JSON.parse(rateResult.data)
          : rateResult.data;
        if (rateData.rate) {
          self.exchangeRate = parseFloat(rateData.rate) || 42.16;
        }
      }

      // Load working hours adjustment
      self.hoursAdjustment = 0;
      try {
        var adjResult = await DB.getSetting('working_hours_adjustment');
        if (adjResult && adjResult.data) {
          var adjData = typeof adjResult.data === 'string'
            ? JSON.parse(adjResult.data)
            : adjResult.data;
          if (adjData.subtract_hours) {
            self.hoursAdjustment = parseInt(adjData.subtract_hours) || 0;
          }
        }
      } catch (e) {
        // default: no adjustment
      }

    } catch (err) {
      console.error('[Reports] loadData error:', err);
    }
  },

  /* ── Render Active Report ── */
  async renderActiveReport(container) {
    var self = this;
    var content = container.querySelector('#report-content');
    if (!content) return;

    switch (self.activeReport) {
      case 'summary':
        self.renderSummary(content);
        break;
      case 'settlements':
        await self.renderSettlements(content);
        break;
      case 'utilization':
        self.renderUtilization(content);
        break;
      default:
        self.renderSummary(content);
    }

    // Update timestamp
    var updatedEl = container.querySelector('#rpt-updated');
    if (updatedEl) {
      updatedEl.textContent = 'Updated: ' + new Date().toLocaleTimeString();
    }
  },

  /* ════════════════════════════════════════════════════════
     SUMMARY REPORT
     Monthly invoice summary with KPIs and export
     ════════════════════════════════════════════════════════ */
  renderSummary(content) {
    var self = this;
    var invoices = self.invoices;

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
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }
    }

    // KPI cards
    var kpiHtml =
      '<div class="fury-grid-4 fury-mb-3">' +
        self._kpiCard('Total Invoiced', self.formatCurrency(totalInvoiced), 'fury-kpi-accent') +
        self._kpiCard('Avg per Person', self.formatCurrency(avgPerPerson), '') +
        self._kpiCard('Highest Invoice', self.formatCurrency(highest), '') +
        self._kpiCard('Lowest Invoice', self.formatCurrency(lowest), '') +
      '</div>';

    // Status summary
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
        '<div style="overflow-x:auto">' +
        '<table class="fury-table">' +
          '<thead>' +
            '<tr>' +
              '<th style="width:40px">#</th>' +
              '<th>Employee</th>' +
              '<th>Invoice #</th>' +
              '<th>Date</th>' +
              '<th style="text-align:right">Subtotal ($)</th>' +
              '<th style="text-align:right">Discount ($)</th>' +
              '<th style="text-align:right">Total ($)</th>' +
              '<th style="text-align:center">Status</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>';

    if (invoices.length === 0) {
      tableHtml +=
        '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--fury-text-muted)">' +
        'No invoices found for this period.' +
        '</td></tr>';
    } else {
      // Sort invoices by employee name
      var sorted = invoices.slice().sort(function (a, b) {
        var nameA = (a.employees && a.employees.name) || '';
        var nameB = (b.employees && b.employees.name) || '';
        return nameA.localeCompare(nameB);
      });

      for (var r = 0; r < sorted.length; r++) {
        var inv = sorted[r];
        var empName = (inv.employees && inv.employees.name) ? inv.employees.name : 'Unknown';
        var prefix = (inv.employees && inv.employees.invoice_prefix) ? inv.employees.invoice_prefix : '';
        var invNum = prefix ? prefix + '-' + inv.invoice_number : String(inv.invoice_number);
        var invDate = inv.invoice_date || '';
        var subtotal = parseFloat(inv.subtotal_usd) || 0;
        var discount = parseFloat(inv.discount_usd) || 0;
        var invTotal = parseFloat(inv.total_usd) || 0;
        var statusBadge = self._statusBadge(inv.status || 'draft');

        tableHtml +=
          '<tr>' +
            '<td style="color:var(--fury-text-muted)">' + (r + 1) + '</td>' +
            '<td style="font-weight:500">' + self.escapeHtml(empName) + '</td>' +
            '<td><span class="fury-badge fury-badge-info">' + self.escapeHtml(invNum) + '</span></td>' +
            '<td style="color:var(--fury-text-secondary)">' + self.escapeHtml(invDate) + '</td>' +
            '<td style="text-align:right;font-variant-numeric:tabular-nums">' + self.formatCurrency(subtotal) + '</td>' +
            '<td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--fury-text-secondary)">' +
              (discount > 0 ? '-' + self.formatCurrency(discount) : '$0.00') +
            '</td>' +
            '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600">' + self.formatCurrency(invTotal) + '</td>' +
            '<td style="text-align:center">' + statusBadge + '</td>' +
          '</tr>';
      }

      // Grand total row
      tableHtml +=
        '<tr style="background:var(--fury-bg);border-top:2px solid var(--fury-accent)">' +
          '<td colspan="4" style="font-weight:700;color:var(--fury-accent)">GRAND TOTAL</td>' +
          '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600">' +
            self.formatCurrency(invoices.reduce(function (s, inv) { return s + (parseFloat(inv.subtotal_usd) || 0); }, 0)) +
          '</td>' +
          '<td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--fury-text-secondary)">' +
            '-' + self.formatCurrency(invoices.reduce(function (s, inv) { return s + (parseFloat(inv.discount_usd) || 0); }, 0)) +
          '</td>' +
          '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:var(--fury-accent);font-size:15px">' +
            self.formatCurrency(totalInvoiced) +
          '</td>' +
          '<td></td>' +
        '</tr>';
    }

    tableHtml += '</tbody></table></div></div>';

    content.innerHTML = kpiHtml + statusHtml + tableHtml;

    // Bind export button
    var exportBtn = content.querySelector('#btn-export-summary');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        self.exportSummaryXlsx();
      });
    }
  },

  /* ── Export Summary as XLSX ── */
  exportSummaryXlsx() {
    var self = this;

    if (typeof XLSX === 'undefined') {
      alert('XLSX library not loaded. Cannot export.');
      return;
    }

    if (self.invoices.length === 0) {
      if (typeof showToast === 'function') {
        showToast('No data to export.', 'error');
      } else {
        alert('No data to export.');
      }
      return;
    }

    try {
      var monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      var header = ['#', 'Employee', 'Invoice #', 'Date', 'Subtotal ($)', 'Discount ($)', 'Total ($)', 'Status'];
      var wsData = [header];

      var sorted = self.invoices.slice().sort(function (a, b) {
        var nameA = (a.employees && a.employees.name) || '';
        var nameB = (b.employees && b.employees.name) || '';
        return nameA.localeCompare(nameB);
      });

      var grandTotal = 0;
      for (var i = 0; i < sorted.length; i++) {
        var inv = sorted[i];
        var empName = (inv.employees && inv.employees.name) || 'Unknown';
        var prefix = (inv.employees && inv.employees.invoice_prefix) || '';
        var invNum = prefix ? prefix + '-' + inv.invoice_number : String(inv.invoice_number);
        var subtotal = parseFloat(inv.subtotal_usd) || 0;
        var discount = parseFloat(inv.discount_usd) || 0;
        var total = parseFloat(inv.total_usd) || 0;
        grandTotal += total;

        var statusLabel = (inv.status || 'draft').charAt(0).toUpperCase() + (inv.status || 'draft').slice(1);

        wsData.push([
          i + 1,
          empName,
          invNum,
          inv.invoice_date || '',
          subtotal,
          discount,
          total,
          statusLabel,
        ]);
      }

      // Grand total row
      wsData.push([]);
      wsData.push(['', 'GRAND TOTAL', '', '', '', '', grandTotal, '']);

      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(wsData);

      ws['!cols'] = [
        { wch: 5 },   // #
        { wch: 25 },  // Employee
        { wch: 18 },  // Invoice #
        { wch: 14 },  // Date
        { wch: 14 },  // Subtotal
        { wch: 14 },  // Discount
        { wch: 14 },  // Total
        { wch: 12 },  // Status
      ];

      var sheetName = monthNames[self.month - 1] + ' ' + self.year;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      var filename = 'Invoice_Summary_' + self.year + '-' + String(self.month).padStart(2, '0') + '.xlsx';
      XLSX.writeFile(wb, filename);

      if (typeof showToast === 'function') {
        showToast('Exported ' + filename, 'success');
      }
    } catch (err) {
      console.error('[Reports] Export error:', err);
      if (typeof showToast === 'function') {
        showToast('Export failed: ' + (err.message || 'Unknown error'), 'error');
      }
    }
  },

  /* ════════════════════════════════════════════════════════
     SETTLEMENTS REPORT
     Inter-company cost allocation based on project hours
     Uses Settlements service for calculation & formatting
     ════════════════════════════════════════════════════════ */
  async renderSettlements(content) {
    var self = this;

    // Show loading state
    content.innerHTML =
      '<div style="text-align:center;padding:40px;color:var(--fury-text-muted)">Calculating settlements...</div>';

    try {
      // ── Calculate via Settlements service ──
      var settlementData = await Settlements.calculate(
        self.month, self.year,
        self.employees, self.timesheets, self.invoices
      );

      // Verify integrity
      if (!Settlements.verify(settlementData)) {
        console.warn('[Reports] Settlement integrity check failed — displaying data with warning');
      }

      // ── Derive display parameters ──
      var activeProjectCodes = Settlements.getActiveProjectCodes(settlementData);
      var companies = Settlements.getActiveCompanies(settlementData);

      // ── Format for detailed table ──
      var detailed = Settlements.formatForDetailedTable(settlementData, activeProjectCodes, companies);

      // ── Build HTML ──
      self._renderSettlementsHtml(content, detailed, activeProjectCodes, companies);

    } catch (err) {
      console.error('[Reports] renderSettlements error:', err);
      content.innerHTML =
        '<div class="fury-card" style="padding:24px;text-align:center;color:var(--fury-danger)">' +
        'Error calculating settlements: ' + self.escapeHtml(err.message || 'Unknown error') +
        '</div>';
    }
  },

  /**
   * Render the settlements HTML from pre-calculated detailed data.
   * Separated from renderSettlements to keep the async logic clean.
   */
  _renderSettlementsHtml(content, detailed, activeProjectCodes, companies) {
    var self = this;
    var rows = detailed.rows;
    var companyTotals = detailed.companyTotals;
    var grandTotal = detailed.grandTotal;

    // Project columns header
    var projHeaders = '';
    for (var phi = 0; phi < activeProjectCodes.length; phi++) {
      projHeaders += '<th style="text-align:right;font-size:10px">' + activeProjectCodes[phi] + '</th>';
    }

    // Company total columns header
    var compHeaders = '';
    for (var chi = 0; chi < companies.length; chi++) {
      var compLabel = Settlements.getCompanyLabel(companies[chi]);
      compHeaders +=
        '<th style="text-align:right;font-size:10px;background:rgba(0,212,255,0.05)">' +
        self.escapeHtml(compLabel) +
        '</th>';
    }

    var tableHtml =
      '<div class="fury-card fury-mb-3" style="padding:16px">' +
        '<h3 style="font-size:14px;font-weight:600;color:var(--fury-text);margin-bottom:8px">Project-to-Company Mapping</h3>' +
        '<div class="fury-flex fury-gap-3" style="flex-wrap:wrap">' +
          self._buildMappingChips() +
        '</div>' +
      '</div>' +

      '<div class="fury-card" style="padding:0;overflow:hidden">' +
        '<div class="fury-card-header" style="padding:16px 24px;margin-bottom:0">' +
          '<h3 style="font-size:14px;font-weight:600;color:var(--fury-text)">Cost Allocation by Project & Company</h3>' +
          '<button class="fury-btn fury-btn-secondary fury-btn-sm" id="btn-export-settlements">Export .xlsx</button>' +
        '</div>' +
        '<div style="overflow-x:auto">' +
        '<table class="fury-table" style="font-size:13px">' +
          '<thead>' +
            '<tr>' +
              '<th>Employee</th>' +
              '<th style="text-align:right">Total Paid</th>' +
              '<th style="text-align:right">Hours</th>' +
              projHeaders +
              compHeaders +
            '</tr>' +
          '</thead>' +
          '<tbody>';

    if (rows.length === 0) {
      var totalCols = 3 + activeProjectCodes.length + companies.length;
      tableHtml +=
        '<tr><td colspan="' + totalCols + '" style="text-align:center;padding:40px;color:var(--fury-text-muted)">' +
        'No timesheet data found for this period. Upload timesheets first.' +
        '</td></tr>';
    } else {
      for (var ri = 0; ri < rows.length; ri++) {
        var row = rows[ri];

        // Project cost cells
        var projCells = '';
        for (var pci = 0; pci < activeProjectCodes.length; pci++) {
          var projCode = activeProjectCodes[pci];
          var alloc = row.projectAllocations[projCode];
          var costDisplay = alloc.cost > 0
            ? self.formatCurrency(alloc.cost)
            : '<span style="color:var(--fury-text-muted)">-</span>';
          var pctDisplay = alloc.percentage > 0
            ? '<br><span style="font-size:10px;color:var(--fury-text-muted)">' +
              (alloc.percentage * 100).toFixed(1) + '%</span>'
            : '';

          projCells +=
            '<td style="text-align:right;font-variant-numeric:tabular-nums;line-height:1.3">' +
            costDisplay + pctDisplay +
            '</td>';
        }

        // Company total cells
        var compCells = '';
        for (var cci = 0; cci < companies.length; cci++) {
          var compCost = row.companyAllocations[companies[cci]] || 0;
          compCells +=
            '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;background:rgba(0,212,255,0.03)">' +
            (compCost > 0 ? self.formatCurrency(compCost) : '<span style="color:var(--fury-text-muted)">-</span>') +
            '</td>';
        }

        tableHtml +=
          '<tr>' +
            '<td style="font-weight:500">' + self.escapeHtml(row.employee.name) + '</td>' +
            '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600">' +
              self.formatCurrency(row.totalPaid) +
            '</td>' +
            '<td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--fury-text-secondary)">' +
              row.totalHours.toFixed(1) +
            '</td>' +
            projCells +
            compCells +
          '</tr>';
      }

      // Totals row
      var projTotalCells = '';
      for (var ptci = 0; ptci < activeProjectCodes.length; ptci++) {
        projTotalCells +=
          '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:var(--fury-accent)">' +
          self.formatCurrency(detailed.projectTotals[activeProjectCodes[ptci]] || 0) +
          '</td>';
      }

      var compTotalCells = '';
      for (var ctci = 0; ctci < companies.length; ctci++) {
        compTotalCells +=
          '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:var(--fury-accent);background:rgba(0,212,255,0.05)">' +
          self.formatCurrency(companyTotals[companies[ctci]] || 0) +
          '</td>';
      }

      tableHtml +=
        '<tr style="background:var(--fury-bg);border-top:2px solid var(--fury-accent)">' +
          '<td style="font-weight:700;color:var(--fury-accent)">TOTAL</td>' +
          '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:var(--fury-accent)">' +
            self.formatCurrency(grandTotal) +
          '</td>' +
          '<td></td>' +
          projTotalCells +
          compTotalCells +
        '</tr>';
    }

    tableHtml += '</tbody></table></div></div>';

    // ── Settlement Summary Cards ──
    var settlementCardsHtml = '';
    if (rows.length > 0 && companies.length > 1) {
      settlementCardsHtml = '<div class="fury-grid-' + Math.min(companies.length, 4) + ' fury-mt-3">';

      for (var sci = 0; sci < companies.length; sci++) {
        var companyCode = companies[sci];
        var companyLabel = Settlements.getCompanyLabel(companyCode);
        var companyTotal = companyTotals[companyCode] || 0;
        var companyPct = grandTotal > 0
          ? ((companyTotal / grandTotal) * 100).toFixed(1)
          : '0.0';

        settlementCardsHtml +=
          '<div class="fury-card">' +
            '<h4 style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:var(--fury-text-secondary);margin-bottom:8px">' +
              self.escapeHtml(companyLabel) +
            '</h4>' +
            '<div class="fury-kpi-value" style="font-size:24px;margin-bottom:4px">' +
              self.formatCurrency(companyTotal) +
            '</div>' +
            '<div style="font-size:12px;color:var(--fury-text-muted)">' + companyPct + '% of total</div>' +
            '<div class="fury-progress fury-mt-2">' +
              '<div class="fury-progress-bar" style="width:' + companyPct + '%"></div>' +
            '</div>' +
          '</div>';
      }

      settlementCardsHtml += '</div>';

      // Net settlement calculations
      // If WS pays all employees, other companies need to reimburse WS
      settlementCardsHtml +=
        '<div class="fury-card fury-mt-3">' +
          '<h3 style="font-size:14px;font-weight:600;color:var(--fury-text);margin-bottom:12px">' +
            'Inter-Company Settlement (WS pays, others reimburse)' +
          '</h3>' +
          '<div class="fury-grid-' + Math.min(companies.length - 1, 3) + '">';

      for (var nsi = 0; nsi < companies.length; nsi++) {
        if (companies[nsi] === 'WS') continue;
        var netAmount = companyTotals[companies[nsi]] || 0;
        var netLabel = Settlements.getCompanyLabel(companies[nsi]);

        settlementCardsHtml +=
          '<div style="padding:16px;border:1px solid var(--fury-border);border-radius:var(--fury-radius);background:var(--fury-elevated)">' +
            '<div style="font-size:12px;color:var(--fury-text-secondary);margin-bottom:4px">' +
              self.escapeHtml(netLabel) + ' owes WS' +
            '</div>' +
            '<div style="font-size:22px;font-weight:700;color:var(--fury-success)">' +
              self.formatCurrency(netAmount) +
            '</div>' +
          '</div>';
      }

      settlementCardsHtml += '</div></div>';
    }

    content.innerHTML = tableHtml + settlementCardsHtml;

    // Bind export button
    var exportBtn = content.querySelector('#btn-export-settlements');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        self.exportSettlementsXlsx(detailed, activeProjectCodes, companies);
      });
    }
  },

  /* ── Build mapping chips for settlements (delegates to Settlements service) ── */
  _buildMappingChips() {
    var self = this;
    var chips = Settlements.getMappingChips();
    var html = '';

    for (var i = 0; i < chips.length; i++) {
      var chip = chips[i];
      var bgColor = chip.company === 'WS' ? 'rgba(0,212,255,0.1)'
        : chip.company === 'OMD' ? 'rgba(245,158,11,0.1)'
        : 'rgba(139,92,246,0.1)';
      var textColor = chip.company === 'WS' ? 'var(--fury-accent)'
        : chip.company === 'OMD' ? 'var(--fury-warning)'
        : '#A78BFA';

      html +=
        '<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;' +
        'border-radius:var(--fury-radius-full);font-size:12px;font-weight:500;' +
        'background:' + bgColor + ';color:' + textColor + '">' +
        chip.code + ' &rarr; ' + self.escapeHtml(chip.label) +
        '</span>';
    }
    return html;
  },

  /* ── Export Settlements XLSX (delegates formatting to Settlements service) ── */
  exportSettlementsXlsx(detailedData, activeProjectCodes, companies) {
    var self = this;

    if (typeof XLSX === 'undefined') {
      alert('XLSX library not loaded.');
      return;
    }

    try {
      var exportData = Settlements.formatForExport(detailedData, activeProjectCodes, companies);

      var wsData = [exportData.header];
      for (var i = 0; i < exportData.dataRows.length; i++) {
        wsData.push(exportData.dataRows[i]);
      }
      wsData.push([]);
      wsData.push(exportData.totalRow);

      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(wsData);

      var monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      var sheetName = 'Settlements ' + monthNames[self.month - 1].substring(0, 3) + ' ' + self.year;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      var filename = 'Settlements_' + self.year + '-' + String(self.month).padStart(2, '0') + '.xlsx';
      XLSX.writeFile(wb, filename);

      if (typeof showToast === 'function') {
        showToast('Exported ' + filename, 'success');
      }
    } catch (err) {
      console.error('[Reports] Settlement export error:', err);
      if (typeof showToast === 'function') {
        showToast('Export failed: ' + (err.message || 'Unknown error'), 'error');
      }
    }
  },

  /* ════════════════════════════════════════════════════════
     UTILIZATION REPORT
     Team utilization with progress bars
     ════════════════════════════════════════════════════════ */
  renderUtilization(content) {
    var self = this;

    // Calculate regular working hours for this month
    var regularHoursBase = self.calculateRegularHours(self.month, self.year);
    var regularHoursAdj = Math.max(0, regularHoursBase - self.hoursAdjustment);

    // Build timesheet aggregation per employee
    var empHoursMap = {};
    for (var t = 0; t < self.timesheets.length; t++) {
      var ts = self.timesheets[t];
      var empId = ts.employee_id;
      empHoursMap[empId] = (empHoursMap[empId] || 0) + (parseFloat(ts.hours) || 0);
    }

    // Build utilization rows
    var utilRows = [];
    var totalRegular = 0;
    var totalActual = 0;
    var employeesWithHours = 0;

    for (var e = 0; e < self.employees.length; e++) {
      var emp = self.employees[e];
      var isFTE = emp.employee_type !== 'Hourly Contractor';
      var regular = isFTE ? regularHoursAdj : 0;
      var actual = empHoursMap[emp.id] || 0;
      var utilization = regular > 0 ? (actual / regular) * 100 : (actual > 0 ? 100 : 0);
      var overtime = actual - regular;

      if (actual > 0) employeesWithHours++;
      totalRegular += regular;
      totalActual += actual;

      utilRows.push({
        employee: emp,
        regular: regular,
        actual: actual,
        utilization: utilization,
        overtime: overtime,
        isFTE: isFTE,
      });
    }

    // Sort by utilization descending
    utilRows.sort(function (a, b) {
      return b.utilization - a.utilization;
    });

    // Team average utilization (only for FTE with regular > 0)
    var fteRows = utilRows.filter(function (r) { return r.isFTE && r.regular > 0; });
    var teamAvgUtil = fteRows.length > 0
      ? fteRows.reduce(function (s, r) { return s + r.utilization; }, 0) / fteRows.length
      : 0;

    // KPI cards
    var kpiHtml =
      '<div class="fury-grid-4 fury-mb-3">' +
        self._kpiCard(
          'Team Avg Utilization',
          teamAvgUtil.toFixed(1) + '%',
          teamAvgUtil >= 95 ? 'fury-kpi-success' : teamAvgUtil >= 80 ? '' : 'fury-kpi-danger'
        ) +
        self._kpiCard('Regular Hours', regularHoursAdj + 'h', '') +
        self._kpiCard('Active Team', employeesWithHours + ' / ' + self.employees.length, '') +
        self._kpiCard('Total Overtime',
          (totalActual - totalRegular > 0 ? '+' : '') +
          (totalActual - totalRegular).toFixed(1) + 'h',
          totalActual - totalRegular > 0 ? 'fury-kpi-warning' : ''
        ) +
      '</div>';

    // Utilization table with progress bars
    var tableHtml =
      '<div class="fury-card" style="padding:0;overflow:hidden">' +
        '<div class="fury-card-header" style="padding:16px 24px;margin-bottom:0">' +
          '<h3 style="font-size:14px;font-weight:600;color:var(--fury-text)">Individual Utilization</h3>' +
        '</div>' +
        '<div style="overflow-x:auto">' +
        '<table class="fury-table">' +
          '<thead>' +
            '<tr>' +
              '<th>Employee</th>' +
              '<th>Type</th>' +
              '<th style="text-align:right">Regular (h)</th>' +
              '<th style="text-align:right">Actual (h)</th>' +
              '<th style="width:200px">Utilization</th>' +
              '<th style="text-align:right">Overtime (h)</th>' +
            '</tr>' +
          '</thead>' +
          '<tbody>';

    if (utilRows.length === 0) {
      tableHtml +=
        '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--fury-text-muted)">' +
        'No employees found.' +
        '</td></tr>';
    } else {
      for (var ri = 0; ri < utilRows.length; ri++) {
        var row = utilRows[ri];

        // Utilization color
        var utilColor;
        if (row.utilization >= 95) {
          utilColor = 'var(--fury-success)';
        } else if (row.utilization >= 80) {
          utilColor = 'var(--fury-warning)';
        } else {
          utilColor = 'var(--fury-danger)';
        }

        // Progress bar class
        var barClass;
        if (row.utilization >= 95) {
          barClass = 'fury-progress-bar-success';
        } else if (row.utilization >= 80) {
          barClass = 'fury-progress-bar-warning';
        } else {
          barClass = 'fury-progress-bar-danger';
        }

        var barWidth = Math.min(row.utilization, 120); // Cap visual at 120%

        // Overtime styling
        var overtimeStr;
        var overtimeStyle;
        if (row.overtime > 0) {
          overtimeStr = '+' + row.overtime.toFixed(1);
          overtimeStyle = 'color:var(--fury-success)';
        } else if (row.overtime < 0) {
          overtimeStr = row.overtime.toFixed(1);
          overtimeStyle = 'color:var(--fury-danger)';
        } else {
          overtimeStr = '0';
          overtimeStyle = 'color:var(--fury-text-muted)';
        }

        // Type badge
        var typeBadge = row.isFTE
          ? '<span class="fury-badge fury-badge-info" style="font-size:10px">FTE</span>'
          : '<span class="fury-badge fury-badge-neutral" style="font-size:10px">HC</span>';

        tableHtml +=
          '<tr>' +
            '<td style="font-weight:500">' + self.escapeHtml(row.employee.name) + '</td>' +
            '<td>' + typeBadge + '</td>' +
            '<td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--fury-text-secondary)">' +
              (row.isFTE ? row.regular : '-') +
            '</td>' +
            '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600">' +
              row.actual.toFixed(1) +
            '</td>' +
            '<td>' +
              '<div class="fury-flex fury-gap-2" style="align-items:center">' +
                '<div class="fury-progress" style="flex:1">' +
                  '<div class="fury-progress-bar ' + barClass + '" style="width:' + barWidth + '%"></div>' +
                '</div>' +
                '<span style="font-size:12px;font-weight:600;min-width:44px;text-align:right;color:' + utilColor + '">' +
                  (row.isFTE ? row.utilization.toFixed(1) + '%' : 'N/A') +
                '</span>' +
              '</div>' +
            '</td>' +
            '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;' + overtimeStyle + '">' +
              overtimeStr +
            '</td>' +
          '</tr>';
      }

      // Team total row
      var teamUtil = totalRegular > 0 ? ((totalActual / totalRegular) * 100).toFixed(1) : 'N/A';
      var teamOvertime = totalActual - totalRegular;
      var teamOtStyle = teamOvertime > 0 ? 'color:var(--fury-success)' : teamOvertime < 0 ? 'color:var(--fury-danger)' : 'color:var(--fury-text-muted)';
      var teamOtStr = teamOvertime > 0 ? '+' + teamOvertime.toFixed(1) : teamOvertime.toFixed(1);

      tableHtml +=
        '<tr style="background:var(--fury-bg);border-top:2px solid var(--fury-accent)">' +
          '<td style="font-weight:700;color:var(--fury-accent)">TEAM TOTAL</td>' +
          '<td></td>' +
          '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600;color:var(--fury-accent)">' +
            totalRegular +
          '</td>' +
          '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:var(--fury-accent)">' +
            totalActual.toFixed(1) +
          '</td>' +
          '<td style="font-weight:600;color:var(--fury-accent);text-align:center">' +
            teamUtil + (teamUtil !== 'N/A' ? '%' : '') +
          '</td>' +
          '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:700;' + teamOtStyle + '">' +
            teamOtStr +
          '</td>' +
        '</tr>';
    }

    tableHtml += '</tbody></table></div></div>';

    content.innerHTML = kpiHtml + tableHtml;
  },

  /* ── Bind Events ── */
  bindEvents(container, ctx) {
    var self = this;

    // Month/year change
    var monthSelect = container.querySelector('#rpt-month');
    var yearSelect = container.querySelector('#rpt-year');

    if (monthSelect) {
      monthSelect.addEventListener('change', function () {
        self.month = parseInt(this.value, 10);
        self.reloadData(container, ctx);
      });
    }

    if (yearSelect) {
      yearSelect.addEventListener('change', function () {
        self.year = parseInt(this.value, 10);
        self.reloadData(container, ctx);
      });
    }

    // Report tabs
    var tabs = container.querySelectorAll('.fury-tab[data-report]');
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].addEventListener('click', function () {
        for (var i = 0; i < tabs.length; i++) {
          tabs[i].classList.remove('active');
        }
        this.classList.add('active');
        self.activeReport = this.getAttribute('data-report');
        self.renderActiveReport(container);
      });
    }
  },

  /* ── Reload Data ── */
  async reloadData(container, ctx) {
    var content = container.querySelector('#report-content');
    if (content) {
      content.innerHTML = '<div style="text-align:center;padding:40px;color:var(--fury-text-muted)">Loading reports...</div>';
    }
    await this.loadData(ctx);
    this.renderActiveReport(container);
  },

  /* ═══════════════════════════════════════════════════
     HELPER FUNCTIONS
     ═══════════════════════════════════════════════════ */

  /* ── Calculate working days in month ── */
  calculateRegularHours(month, year) {
    var workingDays = 0;
    var daysInMonth = new Date(year, month, 0).getDate();
    for (var d = 1; d <= daysInMonth; d++) {
      var dayOfWeek = new Date(year, month - 1, d).getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
    }
    return workingDays * 8;
  },

  /* ── KPI card helper ── */
  _kpiCard(label, value, extraClass) {
    return (
      '<div class="fury-kpi ' + (extraClass || '') + '">' +
        '<span class="fury-kpi-value">' + value + '</span>' +
        '<span class="fury-kpi-label">' + label + '</span>' +
      '</div>'
    );
  },

  /* ── Status badge ── */
  _statusBadge(status) {
    var map = {
      'draft':     { cls: 'fury-badge fury-badge-neutral',  label: 'Draft' },
      'generated': { cls: 'fury-badge fury-badge-info',     label: 'Generated' },
      'sent':      { cls: 'fury-badge fury-badge-warning',  label: 'Sent' },
      'paid':      { cls: 'fury-badge fury-badge-success',  label: 'Paid' },
    };
    var info = map[status] || map['draft'];
    return '<span class="' + info.cls + '">' + info.label + '</span>';
  },

  /* ── Format currency ── */
  formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return '$0.00';
    return '$' + Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  /* ── HTML escape ── */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};
