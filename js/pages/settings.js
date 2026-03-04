/* =============================================================
   Settings — Admin Configuration Page
   Invoice Platform · OMD Systems
   ============================================================= */

const Settings = {
  title: 'Settings',
  activeTab: 'general',

  /* ── Cached data ── */
  settings: {},
  projects: [],
  teams: [],
  teamMembers: {},   // { teamId: [members] }
  profiles: [],
  monthLocks: [],

  /* ── Company options (used in Project form) ── */
  COMPANIES: ['WS', 'OMD', 'OM_ENERGY', 'OM_ENERGY_UA'],

  /* ── Role options ── */
  ROLES: ['admin', 'lead', 'viewer'],

  /* ── Main Render ── */
  async render(container, ctx) {
    if (ctx.role !== 'admin') {
      container.innerHTML =
        '<div class="fury-empty">' +
        '<div class="fury-empty-icon" style="font-size:48px;">&#x26D4;</div>' +
        '<div class="fury-empty-title">Access Denied</div>' +
        '<div class="fury-empty-text">This page is restricted to administrators only.</div>' +
        '</div>';
      return;
    }

    container.innerHTML = this.template();
    this.bindEvents(container, ctx);
    await this.loadData();
    this.renderActiveTab(container);
  },

  /* ── Page Template ── */
  template() {
    return (
      '<div class="settings-page" style="max-width:1200px;">' +

      /* ── Tabs ── */
      '<div class="fury-tabs fury-mb-3" role="tablist" aria-label="Settings tabs">' +
      '<button class="fury-tab' + (this.activeTab === 'general' ? ' active' : '') + '" data-tab="general">General</button>' +
      '<button class="fury-tab' + (this.activeTab === 'projects' ? ' active' : '') + '" data-tab="projects">Projects</button>' +
      '<button class="fury-tab' + (this.activeTab === 'teams' ? ' active' : '') + '" data-tab="teams">Teams</button>' +
      '<button class="fury-tab' + (this.activeTab === 'users' ? ' active' : '') + '" data-tab="users">Users</button>' +
      '<button class="fury-tab' + (this.activeTab === 'months' ? ' active' : '') + '" data-tab="months">Month Control</button>' +
      '<button class="fury-tab' + (this.activeTab === 'email_requests' ? ' active' : '') + '" data-tab="email_requests">Email Requests</button>' +
      '<button class="fury-tab' + (this.activeTab === 'working_hours' ? ' active' : '') + '" data-tab="working_hours">Working Hours</button>' +
      '</div>' +

      /* ── Tab Content ── */
      '<div id="settings-content"></div>' +

      '</div>' +

      /* ── Modal Container ── */
      '<div id="settings-modal-overlay" class="fury-modal-overlay">' +
      '<div class="fury-modal" id="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">' +
      '<div class="fury-modal-header">' +
      '<span class="fury-modal-title" id="settings-modal-title">Modal</span>' +
      '<button class="fury-modal-close" id="settings-modal-close" aria-label="Close">&times;</button>' +
      '</div>' +
      '<div class="fury-modal-body" id="settings-modal-body"></div>' +
      '<div class="fury-modal-footer" id="settings-modal-footer"></div>' +
      '</div>' +
      '</div>' +

      /* ── Page Styles ── */
      '<style>' +
      '.settings-section { margin-bottom: 32px; }' +
      '.settings-section-title { font-size: 14px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px; }' +
      '.settings-row { display: flex; gap: 16px; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; }' +
      '.settings-field { flex: 1; min-width: 200px; }' +
      '.settings-field label { display: block; font-size: 12px; font-weight: 600; color: #9CA3AF; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px; }' +
      '.settings-field input, .settings-field textarea, .settings-field select { width: 100%; }' +
      '.settings-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 24px; padding-top: 16px; border-top: 1px solid #374151; }' +
      '.settings-table-actions { display: flex; gap: 6px; }' +
      '.team-expand { cursor: pointer; }' +
      '.team-expand:hover { color: #00D4FF; }' +
      '.team-members-row td { padding: 8px 16px !important; background: #0D0D0F; }' +
      '.team-members-list { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0; }' +
      '.team-member-tag { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; background: rgba(0,212,255,0.08); border: 1px solid #374151; border-radius: 12px; font-size: 12px; color: #E5E7EB; }' +
      '.team-member-tag .remove-member { cursor: pointer; color: var(--fury-neutral); font-size: 14px; line-height: 1; }' +
      '.team-member-tag .remove-member:hover { color: #EF4444; }' +
      '.month-lock-badge { display: inline-flex; align-items: center; gap: 4px; }' +
      '</style>'
    );
  },

  /* ═══════════════════════════════════════════════════
     TAB: General
     ═══════════════════════════════════════════════════ */
  renderGeneral() {
    var billedTo = this.settings.billed_to || {};
    var terms = this.settings.payment_terms || {};
    var exchangeRate = this.settings.exchange_rate || {};
    var workingHours = this.settings.working_hours_adjustment || {};

    return (
      '<div class="fury-card">' +

      /* ── Billed To ── */
      '<div class="settings-section">' +
      '<div class="settings-section-title">Billed To (Company Info)</div>' +
      '<div class="settings-row">' +
      '<div class="settings-field">' +
      '<label for="set-billed-name">Company Name</label>' +
      '<input class="fury-input" id="set-billed-name" type="text" placeholder="Woodenshark LLC" ' +
      'value="' + this._escapeAttr(billedTo.name || '') + '">' +
      '</div>' +
      '</div>' +
      '<div class="settings-row">' +
      '<div class="settings-field">' +
      '<label for="set-billed-address">Address</label>' +
      '<textarea class="fury-input" id="set-billed-address" rows="3" ' +
      'placeholder="3411 Silverside Road, Tatnall Building #104, Wilmington, DE 19810">' +
      this._escapeHtml(billedTo.address || '') +
      '</textarea>' +
      '</div>' +
      '</div>' +
      '</div>' +

      /* ── Payment Terms ── */
      '<div class="settings-section">' +
      '<div class="settings-section-title">Payment Terms</div>' +
      '<div class="settings-row">' +
      '<div class="settings-field">' +
      '<label for="set-terms-text">Terms Text</label>' +
      '<textarea class="fury-input" id="set-terms-text" rows="4" ' +
      'placeholder="Thank you for your business! Please make the payment within 14 days...">' +
      this._escapeHtml(terms.text || '') +
      '</textarea>' +
      '</div>' +
      '</div>' +
      '<div class="settings-row">' +
      '<div class="settings-field" style="max-width:200px;">' +
      '<label for="set-due-days">Default Due Days</label>' +
      '<input class="fury-input" id="set-due-days" type="number" min="1" max="365" ' +
      'value="' + (terms.due_days || 7) + '">' +
      '</div>' +
      '</div>' +
      '</div>' +

      /* ── Exchange Rate ── */
      '<div class="settings-section">' +
      '<div class="settings-section-title">Exchange Rate</div>' +
      '<div class="settings-row">' +
      '<div class="settings-field" style="max-width:200px;">' +
      '<label for="set-uah-usd">UAH/USD Rate</label>' +
      '<input class="fury-input" id="set-uah-usd" type="number" step="0.01" min="0" ' +
      'value="' + (exchangeRate.uah_usd || '') + '" placeholder="41.50">' +
      '</div>' +
      '<div class="settings-field" style="max-width:300px;">' +
      '<label>Last Updated</label>' +
      '<div style="padding:8px 0;font-size:13px;color:var(--fury-neutral);">' +
      (exchangeRate.updated_at ? new Date(exchangeRate.updated_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Never') +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      /* ── Working Hours Adjustment ── */
      '<div class="settings-section">' +
      '<div class="settings-section-title">Working Hours</div>' +
      '<div class="settings-row">' +
      '<div class="settings-field" style="max-width:200px;">' +
      '<label for="set-subtract-hours">Adjustment Hours</label>' +
      '<input class="fury-input" id="set-subtract-hours" type="number" min="0" max="40" step="1" ' +
      'value="' + (workingHours.subtract_hours != null ? workingHours.subtract_hours : 8) + '">' +
      '</div>' +
      '<div class="settings-field">' +
      '<label>&nbsp;</label>' +
      '<div style="padding:8px 0;font-size:13px;color:var(--fury-neutral);">' +
      'Subtracted from monthly working hours (default: 8)' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      /* ── Save ── */
      '<div class="settings-actions">' +
      '<button class="fury-btn fury-btn-primary" id="set-save-general">Save Settings</button>' +
      '</div>' +

      '</div>'
    );
  },

  /* ═══════════════════════════════════════════════════
     TAB: Projects
     ═══════════════════════════════════════════════════ */
  renderProjects() {
    var self = this;
    var rows = '';

    if (self.projects.length === 0) {
      rows =
        '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--fury-neutral);">' +
        'No projects found.' +
        '</td></tr>';
    } else {
      for (var i = 0; i < self.projects.length; i++) {
        var p = self.projects[i];
        var activeBadge = p.is_active
          ? '<span class="fury-badge fury-badge-success">Active</span>'
          : '<span class="fury-badge fury-badge-neutral">Inactive</span>';

        var companyBadge = '<span class="fury-badge fury-badge-info">' + self._escapeHtml(p.company || 'WS') + '</span>';

        rows +=
          '<tr>' +
          '<td style="font-weight:600;color:#00D4FF;">' + self._escapeHtml(p.code || '') + '</td>' +
          '<td>' + self._escapeHtml(p.name || '') + '</td>' +
          '<td>' + companyBadge + '</td>' +
          '<td style="text-align:center;">' + activeBadge + '</td>' +
          '<td class="fury-table-actions">' +
          '<div class="settings-table-actions">' +
          '<button class="fury-btn fury-btn-sm fury-btn-secondary set-edit-project" data-id="' + p.id + '">Edit</button>' +
          '</div>' +
          '</td>' +
          '</tr>';
      }
    }

    return (
      '<div class="fury-flex-between fury-mb-2">' +
      '<div style="font-size:13px;color:var(--fury-neutral);">' + self.projects.length + ' project(s)</div>' +
      '<button class="fury-btn fury-btn-sm fury-btn-primary" id="set-add-project">+ Add Project</button>' +
      '</div>' +
      '<div class="fury-card" style="padding:0;overflow:hidden;">' +
      '<table class="fury-table">' +
      '<thead>' +
      '<tr>' +
      '<th scope="col" style="width:120px;">Code</th>' +
      '<th scope="col">Name</th>' +
      '<th scope="col" style="width:140px;">Company</th>' +
      '<th scope="col" style="width:100px;text-align:center;">Status</th>' +
      '<th scope="col" style="width:100px;text-align:right;">Actions</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody id="set-projects-tbody">' + rows + '</tbody>' +
      '</table>' +
      '</div>'
    );
  },

  /* ═══════════════════════════════════════════════════
     TAB: Teams
     ═══════════════════════════════════════════════════ */
  renderTeams() {
    var self = this;
    var rows = '';

    if (self.teams.length === 0) {
      rows =
        '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--fury-neutral);">' +
        'No teams found.' +
        '</td></tr>';
    } else {
      for (var i = 0; i < self.teams.length; i++) {
        var t = self.teams[i];
        var members = self.teamMembers[t.id] || [];
        var memberCount = members.length;

        rows +=
          '<tr class="team-expand" data-team-id="' + t.id + '">' +
          '<td style="font-weight:600;">' +
          '<span style="color:var(--fury-neutral);margin-right:6px;font-size:11px;">&#x25B6;</span>' +
          self._escapeHtml(t.name || '') +
          '</td>' +
          '<td>' + self._escapeHtml(t.lead_email || '') + '</td>' +
          '<td style="text-align:center;">' +
          '<span class="fury-badge fury-badge-info">' + memberCount + '</span>' +
          '</td>' +
          '<td class="fury-table-actions">' +
          '<div class="settings-table-actions">' +
          '<button class="fury-btn fury-btn-sm fury-btn-secondary set-edit-team" data-id="' + t.id + '">Edit</button>' +
          '<button class="fury-btn fury-btn-sm fury-btn-secondary set-manage-members" data-id="' + t.id + '">Members</button>' +
          '</div>' +
          '</td>' +
          '</tr>';

        // Expandable member row (hidden by default)
        var memberTags = '';
        for (var m = 0; m < members.length; m++) {
          var mem = members[m];
          var empName = (mem.employees && mem.employees.name) ? mem.employees.name : mem.employee_id;
          memberTags +=
            '<span class="team-member-tag">' +
            self._escapeHtml(empName) +
            '</span>';
        }
        if (memberTags === '') {
          memberTags = '<span style="color:var(--fury-neutral);font-size:13px;">No members assigned</span>';
        }

        rows +=
          '<tr class="team-members-row" data-team-members="' + t.id + '" style="display:none;">' +
          '<td colspan="4">' +
          '<div class="team-members-list">' + memberTags + '</div>' +
          '</td>' +
          '</tr>';
      }
    }

    return (
      '<div class="fury-flex-between fury-mb-2">' +
      '<div style="font-size:13px;color:var(--fury-neutral);">' + self.teams.length + ' team(s)</div>' +
      '<button class="fury-btn fury-btn-sm fury-btn-primary" id="set-add-team">+ Add Team</button>' +
      '</div>' +
      '<div class="fury-card" style="padding:0;overflow:hidden;">' +
      '<table class="fury-table">' +
      '<thead>' +
      '<tr>' +
      '<th scope="col">Team Name</th>' +
      '<th scope="col">Lead (Email)</th>' +
      '<th scope="col" style="width:100px;text-align:center;">Members</th>' +
      '<th scope="col" style="width:160px;text-align:right;">Actions</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody id="set-teams-tbody">' + rows + '</tbody>' +
      '</table>' +
      '</div>'
    );
  },

  /* ═══════════════════════════════════════════════════
     TAB: Users
     ═══════════════════════════════════════════════════ */
  renderUsers() {
    var self = this;
    var rows = '';

    if (self.profiles.length === 0) {
      rows =
        '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--fury-neutral);">' +
        'No user profiles found.' +
        '</td></tr>';
    } else {
      for (var i = 0; i < self.profiles.length; i++) {
        var u = self.profiles[i];
        var roleBadge = '';
        if (u.role === 'admin') {
          roleBadge = '<span class="fury-badge fury-badge-info">Admin</span>';
        } else if (u.role === 'lead') {
          roleBadge = '<span class="fury-badge" style="background:rgba(139,92,246,0.15);color:#A78BFA;">Lead</span>';
        } else {
          roleBadge = '<span class="fury-badge fury-badge-neutral">Viewer</span>';
        }

        // Role select
        var roleSelect =
          '<select class="fury-select fury-btn-sm set-change-role" data-id="' + u.id + '" ' +
          'style="width:auto;padding:4px 28px 4px 8px;height:28px;font-size:12px;">';
        for (var r = 0; r < self.ROLES.length; r++) {
          var selected = self.ROLES[r] === u.role ? ' selected' : '';
          roleSelect += '<option value="' + self.ROLES[r] + '"' + selected + '>' +
            self.ROLES[r].charAt(0).toUpperCase() + self.ROLES[r].slice(1) +
            '</option>';
        }
        roleSelect += '</select>';

        rows +=
          '<tr>' +
          '<td>' + self._escapeHtml(u.email || '') + '</td>' +
          '<td>' + self._escapeHtml(u.full_name || u.email || '') + '</td>' +
          '<td>' + roleBadge + '</td>' +
          '<td class="fury-table-actions">' + roleSelect + '</td>' +
          '</tr>';
      }
    }

    return (
      '<div class="fury-flex-between fury-mb-2">' +
      '<div style="font-size:13px;color:var(--fury-neutral);">' + self.profiles.length + ' user(s)</div>' +
      '<button class="fury-btn fury-btn-sm fury-btn-primary" id="set-add-user">+ Add User</button>' +
      '</div>' +
      '<div class="fury-card" style="padding:0;overflow:hidden;">' +
      '<table class="fury-table">' +
      '<thead>' +
      '<tr>' +
      '<th scope="col">Email</th>' +
      '<th scope="col">Name</th>' +
      '<th scope="col" style="width:100px;">Role</th>' +
      '<th scope="col" style="width:140px;text-align:right;">Change Role</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody id="set-users-tbody">' + rows + '</tbody>' +
      '</table>' +
      '</div>'
    );
  },

  /* ═══════════════════════════════════════════════════
     TAB: Month Control
     ═══════════════════════════════════════════════════ */
  renderMonths() {
    var self = this;
    var rows = '';
    var now = new Date();
    var currentMonth = now.getMonth() + 1;
    var currentYear = now.getFullYear();

    var monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Build lock lookup
    var lockMap = {};
    for (var l = 0; l < self.monthLocks.length; l++) {
      var lock = self.monthLocks[l];
      lockMap[lock.month + '-' + lock.year] = lock;
    }

    // Show last 12 months
    var months = [];
    var m = currentMonth;
    var y = currentYear;
    for (var i = 0; i < 12; i++) {
      months.push({ month: m, year: y });
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
    }

    for (var j = 0; j < months.length; j++) {
      var entry = months[j];
      var key = entry.month + '-' + entry.year;
      var lockInfo = lockMap[key] || null;
      var isLocked = !!lockInfo;

      var statusBadge = isLocked
        ? '<span class="fury-badge fury-badge-danger fury-badge-dot">Locked</span>'
        : '<span class="fury-badge fury-badge-success fury-badge-dot">Open</span>';

      var lockedBy = isLocked ? self._escapeHtml(lockInfo.locked_by_email || lockInfo.locked_by || 'Admin') : '&mdash;';
      var lockedDate = isLocked && lockInfo.created_at
        ? new Date(lockInfo.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
        : '&mdash;';

      var actionBtn = isLocked
        ? '<button class="fury-btn fury-btn-sm fury-btn-success set-unlock-month" data-month="' + entry.month + '" data-year="' + entry.year + '">Unlock</button>'
        : '<button class="fury-btn fury-btn-sm fury-btn-danger set-lock-month" data-month="' + entry.month + '" data-year="' + entry.year + '">Lock</button>';

      var isCurrent = (entry.month === currentMonth && entry.year === currentYear);
      var rowStyle = isCurrent ? ' style="background:rgba(0,212,255,0.03);"' : '';

      rows +=
        '<tr' + rowStyle + '>' +
        '<td style="font-weight:600;">' + monthNames[entry.month - 1] + '</td>' +
        '<td>' + entry.year + '</td>' +
        '<td style="text-align:center;">' + statusBadge + '</td>' +
        '<td>' + lockedBy + '</td>' +
        '<td>' + lockedDate + '</td>' +
        '<td class="fury-table-actions">' + actionBtn + '</td>' +
        '</tr>';
    }

    return (
      '<div class="fury-card" style="padding:0;overflow:hidden;">' +
      '<table class="fury-table">' +
      '<thead>' +
      '<tr>' +
      '<th scope="col">Month</th>' +
      '<th scope="col" style="width:80px;">Year</th>' +
      '<th scope="col" style="width:100px;text-align:center;">Status</th>' +
      '<th scope="col">Locked By</th>' +
      '<th scope="col">Date</th>' +
      '<th scope="col" style="width:100px;text-align:right;">Action</th>' +
      '</tr>' +
      '</thead>' +
      '<tbody id="set-months-tbody">' + rows + '</tbody>' +
      '</table>' +
      '</div>'
    );
  },

  /* ═══════════════════════════════════════════════════
     RENDER ACTIVE TAB
     ═══════════════════════════════════════════════════ */
  renderActiveTab(container) {
    var contentEl = container.querySelector('#settings-content');
    if (!contentEl) return;

    var html = '';
    switch (this.activeTab) {
      case 'general': html = this.renderGeneral(); break;
      case 'projects': html = this.renderProjects(); break;
      case 'teams': html = this.renderTeams(); break;
      case 'users': html = this.renderUsers(); break;
      case 'months': html = this.renderMonths(); break;
      case 'email_requests': html = this.renderEmailRequests(); break;
      case 'working_hours': html = this.renderWorkingHours(); break;
      default: html = this.renderGeneral(); break;
    }

    contentEl.innerHTML = html;
    this.bindTabEvents(container);
  },

  /* ═══════════════════════════════════════════════════
     DATA LOADING
     ═══════════════════════════════════════════════════ */
  async loadData() {
    var self = this;

    try {
      // Parallel load: all settings + projects + teams + profiles + locks + team_members
      var settingKeys = ['billed_to', 'payment_terms', 'exchange_rate', 'working_hours_adjustment'];
      var settingPromises = settingKeys.map(function (key) { return DB.getSetting(key); });

      var parallel = await Promise.all([
        Promise.all(settingPromises),
        DB.client.from('projects').select('*').order('name', { ascending: true }),
        DB.getTeams(),
        DB.client.from('profiles').select('*').order('email', { ascending: true }),
        DB.client.from('month_locks').select('*')
          .order('year', { ascending: false })
          .order('month', { ascending: false }),
        // Single query for ALL team_members with employee names (replaces N+1 per team)
        DB.client.from('team_members').select('*, employees(id, name, work_email)')
      ]);

      // Settings
      var settingResults = parallel[0];
      for (var i = 0; i < settingKeys.length; i++) {
        var result = settingResults[i];
        self.settings[settingKeys[i]] = (result && result.data) ? result.data : {};
      }

      self.projects = (parallel[1] && parallel[1].data) ? parallel[1].data : [];
      self.teams = (parallel[2] && parallel[2].data) ? parallel[2].data : [];

      // Group team_members by team_id from single query
      self.teamMembers = {};
      for (var t = 0; t < self.teams.length; t++) {
        self.teamMembers[self.teams[t].id] = [];
      }
      var allMembers = (parallel[5] && parallel[5].data) ? parallel[5].data : [];
      for (var m = 0; m < allMembers.length; m++) {
        var member = allMembers[m];
        if (!self.teamMembers[member.team_id]) {
          self.teamMembers[member.team_id] = [];
        }
        self.teamMembers[member.team_id].push(member);
      }

      self.profiles = (parallel[3] && parallel[3].data) ? parallel[3].data : [];
      self.monthLocks = (parallel[4] && parallel[4].data) ? parallel[4].data : [];

    } catch (err) {
      console.error('[Settings] loadData error:', err);
      showToast('Failed to load settings. Please try again.', 'error');
    }
  },

  /* ═══════════════════════════════════════════════════
     EVENT BINDING
     ═══════════════════════════════════════════════════ */
  bindEvents(container, ctx) {
    var self = this;

    // Tab switching
    var tabs = container.querySelectorAll('.fury-tab[data-tab]');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].addEventListener('click', function () {
        // Deactivate all tabs
        for (var j = 0; j < tabs.length; j++) {
          tabs[j].classList.remove('active');
          tabs[j].setAttribute('aria-selected', 'false');
        }
        this.classList.add('active');
        this.setAttribute('aria-selected', 'true');
        self.activeTab = this.getAttribute('data-tab');
        self.renderActiveTab(container);
      });
    }

    // Arrow key navigation for tabs
    var tabList = container.querySelector('[role="tablist"]');
    if (tabList) {
      tabList.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        var currentIdx = Array.prototype.indexOf.call(tabs, document.activeElement);
        if (currentIdx === -1) return;
        e.preventDefault();
        var nextIdx;
        if (e.key === 'ArrowRight') {
          nextIdx = (currentIdx + 1) % tabs.length;
        } else {
          nextIdx = (currentIdx - 1 + tabs.length) % tabs.length;
        }
        tabs[nextIdx].focus();
        tabs[nextIdx].click();
      });
    }

    // Modal close
    var overlay = container.parentNode.querySelector('#settings-modal-overlay');
    var closeBtn = container.parentNode.querySelector('#settings-modal-close');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) self._closeModal();
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        self._closeModal();
      });
    }
  },

  /* ── Bind events specific to the active tab content ── */
  bindTabEvents(container) {
    var self = this;

    switch (self.activeTab) {
      case 'general':
        self._bindGeneralEvents(container);
        break;
      case 'projects':
        self._bindProjectEvents(container);
        break;
      case 'teams':
        self._bindTeamEvents(container);
        break;
      case 'users':
        self._bindUserEvents(container);
        break;
      case 'months':
        self._bindMonthEvents(container);
        break;
      case 'email_requests':
        self._bindEmailRequestEvents(container);
        break;
      case 'working_hours':
        self._bindWorkingHoursEvents(container);
        break;
    }
  },

  /* ── General Tab Events ── */
  _bindGeneralEvents(container) {
    var self = this;

    var saveBtn = container.querySelector('#set-save-general');
    if (saveBtn) {
      saveBtn.addEventListener('click', async function () {
        // Validate before saving
        var companyName = (container.querySelector('#set-billed-name') || {}).value || '';
        var companyAddress = (container.querySelector('#set-billed-address') || {}).value || '';
        var termsText = (container.querySelector('#set-terms-text') || {}).value || '';
        var dueDaysVal = (container.querySelector('#set-due-days') || {}).value;
        var rateVal = (container.querySelector('#set-uah-usd') || {}).value;
        var subtractVal = (container.querySelector('#set-subtract-hours') || {}).value;

        // Validate company name length
        if (companyName.length > 200) {
          showToast('Company name must be 200 characters or less.', 'error');
          return;
        }

        // Validate due days
        var dueDays = parseInt(dueDaysVal, 10);
        if (dueDaysVal !== '' && (!Number.isFinite(dueDays) || dueDays < 1 || dueDays > 365)) {
          showToast('Due days must be between 1 and 365.', 'error');
          return;
        }

        // Validate exchange rate
        var newRate = parseFloat(rateVal);
        if (rateVal !== '' && (!Number.isFinite(newRate) || newRate < 0 || newRate > 1000)) {
          showToast('Exchange rate must be between 0 and 1000.', 'error');
          return;
        }
        if (rateVal === '' || isNaN(newRate)) newRate = 0;

        // Validate subtract hours
        var subtractHours = parseInt(subtractVal, 10);
        if (isNaN(subtractHours)) subtractHours = 8;
        if (subtractHours < 0 || subtractHours > 40) {
          showToast('Adjustment hours must be between 0 and 40.', 'error');
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';

        try {
          // Billed To
          var billedTo = {
            name: companyName,
            address: companyAddress
          };
          var billedResult = await DB.setSetting('billed_to', billedTo);
          if (billedResult && billedResult.error) throw new Error(billedResult.error.message);

          // Payment Terms
          var terms = {
            text: termsText,
            due_days: dueDays || 7
          };
          var termsResult = await DB.setSetting('payment_terms', terms);
          if (termsResult && termsResult.error) throw new Error(termsResult.error.message);

          // Exchange Rate
          var currentRate = self.settings.exchange_rate || {};
          var exchangeRate = {
            uah_usd: newRate,
            updated_at: newRate !== currentRate.uah_usd ? new Date().toISOString() : (currentRate.updated_at || new Date().toISOString())
          };
          var rateResult = await DB.setSetting('exchange_rate', exchangeRate);
          if (rateResult && rateResult.error) throw new Error(rateResult.error.message);

          // Working Hours
          var workingHours = {
            subtract_hours: subtractHours
          };
          var hoursResult = await DB.setSetting('working_hours_adjustment', workingHours);
          if (hoursResult && hoursResult.error) throw new Error(hoursResult.error.message);

          // Update cached data
          self.settings.billed_to = billedTo;
          self.settings.payment_terms = terms;
          self.settings.exchange_rate = exchangeRate;
          self.settings.working_hours_adjustment = workingHours;

          showToast('Settings saved', 'success');
        } catch (err) {
          console.error('[Settings] save general error:', err);
          showToast('Failed to save settings. Please try again.', 'error');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Settings';
        }
      });
    }
  },

  /* ── Project Tab Events ── */
  _bindProjectEvents(container) {
    var self = this;

    // Add Project
    var addBtn = container.querySelector('#set-add-project');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        self._showProjectModal(null, container);
      });
    }

    // Edit Project (delegated)
    var tbody = container.querySelector('#set-projects-tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        var editBtn = e.target.closest('.set-edit-project');
        if (editBtn) {
          var projectId = editBtn.getAttribute('data-id');
          var project = self.projects.find(function (p) { return p.id === projectId; });
          if (project) {
            self._showProjectModal(project, container);
          }
        }
      });
    }
  },

  /* ── Team Tab Events ── */
  _bindTeamEvents(container) {
    var self = this;

    // Add Team
    var addBtn = container.querySelector('#set-add-team');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        self._showTeamModal(null, container);
      });
    }

    // Delegated events on team tbody
    var tbody = container.querySelector('#set-teams-tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        // Expand/collapse members
        var expandRow = e.target.closest('.team-expand');
        if (expandRow && !e.target.closest('.fury-btn')) {
          var teamId = expandRow.getAttribute('data-team-id');
          var membersRow = container.querySelector('[data-team-members="' + teamId + '"]');
          if (membersRow) {
            var isVisible = membersRow.style.display !== 'none';
            membersRow.style.display = isVisible ? 'none' : 'table-row';
            // Toggle arrow
            var arrow = expandRow.querySelector('span');
            if (arrow) {
              arrow.innerHTML = isVisible ? '&#x25B6;' : '&#x25BC;';
            }
          }
          return;
        }

        // Edit team
        var editBtn = e.target.closest('.set-edit-team');
        if (editBtn) {
          var editTeamId = editBtn.getAttribute('data-id');
          var team = self.teams.find(function (t) { return t.id === editTeamId; });
          if (team) {
            self._showTeamModal(team, container);
          }
          return;
        }

        // Manage members
        var membersBtn = e.target.closest('.set-manage-members');
        if (membersBtn) {
          var manageTeamId = membersBtn.getAttribute('data-id');
          var manageTeam = self.teams.find(function (t) { return t.id === manageTeamId; });
          if (manageTeam) {
            self._showMembersModal(manageTeam, container);
          }
        }
      });
    }
  },

  /* ── User Tab Events ── */
  _bindUserEvents(container) {
    var self = this;

    // Add User
    var addBtn = container.querySelector('#set-add-user');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        self._showUserModal(container);
      });
    }

    // Change Role (delegated)
    var tbody = container.querySelector('#set-users-tbody');
    if (tbody) {
      tbody.addEventListener('change', function (e) {
        if (e.target.classList.contains('set-change-role')) {
          var userId = e.target.getAttribute('data-id');
          var newRole = e.target.value;
          self._changeUserRole(userId, newRole, container);
        }
      });
    }
  },

  /* ── Month Tab Events ── */
  _bindMonthEvents(container) {
    var self = this;

    var tbody = container.querySelector('#set-months-tbody');
    if (tbody) {
      tbody.addEventListener('click', function (e) {
        // Lock month
        var lockBtn = e.target.closest('.set-lock-month');
        if (lockBtn) {
          if (lockBtn.disabled) return;
          lockBtn.disabled = true;
          var month = parseInt(lockBtn.getAttribute('data-month'), 10);
          var year = parseInt(lockBtn.getAttribute('data-year'), 10);
          self._lockMonth(month, year, container);
          return;
        }

        // Unlock month
        var unlockBtn = e.target.closest('.set-unlock-month');
        if (unlockBtn) {
          if (unlockBtn.disabled) return;
          unlockBtn.disabled = true;
          var unlockMonth = parseInt(unlockBtn.getAttribute('data-month'), 10);
          var unlockYear = parseInt(unlockBtn.getAttribute('data-year'), 10);
          self._unlockMonth(unlockMonth, unlockYear, container);
        }
      });
    }
  },

  /* ═══════════════════════════════════════════════════
     MODAL HELPERS
     ═══════════════════════════════════════════════════ */

  _openModal(title, bodyHtml, footerHtml) {
    this._modalTrigger = document.activeElement;
    var overlay = document.querySelector('#settings-modal-overlay');
    var titleEl = document.querySelector('#settings-modal-title');
    var bodyEl = document.querySelector('#settings-modal-body');
    var footerEl = document.querySelector('#settings-modal-footer');

    if (titleEl) titleEl.textContent = title;
    if (bodyEl) bodyEl.innerHTML = bodyHtml;
    if (footerEl) footerEl.innerHTML = footerHtml;
    if (overlay) overlay.classList.add('active');

    // Cleanup previous handlers if any
    this._cleanupModalHandlers();

    // Escape to close
    var self = this;
    this._currentEscHandler = function(e) {
      if (e.key === 'Escape') self._closeModal();
    };
    document.addEventListener('keydown', this._currentEscHandler);

    // Enter to submit
    this._currentEnterHandler = function(e) {
      if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
        e.preventDefault();
        var saveBtn = overlay.querySelector('.fury-btn-primary');
        if (saveBtn && !saveBtn.disabled) saveBtn.click();
      }
    };
    if (overlay) overlay.addEventListener('keydown', this._currentEnterHandler);

    // Body scroll lock
    document.body.classList.add('fury-modal-open');

    // Trap focus inside modal
    if (overlay) {
      this._currentFocusTrap = function(e) {
        if (e.key !== 'Tab') return;
        var focusable = overlay.querySelectorAll('input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])');
        if (focusable.length === 0) return;
        var first = focusable[0];
        var last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };
      overlay.addEventListener('keydown', this._currentFocusTrap);
    }

    // Focus first input
    setTimeout(function() {
      var firstInput = bodyEl.querySelector('input:not([readonly]):not([disabled]), select, textarea');
      if (firstInput) firstInput.focus();
    }, 100);
  },

  _cleanupModalHandlers() {
    if (this._currentEscHandler) {
      document.removeEventListener('keydown', this._currentEscHandler);
      this._currentEscHandler = null;
    }
    var overlay = document.querySelector('#settings-modal-overlay');
    if (overlay && this._currentEnterHandler) {
      overlay.removeEventListener('keydown', this._currentEnterHandler);
      this._currentEnterHandler = null;
    }
    if (overlay && this._currentFocusTrap) {
      overlay.removeEventListener('keydown', this._currentFocusTrap);
      this._currentFocusTrap = null;
    }
  },

  _closeModal() {
    var overlay = document.querySelector('#settings-modal-overlay');
    if (overlay) overlay.classList.remove('active');

    // Cleanup all modal handlers
    this._cleanupModalHandlers();

    // Remove body scroll lock
    document.body.classList.remove('fury-modal-open');

    // Return focus to trigger element
    if (this._modalTrigger && typeof this._modalTrigger.focus === 'function') {
      this._modalTrigger.focus();
      this._modalTrigger = null;
    }
  },

  /* ── Custom Confirm Dialog (replaces browser confirm()) ── */
  _confirmDialog(message, onConfirm) {
    var self = this;
    var bodyHtml =
      '<p style="font-size:14px;color:#E5E7EB;line-height:1.6;white-space:pre-line;">' +
      self._escapeHtml(message) + '</p>';
    var footerHtml =
      '<button class="fury-btn fury-btn-secondary" id="modal-confirm-cancel">Cancel</button>' +
      '<button class="fury-btn fury-btn-danger" id="modal-confirm-ok">Confirm</button>';

    self._openModal('Confirm Action', bodyHtml, footerHtml);

    document.querySelector('#modal-confirm-cancel').addEventListener('click', function () {
      self._closeModal();
    });
    document.querySelector('#modal-confirm-ok').addEventListener('click', function () {
      self._closeModal();
      onConfirm();
    });
  },

  /* ═══════════════════════════════════════════════════
     PROJECT MODAL
     ═══════════════════════════════════════════════════ */
  _showProjectModal(project, container) {
    var self = this;
    var isEdit = !!project;
    var title = isEdit ? 'Edit Project' : 'Add Project';

    var companyOptions = '';
    for (var c = 0; c < self.COMPANIES.length; c++) {
      var selected = project && project.company === self.COMPANIES[c] ? ' selected' : '';
      companyOptions += '<option value="' + self.COMPANIES[c] + '"' + selected + '>' + self.COMPANIES[c] + '</option>';
    }

    var bodyHtml =
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="modal-project-code">Project Code</label>' +
      '<input class="fury-input" id="modal-project-code" type="text" placeholder="FURY" ' +
      'value="' + self._escapeAttr((project && project.code) || '') + '"' +
      (isEdit ? ' disabled' : '') + '>' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="modal-project-name">Project Name</label>' +
      '<input class="fury-input" id="modal-project-name" type="text" placeholder="Fury UAV Platform" ' +
      'value="' + self._escapeAttr((project && project.name) || '') + '">' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="modal-project-company">Company</label>' +
      '<select class="fury-select" id="modal-project-company">' + companyOptions + '</select>' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-checkbox">' +
      '<input type="checkbox" id="modal-project-active"' +
      ((!project || project.is_active) ? ' checked' : '') + '>' +
      ' Active' +
      '</label>' +
      '</div>';

    var footerHtml =
      '<button class="fury-btn fury-btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button class="fury-btn fury-btn-primary" id="modal-save-project">' + (isEdit ? 'Update' : 'Create') + '</button>';

    self._openModal(title, bodyHtml, footerHtml);

    // Bind modal events
    document.querySelector('#modal-cancel').addEventListener('click', function () {
      self._closeModal();
    });

    document.querySelector('#modal-save-project').addEventListener('click', async function () {
      var saveBtn = this;
      var code = (document.querySelector('#modal-project-code') || {}).value.trim();
      var name = (document.querySelector('#modal-project-name') || {}).value.trim();
      var company = (document.querySelector('#modal-project-company') || {}).value;
      var isActive = (document.querySelector('#modal-project-active') || {}).checked;

      if (!code || !name) {
        showToast('Project code and name are required.', 'error');
        return;
      }

      if (!/^[A-Za-z0-9_-]{1,10}$/.test(code)) {
        showToast('Project code: alphanumeric, underscore, dash only, max 10 chars.', 'error');
        return;
      }

      if (name.length > 100) {
        showToast('Project name must be 100 characters or less.', 'error');
        return;
      }

      // Check for duplicate code on new projects
      if (!isEdit) {
        var upperCode = code.toUpperCase();
        var duplicate = self.projects.find(function(p) { return p.code === upperCode; });
        if (duplicate) {
          showToast('A project with code "' + upperCode + '" already exists.', 'error');
          return;
        }
      }

      // Validate company against whitelist
      if (self.COMPANIES.indexOf(company) === -1) {
        showToast('Invalid company selected.', 'error');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        var projectData = {
          code: code.toUpperCase(),
          name: name,
          company: company,
          is_active: isActive
        };

        if (isEdit) {
          projectData.id = project.id;
        }

        var result = await DB.client
          .from('projects')
          .upsert(projectData, { onConflict: 'id' })
          .select()
          .single();

        if (result.error) throw result.error;

        self._closeModal();
        showToast(isEdit ? 'Project updated' : 'Project created', 'success');

        // Reload projects
        var projResult = await DB.client
          .from('projects')
          .select('*')
          .order('name', { ascending: true });
        self.projects = (projResult && projResult.data) ? projResult.data : [];
        self.renderActiveTab(container);

      } catch (err) {
        console.error('[Settings] save project error:', err);
        showToast('Failed to save project. Please try again.', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Update' : 'Create';
      }
    });
  },

  /* ═══════════════════════════════════════════════════
     TEAM MODAL
     ═══════════════════════════════════════════════════ */
  _showTeamModal(team, container) {
    var self = this;
    var isEdit = !!team;
    var title = isEdit ? 'Edit Team' : 'Add Team';

    var bodyHtml =
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="modal-team-name">Team Name</label>' +
      '<input class="fury-input" id="modal-team-name" type="text" placeholder="Engineering" ' +
      'value="' + self._escapeAttr((team && team.name) || '') + '">' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="modal-team-lead">Lead Email</label>' +
      '<input class="fury-input" id="modal-team-lead" type="email" placeholder="lead@omdsystems.com" ' +
      'value="' + self._escapeAttr((team && team.lead_email) || '') + '">' +
      '</div>';

    var footerHtml =
      '<button class="fury-btn fury-btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button class="fury-btn fury-btn-primary" id="modal-save-team">' + (isEdit ? 'Update' : 'Create') + '</button>';

    self._openModal(title, bodyHtml, footerHtml);

    document.querySelector('#modal-cancel').addEventListener('click', function () {
      self._closeModal();
    });

    document.querySelector('#modal-save-team').addEventListener('click', async function () {
      var saveBtn = this;
      var name = (document.querySelector('#modal-team-name') || {}).value.trim();
      var leadEmail = (document.querySelector('#modal-team-lead') || {}).value.trim();

      if (!name) {
        showToast('Team name is required.', 'error');
        return;
      }
      if (name.length > 100) {
        showToast('Team name must be 100 characters or less.', 'error');
        return;
      }
      if (leadEmail && !Validation.isValidEmail(leadEmail)) {
        showToast('Please enter a valid lead email.', 'error');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        var teamData = {
          name: name,
          lead_email: leadEmail
        };

        if (isEdit) {
          teamData.id = team.id;
        }

        var result = await DB.client
          .from('teams')
          .upsert(teamData, { onConflict: 'id' })
          .select()
          .single();

        if (result.error) throw result.error;

        self._closeModal();
        showToast(isEdit ? 'Team updated' : 'Team created', 'success');

        // Reload teams
        var teamResult = await DB.getTeams();
        self.teams = (teamResult && teamResult.data) ? teamResult.data : [];
        self.renderActiveTab(container);

      } catch (err) {
        console.error('[Settings] save team error:', err);
        showToast('Failed to save team. Please try again.', 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = isEdit ? 'Update' : 'Create';
      }
    });
  },

  /* ═══════════════════════════════════════════════════
     TEAM MEMBERS MODAL
     ═══════════════════════════════════════════════════ */
  _showMembersModal(team, container) {
    var self = this;
    var members = self.teamMembers[team.id] || [];

    // Build current member list
    var memberListHtml = '';
    for (var i = 0; i < members.length; i++) {
      var mem = members[i];
      var empName = (mem.employees && mem.employees.name) ? mem.employees.name : mem.employee_id;
      memberListHtml +=
        '<div class="team-member-tag" style="margin-bottom:4px;">' +
        self._escapeHtml(empName) +
        ' <span class="remove-member" data-member-id="' + mem.id + '" data-employee-id="' + mem.employee_id + '" title="Remove">&times;</span>' +
        '</div>';
    }
    if (!memberListHtml) {
      memberListHtml = '<div style="color:var(--fury-neutral);font-size:13px;padding:8px 0;">No members in this team.</div>';
    }

    // Build employee dropdown (exclude already-assigned members)
    var assignedIds = {};
    for (var m = 0; m < members.length; m++) {
      assignedIds[members[m].employee_id] = true;
    }

    // Employee options loaded asynchronously via _loadEmployeesForMemberSelect

    var bodyHtml =
      '<div style="margin-bottom:16px;">' +
      '<div class="settings-section-title" style="margin-bottom:8px;">Current Members</div>' +
      '<div id="modal-members-list" class="team-members-list" style="flex-wrap:wrap;">' + memberListHtml + '</div>' +
      '</div>' +
      '<div class="fury-divider"></div>' +
      '<div>' +
      '<div class="settings-section-title" style="margin-bottom:8px;">Add Member</div>' +
      '<div style="display:flex;gap:8px;align-items:flex-end;">' +
      '<div style="flex:1;">' +
      '<select class="fury-select" id="modal-add-member-select">' +
      '<option value="">Loading employees...</option>' +
      '</select>' +
      '</div>' +
      '<button class="fury-btn fury-btn-sm fury-btn-primary" id="modal-add-member-btn">Add</button>' +
      '</div>' +
      '</div>';

    var footerHtml =
      '<button class="fury-btn fury-btn-secondary" id="modal-cancel">Close</button>';

    self._openModal('Manage Members: ' + team.name, bodyHtml, footerHtml);

    document.querySelector('#modal-cancel').addEventListener('click', function () {
      self._closeModal();
    });

    // Load employees for the dropdown
    self._loadEmployeesForMemberSelect(team, container);

    // Remove member (delegated)
    var membersList = document.querySelector('#modal-members-list');
    if (membersList) {
      membersList.addEventListener('click', function (e) {
        var removeBtn = e.target.closest('.remove-member');
        if (!removeBtn) return;

        var memberId = removeBtn.getAttribute('data-member-id');
        self._closeModal();
        self._confirmDialog('Remove this member from the team?', async function () {
          try {
            var result = await DB.client
              .from('team_members')
              .delete()
              .eq('id', memberId);

            if (result.error) throw result.error;

            showToast('Member removed', 'success');

            // Reload team members
            var membersResult = await DB.getTeamMembers(team.id);
            self.teamMembers[team.id] = (membersResult && membersResult.data) ? membersResult.data : [];
            self.renderActiveTab(container);

          } catch (err) {
            console.error('[Settings] remove member error:', err);
            showToast('Failed to remove member. Please try again.', 'error');
          }
        });
      });
    }

    // Add member
    var addMemberBtn = document.querySelector('#modal-add-member-btn');
    if (addMemberBtn) {
      addMemberBtn.addEventListener('click', async function () {
        var select = document.querySelector('#modal-add-member-select');
        var employeeId = select ? select.value : '';

        if (!employeeId) {
          showToast('Please select an employee.', 'error');
          return;
        }

        addMemberBtn.disabled = true;
        addMemberBtn.textContent = '...';

        try {
          var result = await DB.client
            .from('team_members')
            .insert({
              team_id: team.id,
              employee_id: employeeId
            })
            .select()
            .single();

          if (result.error) throw result.error;

          showToast('Member added', 'success');
          self._closeModal();

          // Reload team members
          var membersResult = await DB.getTeamMembers(team.id);
          self.teamMembers[team.id] = (membersResult && membersResult.data) ? membersResult.data : [];
          self.renderActiveTab(container);

        } catch (err) {
          console.error('[Settings] add member error:', err);
          showToast('Failed to add member. Please try again.', 'error');
          addMemberBtn.disabled = false;
          addMemberBtn.textContent = 'Add';
        }
      });
    }
  },

  /* ── Load employees into the member-add dropdown ── */
  async _loadEmployeesForMemberSelect(team, container) {
    var self = this;
    try {
      var empResult = await DB.getEmployees();
      var employees = (empResult && empResult.data) ? empResult.data : [];
      var members = self.teamMembers[team.id] || [];

      // Build set of already-assigned employee IDs
      var assignedIds = {};
      for (var m = 0; m < members.length; m++) {
        assignedIds[members[m].employee_id] = true;
      }

      var select = document.querySelector('#modal-add-member-select');
      if (!select) return;

      var options = '<option value="">Select employee...</option>';
      for (var e = 0; e < employees.length; e++) {
        var emp = employees[e];
        if (assignedIds[emp.id]) continue;
        options += '<option value="' + emp.id + '">' + self._escapeHtml(emp.name || emp.email || emp.id) + '</option>';
      }

      select.innerHTML = options;

    } catch (err) {
      console.error('[Settings] loadEmployeesForMemberSelect error:', err);
      showToast('Failed to load employee list.', 'error');
    }
  },

  /* ═══════════════════════════════════════════════════
     USER MODAL (Add)
     ═══════════════════════════════════════════════════ */
  _showUserModal(container) {
    var self = this;

    var roleOptions = '';
    for (var r = 0; r < self.ROLES.length; r++) {
      var selected = self.ROLES[r] === 'viewer' ? ' selected' : '';
      roleOptions += '<option value="' + self.ROLES[r] + '"' + selected + '>' +
        self.ROLES[r].charAt(0).toUpperCase() + self.ROLES[r].slice(1) +
        '</option>';
    }

    var bodyHtml =
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="modal-user-email">Email</label>' +
      '<input class="fury-input" id="modal-user-email" type="email" placeholder="user@omdsystems.com">' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="modal-user-name">Full Name</label>' +
      '<input class="fury-input" id="modal-user-name" type="text" placeholder="John Doe">' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label" for="modal-user-role">Role</label>' +
      '<select class="fury-select" id="modal-user-role">' + roleOptions + '</select>' +
      '</div>';

    var footerHtml =
      '<button class="fury-btn fury-btn-secondary" id="modal-cancel">Cancel</button>' +
      '<button class="fury-btn fury-btn-primary" id="modal-save-user">Create User</button>';

    self._openModal('Add User', bodyHtml, footerHtml);

    document.querySelector('#modal-cancel').addEventListener('click', function () {
      self._closeModal();
    });

    document.querySelector('#modal-save-user').addEventListener('click', async function () {
      var saveBtn = this;
      var email = (document.querySelector('#modal-user-email') || {}).value.trim();
      var fullName = (document.querySelector('#modal-user-name') || {}).value.trim();
      var role = (document.querySelector('#modal-user-role') || {}).value;

      // Validate email
      if (!email) {
        showToast('Email is required.', 'error');
        return;
      }
      if (!Validation.isValidEmail(email)) {
        showToast('Please enter a valid email address.', 'error');
        return;
      }

      // Validate name
      if (!fullName) {
        showToast('Full name is required.', 'error');
        return;
      }
      if (fullName.length > 100) {
        showToast('Full name must be 100 characters or less.', 'error');
        return;
      }

      // Validate role against whitelist
      if (self.ROLES.indexOf(role) === -1) {
        showToast('Invalid role selected.', 'error');
        return;
      }

      // Check for duplicate email
      var existingUser = self.profiles.find(function(p) { return p.email === email; });
      if (existingUser) {
        showToast('A user with this email already exists.', 'error');
        return;
      }

      saveBtn.disabled = true;
      saveBtn.textContent = 'Creating...';

      try {
        // Generate secure temp password (16 chars for better entropy)
        var arr = new Uint8Array(16);
        crypto.getRandomValues(arr);
        var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
        var tempPassword = '';
        for (var ci = 0; ci < 16; ci++) {
          tempPassword += chars[arr[ci] % chars.length];
        }

        // Create user via admin RPC (checks admin role server-side)
        var result = await DB.client.rpc('admin_create_user', {
          p_email: email,
          p_password: tempPassword,
          p_full_name: fullName,
          p_role: role
        });

        if (result.error) throw result.error;

        self._closeModal();

        // Show password in a secure modal (not prompt())
        var pwBodyHtml =
          '<p style="font-size:13px;color:#9CA3AF;margin-bottom:12px;">User created successfully. Copy the temporary password below:</p>' +
          '<div style="display:flex;gap:8px;align-items:center;">' +
          '<input class="fury-input" id="modal-temp-password" type="text" value="' + self._escapeAttr(tempPassword) + '" readonly ' +
          'style="font-family:monospace;font-size:14px;letter-spacing:0.05em;">' +
          '<button class="fury-btn fury-btn-sm fury-btn-primary" id="modal-copy-password">Copy</button>' +
          '</div>';
        var pwFooterHtml = '<button class="fury-btn fury-btn-secondary" id="modal-pw-close">Close</button>';
        self._openModal('User Created', pwBodyHtml, pwFooterHtml);

        document.querySelector('#modal-copy-password').addEventListener('click', function() {
          var pwInput = document.querySelector('#modal-temp-password');
          if (pwInput) {
            pwInput.select();
            if (navigator.clipboard) {
              navigator.clipboard.writeText(pwInput.value).then(function() {
                showToast('Password copied to clipboard.', 'success');
              }).catch(function() {
                document.execCommand('copy');
                showToast('Password copied.', 'success');
              });
            } else {
              document.execCommand('copy');
              showToast('Password copied.', 'success');
            }
          }
        });
        document.querySelector('#modal-pw-close').addEventListener('click', function() {
          self._closeModal();
        });

        // Reload profiles
        var profileResult = await DB.client
          .from('profiles')
          .select('*')
          .order('email', { ascending: true });
        self.profiles = (profileResult && profileResult.data) ? profileResult.data : [];
        self.renderActiveTab(container);

      } catch (err) {
        console.error('[Settings] add user error:', err);
        var errMsg = (err && err.message) || (err && err.details) || 'Unknown error';
        showToast('Failed to create user: ' + errMsg, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = 'Create User';
      }
    });
  },

  /* ═══════════════════════════════════════════════════
     ROLE CHANGE
     ═══════════════════════════════════════════════════ */
  _changeUserRole(userId, newRole, container) {
    var self = this;

    // Validate role against whitelist
    if (self.ROLES.indexOf(newRole) === -1) {
      showToast('Invalid role.', 'error');
      self.renderActiveTab(container);
      return;
    }

    // Prevent self-demotion
    if (App.user && App.user.id === userId && newRole !== 'admin') {
      showToast('You cannot change your own role.', 'error');
      self.renderActiveTab(container);
      return;
    }

    // Find user name for confirm message
    var targetUser = self.profiles.find(function(p) { return p.id === userId; });
    var userName = targetUser ? (targetUser.full_name || targetUser.email) : userId;

    self._confirmDialog(
      'Change role for ' + userName + ' to "' + newRole + '"?',
      async function () {
        try {
          var result = await DB.client
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId)
            .select()
            .single();

          if (result.error) throw result.error;

          // Update local cache
          for (var i = 0; i < self.profiles.length; i++) {
            if (self.profiles[i].id === userId) {
              self.profiles[i].role = newRole;
              break;
            }
          }

          showToast('Role updated to ' + newRole + '. User must re-login for full effect.', 'success');
          self.renderActiveTab(container);

        } catch (err) {
          console.error('[Settings] change role error:', err);
          showToast('Failed to change role. Please try again.', 'error');
          self.renderActiveTab(container);
        }
      }
    );
  },

  /* ═══════════════════════════════════════════════════
     MONTH LOCK / UNLOCK
     ═══════════════════════════════════════════════════ */
  _lockMonth(month, year, container) {
    var self = this;
    var monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    self._confirmDialog(
      'Lock ' + monthNames[month - 1] + ' ' + year + '?\n\nTimesheets and invoices for this month will not be editable.',
      async function () {
        try {
          var result = await DB.lockMonth(month, year);
          if (result.error) throw result.error;

          showToast(monthNames[month - 1] + ' ' + year + ' locked', 'success');

          // Reload locks
          var locksResult = await DB.client
            .from('month_locks')
            .select('*')
            .order('year', { ascending: false })
            .order('month', { ascending: false });
          self.monthLocks = (locksResult && locksResult.data) ? locksResult.data : [];
          self.renderActiveTab(container);

        } catch (err) {
          console.error('[Settings] lock month error:', err);
          showToast('Failed to lock month. Please try again.', 'error');
        }
      }
    );
  },

  _unlockMonth(month, year, container) {
    var self = this;
    var monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    self._confirmDialog(
      'Unlock ' + monthNames[month - 1] + ' ' + year + '?\n\nTimesheets and invoices for this month will become editable again.',
      async function () {
        try {
          var result = await DB.unlockMonth(month, year);
          if (result.error) throw result.error;

          showToast(monthNames[month - 1] + ' ' + year + ' unlocked', 'success');

          // Reload locks
          var locksResult = await DB.client
            .from('month_locks')
            .select('*')
            .order('year', { ascending: false })
            .order('month', { ascending: false });
          self.monthLocks = (locksResult && locksResult.data) ? locksResult.data : [];
          self.renderActiveTab(container);

        } catch (err) {
          console.error('[Settings] unlock month error:', err);
          showToast('Failed to unlock month. Please try again.', 'error');
        }
      }
    );
  },

  /* ═══════════════════════════════════════════════════
     UTILITY HELPERS
     ═══════════════════════════════════════════════════ */
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
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /* ═══════════════════════════════════════════════════
     EMAIL REQUESTS TAB
     ═══════════════════════════════════════════════════ */
  renderEmailRequests() {
    var self = this;
    var requests = self._emailRequests || [];

    var html =
      '<div class="fury-card">' +
      '<div class="fury-card-header" style="margin-bottom:16px">' +
      '<h3 style="font-size:15px;font-weight:600">Email Requests</h3>' +
      '</div>' +
      '<p style="color:var(--fury-text-secondary);font-size:13px;margin-bottom:16px">' +
      'Manage corporate email provisioning requests. When a request is approved and marked as "created", the email is auto-synced to the employee record.' +
      '</p>' +
      '<table class="fury-table"><thead><tr>' +
      '<th scope="col">Employee</th><th scope="col">Status</th><th scope="col">Requested</th><th scope="col">Note/Email</th><th scope="col" style="width:200px">Actions</th>' +
      '</tr></thead><tbody id="set-email-tbody">';

    if (requests.length === 0) {
      html += '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--fury-text-muted)">No email requests found.</td></tr>';
    } else {
      for (var i = 0; i < requests.length; i++) {
        var req = requests[i];
        var empName = (req.employees && req.employees.name) || 'Unknown';
        var currentEmail = (req.employees && req.employees.work_email) || '';
        var statusBadge = self._emailStatusBadge(req.status);
        var dateStr = req.created_at ? new Date(req.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—';

        html += '<tr data-req-id="' + req.id + '">' +
          '<td style="font-weight:500">' + self._escapeHtml(empName) + (currentEmail ? '<br><span style="font-size:11px;color:var(--fury-text-muted)">' + self._escapeHtml(currentEmail) + '</span>' : '') + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="color:var(--fury-text-secondary);font-size:12px">' + dateStr + '</td>' +
          '<td>';

        if (req.status === 'pending' || req.status === 'approved') {
          html += '<input type="text" class="fury-input fury-input-sm set-email-note" data-id="' + req.id + '" placeholder="email@omdsystems.com" value="' + self._escapeAttr(req.admin_note || '') + '" style="width:200px" />';
        } else {
          html += '<span style="font-size:12px;color:var(--fury-text-secondary)">' + self._escapeHtml(req.admin_note || '—') + '</span>';
        }

        html += '</td><td>';

        if (req.status === 'pending') {
          html += '<button class="fury-btn fury-btn-accent fury-btn-sm set-email-approve" data-id="' + req.id + '">Approve</button> ' +
            '<button class="fury-btn fury-btn-secondary fury-btn-sm set-email-reject" data-id="' + req.id + '" style="color:var(--fury-danger)">Reject</button>';
        } else if (req.status === 'approved') {
          html += '<button class="fury-btn fury-btn-success fury-btn-sm set-email-create" data-id="' + req.id + '">Mark Created</button>';
        } else {
          html += '<span style="font-size:11px;color:var(--fury-text-muted)">' + (req.status === 'created' ? 'Done' : 'Rejected') + '</span>';
        }

        html += '</td></tr>';
      }
    }

    html += '</tbody></table></div>';
    return html;
  },

  _emailStatusBadge(status) {
    var map = {
      pending: 'fury-badge fury-badge-warning',
      approved: 'fury-badge fury-badge-info',
      rejected: 'fury-badge fury-badge-neutral',
      created: 'fury-badge fury-badge-success'
    };
    var label = { pending: 'Pending', approved: 'Approved', rejected: 'Rejected', created: 'Created' };
    var safeStatus = label[status] || this._escapeHtml(status);
    return '<span class="' + (map[status] || 'fury-badge') + '">' + safeStatus + '</span>';
  },

  _bindEmailRequestEvents(container) {
    var self = this;

    // Load email requests data
    DB.getEmailRequests().then(function (result) {
      self._emailRequests = (result && result.data) || [];
      var contentEl = container.querySelector('#settings-content');
      if (contentEl) {
        contentEl.innerHTML = self.renderEmailRequests();
        self._attachEmailRequestHandlers(container);
      }
    }).catch(function (err) {
      console.error('[Settings] load email requests error:', err);
      showToast('Failed to load email requests.', 'error');
    });
  },

  _attachEmailRequestHandlers(container) {
    var self = this;

    // Approve
    var approveBtns = container.querySelectorAll('.set-email-approve');
    for (var a = 0; a < approveBtns.length; a++) {
      approveBtns[a].addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        var id = btn.getAttribute('data-id');
        var noteInput = container.querySelector('.set-email-note[data-id="' + id + '"]');
        var note = noteInput ? noteInput.value.trim() : '';
        DB.updateEmailRequest(id, { status: 'approved', admin_note: note }).then(function () {
          showToast('Request approved', 'success');
          self._bindEmailRequestEvents(container);
        }).catch(function (err) {
          console.error('[Settings] approve error:', err);
          showToast('Failed to approve request. Please try again.', 'error');
          btn.disabled = false;
        });
      });
    }

    // Reject
    var rejectBtns = container.querySelectorAll('.set-email-reject');
    for (var r = 0; r < rejectBtns.length; r++) {
      rejectBtns[r].addEventListener('click', function () {
        var btn = this;
        btn.disabled = true;
        var id = btn.getAttribute('data-id');
        DB.updateEmailRequest(id, { status: 'rejected' }).then(function () {
          showToast('Request rejected', 'success');
          self._bindEmailRequestEvents(container);
        }).catch(function (err) {
          console.error('[Settings] reject error:', err);
          showToast('Failed to reject request. Please try again.', 'error');
          btn.disabled = false;
        });
      });
    }

    // Mark created
    var createBtns = container.querySelectorAll('.set-email-create');
    for (var c = 0; c < createBtns.length; c++) {
      createBtns[c].addEventListener('click', function () {
        var btn = this;
        var id = btn.getAttribute('data-id');
        var noteInput = container.querySelector('.set-email-note[data-id="' + id + '"]');
        var note = noteInput ? noteInput.value.trim() : '';
        if (!note || !Validation.isValidEmail(note)) {
          showToast('Please enter the created email address', 'error');
          return;
        }
        btn.disabled = true;
        var req = (self._emailRequests || []).find(function(r) { return r.id === id; });
        DB.updateEmailRequest(id, { status: 'created', admin_note: note }).then(function () {
          if (req && req.employee_id) {
            return DB.client
              .from('employees')
              .update({ work_email: note })
              .eq('id', req.employee_id);
          }
        }).then(function (syncResult) {
          if (syncResult && syncResult.error) {
            console.warn('[Settings] work_email sync warning:', syncResult.error);
            showToast('Request marked created, but email sync failed.', 'warning');
          } else {
            showToast('Email created and synced to employee.', 'success');
          }
          self._bindEmailRequestEvents(container);
        }).catch(function (err) {
          console.error('[Settings] update email error:', err);
          showToast('Failed to update request. Please try again.', 'error');
          btn.disabled = false;
        });
      });
    }
  },

  /* ═══════════════════════════════════════════════════
     WORKING HOURS TAB
     ═══════════════════════════════════════════════════ */
  renderWorkingHours() {
    var self = this;
    var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'];
    var now = new Date();
    var selMonth = self._whMonth || (now.getMonth() + 1);
    var selYear = self._whYear || now.getFullYear();
    var config = self._whConfig || {};

    // Auto-calculate working days
    var autoDays = 0;
    var daysInMonth = new Date(selYear, selMonth, 0).getDate();
    for (var d = 1; d <= daysInMonth; d++) {
      var dow = new Date(selYear, selMonth - 1, d).getDay();
      if (dow !== 0 && dow !== 6) autoDays++;
    }

    var monthOpts = '';
    for (var m = 1; m <= 12; m++) {
      monthOpts += '<option value="' + m + '"' + (m === selMonth ? ' selected' : '') + '>' + MONTHS[m - 1] + '</option>';
    }
    var yearOpts = '';
    for (var y = now.getFullYear() - 1; y <= now.getFullYear() + 1; y++) {
      yearOpts += '<option value="' + y + '"' + (y === selYear ? ' selected' : '') + '>' + y + '</option>';
    }

    var workingDays = config.working_days != null ? config.working_days : autoDays;
    var hpd = config.hours_per_day != null ? config.hours_per_day : 8;
    var adj = config.adjustment_hours != null ? config.adjustment_hours : 0;
    var totalHours = (workingDays * hpd) + adj;

    return '' +
      '<div class="fury-card">' +
      '<div class="fury-card-header" style="margin-bottom:16px">' +
      '<h3 style="font-size:15px;font-weight:600">Working Hours Configuration</h3>' +
      '</div>' +
      '<p style="color:var(--fury-text-secondary);font-size:13px;margin-bottom:16px">' +
      'Configure working days and hours per month. Auto-calculated values are used as defaults if no override is set.' +
      '</p>' +

      '<div class="fury-flex fury-gap-3 fury-mb-3">' +
      '<select class="fury-select" id="set-wh-month" style="width:auto">' + monthOpts + '</select>' +
      '<select class="fury-select" id="set-wh-year" style="width:auto">' + yearOpts + '</select>' +
      '<span style="color:var(--fury-text-muted);font-size:12px;align-self:center">' +
      'Auto-calculated: ' + autoDays + ' working days' +
      '</span>' +
      '</div>' +

      '<div class="fury-form-row fury-mb-3">' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Working Days</label>' +
      '<input type="number" class="fury-input" id="set-wh-days" min="0" max="31" value="' + workingDays + '" />' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Hours per Day</label>' +
      '<input type="number" class="fury-input" id="set-wh-hpd" min="0" max="24" step="0.5" value="' + hpd + '" />' +
      '</div>' +
      '<div class="fury-form-group">' +
      '<label class="fury-label">Adjustment Hours</label>' +
      '<input type="number" class="fury-input" id="set-wh-adj" step="0.5" value="' + adj + '" />' +
      '</div>' +
      '</div>' +

      '<div class="fury-flex fury-gap-3 fury-mb-3" style="align-items:center">' +
      '<span style="font-size:14px;font-weight:600;color:var(--fury-accent)">' +
      'Total: ' + totalHours.toFixed(1) + ' hours' +
      '</span>' +
      '<span style="font-size:12px;color:var(--fury-text-muted)">' +
      '(' + workingDays + ' &times; ' + hpd + 'h' + (adj !== 0 ? ' ' + (adj > 0 ? '+' : '') + adj + 'h adj' : '') + ')' +
      '</span>' +
      '</div>' +

      '<div class="fury-form-group fury-mb-3">' +
      '<label class="fury-label">Notes</label>' +
      '<input type="text" class="fury-input" id="set-wh-notes" placeholder="e.g. Public holidays included" value="' + self._escapeAttr((config.notes || '')) + '" />' +
      '</div>' +

      '<button class="fury-btn fury-btn-primary" id="set-wh-save">Save Configuration</button>' +
      '</div>';
  },

  _bindWorkingHoursEvents(container) {
    var self = this;
    self._whMonth = self._whMonth || (new Date().getMonth() + 1);
    self._whYear = self._whYear || new Date().getFullYear();

    // Load config for selected month
    DB.getWorkingHoursConfig(self._whMonth, self._whYear).then(function (result) {
      self._whConfig = (result && result.data) || {};
      var contentEl = container.querySelector('#settings-content');
      if (contentEl) {
        contentEl.innerHTML = self.renderWorkingHours();
        self._attachWorkingHoursHandlers(container);
      }
    }).catch(function (err) {
      console.error('[Settings] load working hours config error:', err);
      showToast('Failed to load working hours config.', 'error');
    });
  },

  _attachWorkingHoursHandlers(container) {
    var self = this;

    // Month/year change
    var monthSel = container.querySelector('#set-wh-month');
    var yearSel = container.querySelector('#set-wh-year');
    if (monthSel) {
      monthSel.addEventListener('change', function () {
        self._whMonth = parseInt(this.value, 10);
        self._bindWorkingHoursEvents(container);
      });
    }
    if (yearSel) {
      yearSel.addEventListener('change', function () {
        self._whYear = parseInt(this.value, 10);
        self._bindWorkingHoursEvents(container);
      });
    }

    // Save
    var saveBtn = container.querySelector('#set-wh-save');
    if (saveBtn) {
      saveBtn.addEventListener('click', async function () {
        // Validate inputs
        var wdVal = parseInt(container.querySelector('#set-wh-days').value, 10);
        var hpdVal = parseFloat(container.querySelector('#set-wh-hpd').value);
        var adjVal = parseFloat(container.querySelector('#set-wh-adj').value);
        var notesVal = (container.querySelector('#set-wh-notes').value || '').trim();

        if (!Number.isFinite(wdVal) || wdVal < 0 || wdVal > 31) {
          showToast('Working days must be between 0 and 31.', 'error');
          return;
        }
        if (!Number.isFinite(hpdVal) || hpdVal < 0 || hpdVal > 24) {
          showToast('Hours per day must be between 0 and 24.', 'error');
          return;
        }
        if (!Number.isFinite(adjVal) || adjVal < -200 || adjVal > 200) {
          showToast('Adjustment hours must be between -200 and 200.', 'error');
          return;
        }
        if (notesVal.length > 500) {
          showToast('Notes must be 500 characters or less.', 'error');
          return;
        }

        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
        try {
          var config = {
            month: self._whMonth,
            year: self._whYear,
            working_days: wdVal,
            hours_per_day: hpdVal,
            adjustment_hours: adjVal,
            notes: notesVal
          };
          var result = await DB.upsertWorkingHoursConfig(config);
          if (result && result.error) throw new Error(result.error.message);
          showToast('Working hours config saved', 'success');
          self._whConfig = config;
          var contentEl = container.querySelector('#settings-content');
          if (contentEl) {
            contentEl.innerHTML = self.renderWorkingHours();
            self._attachWorkingHoursHandlers(container);
          }
        } catch (err) {
          showToast('Failed to save working hours config. Please try again.', 'error');
        } finally {
          saveBtn.disabled = false;
          saveBtn.textContent = 'Save Configuration';
        }
      });
    }
  },

  destroy() {
    // Cleanup modal event handlers
    this._cleanupModalHandlers();

    // Remove body scroll lock
    document.body.classList.remove('fury-modal-open');

    // Remove any lingering settings modals
    var modals = document.querySelectorAll('#settings-modal-overlay');
    for (var i = 0; i < modals.length; i++) {
      modals[i].remove();
    }
  }
};
