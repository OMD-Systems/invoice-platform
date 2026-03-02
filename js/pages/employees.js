/* =============================================================
   Employees — Directory & Profile Management
   Invoice Platform · OMD Systems
   ============================================================= */

const Employees = {
  title: 'Employees',
  employees: [],
  allEmployees: [],
  selectedEmployee: null,
  searchQuery: '',

  /* ── Main Render ── */
  async render(container, ctx) {
    container.innerHTML = '<div class="loading">Loading employees...</div>';
    try {
      await this.loadData(ctx);
      container.innerHTML = this.template(ctx);
      this.bindEvents(container, ctx);
    } catch (err) {
      console.error('[Employees] render error:', err);
      container.innerHTML =
        '<div class="loading" style="color:#EF4444;">' +
        'Error loading employees: ' + (err.message || 'Unknown error') +
        '</div>';
    }
  },

  /* ── HTML Template ── */
  template(ctx) {
    var self = this;
    var isAdmin = ctx.role === 'admin';

    // Build rows
    var rows = '';
    for (var i = 0; i < self.employees.length; i++) {
      var emp = self.employees[i];

      // Type badge
      var typeBadge = emp.employee_type === 'Hourly Contractor'
        ? '<span class="emp-badge emp-badge-hc">HC</span>'
        : '<span class="emp-badge emp-badge-fte">FTE</span>';

      // Active status
      var activeStatus = emp.is_active
        ? '<span class="emp-status-dot emp-status-active" title="Active"></span>'
        : '<span class="emp-status-dot emp-status-inactive" title="Inactive"></span>';

      // Format badge
      var formatBadge = '<span class="emp-badge emp-badge-format">' + self.escapeHtml(emp.invoice_format || 'WS') + '</span>';

      // Rate display
      var rateDisplay = emp.rate_usd
        ? '$' + parseFloat(emp.rate_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '—';

      rows +=
        '<tr class="emp-row" data-id="' + emp.id + '">' +
        '<td class="emp-cell emp-cell-status">' + activeStatus + '</td>' +
        '<td class="emp-cell emp-cell-pin">' + self.escapeHtml(emp.pin || '—') + '</td>' +
        '<td class="emp-cell emp-cell-name">' + self.escapeHtml(emp.name) + '</td>' +
        '<td class="emp-cell emp-cell-type">' + typeBadge + '</td>' +
        '<td class="emp-cell emp-cell-rate">' + rateDisplay + '</td>' +
        '<td class="emp-cell emp-cell-phone">' + self.escapeHtml(emp.phone || '—') + '</td>' +
        '<td class="emp-cell emp-cell-format">' + formatBadge + '</td>' +
        '<td class="emp-cell emp-cell-actions">' +
        '<button class="fury-btn-sm emp-btn-edit" data-id="' + emp.id + '" title="Edit">&#x270E;</button>' +
        '<button class="fury-btn-sm emp-btn-invoices" data-id="' + emp.id + '" title="View Invoices">&#x25C8;</button>' +
        '</td>' +
        '</tr>';
    }

    // Empty state
    if (self.employees.length === 0) {
      rows =
        '<tr><td colspan="8" style="text-align:center;color:#6B7280;padding:40px;">' +
        (self.searchQuery ? 'No employees match your search.' : 'No employees found.') +
        '</td></tr>';
    }

    return '' +
      '<div class="emp-page">' +

      /* ── Header ── */
      '<div class="emp-header">' +
      '<div class="emp-header-left">' +
      '<div class="emp-search-wrap">' +
      '<input type="text" class="fury-input emp-search" id="emp-search" ' +
      'placeholder="Search by name, PIN, or phone..." ' +
      'value="' + self.escapeHtml(self.searchQuery) + '" />' +
      '</div>' +
      '<span class="emp-count">' + self.employees.length + ' employee' + (self.employees.length !== 1 ? 's' : '') + '</span>' +
      '</div>' +
      '<div class="emp-header-right">' +
      (isAdmin
        ? '<button class="fury-btn-primary" id="emp-btn-add">+ Add Employee</button>'
        : '') +
      '</div>' +
      '</div>' +

      /* ── Table ── */
      '<div class="fury-card emp-card">' +
      '<div class="emp-table-wrap">' +
      '<table class="fury-table emp-table">' +
      '<thead>' +
      '<tr>' +
      '<th class="emp-th" style="width:32px;"></th>' +
      '<th class="emp-th">PIN</th>' +
      '<th class="emp-th emp-th-name">Name</th>' +
      '<th class="emp-th">Type</th>' +
      '<th class="emp-th">Rate</th>' +
      '<th class="emp-th">Phone</th>' +
      '<th class="emp-th">Format</th>' +
      '<th class="emp-th" style="width:80px;">Actions</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody id="emp-tbody">' +
      rows +
      '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>' +

      '</div>' +

      /* ── Modal Container ── */
      '<div class="fury-modal-overlay" id="emp-modal-overlay" style="display:none;">' +
      '<div class="fury-modal" id="emp-modal"></div>' +
      '</div>' +

      /* ── Page Styles ── */
      '<style>' +
      '.emp-page { max-width: 1200px; }' +
      '.emp-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px; }' +
      '.emp-header-left { display:flex; align-items:center; gap:12px; }' +
      '.emp-header-right { display:flex; align-items:center; gap:8px; }' +
      '.emp-search-wrap { position:relative; }' +
      '.emp-search { width:280px; padding:8px 12px; background:#1A1A1F; border:1px solid #2A2A30; border-radius:6px; color:#E5E7EB; font-size:13px; }' +
      '.emp-search:focus { border-color:#00E5FF; outline:none; }' +
      '.emp-search::placeholder { color:#4B5563; }' +
      '.emp-count { font-size:12px; color:#6B7280; }' +
      '.emp-card { overflow:visible; padding:0; }' +
      '.emp-table-wrap { overflow-x:auto; }' +
      '.emp-table { width:100%; border-collapse:collapse; font-size:13px; }' +
      '.emp-th { padding:10px 12px; text-align:left; font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1F1F23; white-space:nowrap; }' +
      '.emp-th-name { min-width:200px; }' +
      '.emp-cell { padding:10px 12px; border-bottom:1px solid #1A1A1F; vertical-align:middle; }' +
      '.emp-cell-name { font-weight:500; color:#E5E7EB; }' +
      '.emp-cell-pin { font-family:"JetBrains Mono","Fira Code",monospace; color:#9CA3AF; font-size:12px; }' +
      '.emp-cell-rate { font-variant-numeric:tabular-nums; color:#10B981; font-weight:500; }' +
      '.emp-cell-phone { color:#9CA3AF; font-size:12px; }' +
      '.emp-cell-actions { white-space:nowrap; }' +
      '.emp-cell-status { text-align:center; width:32px; }' +
      '.emp-row:hover { background:rgba(0,229,255,0.03); }' +

      /* ── Status dot ── */
      '.emp-status-dot { display:inline-block; width:8px; height:8px; border-radius:50%; }' +
      '.emp-status-active { background:#10B981; box-shadow:0 0 4px rgba(16,185,129,0.4); }' +
      '.emp-status-inactive { background:#4B5563; }' +

      /* ── Badges ── */
      '.emp-badge { display:inline-block; padding:2px 8px; font-size:10px; font-weight:600; border-radius:4px; letter-spacing:0.5px; text-transform:uppercase; }' +
      '.emp-badge-fte { background:rgba(0,229,255,0.12); color:#00E5FF; }' +
      '.emp-badge-hc { background:rgba(139,92,246,0.15); color:#A78BFA; }' +
      '.emp-badge-format { background:rgba(107,114,128,0.15); color:#9CA3AF; }' +

      /* ── Action Buttons ── */
      '.fury-btn-sm { background:transparent; border:1px solid #2A2A30; border-radius:4px; color:#9CA3AF; padding:4px 8px; font-size:13px; cursor:pointer; margin-right:4px; transition:border-color 0.2s,color 0.2s; }' +
      '.fury-btn-sm:hover { border-color:#00E5FF; color:#00E5FF; }' +

      /* ── Buttons (shared with timesheet) ── */
      '.fury-btn-primary { padding:8px 20px; background:#00E5FF; color:#0D0D0F; border:none; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; transition:background 0.2s,opacity 0.2s; }' +
      '.fury-btn-primary:hover { background:#00D4EC; }' +
      '.fury-btn-primary:disabled { opacity:0.4; cursor:not-allowed; }' +
      '.fury-btn-secondary { padding:8px 16px; background:transparent; color:#9CA3AF; border:1px solid #2A2A30; border-radius:6px; font-size:13px; font-weight:500; cursor:pointer; transition:border-color 0.2s,color 0.2s; }' +
      '.fury-btn-secondary:hover { border-color:#00E5FF; color:#00E5FF; }' +
      '.fury-card { background:#111114; border:1px solid #1F1F23; border-radius:10px; padding:20px; }' +

      /* ── Modal Overlay ── */
      '.fury-modal-overlay { position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.7); backdrop-filter:blur(4px); display:flex; align-items:center; justify-content:center; z-index:5000; }' +
      '.fury-modal { background:#111114; border:1px solid #1F1F23; border-radius:12px; width:560px; max-width:95vw; max-height:90vh; overflow-y:auto; padding:0; box-shadow:0 20px 60px rgba(0,0,0,0.5); }' +

      /* ── Modal Header ── */
      '.emp-modal-header { display:flex; justify-content:space-between; align-items:center; padding:20px 24px 16px; border-bottom:1px solid #1F1F23; }' +
      '.emp-modal-title { font-size:16px; font-weight:600; color:#E5E7EB; }' +
      '.emp-modal-close { background:none; border:none; color:#6B7280; font-size:20px; cursor:pointer; padding:4px; transition:color 0.2s; }' +
      '.emp-modal-close:hover { color:#EF4444; }' +

      /* ── Modal Body ── */
      '.emp-modal-body { padding:20px 24px; display:flex; flex-direction:column; gap:16px; }' +
      '.emp-modal-section { border-bottom:1px solid #1A1A1F; padding-bottom:16px; }' +
      '.emp-modal-section:last-child { border-bottom:none; padding-bottom:0; }' +
      '.emp-modal-section-title { font-size:11px; font-weight:600; color:#00E5FF; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px; }' +

      /* ── Form Groups ── */
      '.fury-form-group { display:flex; flex-direction:column; gap:4px; }' +
      '.fury-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }' +
      '.fury-label { font-size:11px; font-weight:500; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.5px; }' +
      '.fury-input { padding:8px 12px; background:#1A1A1F; border:1px solid #2A2A30; border-radius:6px; color:#E5E7EB; font-size:13px; outline:none; transition:border-color 0.2s; }' +
      '.fury-input:focus { border-color:#00E5FF; }' +
      '.fury-input::placeholder { color:#4B5563; }' +
      '.fury-input:disabled { opacity:0.5; cursor:not-allowed; }' +
      '.fury-select { padding:8px 12px; background:#1A1A1F; border:1px solid #2A2A30; border-radius:6px; color:#E5E7EB; font-size:13px; outline:none; transition:border-color 0.2s; appearance:none; -webkit-appearance:none; cursor:pointer; }' +
      '.fury-select:focus { border-color:#00E5FF; }' +
      '.fury-textarea { padding:8px 12px; background:#1A1A1F; border:1px solid #2A2A30; border-radius:6px; color:#E5E7EB; font-size:13px; outline:none; transition:border-color 0.2s; resize:vertical; min-height:60px; font-family:inherit; }' +
      '.fury-textarea:focus { border-color:#00E5FF; }' +
      '.fury-checkbox-group { display:flex; align-items:center; gap:8px; }' +
      '.fury-checkbox-group input[type="checkbox"] { accent-color:#00E5FF; width:16px; height:16px; cursor:pointer; }' +
      '.fury-checkbox-label { font-size:13px; color:#E5E7EB; cursor:pointer; }' +

      /* ── Modal Footer ── */
      '.emp-modal-footer { display:flex; justify-content:flex-end; gap:8px; padding:16px 24px 20px; border-top:1px solid #1F1F23; }' +

      /* ── Toast (if not defined by timesheet.js) ── */
      '.fury-toast { position:fixed; bottom:24px; right:24px; padding:12px 24px; border-radius:8px; font-size:13px; font-weight:500; color:#E5E7EB; z-index:10000; opacity:0; transform:translateY(12px); transition:opacity 0.3s,transform 0.3s; pointer-events:none; }' +
      '.fury-toast.show { opacity:1; transform:translateY(0); pointer-events:auto; }' +
      '.fury-toast-success { background:#065F46; border:1px solid #10B981; }' +
      '.fury-toast-error { background:#7F1D1D; border:1px solid #EF4444; }' +
      '.fury-toast-info { background:#1E3A5F; border:1px solid #3B82F6; }' +
      '</style>';
  },

  /* ── Load Data ── */
  async loadData(ctx) {
    var self = this;

    if (ctx.role === 'admin') {
      // Admin sees all employees
      var result = await DB.getEmployees();
      self.allEmployees = (result && result.data) ? result.data : [];
    } else if (ctx.role === 'lead') {
      // Lead sees team members only
      var tmResult = await DB.getTeamMembersByLead(ctx.user.email);
      var teamMembers = (tmResult && tmResult.data) ? tmResult.data : [];
      if (teamMembers.length > 0) {
        var memberIds = {};
        for (var tm = 0; tm < teamMembers.length; tm++) {
          memberIds[teamMembers[tm].employee_id] = true;
        }
        var allResult = await DB.getEmployees();
        self.allEmployees = ((allResult && allResult.data) ? allResult.data : []).filter(function (emp) {
          return memberIds[emp.id];
        });
      } else {
        self.allEmployees = [];
      }
    } else {
      // Viewer sees all employees (read-only)
      var viewerResult = await DB.getEmployees();
      self.allEmployees = (viewerResult && viewerResult.data) ? viewerResult.data : [];
    }

    // Sort: active first, then by name
    self.allEmployees.sort(function (a, b) {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      return (a.name || '').localeCompare(b.name || '');
    });

    // Apply search filter
    self.applySearch();
  },

  /* ── Apply Search Filter ── */
  applySearch() {
    var self = this;
    var q = self.searchQuery.toLowerCase().trim();

    if (!q) {
      self.employees = self.allEmployees.slice();
      return;
    }

    self.employees = self.allEmployees.filter(function (emp) {
      var name = (emp.name || '').toLowerCase();
      var pin = (emp.pin || '').toLowerCase();
      var phone = (emp.phone || '').toLowerCase();
      var fullNameLat = (emp.full_name_lat || '').toLowerCase();
      return name.indexOf(q) !== -1 ||
        pin.indexOf(q) !== -1 ||
        phone.indexOf(q) !== -1 ||
        fullNameLat.indexOf(q) !== -1;
    });
  },

  /* ── Bind Events ── */
  bindEvents(container, ctx) {
    var self = this;

    // Search input with debounce
    var searchInput = container.querySelector('#emp-search');
    var searchTimeout = null;

    if (searchInput) {
      searchInput.addEventListener('input', function () {
        var val = this.value;
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function () {
          self.searchQuery = val;
          self.applySearch();
          self.refreshTable(container, ctx);
        }, 250);
      });
    }

    // Add Employee button (admin only)
    var addBtn = container.querySelector('#emp-btn-add');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        self.showEditModal(null, container, ctx);
      });
    }

    // Delegate clicks on edit/invoices buttons
    var tbody = container.querySelector('#emp-tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var editBtn = e.target.closest('.emp-btn-edit');
        var invoicesBtn = e.target.closest('.emp-btn-invoices');

        if (editBtn) {
          var empId = editBtn.getAttribute('data-id');
          var employee = self.findEmployee(empId);
          if (employee) {
            self.showEditModal(employee, container, ctx);
          }
        }

        if (invoicesBtn) {
          var invEmpId = invoicesBtn.getAttribute('data-id');
          window.location.hash = '#/invoices?employee=' + invEmpId;
        }
      });
    }

    // Close modal on overlay click
    var overlay = container.querySelector('#emp-modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) {
          self.closeModal(container);
        }
      });
    }

    // Close modal on Escape key
    self._escHandler = function (e) {
      if (e.key === 'Escape') {
        self.closeModal(container);
      }
    };
    document.addEventListener('keydown', self._escHandler);
  },

  /* ── Refresh Table Body (after search) ── */
  refreshTable(container, ctx) {
    var self = this;
    var tbody = container.querySelector('#emp-tbody');
    var countEl = container.querySelector('.emp-count');

    if (!tbody) return;

    var isAdmin = ctx.role === 'admin';
    var rows = '';

    for (var i = 0; i < self.employees.length; i++) {
      var emp = self.employees[i];

      var typeBadge = emp.employee_type === 'Hourly Contractor'
        ? '<span class="emp-badge emp-badge-hc">HC</span>'
        : '<span class="emp-badge emp-badge-fte">FTE</span>';

      var activeStatus = emp.is_active
        ? '<span class="emp-status-dot emp-status-active" title="Active"></span>'
        : '<span class="emp-status-dot emp-status-inactive" title="Inactive"></span>';

      var formatBadge = '<span class="emp-badge emp-badge-format">' + self.escapeHtml(emp.invoice_format || 'WS') + '</span>';

      var rateDisplay = emp.rate_usd
        ? '$' + parseFloat(emp.rate_usd).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '—';

      rows +=
        '<tr class="emp-row" data-id="' + emp.id + '">' +
        '<td class="emp-cell emp-cell-status">' + activeStatus + '</td>' +
        '<td class="emp-cell emp-cell-pin">' + self.escapeHtml(emp.pin || '—') + '</td>' +
        '<td class="emp-cell emp-cell-name">' + self.escapeHtml(emp.name) + '</td>' +
        '<td class="emp-cell emp-cell-type">' + typeBadge + '</td>' +
        '<td class="emp-cell emp-cell-rate">' + rateDisplay + '</td>' +
        '<td class="emp-cell emp-cell-phone">' + self.escapeHtml(emp.phone || '—') + '</td>' +
        '<td class="emp-cell emp-cell-format">' + formatBadge + '</td>' +
        '<td class="emp-cell emp-cell-actions">' +
        '<button class="fury-btn-sm emp-btn-edit" data-id="' + emp.id + '" title="Edit">&#x270E;</button>' +
        '<button class="fury-btn-sm emp-btn-invoices" data-id="' + emp.id + '" title="View Invoices">&#x25C8;</button>' +
        '</td>' +
        '</tr>';
    }

    if (self.employees.length === 0) {
      rows =
        '<tr><td colspan="8" style="text-align:center;color:#6B7280;padding:40px;">' +
        (self.searchQuery ? 'No employees match your search.' : 'No employees found.') +
        '</td></tr>';
    }

    tbody.innerHTML = rows;

    if (countEl) {
      countEl.textContent = self.employees.length + ' employee' + (self.employees.length !== 1 ? 's' : '');
    }
  },

  /* ── Show Edit/Add Modal ── */
  showEditModal(employee, container, ctx) {
    var self = this;
    var overlay = container.querySelector('#emp-modal-overlay');
    var modal = container.querySelector('#emp-modal');

    if (!overlay || !modal) return;

    modal.innerHTML = self.renderModal(employee, ctx);
    overlay.style.display = 'flex';

    // Bind modal events
    self.bindModalEvents(employee, container, ctx);

    // Focus first input
    var firstInput = modal.querySelector('#emp-field-pin');
    if (firstInput) {
      setTimeout(function () { firstInput.focus(); }, 100);
    }
  },

  /* ── Close Modal ── */
  closeModal(container) {
    var overlay = container.querySelector('#emp-modal-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  },

  /* ── Render Modal HTML ── */
  renderModal(employee, ctx) {
    var self = this;
    var isNew = !employee;
    var title = isNew ? 'Add Employee' : 'Edit Employee';
    var emp = employee || {};
    var isAdmin = ctx.role === 'admin';

    return '' +
      /* ── Header ── */
      '<div class="emp-modal-header">' +
      '<span class="emp-modal-title">' + title + '</span>' +
      '<button class="emp-modal-close" id="emp-modal-close">&times;</button>' +
      '</div>' +

      /* ── Body ── */
      '<div class="emp-modal-body">' +

      /* Section: Basic Info */
      '<div class="emp-modal-section">' +
      '<div class="emp-modal-section-title">Basic Information</div>' +
      '<div class="fury-form-row">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="emp-field-pin">PIN (4 digits)</label>' +
      '<input type="text" class="fury-input" id="emp-field-pin" maxlength="4" pattern="[0-9]{4}" ' +
      'placeholder="0001" value="' + self.escapeHtml(emp.pin || '') + '" />' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="emp-field-name">Name (Surname, First)</label>' +
      '<input type="text" class="fury-input" id="emp-field-name" ' +
      'placeholder="Persystyi, Kostiantyn" value="' + self.escapeHtml(emp.name || '') + '" />' +
      '</div>' +
      '</div>' +

      '<div class="fury-form-group" style="margin-top:12px;">' +
      '<label class="fury-label" for="emp-field-full-name-lat">Full Name (Latin, for invoice header)</label>' +
      '<input type="text" class="fury-input" id="emp-field-full-name-lat" ' +
      'placeholder="PERSYSTYI KOSTIANTYN" value="' + self.escapeHtml(emp.full_name_lat || '') + '" />' +
      '</div>' +

      '<div class="fury-form-group" style="margin-top:12px;">' +
      '<label class="fury-label" for="emp-field-address">Address (Latin transliteration)</label>' +
      '<textarea class="fury-textarea" id="emp-field-address" ' +
      'placeholder="Street, City, Region, Country, ZIP">' + self.escapeHtml(emp.address || '') + '</textarea>' +
      '</div>' +

      '<div class="fury-form-group" style="margin-top:12px;">' +
      '<label class="fury-label" for="emp-field-phone">Phone</label>' +
      '<input type="text" class="fury-input" id="emp-field-phone" ' +
      'placeholder="+380 XX XXX XX XX" value="' + self.escapeHtml(emp.phone || '') + '" />' +
      '</div>' +
      '</div>' +

      /* Section: Banking */
      '<div class="emp-modal-section">' +
      '<div class="emp-modal-section-title">Banking Details</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="emp-field-iban">IBAN</label>' +
      '<input type="text" class="fury-input" id="emp-field-iban" maxlength="29" ' +
      'placeholder="UA000000000000000000000000000" value="' + self.escapeHtml(emp.iban || '') + '" />' +
      '</div>' +

      '<div class="fury-form-row" style="margin-top:12px;">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="emp-field-swift">SWIFT / BIC</label>' +
      '<input type="text" class="fury-input" id="emp-field-swift" ' +
      'placeholder="UNJSUAUKXXX" value="' + self.escapeHtml(emp.swift || 'UNJSUAUKXXX') + '" />' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="emp-field-bank-name">Bank Name</label>' +
      '<input type="text" class="fury-input" id="emp-field-bank-name" ' +
      'placeholder="JSC UNIVERSAL BANK, KYIV, UKRAINE" value="' + self.escapeHtml(emp.bank_name || 'JSC UNIVERSAL BANK, KYIV, UKRAINE') + '" />' +
      '</div>' +
      '</div>' +

      '<div class="fury-form-group" style="margin-top:12px;">' +
      '<label class="fury-label" for="emp-field-receiver-name">Receiver Name (for bank section)</label>' +
      '<input type="text" class="fury-input" id="emp-field-receiver-name" ' +
      'placeholder="PE PERSYSTYI KOSTIANTYN" value="' + self.escapeHtml(emp.receiver_name || '') + '" />' +
      '</div>' +
      '</div>' +

      /* Section: Invoice & Rate */
      '<div class="emp-modal-section">' +
      '<div class="emp-modal-section-title">Invoice & Rate Settings</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="emp-field-service-desc">Service Description</label>' +
      '<input type="text" class="fury-input" id="emp-field-service-desc" ' +
      'placeholder="UAV Systems Development Services" value="' + self.escapeHtml(emp.service_description || 'UAV Systems Development Services') + '" />' +
      '</div>' +

      '<div class="fury-form-row" style="margin-top:12px;">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="emp-field-rate">Rate USD</label>' +
      '<input type="number" class="fury-input" id="emp-field-rate" min="0" step="0.01" ' +
      'placeholder="0.00" value="' + (emp.rate_usd || '') + '" />' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="emp-field-type">Employee Type</label>' +
      '<select class="fury-select" id="emp-field-type">' +
      '<option value="FTE"' + (emp.employee_type === 'FTE' || !emp.employee_type ? ' selected' : '') + '>FTE (Full-Time)</option>' +
      '<option value="Hourly Contractor"' + (emp.employee_type === 'Hourly Contractor' ? ' selected' : '') + '>Hourly Contractor</option>' +
      '</select>' +
      '</div>' +
      '</div>' +

      '<div class="fury-form-row" style="margin-top:12px;">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="emp-field-invoice-format">Invoice Format</label>' +
      '<select class="fury-select" id="emp-field-invoice-format">' +
      '<option value="WS"' + (emp.invoice_format === 'WS' || !emp.invoice_format ? ' selected' : '') + '>WS</option>' +
      '<option value="FOP"' + (emp.invoice_format === 'FOP' ? ' selected' : '') + '>FOP</option>' +
      '<option value="CUSTOM"' + (emp.invoice_format === 'CUSTOM' ? ' selected' : '') + '>CUSTOM</option>' +
      '</select>' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="emp-field-invoice-prefix">Invoice Prefix</label>' +
      '<input type="text" class="fury-input" id="emp-field-invoice-prefix" ' +
      'placeholder="WS-Invoice" value="' + self.escapeHtml(emp.invoice_prefix || 'WS-Invoice') + '" />' +
      '</div>' +
      '</div>' +

      '<div class="fury-form-row" style="margin-top:12px;">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="emp-field-next-invoice">Next Invoice Number</label>' +
      '<input type="number" class="fury-input" id="emp-field-next-invoice" min="1" step="1" ' +
      'value="' + (emp.next_invoice_number || 1) + '" />' +
      '</div>' +
      '<div class="fury-form-group" style="justify-content:flex-end;">' +
      '<div class="fury-checkbox-group" style="margin-top:20px;">' +
      '<input type="checkbox" id="emp-field-active" ' + (emp.is_active !== false ? 'checked' : '') + ' />' +
      '<label class="fury-checkbox-label" for="emp-field-active">Active</label>' +
      '</div>' +
      '</div>' +
      '</div>' +

      '</div>' +
      '</div>' +

      /* ── Footer ── */
      '<div class="emp-modal-footer">' +
      '<button class="fury-btn-secondary" id="emp-modal-cancel">Cancel</button>' +
      '<button class="fury-btn-primary" id="emp-modal-save">' + (isNew ? 'Add Employee' : 'Save Changes') + '</button>' +
      '</div>';
  },

  /* ── Bind Modal Events ── */
  bindModalEvents(employee, container, ctx) {
    var self = this;
    var modal = container.querySelector('#emp-modal');
    if (!modal) return;

    // Close button
    var closeBtn = modal.querySelector('#emp-modal-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        self.closeModal(container);
      });
    }

    // Cancel button
    var cancelBtn = modal.querySelector('#emp-modal-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        self.closeModal(container);
      });
    }

    // Save button
    var saveBtn = modal.querySelector('#emp-modal-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        self.handleModalSave(employee, container, ctx);
      });
    }

    // Enter key on inputs -> trigger save
    var inputs = modal.querySelectorAll('.fury-input, .fury-textarea');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey && this.tagName !== 'TEXTAREA') {
          e.preventDefault();
          saveBtn.click();
        }
      });
    }
  },

  /* ── Handle Modal Save ── */
  async handleModalSave(existingEmployee, container, ctx) {
    var self = this;
    var modal = container.querySelector('#emp-modal');
    if (!modal) return;

    var saveBtn = modal.querySelector('#emp-modal-save');

    // Collect field values
    var data = {
      pin: (modal.querySelector('#emp-field-pin').value || '').trim(),
      name: (modal.querySelector('#emp-field-name').value || '').trim(),
      full_name_lat: (modal.querySelector('#emp-field-full-name-lat').value || '').trim(),
      address: (modal.querySelector('#emp-field-address').value || '').trim(),
      phone: (modal.querySelector('#emp-field-phone').value || '').trim(),
      iban: (modal.querySelector('#emp-field-iban').value || '').trim(),
      swift: (modal.querySelector('#emp-field-swift').value || '').trim(),
      bank_name: (modal.querySelector('#emp-field-bank-name').value || '').trim(),
      receiver_name: (modal.querySelector('#emp-field-receiver-name').value || '').trim(),
      service_description: (modal.querySelector('#emp-field-service-desc').value || '').trim(),
      rate_usd: parseFloat(modal.querySelector('#emp-field-rate').value) || null,
      employee_type: modal.querySelector('#emp-field-type').value,
      invoice_format: modal.querySelector('#emp-field-invoice-format').value,
      invoice_prefix: (modal.querySelector('#emp-field-invoice-prefix').value || '').trim(),
      next_invoice_number: parseInt(modal.querySelector('#emp-field-next-invoice').value, 10) || 1,
      is_active: modal.querySelector('#emp-field-active').checked
    };

    // Validation
    if (!data.name) {
      showToast('Name is required.', 'error');
      modal.querySelector('#emp-field-name').focus();
      return;
    }

    if (data.pin && !/^\d{4}$/.test(data.pin)) {
      showToast('PIN must be exactly 4 digits.', 'error');
      modal.querySelector('#emp-field-pin').focus();
      return;
    }

    if (data.iban && !/^UA\d{27}$/.test(data.iban.replace(/\s/g, ''))) {
      // Warn but don't block — some IBANs may differ
      console.warn('[Employees] IBAN format looks unusual:', data.iban);
    }

    // Disable save button
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      if (existingEmployee) {
        // Update existing
        data.id = existingEmployee.id;
        var upResult = await DB.upsertEmployee(data);
        if (upResult && upResult.error) throw new Error(upResult.error.message || 'Failed to update');
        showToast('Employee updated successfully!', 'success');
      } else {
        // Insert new
        var insResult = await DB.upsertEmployee(data);
        if (insResult && insResult.error) throw new Error(insResult.error.message || 'Failed to add');
        showToast('Employee added successfully!', 'success');
      }

      // Close modal and reload
      self.closeModal(container);
      await self.loadData(ctx);
      self.refreshTable(container, ctx);

    } catch (err) {
      console.error('[Employees] save error:', err);
      var errorMsg = err.message || 'Unknown error';

      // Detect duplicate PIN
      if (errorMsg.indexOf('employees_pin_key') !== -1 || errorMsg.indexOf('duplicate') !== -1) {
        errorMsg = 'PIN "' + data.pin + '" is already in use by another employee.';
      }

      showToast('Error saving: ' + errorMsg, 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = existingEmployee ? 'Save Changes' : 'Add Employee';
      }
    }
  },

  /* ── Find Employee by ID ── */
  findEmployee(id) {
    for (var i = 0; i < this.allEmployees.length; i++) {
      if (this.allEmployees[i].id === id) {
        return this.allEmployees[i];
      }
    }
    return null;
  },

  /* ── Utility: Escape HTML ── */
  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
};


/* ── Global Toast Notification (safe re-declaration) ── */
if (typeof showToast === 'undefined') {
  function showToast(message, type) {
    type = type || 'success';

    var existing = document.querySelectorAll('.fury-toast');
    for (var i = 0; i < existing.length; i++) {
      existing[i].remove();
    }

    var toast = document.createElement('div');
    toast.className = 'fury-toast fury-toast-' + type;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function () {
      toast.classList.add('show');
    }, 10);

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, 3000);
  }
}
