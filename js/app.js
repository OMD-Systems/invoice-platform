/* ═══════════════════════════════════════════════════════
   App — Main SPA Controller
   Invoice Platform · OMD Systems
   ═══════════════════════════════════════════════════════ */

/* ── HTTPS Enforcement (production only) ── */
if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  window.location.replace('https://' + window.location.host + window.location.pathname + window.location.search + window.location.hash);
}

/* ── Global Error Handlers ── */
window.addEventListener('unhandledrejection', function (event) {
  console.error('[Unhandled Promise]', event.reason);
  if (typeof showToast === 'function') {
    showToast('An unexpected error occurred. Check console.', 'error');
  }
});

window.addEventListener('error', function (event) {
  console.error('[Global Error]', event.error);
  if (typeof showToast === 'function') {
    showToast('A script error occurred. Check console.', 'error');
  }
});

const App = {
  currentPage: null,
  user: null,
  role: null, // 'admin' | 'lead' | 'viewer'
  _navId: 0,
  // Shared period state (synced across pages)
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),

  pages: {
    '/team': Team,
    '/invoices': Invoices,
    '/expenses': Expenses,
    '/settings': Settings,
  },

  /* ── Legacy route redirects ── */
  REDIRECTS: {
    '/dashboard': '/team',
    '/timesheet': '/team',
    '/employees': '/team',
    '/reports': '/invoices',
  },

  /* ── Loading Overlay ── */
  showLoading(show) {
    var overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
  },

  /* ── Bootstrap ── */
  async init() {
    DB.init();
    this.bindLoginEvents();
    this.bindLogout();

    // Show loading state during bootstrap
    var loginScreen = document.getElementById('login-screen');
    if (loginScreen) loginScreen.style.display = 'none';

    try {
      const authResult = await Auth.getSession();
      const session = authResult && authResult.data ? authResult.data.session : null;
      if (session && session.user) {
        this.user = session.user;
        var roleResult = await DB.getUserRole(this.user.email);
        var rawRole = (roleResult && roleResult.data) || 'viewer';
        // V5: Validate role against allowed values
        this.role = (['admin', 'lead', 'viewer'].indexOf(rawRole) !== -1) ? rawRole : 'viewer';
        this.showApp();
        this.setupRouter();

        // Listen for auth state changes (session expiry, token refresh)
        var self = this;
        if (self._authSubscription) {
          self._authSubscription.unsubscribe();
        }
        var authSub = DB.client.auth.onAuthStateChange(function(event, session) {
          if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
            if (event === 'SIGNED_OUT') {
              self.clearAppState();
              self.showLogin();
            }
            if (event === 'TOKEN_REFRESHED' && session) {
              var appRole = session.user?.app_metadata?.role;
              if (appRole && appRole !== self.role) {
                self.role = appRole;
                self.applyRoleVisibility();
              }
            }
          }
        });
        self._authSubscription = authSub.data.subscription;

        this.navigate(window.location.hash || '#/team');
      } else {
        this.showLogin();
      }
    } catch (err) {
      console.error('[App] init failed:', err);
      this.showLogin();
    }
  },

  /* ── Login / App Visibility ── */
  showLogin() {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('login-step-email').classList.remove('hidden');
    document.getElementById('login-step-otp').classList.add('hidden');
    document.getElementById('login-error').textContent = '';
    document.getElementById('login-email').value = '';
    document.getElementById('login-otp').value = '';
    document.getElementById('login-email').focus();
  },

  showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'flex';
    this.renderUserInfo();
    this.applyRoleVisibility();
  },

  /* ── Render user info into sidebar & top bar ── */
  renderUserInfo() {
    const email = this.user.email || '';
    const name = this.user.user_metadata?.full_name || email.split('@')[0] || 'User';
    const initials = name
      .split(/[\s._-]+/)
      .slice(0, 2)
      .map(function (w) { return w.charAt(0).toUpperCase(); })
      .join('');

    document.getElementById('sidebar-avatar').textContent = initials;
    document.getElementById('sidebar-user-name').textContent = name;
    document.getElementById('top-bar-user-name').textContent = name;

    var badge = document.getElementById('top-bar-role-badge');
    badge.textContent = this.role || 'viewer';
    badge.className = 'role-badge ' + (this.role || 'viewer');
  },

  /* ── Clear all app state on logout/session expiry ── */
  clearAppState() {
    this.user = null;
    this.role = null;
    if (this.currentPage && typeof this.currentPage.destroy === 'function') {
      try { this.currentPage.destroy(); } catch(e) {}
    }
    this.currentPage = null;
    // Clear page singletons data
    if (typeof Team !== 'undefined') {
      Team.allEmployees = [];
      Team.projects = [];
      Team.allTimesheets = [];
      Team.invoices = [];
    }
    if (typeof Invoices !== 'undefined') {
      Invoices.invoices = [];
      Invoices.employees = [];
      Invoices.timesheetMap = {};
      Invoices.timesheets = [];
      Invoices.projects = [];
    }
    if (typeof Expenses !== 'undefined') {
      Expenses.invoices = [];
      Expenses.expenses = [];
    }
    if (typeof Settings !== 'undefined') {
      Settings.settings = {};
      Settings.projects = [];
      Settings.teams = [];
      Settings.teamMembers = {};
      Settings.profiles = [];
      Settings.monthLocks = [];
    }
    // Clear DOM content
    var mainContent = document.getElementById('main-content');
    if (mainContent) mainContent.innerHTML = '';
  },

  /* ── Hide admin-only nav items for non-admins ── */
  applyRoleVisibility() {
    var settingsNav = document.getElementById('nav-settings');
    if (settingsNav) {
      settingsNav.style.display = this.role === 'admin' ? '' : 'none';
    }
  },

  /* ── Login Form Events ── */
  bindLoginEvents() {
    var self = this;
    var btnSend = document.getElementById('btn-send-code');
    var btnVerify = document.getElementById('btn-verify');
    var emailInput = document.getElementById('login-email');
    var otpInput = document.getElementById('login-otp');
    var errorEl = document.getElementById('login-error');

    // Send OTP code
    btnSend.addEventListener('click', async function () {
      var email = emailInput.value.trim();
      if (!email) {
        errorEl.textContent = 'Please enter your email address.';
        return;
      }

      // V4: Check cooldown before sending
      var cooldown = Auth.getOtpCooldownStatus();
      if (cooldown.inCooldown) {
        errorEl.textContent = 'Please wait ' + cooldown.remainingSeconds + ' seconds before requesting a new code.';
        return;
      }

      errorEl.textContent = '';
      btnSend.disabled = true;
      btnSend.textContent = 'Sending...';

      try {
        await Auth.sendOtp(email);
      } catch (err) {
        errorEl.textContent = 'Failed to send code. Please try again or enter an existing code.';
      } finally {
        // V4: Start cooldown countdown timer on button
        var cooldownSec = CONFIG.OTP_COOLDOWN_SECONDS || 60;
        var remaining = cooldownSec;
        btnSend.disabled = true;
        btnSend.textContent = 'Resend (' + remaining + 's)';

        var cooldownInterval = setInterval(function () {
          remaining--;
          if (remaining <= 0) {
            clearInterval(cooldownInterval);
            btnSend.disabled = false;
            btnSend.textContent = 'Resend Code';
          } else {
            btnSend.textContent = 'Resend (' + remaining + 's)';
          }
        }, 1000);

        // Always show OTP step so user can enter code even on rate limit
        document.getElementById('login-step-email').classList.add('hidden');
        document.getElementById('login-step-otp').classList.remove('hidden');
        otpInput.focus();
      }
    });

    // Allow Enter key on email field
    emailInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btnSend.click();
    });

    // Verify OTP
    btnVerify.addEventListener('click', async function () {
      var email = emailInput.value.trim();
      var code = otpInput.value.trim();
      if (!code) {
        errorEl.textContent = 'Please enter the verification code.';
        return;
      }
      errorEl.textContent = '';
      btnVerify.disabled = true;
      btnVerify.textContent = 'Verifying...';

      try {
        var session = await Auth.verifyOtp(email, code);
        self.user = session.user;
        var roleRes = await DB.getUserRole(self.user.email);
        var rawRole = (roleRes && roleRes.data) || 'viewer';
        // V5: Validate role against allowed values
        self.role = (['admin', 'lead', 'viewer'].indexOf(rawRole) !== -1) ? rawRole : 'viewer';
        self.showApp();
        self.setupRouter();
        self.navigate(window.location.hash || '#/team');
      } catch (err) {
        errorEl.textContent = 'Invalid or expired code. Please try again.';
      } finally {
        btnVerify.disabled = false;
        btnVerify.textContent = 'Verify';
      }
    });

    // Allow Enter key on OTP field
    otpInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') btnVerify.click();
    });
  },

  /* ── Logout ── */
  bindLogout() {
    var self = this;
    document.getElementById('btn-logout').addEventListener('click', async function () {
      try {
        await Auth.signOut();
      } catch (err) {
        console.warn('[App] signOut error:', err);
      }
      // Remove router
      if (self._hashChangeHandler) {
        window.removeEventListener('hashchange', self._hashChangeHandler);
        self._hashChangeHandler = null;
      }
      self._routerReady = false;
      if (self._authSubscription) {
        self._authSubscription.unsubscribe();
        self._authSubscription = null;
      }
      self.clearAppState();
      window.location.hash = '';
      self.showLogin();
    });
  },

  /* ── Hash Router ── */
  setupRouter() {
    if (this._routerReady) return;
    this._routerReady = true;
    var self = this;
    this._hashChangeHandler = function () {
      self.navigate(window.location.hash);
    };
    window.addEventListener('hashchange', this._hashChangeHandler);
  },

  /* ── Page Navigation ── */
  async navigate(hash) {
    var navId = ++this._navId;
    // Normalize: strip hash, query params, trailing slashes
    var raw = (hash || '').replace(/^#/, '').split('?')[0].split('&')[0];
    var path = raw.replace(/\/+$/, '') || '/team';
    // Ensure path starts with /
    if (path.charAt(0) !== '/') path = '/' + path;

    // Handle legacy route redirects (prevent infinite loops)
    if (this.REDIRECTS && this.REDIRECTS[path]) {
      var target = this.REDIRECTS[path];
      if (this.pages[target]) {
        window.location.hash = '#' + target;
      } else {
        window.location.hash = '#/team';
      }
      return;
    }

    // Redirect unknown routes
    if (!this.pages[path]) {
      window.location.hash = '#/team';
      return;
    }

    // Block non-admin from settings
    if (path === '/settings' && this.role !== 'admin') {
      window.location.hash = '#/team';
      return;
    }

    var page = this.pages[path];

    // Update active nav item
    var navItems = document.querySelectorAll('#sidebar-nav .nav-item');
    for (var i = 0; i < navItems.length; i++) {
      navItems[i].classList.remove('active');
    }
    var activeNav = null;
    for (var i = 0; i < navItems.length; i++) {
      if (navItems[i].getAttribute('data-page') === path) { activeNav = navItems[i]; break; }
    }
    if (activeNav) {
      activeNav.classList.add('active');
    }

    // Update page title in top bar
    document.getElementById('page-title').textContent = page.title || '';

    // Cleanup previous page
    if (this.currentPage && typeof this.currentPage.destroy === 'function') {
      try { this.currentPage.destroy(); } catch (e) { console.warn('[App] page destroy error:', e); }
    }

    // Render page content
    var container = document.getElementById('main-content');
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
      await page.render(container, {
        user: this.user,
        role: this.role,
      });
      if (navId !== this._navId) return;
      this.currentPage = page;
    } catch (err) {
      if (navId !== this._navId) return;
      console.error('[App] Page render error (' + path + '):', err);
      container.innerHTML =
        '<div class="loading" style="color:#EF4444;">' +
        'Failed to load page. Please try again.' +
        '</div>';
      this.currentPage = null;
    }
  },
};

/* ── Start ── */
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
