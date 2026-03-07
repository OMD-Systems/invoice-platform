/* =============================================================
   Dashboard — Viewer Landing Page
   Invoice Platform · OMD Systems
   ============================================================= */

const Dashboard = {
  title: 'Dashboard',
  employee: null,
  invoices: [],
  projects: [],
  timesheets: [],
  suggestions: [],

  _escapeHtml: function(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  async render(container, ctx) {
    this._ctx = ctx;
    container.innerHTML = '<div style="padding:24px">' + Skeleton.render('card', 3) + '</div>';

    try {
      await this._loadData(ctx);
    } catch (e) {
      console.error('[Dashboard] load error:', e);
    }

    container.innerHTML = this._template();
    this._bindEvents(container);
  },

  async _loadData(ctx) {
    var userEmail = ctx.user.email.toLowerCase();

    var results = await Promise.all([
      DB.getEmployeesSafe(),
      DB.getProjects()
    ]);

    var employees = Array.isArray(results[0]) ? results[0] : (results[0] && results[0].data || []);
    this.employee = employees.find(function(e) {
      return e.work_email && e.work_email.toLowerCase() === userEmail;
    }) || null;

    this.projects = (results[1] && results[1].data) || [];

    if (!this.employee) return;

    var now = new Date();
    var month = now.getMonth() + 1;
    var year = now.getFullYear();

    var results2 = await Promise.all([
      DB.getInvoicesByEmployee(this.employee.id),
      DB.getTimesheets(month, year, [this.employee.id]),
      DB.getTimesheetSuggestions(month, year, this.employee.id)
    ]);

    this.invoices = (results2[0] && results2[0].data) || [];
    this.timesheets = (results2[1] && results2[1].data) || [];
    this.suggestions = (results2[2] && results2[2].data) || [];
  },

  _template: function() {
    if (!this.employee) {
      return '<div class="loading">No employee profile found for your account.</div>';
    }

    var emp = this.employee;
    var invoices = this.invoices;
    var now = new Date();
    var curMonth = now.getMonth() + 1;
    var curYear = now.getFullYear();

    return (
      '<div class="dash-page">' +
      this._renderHeader(emp) +
      this._renderKPI(emp, invoices) +
      this._renderChart(invoices) +
      this._renderCurrentMonth(invoices, curMonth, curYear) +
      this._renderHours(curMonth, curYear) +
      this._renderRecent(invoices) +
      '</div>' +
      '<style>' + this._styles() + '</style>'
    );
  },

  // ── Header ──
  _renderHeader: function(emp) {
    var initials = (emp.name || '').split(',').reverse().map(function(w) {
      return w.trim().charAt(0);
    }).join('').toUpperCase() || '?';

    var avatarHtml;
    if (emp.avatar_url) {
      avatarHtml = '<img src="' + this._escapeHtml(emp.avatar_url) + '" alt="Avatar" class="dash-avatar-img" />';
    } else {
      avatarHtml = '<div class="dash-avatar-initials">' + this._escapeHtml(initials) + '</div>';
    }

    return (
      '<div class="dash-header">' +
      '<div class="dash-avatar">' + avatarHtml + '</div>' +
      '<div>' +
      '<div class="dash-name">' + this._escapeHtml(emp.name || '') + '</div>' +
      '<div class="dash-meta">' +
      this._escapeHtml(emp.employee_type || '') +
      (emp.contract_type ? ' &middot; ' + this._escapeHtml(emp.contract_type) : '') +
      (emp.rate_usd ? ' &middot; $' + Number(emp.rate_usd).toLocaleString() + '/mo' : '') +
      '</div>' +
      '</div>' +
      '</div>'
    );
  },

  // ── KPI Cards ──
  _renderKPI: function(emp, invoices) {
    var now = new Date();
    var year = now.getFullYear();

    var earnedYTD = 0;
    var totalCount = 0;
    var paidCount = 0;
    var pending = 0;

    for (var i = 0; i < invoices.length; i++) {
      var inv = invoices[i];
      if (inv.year === year) {
        var amount = Number(inv.total_usd || inv.subtotal_usd || 0);
        if (inv.status === 'paid') { earnedYTD += amount; paidCount++; }
        if (inv.status === 'sent') { pending += amount; }
        totalCount++;
      }
    }

    var rate = emp.rate_usd ? '$' + Number(emp.rate_usd).toLocaleString() + '/mo' : 'N/A';

    return (
      '<div class="dash-kpi-grid">' +
      this._kpiCard('Earned YTD', '$' + earnedYTD.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}), '#22C55E') +
      this._kpiCard('Invoices', totalCount + ' (' + paidCount + ' paid)', '#00D4FF') +
      this._kpiCard('Pending', '$' + pending.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0}), '#F59E0B') +
      this._kpiCard('Rate', rate, '#A78BFA') +
      '</div>'
    );
  },

  _kpiCard: function(label, value, color) {
    return (
      '<div class="dash-kpi">' +
      '<div class="dash-kpi-value" style="color:' + color + '">' + value + '</div>' +
      '<div class="dash-kpi-label">' + label + '</div>' +
      '</div>'
    );
  },

  // ── Earnings Chart (12 months) ──
  _renderChart: function(invoices) {
    var now = new Date();
    var months = [];

    for (var i = 11; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ month: d.getMonth() + 1, year: d.getFullYear(), label: d.toLocaleString('en', { month: 'short' }) });
    }

    // Aggregate by month
    var monthMap = {};
    for (var i = 0; i < invoices.length; i++) {
      var inv = invoices[i];
      var key = inv.year + '-' + inv.month;
      if (!monthMap[key]) monthMap[key] = { paid: 0, sent: 0, draft: 0 };
      var amt = Number(inv.total_usd || inv.subtotal_usd || 0);
      if (inv.status === 'paid') monthMap[key].paid += amt;
      else if (inv.status === 'sent') monthMap[key].sent += amt;
      else monthMap[key].draft += amt;
    }

    // Find max for scaling
    var maxVal = 0;
    for (var i = 0; i < months.length; i++) {
      var k = months[i].year + '-' + months[i].month;
      var d = monthMap[k] || { paid: 0, sent: 0, draft: 0 };
      var total = d.paid + d.sent + d.draft;
      if (total > maxVal) maxVal = total;
    }
    if (maxVal === 0) maxVal = 1;

    var barsHtml = '';
    for (var i = 0; i < months.length; i++) {
      var k = months[i].year + '-' + months[i].month;
      var d = monthMap[k] || { paid: 0, sent: 0, draft: 0 };
      var total = d.paid + d.sent + d.draft;
      var pctPaid = (d.paid / maxVal * 100).toFixed(1);
      var pctSent = (d.sent / maxVal * 100).toFixed(1);
      var pctDraft = (d.draft / maxVal * 100).toFixed(1);

      barsHtml += (
        '<div class="dash-bar-col">' +
        '<div class="dash-bar-stack" title="$' + total.toLocaleString() + '">' +
        (d.draft > 0 ? '<div class="dash-bar-seg" style="height:' + pctDraft + '%;background:#374151"></div>' : '') +
        (d.sent > 0 ? '<div class="dash-bar-seg" style="height:' + pctSent + '%;background:#F59E0B"></div>' : '') +
        (d.paid > 0 ? '<div class="dash-bar-seg" style="height:' + pctPaid + '%;background:#22C55E"></div>' : '') +
        '</div>' +
        '<div class="dash-bar-label">' + months[i].label + '</div>' +
        '</div>'
      );
    }

    return (
      '<div class="fury-card dash-section">' +
      '<div class="dash-section-title">Earnings — Last 12 Months</div>' +
      '<div class="dash-legend">' +
      '<span><span class="dash-dot" style="background:#22C55E"></span>Paid</span>' +
      '<span><span class="dash-dot" style="background:#F59E0B"></span>Sent</span>' +
      '<span><span class="dash-dot" style="background:#374151"></span>Draft</span>' +
      '</div>' +
      '<div class="dash-chart">' + barsHtml + '</div>' +
      '</div>'
    );
  },

  // ── Current Month ──
  _renderCurrentMonth: function(invoices, month, year) {
    var monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    var curInvoice = null;
    for (var i = 0; i < invoices.length; i++) {
      if (invoices[i].month === month && invoices[i].year === year) {
        curInvoice = invoices[i];
        break;
      }
    }

    var content;
    if (curInvoice) {
      var statusClass = curInvoice.status === 'paid' ? 'dash-status-paid' :
                        curInvoice.status === 'sent' ? 'dash-status-sent' : 'dash-status-draft';
      content = (
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">' +
        '<div>' +
        '<span class="' + statusClass + '">' + this._escapeHtml(curInvoice.status) + '</span>' +
        ' &nbsp; $' + Number(curInvoice.total_usd || curInvoice.subtotal_usd || 0).toLocaleString() +
        (curInvoice.invoice_number ? ' &nbsp; <span style="color:var(--fury-text-muted)">#' + this._escapeHtml(curInvoice.invoice_number) + '</span>' : '') +
        '</div>' +
        '<div style="display:flex;gap:8px">' +
        '<a href="#/invoices" class="fury-btn fury-btn-sm fury-btn-outline">View</a>' +
        '</div>' +
        '</div>'
      );
    } else {
      content = (
        '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">' +
        '<span style="color:var(--fury-text-muted)">No invoice for this month yet</span>' +
        '<a href="#/invoices" class="fury-btn fury-btn-sm fury-btn-primary">Generate Invoice</a>' +
        '</div>'
      );
    }

    return (
      '<div class="fury-card dash-section">' +
      '<div class="dash-section-title">Current Month — ' + monthNames[month] + ' ' + year + '</div>' +
      content +
      '</div>'
    );
  },

  // ── Hours Suggestion ──
  _renderHours: function(month, year) {
    var projects = this.projects;
    var timesheets = this.timesheets;
    var suggestions = this.suggestions;

    // Build suggestion map by project_id
    var sugMap = {};
    for (var i = 0; i < suggestions.length; i++) {
      sugMap[suggestions[i].project_id] = suggestions[i];
    }

    // Build timesheet map by project_id
    var tsMap = {};
    for (var i = 0; i < timesheets.length; i++) {
      tsMap[timesheets[i].project_id] = timesheets[i];
    }

    var monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    var rowsHtml = '';
    for (var i = 0; i < projects.length; i++) {
      var p = projects[i];
      var ts = tsMap[p.id];
      var sug = sugMap[p.id];
      var actualHours = ts ? Number(ts.hours) : 0;
      var sugHours = sug ? Number(sug.suggested_hours) : '';
      var sugNote = sug ? (sug.note || '') : '';
      var status = sug ? sug.status : '';

      var statusBadge = '';
      if (status === 'pending') statusBadge = '<span class="dash-sug-badge dash-sug-pending">pending</span>';
      else if (status === 'accepted') statusBadge = '<span class="dash-sug-badge dash-sug-accepted">accepted</span>';
      else if (status === 'rejected') statusBadge = '<span class="dash-sug-badge dash-sug-rejected">rejected</span>';

      rowsHtml += (
        '<tr>' +
        '<td style="font-weight:500">' + this._escapeHtml(p.code || p.name) + '</td>' +
        '<td style="text-align:center">' + (actualHours > 0 ? actualHours + 'h' : '—') + '</td>' +
        '<td><input type="number" class="fury-input fury-input-sm dash-sug-input" data-project="' + p.id + '" value="' + (sugHours !== '' ? sugHours : '') + '" min="0" max="744" placeholder="0" style="width:70px" /></td>' +
        '<td><input type="text" class="fury-input fury-input-sm dash-sug-note" data-project="' + p.id + '" value="' + this._escapeHtml(sugNote) + '" placeholder="Note..." style="width:140px" /></td>' +
        '<td>' + statusBadge + '</td>' +
        '</tr>'
      );
    }

    if (projects.length === 0) {
      rowsHtml = '<tr><td colspan="5" style="text-align:center;color:var(--fury-text-muted)">No active projects</td></tr>';
    }

    return (
      '<div class="fury-card dash-section">' +
      '<div class="dash-section-title">Hours Suggestion — ' + monthNames[month] + ' ' + year + '</div>' +
      '<div style="overflow-x:auto">' +
      '<table class="fury-table" style="min-width:500px">' +
      '<thead><tr>' +
      '<th>Project</th><th style="text-align:center">Actual</th><th>Suggested</th><th>Note</th><th>Status</th>' +
      '</tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +
      '</div>' +
      (projects.length > 0 ? '<div style="margin-top:12px;text-align:right"><button class="fury-btn fury-btn-primary fury-btn-sm" id="dash-submit-hours">Submit Suggestions</button></div>' : '') +
      '</div>'
    );
  },

  // ── Recent Invoices ──
  _renderRecent: function(invoices) {
    var recent = invoices.slice(0, 5);
    if (recent.length === 0) {
      return (
        '<div class="fury-card dash-section">' +
        '<div class="dash-section-title">Recent Invoices</div>' +
        '<div style="color:var(--fury-text-muted);font-size:13px">No invoices yet</div>' +
        '</div>'
      );
    }

    var self = this;
    var rowsHtml = '';
    for (var i = 0; i < recent.length; i++) {
      var inv = recent[i];
      var monthNames = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      var statusClass = inv.status === 'paid' ? 'dash-status-paid' :
                        inv.status === 'sent' ? 'dash-status-sent' : 'dash-status-draft';
      rowsHtml += (
        '<tr>' +
        '<td>' + self._escapeHtml(inv.invoice_number || '—') + '</td>' +
        '<td>' + monthNames[inv.month] + ' ' + inv.year + '</td>' +
        '<td>$' + Number(inv.total_usd || inv.subtotal_usd || 0).toLocaleString() + '</td>' +
        '<td><span class="' + statusClass + '">' + self._escapeHtml(inv.status) + '</span></td>' +
        '</tr>'
      );
    }

    return (
      '<div class="fury-card dash-section">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">' +
      '<div class="dash-section-title" style="margin-bottom:0">Recent Invoices</div>' +
      '<a href="#/invoices" style="font-size:12px;color:#00D4FF;text-decoration:none">View All &rarr;</a>' +
      '</div>' +
      '<table class="fury-table">' +
      '<thead><tr><th>#</th><th>Period</th><th>Amount</th><th>Status</th></tr></thead>' +
      '<tbody>' + rowsHtml + '</tbody>' +
      '</table>' +
      '</div>'
    );
  },

  // ── Events ──
  _bindEvents: function(container) {
    var self = this;
    var submitBtn = container.querySelector('#dash-submit-hours');
    if (submitBtn) {
      submitBtn.addEventListener('click', async function() {
        if (submitBtn.disabled) return;
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
          var inputs = container.querySelectorAll('.dash-sug-input');
          var notes = container.querySelectorAll('.dash-sug-note');
          var noteMap = {};
          for (var i = 0; i < notes.length; i++) {
            noteMap[notes[i].getAttribute('data-project')] = notes[i].value.trim();
          }

          var submitted = 0;
          for (var i = 0; i < inputs.length; i++) {
            var projectId = inputs[i].getAttribute('data-project');
            var hours = parseFloat(inputs[i].value);
            if (isNaN(hours) || hours <= 0) continue;

            var result = await DB.upsertTimesheetSuggestion({
              employee_id: self.employee.id,
              project_id: projectId,
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
              suggested_hours: hours,
              note: noteMap[projectId] || null,
              status: 'pending'
            });
            if (result.error) throw new Error(result.error.message || 'Failed');
            submitted++;
          }

          if (submitted === 0) {
            showToast('Enter hours for at least one project', 'warning');
          } else {
            showToast(submitted + ' suggestion(s) submitted', 'success');
            // Reload suggestions to show updated status
            var now = new Date();
            var sugResult = await DB.getTimesheetSuggestions(now.getMonth() + 1, now.getFullYear(), self.employee.id);
            self.suggestions = (sugResult && sugResult.data) || [];
            var mainContent = document.getElementById('main-content');
            if (mainContent) {
              mainContent.innerHTML = self._template();
              self._bindEvents(mainContent);
            }
          }
        } catch (err) {
          console.error('[Dashboard] submit hours error:', err);
          showToast('Failed to submit suggestions', 'error');
        } finally {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Submit Suggestions';
        }
      });
    }
  },

  // ── Styles ──
  _styles: function() {
    return (
      '.dash-page { max-width: 900px; }' +

      '.dash-header { display:flex; align-items:center; gap:16px; margin-bottom:24px; }' +
      '.dash-avatar { width:56px; height:56px; border-radius:50%; overflow:hidden; flex-shrink:0; }' +
      '.dash-avatar-img { width:100%; height:100%; object-fit:cover; }' +
      '.dash-avatar-initials { width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:rgba(0,212,255,0.12); border:1px solid rgba(0,212,255,0.3); font-size:20px; font-weight:700; color:#00D4FF; border-radius:50%; }' +
      '.dash-name { font-size:18px; font-weight:600; color:var(--fury-text); }' +
      '.dash-meta { font-size:12px; color:var(--fury-text-secondary); margin-top:2px; }' +

      '.dash-kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:20px; }' +
      '.dash-kpi { background:var(--fury-surface); border:1px solid var(--fury-border); border-radius:8px; padding:16px; }' +
      '.dash-kpi-value { font-size:20px; font-weight:700; margin-bottom:4px; }' +
      '.dash-kpi-label { font-size:11px; color:var(--fury-text-muted); text-transform:uppercase; letter-spacing:0.5px; }' +

      '.dash-section { margin-bottom:16px; }' +
      '.dash-section-title { font-size:13px; font-weight:600; color:var(--fury-text-secondary); text-transform:uppercase; letter-spacing:0.5px; margin-bottom:12px; }' +

      '.dash-chart { display:flex; align-items:flex-end; gap:4px; height:140px; padding-top:8px; }' +
      '.dash-bar-col { flex:1; display:flex; flex-direction:column; align-items:center; height:100%; }' +
      '.dash-bar-stack { flex:1; width:100%; max-width:40px; display:flex; flex-direction:column-reverse; justify-content:flex-start; border-radius:3px 3px 0 0; overflow:hidden; }' +
      '.dash-bar-seg { width:100%; min-height:2px; transition:height 0.3s; }' +
      '.dash-bar-label { font-size:10px; color:var(--fury-text-muted); margin-top:4px; }' +

      '.dash-legend { display:flex; gap:16px; font-size:11px; color:var(--fury-text-muted); margin-bottom:8px; }' +
      '.dash-dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:4px; vertical-align:middle; }' +

      '.dash-status-paid { display:inline-block; padding:2px 8px; font-size:11px; font-weight:600; border-radius:4px; background:rgba(34,197,94,0.15); color:#22C55E; text-transform:uppercase; }' +
      '.dash-status-sent { display:inline-block; padding:2px 8px; font-size:11px; font-weight:600; border-radius:4px; background:rgba(245,158,11,0.15); color:#F59E0B; text-transform:uppercase; }' +
      '.dash-status-draft { display:inline-block; padding:2px 8px; font-size:11px; font-weight:600; border-radius:4px; background:rgba(55,65,81,0.3); color:#9CA3AF; text-transform:uppercase; }' +

      '.dash-sug-badge { display:inline-block; padding:2px 6px; font-size:10px; font-weight:600; border-radius:3px; text-transform:uppercase; }' +
      '.dash-sug-pending { background:rgba(245,158,11,0.15); color:#F59E0B; }' +
      '.dash-sug-accepted { background:rgba(34,197,94,0.15); color:#22C55E; }' +
      '.dash-sug-rejected { background:rgba(239,68,68,0.15); color:#EF4444; }' +

      '@media (max-width:640px) {' +
      '  .dash-kpi-grid { grid-template-columns:repeat(2,1fr); }' +
      '  .dash-kpi-value { font-size:16px; }' +
      '  .dash-chart { height:100px; }' +
      '}'
    );
  },

  destroy: function() {
    // Cleanup
  }
};
