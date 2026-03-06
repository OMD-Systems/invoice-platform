/* =============================================================
   Expenses — Expense Management Page
   Invoice Platform · OMD Systems
   ============================================================= */

const Expenses = {
  title: 'Expenses',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  expenses: [],
  invoices: [],
  exchangeRate: 42.16,
  activeCategory: 'all',
  modalOverlay: null,

  /* ── Categories ── */
  CATEGORIES: {
    motor:       { label: 'Motor',       color: '#F59E0B' },
    electronics: { label: 'Electronics', color: '#3B82F6' },
    logistics:   { label: 'Logistics',   color: '#8B5CF6' },
    '3d_print':  { label: '3D Print',    color: '#10B981' },
    other:       { label: 'Other',       color: '#6B7280' },
  },

  /* ── Main Render ── */
  async render(container, ctx) {
    // Sync period from shared App state
    if (App.month) this.month = App.month;
    if (App.year) this.year = App.year;
    container.innerHTML = this.template();
    this.bindEvents(container, ctx);
    await this.loadData(ctx);
    this.updateUI(container);
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
      '<div class="expenses-page">' +

      /* ── Period Selector ── */
      '<div class="fury-flex-between fury-mb-3">' +
        '<div class="fury-flex fury-gap-3">' +
          '<select class="fury-select" id="exp-month" aria-label="Month" style="width:auto">' + monthOptions + '</select>' +
          '<select class="fury-select" id="exp-year" aria-label="Year" style="width:auto">' + yearOptions + '</select>' +
        '</div>' +
        '<div style="font-size:12px;color:var(--fury-text-muted)" id="exp-updated"></div>' +
      '</div>' +

      /* ── Exchange Rate + Monthly Total Cards ── */
      '<div class="fury-grid-2 fury-mb-3">' +
        '<div class="fury-card">' +
          '<h3 style="font-size:14px;font-weight:600;color:var(--fury-text);margin-bottom:12px">Exchange Rate</h3>' +
          '<div class="fury-flex fury-gap-3">' +
            '<div class="fury-form-group" style="flex:1;margin-bottom:0">' +
              '<label class="fury-label" for="exchange-rate">UAH per 1 USD</label>' +
              '<input type="number" class="fury-input" id="exchange-rate" step="0.01" min="0" value="' + self.exchangeRate + '">' +
            '</div>' +
            '<button class="fury-btn fury-btn-secondary" id="btn-update-rate" style="align-self:flex-end;height:36px">Update</button>' +
          '</div>' +
          '<div style="margin-top:8px;font-size:11px;color:var(--fury-text-muted)" id="rate-updated-info"></div>' +
        '</div>' +
        '<div class="fury-card">' +
          '<h3 style="font-size:14px;font-weight:600;color:var(--fury-text);margin-bottom:12px">Monthly Total</h3>' +
          '<div class="fury-kpi" style="border:none;padding:0;background:transparent">' +
            '<span id="total-expenses-usd" class="fury-kpi-value">$0.00</span>' +
            '<span class="fury-kpi-label">Total expenses (USD)</span>' +
          '</div>' +
          '<div style="margin-top:4px;font-size:13px;color:var(--fury-text-secondary)">' +
            '<span id="total-expenses-uah">0.00</span> UAH' +
          '</div>' +
        '</div>' +
      '</div>' +

      /* ── Category Tabs ── */
      '<div class="fury-tabs fury-mb-3" role="tablist" aria-label="Expense categories">' +
        '<button class="fury-tab active" data-cat="all">All</button>' +
        '<button class="fury-tab" data-cat="motor">Motor</button>' +
        '<button class="fury-tab" data-cat="electronics">Electronics</button>' +
        '<button class="fury-tab" data-cat="logistics">Logistics</button>' +
        '<button class="fury-tab" data-cat="3d_print">3D Print</button>' +
        '<button class="fury-tab" data-cat="other">Other</button>' +
      '</div>' +

      /* ── Action Bar ── */
      '<div class="fury-flex-between fury-mb-2">' +
        '<span id="expense-count" style="color:var(--fury-text-secondary);font-size:13px">0 expenses</span>' +
        '<button class="fury-btn fury-btn-primary" id="btn-add-expense">+ Add Expense</button>' +
      '</div>' +

      /* ── Expenses Table ── */
      '<div class="fury-card" style="padding:0;overflow:hidden">' +
        '<div style="overflow-x:auto">' +
          '<table class="fury-table">' +
            '<thead>' +
              '<tr>' +
                '<th scope="col">Category</th>' +
                '<th scope="col">Description</th>' +
                '<th scope="col" style="text-align:right">Amount (UAH)</th>' +
                '<th scope="col" style="text-align:right">Rate</th>' +
                '<th scope="col" style="text-align:right">Amount (USD)</th>' +
                '<th scope="col">Linked Invoice</th>' +
                '<th scope="col" style="text-align:center">Actions</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody id="expenses-tbody">' +
              Skeleton.render('table-row', 4, { cols: 7 }) +
            '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +

      '</div>'
    );
  },

  /* ── Load Data ── */
  async loadData(ctx) {
    var self = this;

    try {
      // Parallel load: exchange rate, invoices, and all expenses in one query
      var parallel = await Promise.all([
        DB.getSetting('uah_usd_rate'),
        DB.getInvoices({ month: self.month, year: self.year }),
        // Single query replaces N+1 loop (was: getExpenses(inv.id) per invoice)
        DB.client
          .from('expenses')
          .select('*')
          .order('created_at', { ascending: true })
      ]);

      // Exchange rate
      var rateResult = parallel[0];
      if (rateResult && rateResult.data) {
        try {
          var rateData = typeof rateResult.data === 'string'
            ? JSON.parse(rateResult.data)
            : rateResult.data;
          if (rateData && rateData.rate) {
            self.exchangeRate = parseFloat(rateData.rate) || 42.16;
          }
        } catch (e) { /* keep default exchangeRate */ }
      }

      // Invoices
      var invoiceResult = parallel[1];
      if (invoiceResult && invoiceResult.error) {
        console.warn('[Expenses] Failed to load invoices:', invoiceResult.error.message || invoiceResult.error);
      }
      self.invoices = (invoiceResult && invoiceResult.data) ? invoiceResult.data : [];

      // Build invoice lookup map for O(1) access
      var invoiceMap = {};
      for (var i = 0; i < self.invoices.length; i++) {
        invoiceMap[self.invoices[i].id] = self.invoices[i];
      }

      // All expenses loaded in one query — attach _invoice ref and filter to period
      var allExpResult = parallel[2];
      self.expenses = [];

      if (allExpResult && !allExpResult.error && allExpResult.data) {
        for (var e = 0; e < allExpResult.data.length; e++) {
          var exp = allExpResult.data[e];

          if (exp.invoice_id && invoiceMap[exp.invoice_id]) {
            // Linked to an invoice in this period
            exp._invoice = invoiceMap[exp.invoice_id];
            self.expenses.push(exp);
          } else if (!exp.invoice_id) {
            // Unlinked — filter by created_at month/year
            var createdDate = new Date(exp.created_at);
            if (createdDate.getMonth() + 1 === self.month && createdDate.getFullYear() === self.year) {
              exp._invoice = null;
              self.expenses.push(exp);
            }
          }
        }
      }

      // Already sorted by created_at from the query

    } catch (err) {
      console.error('[Expenses] loadData error:', err);
      self.expenses = [];
      showToast('Failed to load expenses. Please refresh.', 'error');
    }
  },

  /* ── Update UI ── */
  updateUI(container) {
    var self = this;

    // Update exchange rate input
    var rateInput = container.querySelector('#exchange-rate');
    if (rateInput) {
      rateInput.value = self.exchangeRate;
    }

    // Filter expenses by active category
    var filtered = self.activeCategory === 'all'
      ? self.expenses
      : self.expenses.filter(function (exp) {
          return exp.category === self.activeCategory;
        });

    // Update count
    var countEl = container.querySelector('#expense-count');
    if (countEl) {
      countEl.textContent = filtered.length + ' expense' + (filtered.length !== 1 ? 's' : '');
    }

    // Calculate totals
    var totalUsd = 0;
    var totalUah = 0;
    for (var i = 0; i < self.expenses.length; i++) {
      totalUsd += parseFloat(self.expenses[i].amount_usd) || 0;
      totalUah += parseFloat(self.expenses[i].amount_uah) || 0;
    }

    var totalUsdEl = container.querySelector('#total-expenses-usd');
    if (totalUsdEl) {
      totalUsdEl.textContent = self.formatCurrency(totalUsd);
    }

    var totalUahEl = container.querySelector('#total-expenses-uah');
    if (totalUahEl) {
      totalUahEl.textContent = totalUah.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }

    // Render table rows
    var tbody = container.querySelector('#expenses-tbody');
    if (!tbody) return;

    if (filtered.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--fury-text-muted)">' +
        (self.activeCategory === 'all'
          ? 'No expenses recorded for this period. Click "+ Add Expense" to add one.'
          : 'No expenses in category "' + self.escapeHtml(self.getCategoryLabel(self.activeCategory)) + '".'
        ) +
        '</td></tr>';
      return;
    }

    var html = '';
    for (var j = 0; j < filtered.length; j++) {
      html += self.buildExpenseRow(filtered[j]);
    }
    tbody.innerHTML = html;

    // Update timestamp
    var updatedEl = container.querySelector('#exp-updated');
    if (updatedEl) {
      updatedEl.textContent = 'Updated: ' + new Date().toLocaleTimeString();
    }
  },

  /* ── Build Single Expense Row ── */
  buildExpenseRow(expense) {
    var self = this;
    var catInfo = self.CATEGORIES[expense.category] || self.CATEGORIES.other;
    var amountUah = parseFloat(expense.amount_uah) || 0;
    var amountUsd = parseFloat(expense.amount_usd) || 0;
    var rate = parseFloat(expense.exchange_rate) || self.exchangeRate;

    // Invoice link display
    var invoiceDisplay = '';
    if (expense._invoice) {
      var inv = expense._invoice;
      var empName = (inv.employees && inv.employees.name) ? inv.employees.name : '';
      invoiceDisplay =
        '<span class="fury-badge fury-badge-info" style="cursor:pointer" data-invoice-id="' + inv.id + '" title="Go to Invoices page">' +
        self.escapeHtml(String(inv.invoice_number || '')) +
        '</span>';
      if (empName) {
        invoiceDisplay += '<br><span style="font-size:11px;color:var(--fury-text-muted)">' + self.escapeHtml(empName) + '</span>';
      }
    } else {
      invoiceDisplay = '<span class="fury-badge fury-badge-neutral">Unlinked</span>';
    }

    return (
      '<tr>' +
        '<td>' +
          '<span style="display:inline-flex;align-items:center;gap:6px">' +
            '<span style="width:8px;height:8px;border-radius:50%;background:' + catInfo.color + ';flex-shrink:0"></span>' +
            '<span style="font-weight:500">' + self.escapeHtml(catInfo.label) + '</span>' +
          '</span>' +
        '</td>' +
        '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + self.escapeAttr(expense.description || '') + '">' + self.escapeHtml(expense.description || '') + '</td>' +
        '<td style="text-align:right;font-variant-numeric:tabular-nums">' +
          amountUah.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
        '</td>' +
        '<td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--fury-text-secondary)">' +
          rate.toFixed(2) +
        '</td>' +
        '<td style="text-align:right;font-variant-numeric:tabular-nums;font-weight:600">' +
          self.formatCurrency(amountUsd) +
        '</td>' +
        '<td>' + invoiceDisplay + '</td>' +
        '<td style="text-align:center;white-space:nowrap">' +
          '<button class="fury-btn fury-btn-ghost fury-btn-sm exp-edit-btn" ' +
            'data-expense-id="' + expense.id + '" title="Edit" aria-label="Edit expense">' +
            '&#x270E;' +
          '</button>' +
          '<button class="fury-btn fury-btn-ghost fury-btn-sm exp-delete-btn" ' +
            'data-expense-id="' + expense.id + '" ' +
            'data-expense-desc="' + self.escapeAttr(expense.description || '') + '" ' +
            'title="Delete" aria-label="Delete expense" style="color:var(--fury-danger)">' +
            '&#x2715;' +
          '</button>' +
        '</td>' +
      '</tr>'
    );
  },

  /* ── Bind Events ── */
  bindEvents(container, ctx) {
    var self = this;

    // Month/year change
    var monthSelect = container.querySelector('#exp-month');
    var yearSelect = container.querySelector('#exp-year');

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

    // Category tabs
    var tabs = container.querySelectorAll('.fury-tab[data-cat]');
    for (var t = 0; t < tabs.length; t++) {
      tabs[t].addEventListener('click', function () {
        // Update active state
        for (var i = 0; i < tabs.length; i++) {
          tabs[i].classList.remove('active');
        }
        this.classList.add('active');
        self.activeCategory = this.getAttribute('data-cat');
        self.updateUI(container);
      });
    }

    // Add expense button
    var addBtn = container.querySelector('#btn-add-expense');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        self.showExpenseModal(null, container, ctx);
      });
    }

    // Update rate button
    var updateRateBtn = container.querySelector('#btn-update-rate');
    if (updateRateBtn) {
      updateRateBtn.addEventListener('click', function () {
        self.handleUpdateRate(container, ctx);
      });
    }

    // Delegated events for table actions
    var tbody = container.querySelector('#expenses-tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var target = e.target;

        // Handle clicks on child elements inside the button
        var editBtn = target.closest('.exp-edit-btn');
        var deleteBtn = target.closest('.exp-delete-btn');

        if (editBtn) {
          var editId = editBtn.getAttribute('data-expense-id');
          var expense = self.findExpenseById(editId);
          if (expense) {
            self.showExpenseModal(expense, container, ctx);
          }
        }

        if (deleteBtn) {
          var deleteId = deleteBtn.getAttribute('data-expense-id');
          var desc = deleteBtn.getAttribute('data-expense-desc');
          self.handleDelete(deleteId, desc, container, ctx);
          return;
        }

        // Invoice badge click -> navigate to invoices page
        var invBadge = target.closest('[data-invoice-id]');
        if (invBadge) {
          window.location.hash = '#/invoices';
        }
      });
    }
  },

  /* ── Reload Data ── */
  async reloadData(container, ctx) {
    // Sync period to shared App state
    App.month = this.month;
    App.year = this.year;
    var addBtn = container.querySelector('#btn-add-expense');
    var monthSel = container.querySelector('#exp-month');
    var yearSel = container.querySelector('#exp-year');

    // Disable controls during loading
    if (addBtn) addBtn.disabled = true;
    if (monthSel) monthSel.disabled = true;
    if (yearSel) yearSel.disabled = true;

    var tbody = container.querySelector('#expenses-tbody');
    if (tbody) {
      tbody.innerHTML = Skeleton.render('table-row', 4, { cols: 7 });
    }

    try {
      await this.loadData(ctx);
      this.updateUI(container);
    } finally {
      if (addBtn) addBtn.disabled = false;
      if (monthSel) monthSel.disabled = false;
      if (yearSel) yearSel.disabled = false;
    }
  },

  /* ── Handle Update Rate ── */
  async handleUpdateRate(container, ctx) {
    var self = this;
    var rateInput = container.querySelector('#exchange-rate');
    var rateBtn = container.querySelector('#btn-update-rate');

    if (!rateInput) return;

    var newRate = parseFloat(rateInput.value);
    if (!newRate || newRate <= 0) {
      showToast('Please enter a valid exchange rate.', 'error');
      return;
    }

    if (rateBtn) {
      rateBtn.disabled = true;
      rateBtn.textContent = 'Saving...';
    }

    try {
      var result = await DB.setSetting('uah_usd_rate', {
        rate: newRate,
        updated: new Date().toISOString().split('T')[0],
      });

      if (result && result.error) {
        throw new Error(result.error.message || 'Failed to save exchange rate');
      }

      self.exchangeRate = newRate;

      var infoEl = container.querySelector('#rate-updated-info');
      if (infoEl) {
        infoEl.textContent = 'Rate updated: ' + newRate.toFixed(2) + ' UAH/USD at ' + new Date().toLocaleTimeString();
      }

      showToast('Exchange rate updated to ' + newRate.toFixed(2) + ' UAH/USD', 'success');
    } catch (err) {
      console.error('[Expenses] updateRate error:', err);
      showToast('Failed to update rate. Please try again.', 'error');
    } finally {
      if (rateBtn) {
        rateBtn.disabled = false;
        rateBtn.textContent = 'Update';
      }
    }
  },

  /* ── Handle Delete (two-click pattern) ── */
  async handleDelete(expenseId, description, container, ctx) {
    var self = this;
    var btn = container.querySelector('.exp-delete-btn[data-expense-id="' + expenseId + '"]');
    if (!btn) return;

    // First click -- ask confirmation inline
    if (!btn.dataset.confirmPending) {
      btn.dataset.confirmPending = '1';
      btn.innerHTML = '<span style="font-size:11px;color:var(--fury-danger)">Sure?</span>';

      // Reset after 3 seconds if not confirmed
      setTimeout(function () {
        if (btn.dataset.confirmPending) {
          delete btn.dataset.confirmPending;
          btn.innerHTML = '&#x2715;';
        }
      }, 3000);
      return;
    }

    // Second click -- delete
    delete btn.dataset.confirmPending;
    btn.disabled = true;
    btn.innerHTML = '...';

    try {
      var result = await DB.deleteExpense(expenseId);
      if (result && result.error) {
        throw new Error(result.error.message || 'Delete failed');
      }

      // Remove from local array
      self.expenses = self.expenses.filter(function (exp) {
        return exp.id !== expenseId;
      });

      self.updateUI(container);

      showToast('Expense deleted', 'success');
    } catch (err) {
      console.error('[Expenses] delete error:', err);
      showToast('Failed to delete expense. Please try again.', 'error');
      btn.innerHTML = '&#x2715;';
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  /* ════════════════════════════════════════════════════════
     Expense Modal (Add / Edit)
     ════════════════════════════════════════════════════════ */
  showExpenseModal(expense, container, ctx) {
    var self = this;
    var isEdit = !!expense;

    // Build invoice options for the select
    var invoiceOptions = '<option value="">-- Unlinked --</option>';
    for (var i = 0; i < self.invoices.length; i++) {
      var inv = self.invoices[i];
      var empName = (inv.employees && inv.employees.name) ? inv.employees.name : '';
      var label = String(inv.invoice_number || '');
      if (empName) label += ' (' + empName + ')';
      var selected = (expense && expense.invoice_id === inv.id) ? ' selected' : '';
      invoiceOptions += '<option value="' + inv.id + '"' + selected + '>' + self.escapeHtml(label) + '</option>';
    }

    // Category options
    var categoryOptions = '';
    var categories = Object.keys(self.CATEGORIES);
    for (var c = 0; c < categories.length; c++) {
      var catKey = categories[c];
      var catLabel = self.CATEGORIES[catKey].label;
      var catSelected = (expense && expense.category === catKey) ? ' selected' : '';
      categoryOptions += '<option value="' + catKey + '"' + catSelected + '>' + self.escapeHtml(catLabel) + '</option>';
    }

    var currentRate = (expense && expense.exchange_rate) ? expense.exchange_rate : self.exchangeRate;
    var currentUah = (expense && expense.amount_uah) ? expense.amount_uah : '';
    var currentUsd = (expense && expense.amount_usd) ? expense.amount_usd : '';
    var currentDesc = (expense && expense.description) ? expense.description : '';

    // Save trigger for focus return
    var modalTrigger = document.activeElement;

    // Create modal overlay
    var overlay = document.createElement('div');
    overlay.className = 'fury-modal-overlay';
    overlay.innerHTML =
      '<div class="fury-modal" role="dialog" aria-modal="true" aria-label="' + (isEdit ? 'Edit Expense' : 'Add Expense') + '">' +
        '<div class="fury-modal-header">' +
          '<span class="fury-modal-title">' + (isEdit ? 'Edit Expense' : 'Add Expense') + '</span>' +
          '<button class="fury-modal-close" id="modal-close-btn" aria-label="Close">&times;</button>' +
        '</div>' +
        '<div class="fury-modal-body">' +

          '<div class="fury-form-group">' +
            '<label class="fury-label" for="modal-category">Category</label>' +
            '<select class="fury-select" id="modal-category">' + categoryOptions + '</select>' +
          '</div>' +

          '<div class="fury-form-group">' +
            '<label class="fury-label" for="modal-description">Description</label>' +
            '<input type="text" class="fury-input" id="modal-description" ' +
              'placeholder="e.g. T-Motor F90 2806.5 x2" ' +
              'value="' + self.escapeAttr(currentDesc) + '">' +
          '</div>' +

          '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">' +
            '<div class="fury-form-group">' +
              '<label class="fury-label" for="modal-amount-uah">Amount (UAH)</label>' +
              '<input type="number" class="fury-input" id="modal-amount-uah" ' +
                'step="0.01" min="0" placeholder="0.00" ' +
                'value="' + (currentUah != null && currentUah !== '' ? currentUah : '') + '">' +
            '</div>' +
            '<div class="fury-form-group">' +
              '<label class="fury-label" for="modal-amount-usd">Amount (USD)</label>' +
              '<input type="number" class="fury-input" id="modal-amount-usd" ' +
                'step="0.01" min="0" placeholder="0.00" ' +
                'value="' + (currentUsd != null && currentUsd !== '' ? currentUsd : '') + '">' +
            '</div>' +
          '</div>' +

          '<div class="fury-form-group">' +
            '<label class="fury-label" for="modal-rate">Exchange Rate (UAH/USD)</label>' +
            '<input type="number" class="fury-input" id="modal-rate" ' +
              'step="0.01" min="0" value="' + currentRate + '">' +
            '<span class="fury-help-text">Change UAH to auto-calculate USD, or vice versa</span>' +
          '</div>' +

          '<div class="fury-form-group">' +
            '<label class="fury-label" for="modal-invoice">Link to Invoice</label>' +
            '<select class="fury-select" id="modal-invoice">' + invoiceOptions + '</select>' +
          '</div>' +

        '</div>' +
        '<div class="fury-modal-footer">' +
          '<button class="fury-btn fury-btn-secondary" id="modal-cancel-btn">Cancel</button>' +
          '<button class="fury-btn fury-btn-primary" id="modal-save-btn">' + (isEdit ? 'Update' : 'Save') + '</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);
    self.modalOverlay = overlay;
    document.body.classList.add('fury-modal-open');

    // Activate with slight delay for animation
    requestAnimationFrame(function () {
      overlay.classList.add('active');
    });

    // Focus the description field
    var descInput = overlay.querySelector('#modal-description');
    if (descInput) {
      setTimeout(function () { descInput.focus(); }, 100);
    }

    // ── Auto-calc: UAH -> USD ──
    var uahInput = overlay.querySelector('#modal-amount-uah');
    var usdInput = overlay.querySelector('#modal-amount-usd');
    var rateInput = overlay.querySelector('#modal-rate');
    var lastEdited = null; // 'uah' or 'usd'

    uahInput.addEventListener('input', function () {
      lastEdited = 'uah';
      var uah = parseFloat(this.value) || 0;
      var rate = parseFloat(rateInput.value) || self.exchangeRate;
      if (rate > 0 && uah > 0) {
        usdInput.value = (uah / rate).toFixed(2);
      } else if (uah === 0) {
        usdInput.value = '';
      }
    });

    usdInput.addEventListener('input', function () {
      lastEdited = 'usd';
      var usd = parseFloat(this.value) || 0;
      var rate = parseFloat(rateInput.value) || self.exchangeRate;
      if (rate > 0 && usd > 0) {
        uahInput.value = (usd * rate).toFixed(2);
      } else if (usd === 0) {
        uahInput.value = '';
      }
    });

    rateInput.addEventListener('input', function () {
      var rate = parseFloat(this.value) || 0;
      if (rate <= 0) return;

      // Recalculate based on last edited field
      if (lastEdited === 'usd') {
        var usd = parseFloat(usdInput.value) || 0;
        if (usd > 0) {
          uahInput.value = (usd * rate).toFixed(2);
        }
      } else {
        // Default to recalculating USD from UAH
        var uah = parseFloat(uahInput.value) || 0;
        if (uah > 0) {
          usdInput.value = (uah / rate).toFixed(2);
        }
      }
    });

    // ── Close handlers ──
    var escHandler = function (e) {
      if (e.key === 'Escape') closeModal();
    };

    // Focus trap
    var focusTrapHandler = function (e) {
      if (e.key !== 'Tab') return;
      var focusable = overlay.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
      if (focusable.length === 0) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    overlay.addEventListener('keydown', focusTrapHandler);

    var closeModal = function () {
      document.removeEventListener('keydown', escHandler);
      overlay.removeEventListener('keydown', focusTrapHandler);
      overlay.classList.remove('active');
      document.body.classList.remove('fury-modal-open');
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        self.modalOverlay = null;
      }, 250);
      // Return focus to trigger
      if (modalTrigger && typeof modalTrigger.focus === 'function') {
        modalTrigger.focus();
      }
    };

    overlay.querySelector('#modal-close-btn').addEventListener('click', closeModal);
    overlay.querySelector('#modal-cancel-btn').addEventListener('click', closeModal);

    // Close on overlay click (outside modal)
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeModal();
    });

    // Close on Escape key
    document.addEventListener('keydown', escHandler);

    // ── Double-submit guard ──
    var isSubmitting = false;

    // ── Save handler ──
    overlay.querySelector('#modal-save-btn').addEventListener('click', function () {
      if (isSubmitting) return;
      isSubmitting = true;
      self.handleSaveExpense(expense, overlay, container, ctx, closeModal).finally(function () {
        isSubmitting = false;
      });
    });

    // Allow Enter key to save (but not from number inputs or textarea)
    overlay.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        var active = document.activeElement;
        if (active && (active.tagName === 'SELECT' || active.tagName === 'TEXTAREA' || active.type === 'number')) return;
        if (isSubmitting) return;
        isSubmitting = true;
        self.handleSaveExpense(expense, overlay, container, ctx, closeModal).finally(function () {
          isSubmitting = false;
        });
      }
    });
  },

  /* ── Handle Save (from modal) ── */
  async handleSaveExpense(existingExpense, overlay, container, ctx, closeModal) {
    var self = this;

    var category = overlay.querySelector('#modal-category').value;
    var description = overlay.querySelector('#modal-description').value.trim();
    var amountUah = parseFloat(overlay.querySelector('#modal-amount-uah').value) || 0;
    var amountUsd = parseFloat(overlay.querySelector('#modal-amount-usd').value) || 0;
    var rate = parseFloat(overlay.querySelector('#modal-rate').value) || self.exchangeRate;
    var invoiceId = overlay.querySelector('#modal-invoice').value || null;

    // Validation
    if (!self.CATEGORIES[category]) {
      showToast('Please select a valid category.', 'error');
      return;
    }

    if (!description) {
      showToast('Please enter a description.', 'error');
      overlay.querySelector('#modal-description').focus();
      return;
    }

    if (description.length > 500) {
      showToast('Description must be 500 characters or less.', 'error');
      return;
    }

    if (amountUah < 0) {
      showToast('Amount UAH cannot be negative.', 'error');
      return;
    }

    if (amountUsd < 0) {
      showToast('Amount USD cannot be negative.', 'error');
      return;
    }

    if (amountUah <= 0 && amountUsd <= 0) {
      showToast('Please enter an amount in UAH or USD.', 'error');
      return;
    }

    if (rate <= 0) {
      showToast('Exchange rate must be positive.', 'error');
      return;
    }

    // Auto-calculate if one side is missing
    if (amountUah > 0 && amountUsd === 0 && rate > 0) {
      amountUsd = amountUah / rate;
    } else if (amountUsd > 0 && amountUah === 0 && rate > 0) {
      amountUah = amountUsd * rate;
    }

    // Round to 2 decimals
    amountUah = Math.round(amountUah * 100) / 100;
    amountUsd = Math.round(amountUsd * 100) / 100;
    rate = Math.round(rate * 100) / 100;

    var saveBtn = overlay.querySelector('#modal-save-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      var expenseData = {
        category: category,
        description: description,
        amount_uah: amountUah,
        amount_usd: amountUsd,
        exchange_rate: rate,
        invoice_id: invoiceId,
      };

      if (existingExpense) {
        expenseData.id = existingExpense.id;
      }

      var result = await DB.upsertExpense(expenseData);
      if (result && result.error) {
        throw new Error(result.error.message || 'Save failed');
      }

      closeModal();

      // Reload data
      await self.loadData(ctx);
      self.updateUI(container);

      showToast(
        existingExpense ? 'Expense updated' : 'Expense added',
        'success'
      );
    } catch (err) {
      console.error('[Expenses] save error:', err);
      showToast('Failed to save expense. Please try again.', 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = existingExpense ? 'Update' : 'Save';
      }
    }
  },

  /* ── Helper: Find Expense by ID ── */
  findExpenseById(id) {
    for (var i = 0; i < this.expenses.length; i++) {
      if (this.expenses[i].id === id) return this.expenses[i];
    }
    return null;
  },

  /* ── Helper: Category Label ── */
  getCategoryLabel(category) {
    var cat = this.CATEGORIES[category];
    return cat ? cat.label : category;
  },

  /* ── Formatting Helpers ── */
  formatCurrency(amount) {
    if (amount == null || isNaN(amount)) return '$0.00';
    return '$' + Number(amount).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  },

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  escapeAttr(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /* ── Cleanup on page leave ── */
  destroy() {
    if (this.modalOverlay && this.modalOverlay.parentNode) {
      this.modalOverlay.parentNode.removeChild(this.modalOverlay);
      this.modalOverlay = null;
      document.body.classList.remove('fury-modal-open');
    }
  },
};
