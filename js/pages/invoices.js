/* ═══════════════════════════════════════════════════════
   Invoices — Invoice Management Page
   Invoice Platform · OMD Systems
   List view with filtering, generation, preview & download.
   ═══════════════════════════════════════════════════════ */

var Invoices = {
  title: 'Invoices',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  statusFilter: 'all',
  employeeFilter: 'all',
  invoices: [],
  employees: [],
  timesheetMap: {},
  billedTo: null,
  defaultTerms: '',

  /* ═══════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════ */
  async render(container, ctx) {
    container.innerHTML = this.template();
    this.bindEvents(container, ctx);
    await this.loadData(ctx);
    this.updateTable(container);
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

    } catch (err) {
      console.error('[Invoices] loadData error:', err);
      this.employees = [];
      this.invoices = [];
      this.timesheetMap = {};
    }
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
      var total = inv.total_usd || inv.total || 0;
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
                'data-invoice-id="' + inv.id + '" title="Download DOCX">' +
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
      var estAmount = hours * rate;

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

    // Generate Selected: enable when pending checkboxes exist
    var pendingChecks = container.querySelectorAll('.inv-pending-check');
    if (genBtn) genBtn.disabled = pendingChecks.length === 0;

    // Download All DOCX: enable when invoices exist
    if (dlBtn) dlBtn.disabled = this.invoices.length === 0;
  },

  /* ═══════════════════════════════════════════════════════
     BIND EVENTS
     ═══════════════════════════════════════════════════════ */
  bindEvents: function (container, ctx) {
    var self = this;

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
      });
    }

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

    // ── Delegated clicks on invoice table ──
    var invTbody = container.querySelector('#inv-tbody');
    if (invTbody) {
      invTbody.addEventListener('click', function (e) {
        var target = e.target;
        // Preview
        if (target.classList.contains('inv-act-preview')) {
          var invoiceId = target.getAttribute('data-invoice-id');
          self._handlePreview(invoiceId);
        }
        // Download DOCX
        if (target.classList.contains('inv-act-download')) {
          var invId = target.getAttribute('data-invoice-id');
          self._handleDownload(invId);
        }
      });

      // Status change (select)
      invTbody.addEventListener('change', function (e) {
        var target = e.target;
        if (target.classList.contains('inv-act-status')) {
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
        var target = e.target;
        if (target.classList.contains('inv-act-generate')) {
          var empId = target.getAttribute('data-employee-id');
          var empName = target.getAttribute('data-employee-name');
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
    this.updateTable(container);
  },

  /* ═══════════════════════════════════════════════════════
     ACTIONS
     ═══════════════════════════════════════════════════════ */

  /* ── Preview an invoice ── */
  _handlePreview: function (invoiceId) {
    var inv = this._findInvoice(invoiceId);
    if (!inv) {
      alert('Invoice not found.');
      return;
    }

    var previewData = this._buildPreviewData(inv);
    InvoicePreview.show(previewData);
  },

  /* ── Download DOCX for a single invoice ── */
  _handleDownload: function (invoiceId) {
    var inv = this._findInvoice(invoiceId);
    if (!inv) {
      alert('Invoice not found.');
      return;
    }

    if (typeof InvoiceDocx !== 'undefined' && InvoiceDocx.downloadInvoice) {
      var docxData = this._buildPreviewData(inv);
      InvoiceDocx.downloadInvoice(docxData);
    } else {
      alert('DOCX generation service is not available.');
    }
  },

  /* ── Status change ── */
  async _handleStatusChange(invoiceId, newStatus, container, ctx) {
    try {
      var result = await DB.updateInvoiceStatus(invoiceId, newStatus);
      if (result.error) {
        alert('Failed to update status: ' + (result.error.message || 'Unknown error'));
        return;
      }
      // Update local data
      for (var i = 0; i < this.invoices.length; i++) {
        if (this.invoices[i].id === invoiceId) {
          this.invoices[i].status = newStatus;
          break;
        }
      }
    } catch (err) {
      console.error('[Invoices] Status change error:', err);
      alert('Failed to update status: ' + (err.message || 'Unknown error'));
    }
  },

  /* ── Generate invoice for a single employee ── */
  async _handleGenerate(employeeId, employeeName, container, ctx) {
    var emp = this._findEmployee(employeeId);
    if (!emp) {
      alert('Employee not found.');
      return;
    }
    this.showGenerateModal(emp, container, ctx);
  },

  /* ── Generate for selected pending employees ── */
  async _handleGenerateSelected(container, ctx) {
    var checks = container.querySelectorAll('.inv-pending-check:checked');
    if (checks.length === 0) {
      alert('Please select at least one pending employee.');
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
        errors.push(eName + ': ' + (err.message || 'Failed'));
      }
    }

    if (errors.length > 0) {
      alert('Some invoices failed:\n\n' + errors.join('\n'));
    }

    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Generate Selected';
    }

    await this._reload(container, ctx);
  },

  /* ── Batch download ── */
  _handleBatchDownload: function (container, ctx) {
    if (typeof InvoiceDocx !== 'undefined' && InvoiceDocx.downloadBatch) {
      var allData = [];
      for (var i = 0; i < this.invoices.length; i++) {
        allData.push(this._buildPreviewData(this.invoices[i]));
      }
      InvoiceDocx.downloadBatch(allData);
    } else {
      // Fallback: download individually
      for (var j = 0; j < this.invoices.length; j++) {
        this._handleDownload(this.invoices[j].id);
      }
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
    var estimatedAmount = empType === 'hourly' ? (rate * hours) : rate;
    var prefix = employee.invoice_prefix || '';
    var nextNum = employee.next_invoice_number || 1;
    var invoiceNumber = prefix ? prefix + '-' + String(nextNum).padStart(3, '0') : String(nextNum).padStart(3, '0');

    // Last day of selected month
    var lastDay = new Date(this.year, this.month, 0);
    var invDateStr = this._toISODate(lastDay);

    // Remove existing modal
    var existing = document.querySelector('.invoice-generate-overlay');
    if (existing) existing.remove();

    // Build modal
    var overlay = document.createElement('div');
    overlay.className = 'fury-modal-overlay active invoice-generate-overlay';

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
          '<button class="fury-btn fury-btn-primary" id="gen-download">Generate &amp; Download DOCX</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // ── Modal event bindings ──

    // Close
    var closeModal = function () {
      overlay.classList.remove('active');
      setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 260);
    };

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
        '<input class="fury-input gen-exp-rate" type="number" step="0.0001" placeholder="Rate" value="41.50">' +
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

    // Collect line items
    var items = [];
    var liRows = overlay.querySelectorAll('.gen-line-item');
    for (var i = 0; i < liRows.length; i++) {
      var desc = liRows[i].querySelector('.gen-li-desc').value.trim();
      var price = parseFloat(liRows[i].querySelector('.gen-li-price').value) || 0;
      var qty = parseFloat(liRows[i].querySelector('.gen-li-qty').value) || 1;
      var totalVal = parseFloat(liRows[i].querySelector('.gen-li-total').value) || 0;
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
        bank_name: employee.bank_name || ''
      },
      billedTo: this.billedTo || { name: '', address: '' },
      invoiceNumber: invNumber,
      invoiceDate: dateDisplay,
      invoiceDateISO: invDate,
      dueDays: 'Net 15',
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
      if (result.error) {
        alert('Failed to save invoice: ' + (result.error.message || 'Unknown error'));
        return null;
      }

      if (closeCallback) closeCallback();
      await this._reload(container, ctx);
      return result.data;
    } catch (err) {
      console.error('[Invoices] Save error:', err);
      alert('Failed to save invoice: ' + (err.message || 'Unknown error'));
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

    var dlBtn = overlay.querySelector('#gen-download');
    if (dlBtn) {
      dlBtn.disabled = true;
      dlBtn.textContent = 'Generating...';
    }

    try {
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
      if (result.error) {
        alert('Failed to save invoice: ' + (result.error.message || 'Unknown error'));
        return;
      }

      // Download DOCX
      if (typeof InvoiceDocx !== 'undefined' && InvoiceDocx.downloadInvoice) {
        InvoiceDocx.downloadInvoice(data);
      } else {
        // Fallback: show preview for manual print
        InvoicePreview.show(data);
      }

      if (closeCallback) closeCallback();
      await this._reload(container, ctx);
    } catch (err) {
      console.error('[Invoices] Generate & download error:', err);
      alert('Failed to generate invoice: ' + (err.message || 'Unknown error'));
    } finally {
      if (dlBtn) {
        dlBtn.disabled = false;
        dlBtn.textContent = 'Generate & Download DOCX';
      }
    }
  },

  /* ── Auto-generate (for batch "Generate Selected") ── */
  async _autoGenerateInvoice(employee, ctx) {
    var ts = this.timesheetMap[employee.id];
    var hours = ts ? ts.total_hours : 0;
    var rate = employee.rate_usd || employee.hourly_rate || 0;
    var empType = employee.employee_type || 'monthly';
    var amount = empType === 'hourly' ? (rate * hours) : rate;
    var serviceDesc = employee.service_description || employee.position || 'Software Development Services';

    // Get next invoice number
    var numResult = await DB.getNextInvoiceNumber(employee.id);
    var prefix = '';
    var num = 1;
    if (numResult && numResult.data) {
      prefix = numResult.data.prefix || '';
      num = numResult.data.number || 1;
    }
    var invoiceNumber = prefix ? prefix + '-' + String(num).padStart(3, '0') : String(num).padStart(3, '0');

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
    if (result.error) {
      throw new Error(result.error.message || 'DB error');
    }

    return result.data;
  },

  /* ═══════════════════════════════════════════════════════
     HELPERS
     ═══════════════════════════════════════════════════════ */

  /* ── Build preview data from an existing invoice record ── */
  _buildPreviewData: function (inv) {
    var emp = inv.employees || {};
    var items = (inv.invoice_items || []).map(function (it) {
      return {
        description: it.description || '',
        price: it.price_usd || 0,
        qty: it.qty || 1,
        total: it.total_usd || 0
      };
    });

    // Sort by item_order
    items.sort(function (a, b) { return (a.item_order || 0) - (b.item_order || 0); });

    var subtotal = inv.subtotal_usd || 0;
    var discount = inv.discount_usd || 0;
    var tax = inv.tax_usd || 0;
    var total = inv.total_usd || inv.total || 0;

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
        bank_name: emp.bank_name || ''
      },
      billedTo: this.billedTo || { name: '', address: '' },
      invoiceNumber: inv.invoice_number || '',
      invoiceDate: inv.invoice_date ? this._formatDate(inv.invoice_date) : '',
      dueDays: 'Net 15',
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
      'draft':     { cls: 'fury-badge fury-badge-neutral',  label: 'Draft' },
      'generated': { cls: 'fury-badge fury-badge-info',     label: 'Generated' },
      'sent':      { cls: 'fury-badge fury-badge-warning',  label: 'Sent' },
      'paid':      { cls: 'fury-badge fury-badge-success',  label: 'Paid' },
      'overdue':   { cls: 'fury-badge fury-badge-danger',   label: 'Overdue' }
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
  }
};
