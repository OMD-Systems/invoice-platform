/* ═══════════════════════════════════════════════════════
   Dashboard — Main Overview Page
   Invoice Platform · OMD Systems
   ═══════════════════════════════════════════════════════ */

const Dashboard = {
  title: 'Dashboard',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  data: null,

  /* ── Render ── */
  async render(container, ctx) {
    container.innerHTML = this.template();
    this.bindEvents(container, ctx);
    await this.loadData(ctx);
    this.updateUI(container);
  },

  /* ── Template ── */
  template() {
    var monthOptions = '';
    var monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    for (var m = 1; m <= 12; m++) {
      var selected = m === this.month ? ' selected' : '';
      monthOptions += '<option value="' + m + '"' + selected + '>' + monthNames[m - 1] + '</option>';
    }

    var yearOptions = '';
    var currentYear = new Date().getFullYear();
    for (var y = currentYear - 3; y <= currentYear + 1; y++) {
      var sel = y === this.year ? ' selected' : '';
      yearOptions += '<option value="' + y + '"' + sel + '>' + y + '</option>';
    }

    return (
      '<div class="dashboard">' +

        /* ── Period Selector ── */
        '<div class="fury-flex-between" style="margin-bottom: 20px;">' +
          '<div style="display: flex; align-items: center; gap: 12px;">' +
            '<label style="font-size: 13px; color: #9CA3AF; font-weight: 500;">Period:</label>' +
            '<select class="fury-select" id="dash-month">' + monthOptions + '</select>' +
            '<select class="fury-select" id="dash-year">' + yearOptions + '</select>' +
          '</div>' +
          '<div style="font-size: 12px; color: #4B5563;" id="dash-updated"></div>' +
        '</div>' +

        /* ── KPI Cards ── */
        '<div class="fury-grid-4" id="dash-kpi">' +
          this._kpiCard('kpi-employees', 'Total Employees', '—', '&#x25CB;') +
          this._kpiCard('kpi-invoiced', 'Invoiced', '—', '&#x25C8;') +
          this._kpiCard('kpi-pending', 'Pending', '—', '&#x25F7;') +
          this._kpiCard('kpi-amount', 'Total Amount', '—', '&#x25A0;') +
        '</div>' +

        /* ── Team Table ── */
        '<div style="margin-top: 24px; overflow-x: auto;">' +
          '<table class="fury-table" id="dash-table">' +
            '<thead>' +
              '<tr>' +
                '<th>Employee</th>' +
                '<th style="text-align:right">Hours</th>' +
                '<th style="text-align:right">Regular</th>' +
                '<th style="text-align:right">Overtime</th>' +
                '<th style="text-align:right">Rate</th>' +
                '<th style="text-align:right">Invoice Amount</th>' +
                '<th style="text-align:center">Status</th>' +
                '<th style="text-align:center">Actions</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody id="dash-tbody">' +
              '<tr><td colspan="8" class="fury-loading" style="text-align:center; padding: 40px; color: #6B7280;">Loading data...</td></tr>' +
            '</tbody>' +
          '</table>' +
        '</div>' +

        /* ── Action Bar ── */
        '<div class="fury-flex-between" style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #1F1F23;">' +
          '<div style="display: flex; gap: 10px;">' +
            '<button class="fury-btn-primary" id="dash-generate-all" title="Generate invoices for all pending employees">' +
              'Generate All' +
            '</button>' +
          '</div>' +
          '<div style="display: flex; gap: 10px;">' +
            '<button class="fury-btn-secondary" id="dash-upload-timesheet">' +
              'Upload Timesheet' +
            '</button>' +
            '<button class="fury-btn-secondary" id="dash-export-summary">' +
              'Export Summary' +
            '</button>' +
          '</div>' +
        '</div>' +

        /* ── Hidden file input for Upload ── */
        '<input type="file" id="dash-file-input" accept=".xlsx,.xls,.csv" style="display:none">' +

      '</div>'
    );
  },

  /* ── KPI Card Fragment ── */
  _kpiCard(id, label, value, icon) {
    return (
      '<div class="fury-card fury-kpi" id="' + id + '">' +
        '<div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">' +
          '<span style="font-size: 12px; color: #6B7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px;">' + label + '</span>' +
          '<span style="font-size: 18px; color: #374151;">' + icon + '</span>' +
        '</div>' +
        '<div class="kpi-value" style="font-size: 28px; font-weight: 700; color: #E5E7EB; line-height: 1;">' + value + '</div>' +
      '</div>'
    );
  },

  /* ── Load Data ── */
  async loadData(ctx) {
    try {
      var role = ctx.role || App.role;
      var user = ctx.user || App.user;

      // Fetch employees based on role
      var empResult;
      if (role === 'admin') {
        empResult = await DB.getEmployees();
      } else {
        empResult = await DB.getTeamEmployees(user.email);
      }
      var employees = (empResult && empResult.data) ? empResult.data : [];

      // Fetch timesheets for selected period
      var tsResult = await DB.getTimesheets(this.month, this.year);
      var timesheets = (tsResult && tsResult.data) ? tsResult.data : [];

      // Fetch invoices for selected period
      var invResult = await DB.getInvoices({ month: this.month, year: this.year });
      var invoices = (invResult && invResult.data) ? invResult.data : [];

      // Build lookup maps
      var timesheetMap = {};
      if (timesheets && timesheets.length) {
        for (var t = 0; t < timesheets.length; t++) {
          var ts = timesheets[t];
          timesheetMap[ts.employee_id] = ts;
        }
      }

      var invoiceMap = {};
      if (invoices && invoices.length) {
        for (var i = 0; i < invoices.length; i++) {
          var inv = invoices[i];
          invoiceMap[inv.employee_id] = inv;
        }
      }

      // Build row data
      var regularHours = this.getRegularHours(this.month, this.year);
      var rows = [];
      var totalAmount = 0;
      var invoicedCount = 0;
      var pendingCount = 0;

      for (var e = 0; e < employees.length; e++) {
        var emp = employees[e];
        var sheet = timesheetMap[emp.id] || null;
        var invoice = invoiceMap[emp.id] || null;

        var actualHours = sheet ? (sheet.total_hours || 0) : 0;
        var overtime = actualHours - regularHours;
        var rate = emp.hourly_rate || 0;
        var invoiceAmount = invoice ? (invoice.total || 0) : (actualHours * rate);
        var status = invoice ? (invoice.status || 'draft') : 'none';

        if (status !== 'draft' && status !== 'none') {
          invoicedCount++;
        } else {
          pendingCount++;
        }

        if (invoice) {
          totalAmount += invoice.total || 0;
        } else {
          totalAmount += actualHours * rate;
        }

        rows.push({
          id: emp.id,
          name: emp.full_name || emp.name || emp.email || 'Unknown',
          actualHours: actualHours,
          regularHours: regularHours,
          overtime: overtime,
          rate: rate,
          invoiceAmount: invoiceAmount,
          status: status,
          hasInvoice: !!invoice,
          invoiceId: invoice ? invoice.id : null,
          hasTimesheet: !!sheet,
        });
      }

      this.data = {
        employees: employees,
        rows: rows,
        kpi: {
          totalEmployees: employees.length,
          invoiced: invoicedCount,
          pending: pendingCount,
          totalAmount: totalAmount,
        },
      };
    } catch (err) {
      console.error('[Dashboard] loadData error:', err);
      this.data = {
        employees: [],
        rows: [],
        kpi: { totalEmployees: 0, invoiced: 0, pending: 0, totalAmount: 0 },
        error: err.message || 'Failed to load data',
      };
    }
  },

  /* ── Update UI with loaded data ── */
  updateUI(container) {
    if (!this.data) return;

    var kpi = this.data.kpi;

    // Update KPI values
    this._setKpiValue(container, 'kpi-employees', String(kpi.totalEmployees));
    this._setKpiValue(container, 'kpi-invoiced', String(kpi.invoiced));
    this._setKpiValue(container, 'kpi-pending', String(kpi.pending));
    this._setKpiValue(container, 'kpi-amount', this.formatCurrency(kpi.totalAmount));

    // Update table
    var tbody = container.querySelector('#dash-tbody');
    if (!tbody) return;

    if (this.data.error) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center; padding: 40px; color: #EF4444;">' +
        'Error: ' + this._escapeHtml(this.data.error) +
        '</td></tr>';
      return;
    }

    if (this.data.rows.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" style="text-align:center; padding: 40px; color: #6B7280;">' +
        'No employees found for the selected period.' +
        '</td></tr>';
      return;
    }

    var html = '';
    for (var i = 0; i < this.data.rows.length; i++) {
      var row = this.data.rows[i];
      html += this._buildTableRow(row);
    }
    tbody.innerHTML = html;

    // Update timestamp
    var updatedEl = container.querySelector('#dash-updated');
    if (updatedEl) {
      var now = new Date();
      updatedEl.textContent = 'Updated: ' + now.toLocaleTimeString();
    }
  },

  /* ── Build a single table row ── */
  _buildTableRow(row) {
    // Overtime styling
    var overtimeClass = '';
    var overtimePrefix = '';
    if (row.overtime > 0) {
      overtimeClass = 'color: #22C55E;'; // green
      overtimePrefix = '+';
    } else if (row.overtime < 0) {
      overtimeClass = 'color: #EF4444;'; // red
      overtimePrefix = '';
    } else {
      overtimeClass = 'color: #6B7280;'; // gray
      overtimePrefix = '';
    }

    // Status badge
    var statusBadge = this._statusBadge(row.status);

    // Action button
    var actionBtn = '';
    if (row.hasInvoice) {
      actionBtn =
        '<button class="fury-btn-secondary dash-action-view" ' +
        'data-invoice-id="' + row.invoiceId + '" ' +
        'data-employee-id="' + row.id + '" ' +
        'style="font-size: 12px; padding: 4px 12px;">' +
        'View</button>';
    } else {
      actionBtn =
        '<button class="fury-btn-primary dash-action-generate" ' +
        'data-employee-id="' + row.id + '" ' +
        'data-employee-name="' + this._escapeAttr(row.name) + '" ' +
        'style="font-size: 12px; padding: 4px 12px;">' +
        'Generate</button>';
    }

    return (
      '<tr>' +
        '<td>' + this._escapeHtml(row.name) + '</td>' +
        '<td style="text-align:right; font-variant-numeric: tabular-nums;">' + row.actualHours.toFixed(1) + '</td>' +
        '<td style="text-align:right; font-variant-numeric: tabular-nums;">' + row.regularHours.toFixed(1) + '</td>' +
        '<td style="text-align:right; font-variant-numeric: tabular-nums; ' + overtimeClass + '">' +
          overtimePrefix + row.overtime.toFixed(1) +
        '</td>' +
        '<td style="text-align:right; font-variant-numeric: tabular-nums;">' + this.formatCurrency(row.rate) + '</td>' +
        '<td style="text-align:right; font-variant-numeric: tabular-nums; font-weight: 600;">' + this.formatCurrency(row.invoiceAmount) + '</td>' +
        '<td style="text-align:center;">' + statusBadge + '</td>' +
        '<td style="text-align:center;">' + actionBtn + '</td>' +
      '</tr>'
    );
  },

  /* ── Status badge mapping ── */
  _statusBadge(status) {
    var map = {
      'draft':     { cls: 'fury-badge-neutral',  label: 'Draft' },
      'generated': { cls: 'fury-badge-info',     label: 'Generated' },
      'sent':      { cls: 'fury-badge-warning',  label: 'Sent' },
      'paid':      { cls: 'fury-badge-success',  label: 'Paid' },
      'none':      { cls: 'fury-badge-neutral',  label: 'No Invoice' },
      'overdue':   { cls: 'fury-badge-danger',   label: 'Overdue' },
    };

    var info = map[status] || map['none'];
    return '<span class="' + info.cls + '">' + info.label + '</span>';
  },

  /* ── Set KPI card value ── */
  _setKpiValue(container, id, value) {
    var card = container.querySelector('#' + id);
    if (!card) return;
    var valEl = card.querySelector('.kpi-value');
    if (valEl) valEl.textContent = value;
  },

  /* ── Bind Events ── */
  bindEvents(container, ctx) {
    var self = this;

    // ── Month/Year change ──
    var monthSelect = container.querySelector('#dash-month');
    var yearSelect = container.querySelector('#dash-year');

    if (monthSelect) {
      monthSelect.addEventListener('change', function () {
        self.month = parseInt(this.value, 10);
        self._reloadData(container, ctx);
      });
    }

    if (yearSelect) {
      yearSelect.addEventListener('change', function () {
        self.year = parseInt(this.value, 10);
        self._reloadData(container, ctx);
      });
    }

    // ── Generate All ──
    var generateAllBtn = container.querySelector('#dash-generate-all');
    if (generateAllBtn) {
      generateAllBtn.addEventListener('click', function () {
        self._handleGenerateAll(container, ctx);
      });
    }

    // ── Upload Timesheet ──
    var uploadBtn = container.querySelector('#dash-upload-timesheet');
    var fileInput = container.querySelector('#dash-file-input');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', function () {
        fileInput.click();
      });

      fileInput.addEventListener('change', function () {
        if (this.files && this.files.length > 0) {
          self._handleUploadTimesheet(this.files[0], container, ctx);
          this.value = ''; // reset so the same file can be re-selected
        }
      });
    }

    // ── Export Summary ──
    var exportBtn = container.querySelector('#dash-export-summary');
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        self._handleExportSummary();
      });
    }

    // ── Delegated click for row actions ──
    var tbody = container.querySelector('#dash-tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var target = e.target;

        // Generate individual invoice
        if (target.classList.contains('dash-action-generate')) {
          var empId = target.getAttribute('data-employee-id');
          var empName = target.getAttribute('data-employee-name');
          self._handleGenerateSingle(empId, empName, target, container, ctx);
        }

        // View invoice
        if (target.classList.contains('dash-action-view')) {
          var invoiceId = target.getAttribute('data-invoice-id');
          if (invoiceId) {
            window.location.hash = '#/invoices?id=' + invoiceId;
          }
        }
      });
    }
  },

  /* ── Reload data after month/year change ── */
  async _reloadData(container, ctx) {
    var tbody = container.querySelector('#dash-tbody');
    if (tbody) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="fury-loading" style="text-align:center; padding: 40px; color: #6B7280;">' +
        'Loading data...</td></tr>';
    }

    // Reset KPIs to loading state
    this._setKpiValue(container, 'kpi-employees', '...');
    this._setKpiValue(container, 'kpi-invoiced', '...');
    this._setKpiValue(container, 'kpi-pending', '...');
    this._setKpiValue(container, 'kpi-amount', '...');

    await this.loadData(ctx);
    this.updateUI(container);
  },

  /* ── Generate All Invoices ── */
  async _handleGenerateAll(container, ctx) {
    if (!this.data || !this.data.rows) return;

    var pendingRows = this.data.rows.filter(function (r) {
      return !r.hasInvoice && r.hasTimesheet;
    });

    if (pendingRows.length === 0) {
      alert('No pending employees with timesheets to generate invoices for.');
      return;
    }

    var confirmMsg = 'Generate invoices for ' + pendingRows.length + ' employee(s)?';
    if (!confirm(confirmMsg)) return;

    var btn = container.querySelector('#dash-generate-all');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Generating...';
    }

    try {
      var errors = [];
      for (var i = 0; i < pendingRows.length; i++) {
        try {
          await DB.generateInvoice(pendingRows[i].id, this.month, this.year);
        } catch (err) {
          errors.push(pendingRows[i].name + ': ' + (err.message || 'Failed'));
        }
      }

      if (errors.length > 0) {
        alert('Some invoices failed to generate:\n\n' + errors.join('\n'));
      }

      // Reload data
      await this._reloadData(container, ctx);
    } catch (err) {
      console.error('[Dashboard] Generate all error:', err);
      alert('Failed to generate invoices: ' + (err.message || 'Unknown error'));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Generate All';
      }
    }
  },

  /* ── Generate Single Invoice ── */
  async _handleGenerateSingle(employeeId, employeeName, button, container, ctx) {
    if (!confirm('Generate invoice for ' + employeeName + '?')) return;

    button.disabled = true;
    button.textContent = '...';

    try {
      await DB.generateInvoice(employeeId, this.month, this.year);
      await this._reloadData(container, ctx);
    } catch (err) {
      console.error('[Dashboard] Generate single error:', err);
      alert('Failed to generate invoice for ' + employeeName + ': ' + (err.message || 'Unknown error'));
      button.disabled = false;
      button.textContent = 'Generate';
    }
  },

  /* ── Upload Timesheet ── */
  async _handleUploadTimesheet(file, container, ctx) {
    if (!file) return;

    var btn = container.querySelector('#dash-upload-timesheet');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Uploading...';
    }

    try {
      // Parse the timesheet file (uses TimesheetParser service)
      var parsedData = await TimesheetParser.parse(file);

      // Upload parsed data to DB
      await DB.uploadTimesheets(parsedData, this.month, this.year);

      // Reload
      await this._reloadData(container, ctx);
    } catch (err) {
      console.error('[Dashboard] Upload timesheet error:', err);
      alert('Failed to upload timesheet: ' + (err.message || 'Unknown error'));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Upload Timesheet';
      }
    }
  },

  /* ── Export Summary ── */
  async _handleExportSummary() {
    if (!this.data || !this.data.rows || this.data.rows.length === 0) {
      alert('No data to export.');
      return;
    }

    try {
      var monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      // Build worksheet data
      var header = ['Employee', 'Hours', 'Regular Hours', 'Overtime', 'Rate ($)', 'Invoice Amount ($)', 'Status'];
      var wsData = [header];

      for (var i = 0; i < this.data.rows.length; i++) {
        var row = this.data.rows[i];
        wsData.push([
          row.name,
          row.actualHours,
          row.regularHours,
          row.overtime,
          row.rate,
          row.invoiceAmount,
          row.status === 'none' ? 'No Invoice' : row.status.charAt(0).toUpperCase() + row.status.slice(1),
        ]);
      }

      // Add totals row
      wsData.push([]);
      wsData.push([
        'TOTAL',
        this.data.rows.reduce(function (s, r) { return s + r.actualHours; }, 0),
        this.data.rows.length > 0 ? this.data.rows[0].regularHours : 0,
        this.data.rows.reduce(function (s, r) { return s + r.overtime; }, 0),
        '',
        this.data.kpi.totalAmount,
        '',
      ]);

      // Create workbook and download
      var wb = XLSX.utils.book_new();
      var ws = XLSX.utils.aoa_to_sheet(wsData);

      // Set column widths
      ws['!cols'] = [
        { wch: 25 }, // Employee
        { wch: 10 }, // Hours
        { wch: 14 }, // Regular Hours
        { wch: 10 }, // Overtime
        { wch: 10 }, // Rate
        { wch: 16 }, // Invoice Amount
        { wch: 14 }, // Status
      ];

      var sheetName = monthNames[this.month - 1] + ' ' + this.year;
      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      var filename = 'Invoice_Summary_' + this.year + '-' + String(this.month).padStart(2, '0') + '.xlsx';
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error('[Dashboard] Export error:', err);
      alert('Failed to export summary: ' + (err.message || 'Unknown error'));
    }
  },

  /* ── Working Day Calculation ── */
  getRegularHours(month, year) {
    // Count weekdays in the given month, multiply by 8, subtract 8
    var lastDay = new Date(year, month, 0).getDate();
    var workDays = 0;
    for (var d = 1; d <= lastDay; d++) {
      var dow = new Date(year, month - 1, d).getDay();
      if (dow !== 0 && dow !== 6) workDays++;
    }
    return workDays * 8 - 8;
  },

  /* ── Formatting Helpers ── */
  formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return '$0.00';
    return '$' + Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  _escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  _escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },
};
