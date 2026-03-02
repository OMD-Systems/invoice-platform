/* =============================================================
   Timesheet — Hours Entry Page
   Invoice Platform · OMD Systems
   ============================================================= */

const Timesheet = {
  title: 'Timesheet',
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  employees: [],
  projects: [],
  data: {},          // { employeeId: { projectCode: hours } }
  isLocked: false,
  regularHoursMap: {}, // { employeeId: regularHours }

  /* ── Main Render ── */
  async render(container, ctx) {
    container.innerHTML = '<div class="loading">Loading timesheet...</div>';
    try {
      await this.loadData(ctx);
      container.innerHTML = this.template(ctx);
      this.bindEvents(container, ctx);
    } catch (err) {
      console.error('[Timesheet] render error:', err);
      container.innerHTML =
        '<div class="loading" style="color:#EF4444;">' +
        'Error loading timesheet: ' + (err.message || 'Unknown error') +
        '</div>';
    }
  },

  /* ── HTML Template ── */
  template(ctx) {
    var self = this;
    var monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Month options
    var monthOptions = '';
    for (var m = 1; m <= 12; m++) {
      monthOptions +=
        '<option value="' + m + '"' + (m === self.month ? ' selected' : '') + '>' +
        monthNames[m - 1] +
        '</option>';
    }

    // Year options (2024 - 2030)
    var yearOptions = '';
    for (var y = 2024; y <= 2030; y++) {
      yearOptions +=
        '<option value="' + y + '"' + (y === self.year ? ' selected' : '') + '>' +
        y +
        '</option>';
    }

    // Lock badge
    var lockBadge = self.isLocked
      ? '<span class="fury-badge-danger" style="margin-left:12px;padding:4px 10px;font-size:11px;font-weight:600;border-radius:4px;background:rgba(239,68,68,0.15);color:#EF4444;">' +
        '&#x1F512; LOCKED' +
        '</span>'
      : '<span class="fury-badge-success" style="margin-left:12px;padding:4px 10px;font-size:11px;font-weight:600;border-radius:4px;background:rgba(16,185,129,0.15);color:#10B981;">' +
        'Open for editing' +
        '</span>';

    // Project column headers
    var projectHeaders = '';
    for (var p = 0; p < self.projects.length; p++) {
      projectHeaders +=
        '<th class="ts-col-project" title="' + self.projects[p].name + '">' +
        self.projects[p].code +
        '</th>';
    }

    // Employee rows
    var rows = '';
    for (var e = 0; e < self.employees.length; e++) {
      var emp = self.employees[e];
      var empData = self.data[emp.id] || {};
      var total = 0;

      var cells = '';
      for (var p2 = 0; p2 < self.projects.length; p2++) {
        var proj = self.projects[p2];
        var hours = empData[proj.code] || '';
        var numHours = parseFloat(hours) || 0;
        total += numHours;

        cells +=
          '<td class="ts-cell">' +
          '<input type="number" class="fury-input ts-input" ' +
          'data-employee="' + emp.id + '" ' +
          'data-project="' + proj.code + '" ' +
          'data-project-id="' + proj.id + '" ' +
          'value="' + (hours !== '' && hours !== 0 ? hours : '') + '" ' +
          'min="0" max="744" step="0.5" ' +
          'placeholder="0" ' +
          (self.isLocked ? 'disabled ' : '') +
          '/>' +
          '</td>';
      }

      var regular = self.regularHoursMap[emp.id] || 0;
      var diff = total - regular;
      var diffClass = diff > 0 ? 'ts-diff-over' : diff < 0 ? 'ts-diff-under' : 'ts-diff-zero';
      var diffText = diff > 0 ? ('+' + diff.toFixed(1) + ' &#x26A1;') : diff < 0 ? diff.toFixed(1) : '0';

      var typeBadge = emp.employee_type === 'Hourly Contractor'
        ? '<span class="fury-badge-info" style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(139,92,246,0.15);color:#A78BFA;margin-left:6px;">HC</span>'
        : '<span class="fury-badge-info" style="font-size:9px;padding:1px 5px;border-radius:3px;background:rgba(0,229,255,0.12);color:#00E5FF;margin-left:6px;">FTE</span>';

      rows +=
        '<tr>' +
        '<td class="ts-cell-name">' +
        '<span class="ts-employee-name">' + self.escapeHtml(emp.name) + '</span>' +
        typeBadge +
        '</td>' +
        cells +
        '<td class="ts-cell-total" id="ts-total-' + emp.id + '">' + (total ? total.toFixed(1) : '0') + '</td>' +
        '<td class="ts-cell-regular" id="ts-regular-' + emp.id + '">' + regular + '</td>' +
        '<td class="ts-cell-diff ' + diffClass + '" id="ts-diff-' + emp.id + '">' + diffText + '</td>' +
        '</tr>';
    }

    // Empty state
    if (self.employees.length === 0) {
      var colCount = self.projects.length + 4; // name + projects + total + regular + diff
      rows =
        '<tr><td colspan="' + colCount + '" style="text-align:center;color:#6B7280;padding:40px;">' +
        'No employees found. Add employees first in the Employees page.' +
        '</td></tr>';
    }

    return '' +
      '<div class="ts-page">' +

      /* ── Header Bar ── */
      '<div class="ts-header">' +
      '<div class="ts-header-left">' +
      '<div class="fury-form-group" style="display:flex;gap:8px;align-items:center;">' +
      '<select class="fury-select ts-select" id="ts-month">' + monthOptions + '</select>' +
      '<select class="fury-select ts-select" id="ts-year">' + yearOptions + '</select>' +
      lockBadge +
      '</div>' +
      '</div>' +
      '<div class="ts-header-right">' +
      '<button class="fury-btn-secondary ts-btn-upload" id="ts-btn-upload" ' + (self.isLocked ? 'disabled' : '') + '>' +
      '&#x1F4C4; Upload XLSX' +
      '</button>' +
      '<input type="file" id="ts-file-input" accept=".xlsx,.xls" style="display:none;" />' +
      '</div>' +
      '</div>' +

      /* ── Grid Table ── */
      '<div class="fury-card ts-card">' +
      '<div class="ts-table-wrap">' +
      '<table class="fury-table ts-table">' +
      '<thead>' +
      '<tr>' +
      '<th class="ts-col-name">Employee</th>' +
      projectHeaders +
      '<th class="ts-col-total">Total</th>' +
      '<th class="ts-col-regular">Regular</th>' +
      '<th class="ts-col-diff">Diff</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody id="ts-tbody">' +
      rows +
      '</tbody>' +
      '</table>' +
      '</div>' +
      '</div>' +

      /* ── Save Button ── */
      '<div class="ts-footer">' +
      '<button class="fury-btn-primary ts-btn-save" id="ts-btn-save" ' + (self.isLocked ? 'disabled' : '') + '>' +
      'Save Timesheet' +
      '</button>' +
      '</div>' +

      '</div>' +

      /* ── Page Styles ── */
      '<style>' +
      '.ts-page { max-width: 1400px; }' +
      '.ts-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px; }' +
      '.ts-header-left { display:flex; align-items:center; gap:8px; }' +
      '.ts-header-right { display:flex; align-items:center; gap:8px; }' +
      '.ts-select { padding:6px 10px; background:#1A1A1F; border:1px solid #2A2A30; border-radius:6px; color:#E5E7EB; font-size:13px; }' +
      '.ts-card { overflow:visible; padding:0; }' +
      '.ts-table-wrap { overflow-x:auto; }' +
      '.ts-table { width:100%; border-collapse:collapse; font-size:13px; }' +
      '.ts-table thead th { position:sticky; top:0; background:#111114; padding:10px 6px; text-align:center; font-size:11px; font-weight:600; color:#9CA3AF; text-transform:uppercase; letter-spacing:0.5px; border-bottom:1px solid #1F1F23; white-space:nowrap; }' +
      '.ts-col-name { text-align:left !important; min-width:180px; padding-left:12px !important; }' +
      '.ts-col-project { min-width:64px; }' +
      '.ts-col-total, .ts-col-regular, .ts-col-diff { min-width:70px; }' +
      '.ts-cell { padding:4px 2px; text-align:center; border-bottom:1px solid #1A1A1F; }' +
      '.ts-cell-name { padding:8px 12px; border-bottom:1px solid #1A1A1F; white-space:nowrap; }' +
      '.ts-employee-name { font-weight:500; color:#E5E7EB; }' +
      '.ts-cell-total { padding:8px 6px; text-align:center; font-weight:600; color:#00E5FF; border-bottom:1px solid #1A1A1F; }' +
      '.ts-cell-regular { padding:8px 6px; text-align:center; color:#9CA3AF; border-bottom:1px solid #1A1A1F; }' +
      '.ts-cell-diff { padding:8px 6px; text-align:center; font-weight:600; border-bottom:1px solid #1A1A1F; }' +
      '.ts-diff-over { color:#F59E0B; }' +
      '.ts-diff-under { color:#EF4444; }' +
      '.ts-diff-zero { color:#6B7280; }' +
      '.ts-input { width:64px; padding:4px 4px; text-align:center; background:#1A1A1F; border:1px solid #2A2A30; border-radius:4px; color:#E5E7EB; font-size:13px; font-variant-numeric:tabular-nums; }' +
      '.ts-input:focus { border-color:#00E5FF; outline:none; background:#111114; }' +
      '.ts-input:disabled { opacity:0.4; cursor:not-allowed; }' +
      '.ts-input::placeholder { color:#4B5563; }' +
      '.ts-footer { margin-top:16px; display:flex; justify-content:flex-end; }' +
      '.ts-btn-save { padding:10px 32px; }' +
      '.ts-btn-upload { padding:8px 16px; font-size:13px; }' +

      /* ── Hover row highlight ── */
      '.ts-table tbody tr:hover { background:rgba(0,229,255,0.03); }' +
      '</style>';
  },

  /* ── Load Data ── */
  async loadData(ctx) {
    var self = this;

    // Load employees (active only)
    var empResult = await DB.getEmployees();
    self.employees = (empResult && empResult.data) ? empResult.data : [];

    // If lead, filter to team members only
    if (ctx.role === 'lead') {
      var tmResult = await DB.getTeamMembersByLead(ctx.user.email);
      var teamMembers = (tmResult && tmResult.data) ? tmResult.data : [];
      if (teamMembers.length > 0) {
        var memberIds = {};
        for (var tm = 0; tm < teamMembers.length; tm++) {
          memberIds[teamMembers[tm].employee_id] = true;
        }
        self.employees = self.employees.filter(function (emp) {
          return memberIds[emp.id];
        });
      }
    }

    // Sort employees by name
    self.employees.sort(function (a, b) {
      return (a.name || '').localeCompare(b.name || '');
    });

    // Load projects (active only)
    var projResult = await DB.getProjects();
    self.projects = (projResult && projResult.data) ? projResult.data : [];

    // Sort projects by a fixed display order
    var projectOrder = {
      'SPECTR': 1, 'FURY': 2, 'KESTREL': 3, 'RATO_BOOSTER': 4,
      'MOTORS': 5, 'BATTERIES': 6, 'OTHER': 7
    };
    self.projects.sort(function (a, b) {
      return (projectOrder[a.code] || 99) - (projectOrder[b.code] || 99);
    });

    // Check month lock
    var lockResult = await DB.isMonthLocked(self.month, self.year);
    self.isLocked = lockResult && lockResult.data;

    // Load existing timesheets for the selected month
    var tsResult = await DB.getTimesheets(self.month, self.year);
    var timesheets = (tsResult && tsResult.data) ? tsResult.data : [];
    self.data = {};

    // Build project ID -> code map
    var projIdToCode = {};
    for (var p = 0; p < self.projects.length; p++) {
      projIdToCode[self.projects[p].id] = self.projects[p].code;
    }

    if (timesheets && timesheets.length > 0) {
      for (var t = 0; t < timesheets.length; t++) {
        var ts = timesheets[t];
        if (!self.data[ts.employee_id]) {
          self.data[ts.employee_id] = {};
        }
        var code = projIdToCode[ts.project_id] || ts.project_id;
        self.data[ts.employee_id][code] = ts.hours;
      }
    }

    // Calculate regular hours for each employee
    // Regular hours = working days in month * 8
    var regularHours = self.calculateRegularHours(self.month, self.year);

    // Load settings for subtract_hours adjustment
    var adjustment = 0;
    try {
      var adjSetting = await DB.getSetting('working_hours_adjustment');
      var adjData = (adjSetting && adjSetting.data) ? adjSetting.data : null;
      if (adjData && typeof adjData === 'string') adjData = JSON.parse(adjData);
      if (adjData && adjData.subtract_hours) {
        adjustment = adjData.subtract_hours;
      }
    } catch (e) {
      // default: no adjustment
    }

    self.regularHoursMap = {};
    for (var e = 0; e < self.employees.length; e++) {
      var emp = self.employees[e];
      if (emp.employee_type === 'Hourly Contractor') {
        // HC employees don't have fixed regular hours
        self.regularHoursMap[emp.id] = 0;
      } else {
        self.regularHoursMap[emp.id] = Math.max(0, regularHours - adjustment);
      }
    }
  },

  /* ── Calculate working days in a month ── */
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

  /* ── Bind Events ── */
  bindEvents(container, ctx) {
    var self = this;

    // Month/year change -> reload
    var monthSelect = container.querySelector('#ts-month');
    var yearSelect = container.querySelector('#ts-year');

    if (monthSelect) {
      monthSelect.addEventListener('change', function () {
        self.month = parseInt(this.value, 10);
        self.render(container, ctx);
      });
    }

    if (yearSelect) {
      yearSelect.addEventListener('change', function () {
        self.year = parseInt(this.value, 10);
        self.render(container, ctx);
      });
    }

    // Input change -> recalculate row total and diff
    var inputs = container.querySelectorAll('.ts-input');
    for (var i = 0; i < inputs.length; i++) {
      inputs[i].addEventListener('input', function () {
        var empId = this.getAttribute('data-employee');
        self.recalcRow(empId, container);
      });

      // Select all text on focus for quick editing
      inputs[i].addEventListener('focus', function () {
        this.select();
      });
    }

    // Save button
    var saveBtn = container.querySelector('#ts-btn-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        self.saveAll(container, ctx);
      });
    }

    // Upload XLSX button -> trigger file input
    var uploadBtn = container.querySelector('#ts-btn-upload');
    var fileInput = container.querySelector('#ts-file-input');

    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', function () {
        fileInput.click();
      });

      fileInput.addEventListener('change', function () {
        if (this.files && this.files.length > 0) {
          self.handleFileUpload(this.files[0], container, ctx);
          this.value = ''; // reset so same file can be re-uploaded
        }
      });
    }
  },

  /* ── Recalculate Row ── */
  recalcRow(employeeId, container) {
    var self = this;
    var inputs = container.querySelectorAll('.ts-input[data-employee="' + employeeId + '"]');
    var total = 0;

    for (var i = 0; i < inputs.length; i++) {
      var val = parseFloat(inputs[i].value) || 0;
      total += val;
    }

    var totalEl = container.querySelector('#ts-total-' + employeeId);
    var regularEl = container.querySelector('#ts-regular-' + employeeId);
    var diffEl = container.querySelector('#ts-diff-' + employeeId);

    if (totalEl) {
      totalEl.textContent = total ? total.toFixed(1) : '0';
    }

    if (diffEl && regularEl) {
      var regular = parseFloat(regularEl.textContent) || 0;
      var diff = total - regular;
      var diffText = diff > 0 ? '+' + diff.toFixed(1) + ' \u26A1' : diff < 0 ? diff.toFixed(1) : '0';
      diffEl.textContent = diffText;
      diffEl.className = 'ts-cell-diff ' + (diff > 0 ? 'ts-diff-over' : diff < 0 ? 'ts-diff-under' : 'ts-diff-zero');
    }
  },

  /* ── Save All Timesheets ── */
  async saveAll(container, ctx) {
    var self = this;
    var saveBtn = container.querySelector('#ts-btn-save');

    if (self.isLocked) {
      showToast('This month is locked. Cannot save changes.', 'error');
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      var inputs = container.querySelectorAll('.ts-input');
      var upserts = [];

      for (var i = 0; i < inputs.length; i++) {
        var input = inputs[i];
        var empId = input.getAttribute('data-employee');
        var projId = input.getAttribute('data-project-id');
        var hours = parseFloat(input.value) || 0;

        upserts.push({
          employee_id: empId,
          project_id: projId,
          month: self.month,
          year: self.year,
          hours: hours,
          created_by: ctx.user.id
        });
      }

      // Filter out zero-hour entries that have no existing record
      // Keep all entries — DB upsert handles creation/update
      await DB.upsertTimesheets(upserts);

      showToast('Timesheet saved successfully!', 'success');
    } catch (err) {
      console.error('[Timesheet] save error:', err);
      showToast('Error saving timesheet: ' + (err.message || 'Unknown error'), 'error');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Timesheet';
      }
    }
  },

  /* ── Handle XLSX File Upload ── */
  async handleFileUpload(file, container, ctx) {
    var self = this;

    try {
      // Use TimesheetParser service (expected to be loaded globally)
      if (typeof TimesheetParser === 'undefined') {
        showToast('TimesheetParser service not available.', 'error');
        return;
      }

      showToast('Parsing spreadsheet...', 'info');

      var parsed = await TimesheetParser.parse(file);

      if (!parsed || !parsed.timesheets || parsed.timesheets.length === 0) {
        showToast('No data found in the uploaded file.', 'error');
        return;
      }

      // Match parsed employees to DB employees
      var matched = await TimesheetParser.matchEmployees(parsed.timesheets);

      // Build grid data: { employeeId: { projectCode: hours } }
      var gridData = {};
      var warnings = [];

      for (var m = 0; m < matched.length; m++) {
        var row = matched[m];
        if (!row.matched) {
          warnings.push('No match: ' + row.employeeName + ' (PIN: ' + (row.pin || 'none') + ')');
          continue;
        }
        if (!gridData[row.employeeId]) gridData[row.employeeId] = {};
        for (var code in row.projects) {
          if (!row.projects.hasOwnProperty(code)) continue;
          gridData[row.employeeId][code] = (gridData[row.employeeId][code] || 0) + row.projects[code];
        }
      }

      if (Object.keys(gridData).length === 0) {
        showToast('No matching employees found in the uploaded file.', 'error');
        return;
      }

      // Populate the grid inputs with parsed data
      var populated = 0;
      for (var empId in gridData) {
        if (!gridData.hasOwnProperty(empId)) continue;
        var empRow = gridData[empId];

        for (var projCode in empRow) {
          if (!empRow.hasOwnProperty(projCode)) continue;
          var hours = empRow[projCode];

          var input = container.querySelector(
            '.ts-input[data-employee="' + empId + '"][data-project="' + projCode + '"]'
          );

          if (input) {
            input.value = hours;
            populated++;
          }
        }

        // Recalculate row totals
        self.recalcRow(empId, container);
      }

      // Update internal data reference
      self.data = gridData;

      if (warnings.length > 0) {
        showToast('Imported ' + populated + ' cells. ' + warnings.length + ' unmatched — check console.', 'info');
        console.warn('[Timesheet] Upload warnings:', warnings);
      } else {
        showToast('Imported ' + populated + ' cells from spreadsheet. Review and save.', 'success');
      }

    } catch (err) {
      console.error('[Timesheet] file upload error:', err);
      showToast('Error parsing file: ' + (err.message || 'Unknown error'), 'error');
    }
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


/* ── Global Toast Notification ── */
function showToast(message, type) {
  type = type || 'success';

  // Remove existing toasts
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
