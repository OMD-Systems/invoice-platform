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
    showToast('Something went wrong. Please refresh the page.', 'error');
  }
});

window.addEventListener('error', function (event) {
  console.error('[Global Error]', event.error);
  if (typeof showToast === 'function') {
    showToast('Something went wrong. Please refresh the page.', 'error');
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

  // Session expiry monitor state
  _sessionCheckInterval: null,
  _sessionCountdownInterval: null,
  _sessionWarningShown: false,
  _sessionCheckFailures: 0,
  SESSION_WARN_BEFORE_MS: 5 * 60 * 1000, // 5 minutes

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
    var rememberMe = localStorage.getItem('omd_remember_me') !== '0';
    DB.init(null, null, rememberMe ? {} : { storage: sessionStorage });
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
        this.startSessionMonitor();

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

        window.addEventListener('offline', function() {
          showToast('No internet connection. Changes may not be saved.', 'error');
        });
        window.addEventListener('online', function() {
          showToast('Connection restored.', 'success');
        });

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
    var loginError = document.getElementById('login-error');
    loginError.textContent = '';
    loginError.className = 'login-error';
    document.getElementById('login-email').value = '';
    document.getElementById('login-otp').value = '';
    var rememberEl = document.getElementById('login-remember');
    if (rememberEl) rememberEl.checked = localStorage.getItem('omd_remember_me') !== '0';
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

  /* ── Adjust nav labels based on role ── */
  applyRoleVisibility() {
    var settingsNav = document.getElementById('nav-settings');
    if (settingsNav) {
      // Show to all users; non-admins see "Account" label
      settingsNav.style.display = '';
      var label = settingsNav.querySelector('.nav-label');
      if (label) {
        label.textContent = this.role === 'admin' ? 'Settings' : 'Account';
      }
    }
  },

  /* ── Login Message Helper ── */
  _showLoginMsg(el, text, type) {
    // type: 'error' | 'success' | 'info'
    el.textContent = text;
    el.className = 'login-error ' + (type || 'error');
  },

  /* ── Login Form Events ── */
  bindLoginEvents() {
    var self = this;
    var btnSend = document.getElementById('btn-send-code');
    var btnVerify = document.getElementById('btn-verify');
    var emailInput = document.getElementById('login-email');
    var otpInput = document.getElementById('login-otp');
    var errorEl = document.getElementById('login-error');
    var rememberCheck = document.getElementById('login-remember');

    // Restore saved preference
    rememberCheck.checked = localStorage.getItem('omd_remember_me') !== '0';

    // Send OTP code
    btnSend.addEventListener('click', async function () {
      var email = emailInput.value.trim();
      if (!email) {
        self._showLoginMsg(errorEl, 'Please enter your email address.', 'error');
        return;
      }

      // V4: Check cooldown before sending
      var cooldown = Auth.getOtpCooldownStatus();
      if (cooldown.inCooldown) {
        self._showLoginMsg(errorEl, 'Please wait ' + cooldown.remainingSeconds + ' seconds before requesting a new code.', 'error');
        return;
      }

      // Save remember-me preference and re-init client with correct storage
      var remember = rememberCheck.checked;
      localStorage.setItem('omd_remember_me', remember ? '1' : '0');
      DB.init(null, null, remember ? {} : { storage: sessionStorage });

      errorEl.textContent = '';
      errorEl.className = 'login-error';
      btnSend.disabled = true;
      btnSend.textContent = 'Sending...';

      var sendFailed = false;
      try {
        var result = await Auth.sendOtp(email);
        if (result && result.success) {
          self._showLoginMsg(errorEl, 'Code sent! Check your email (including spam folder).', 'success');
        }
      } catch (err) {
        sendFailed = true;
        self._showLoginMsg(errorEl, err.message || 'Failed to send code. Please try again.', 'error');
      } finally {
        if (!sendFailed) {
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

          // Show OTP step on success
          document.getElementById('login-step-email').classList.add('hidden');
          document.getElementById('login-step-otp').classList.remove('hidden');
          otpInput.focus();
        } else {
          // Re-enable button on failure so user can retry
          btnSend.disabled = false;
          btnSend.textContent = 'Send Code';
        }
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
        self._showLoginMsg(errorEl, 'Please enter the verification code.', 'error');
        return;
      }
      errorEl.textContent = '';
      errorEl.className = 'login-error';
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
        self.startSessionMonitor();
        self.navigate(window.location.hash || '#/team');
      } catch (err) {
        self._showLoginMsg(errorEl, err.message || 'Invalid or expired code. Please try again.', 'error');
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
    document.getElementById('btn-logout').addEventListener('click', function () {
      self.doLogout();
    });
  },

  /* ── Session Expiry Monitor ── */
  startSessionMonitor() {
    var self = this;
    // Clear any existing monitor
    this.stopSessionMonitor();

    this._sessionCheckInterval = setInterval(async function () {
      if (!self.user) return;
      try {
        var result = await Auth.getSession();
        var session = result && result.data ? result.data.session : null;
        if (!session || !session.expires_at) return;

        var expiresMs = session.expires_at * 1000;
        var remaining = expiresMs - Date.now();

        if (remaining <= self.SESSION_WARN_BEFORE_MS && remaining > 0 && !self._sessionWarningShown) {
          self.showSessionWarning(expiresMs);
        }
        self._sessionCheckFailures = 0;
      } catch (e) {
        console.warn('[App] Session check error:', e);
        self._sessionCheckFailures++;
        if (self._sessionCheckFailures >= 3) {
          showToast('Session check failed. Your session may have expired.', 'warning');
          self._sessionCheckFailures = 0;
        }
      }
    }, 30000); // check every 30s
  },

  stopSessionMonitor() {
    if (this._sessionCheckInterval) {
      clearInterval(this._sessionCheckInterval);
      this._sessionCheckInterval = null;
    }
    this.hideSessionWarning();
  },

  showSessionWarning(expiresMs) {
    var self = this;
    this._sessionWarningShown = true;
    var overlay = document.getElementById('session-expiry-overlay');
    var timerEl = document.getElementById('session-expiry-timer');
    var btnExtend = document.getElementById('btn-extend-session');
    var btnLogout = document.getElementById('btn-session-logout');

    overlay.style.display = 'flex';

    // Update countdown every second
    function updateTimer() {
      var remaining = expiresMs - Date.now();
      if (remaining <= 0) {
        // Session expired — force logout
        clearInterval(self._sessionCountdownInterval);
        self._sessionCountdownInterval = null;
        self.hideSessionWarning();
        self.doLogout();
        return;
      }
      var totalSec = Math.ceil(remaining / 1000);
      var min = Math.floor(totalSec / 60);
      var sec = totalSec % 60;
      timerEl.textContent = min + ':' + (sec < 10 ? '0' : '') + sec;

      // Red pulsing when under 1 minute
      if (totalSec <= 60) {
        timerEl.classList.add('critical');
      } else {
        timerEl.classList.remove('critical');
      }
    }

    updateTimer();
    this._sessionCountdownInterval = setInterval(updateTimer, 1000);

    // Extend session handler
    var extendHandler = async function () {
      btnExtend.disabled = true;
      btnExtend.textContent = 'Extending...';
      try {
        var refreshResult = await DB.client.auth.refreshSession();
        if (refreshResult.error) throw refreshResult.error;
        self.hideSessionWarning();
        if (typeof showToast === 'function') {
          showToast('Session extended successfully.', 'success');
        }
      } catch (e) {
        console.error('[App] Session refresh failed:', e);
        if (typeof showToast === 'function') {
          showToast('Failed to extend session. Please log in again.', 'error');
        }
        self.hideSessionWarning();
        self.doLogout();
      } finally {
        btnExtend.disabled = false;
        btnExtend.textContent = 'Extend Session';
      }
    };

    // Logout handler
    var logoutHandler = function () {
      self.hideSessionWarning();
      self.doLogout();
    };

    // Store handlers for cleanup
    this._sessionExtendHandler = extendHandler;
    this._sessionLogoutHandler = logoutHandler;

    btnExtend.addEventListener('click', extendHandler);
    btnLogout.addEventListener('click', logoutHandler);
  },

  hideSessionWarning() {
    var overlay = document.getElementById('session-expiry-overlay');
    if (overlay) overlay.style.display = 'none';

    if (this._sessionCountdownInterval) {
      clearInterval(this._sessionCountdownInterval);
      this._sessionCountdownInterval = null;
    }

    this._sessionWarningShown = false;

    // Remove event listeners
    var btnExtend = document.getElementById('btn-extend-session');
    var btnLogout = document.getElementById('btn-session-logout');
    if (btnExtend && this._sessionExtendHandler) {
      btnExtend.removeEventListener('click', this._sessionExtendHandler);
    }
    if (btnLogout && this._sessionLogoutHandler) {
      btnLogout.removeEventListener('click', this._sessionLogoutHandler);
    }
    this._sessionExtendHandler = null;
    this._sessionLogoutHandler = null;
  },

  async doLogout() {
    this.stopSessionMonitor();
    try {
      await Auth.signOut();
    } catch (err) {
      console.warn('[App] signOut error:', err);
    }
    // Clean Supabase auth keys from both storages
    [localStorage, sessionStorage].forEach(function (store) {
      var toRemove = [];
      for (var i = 0; i < store.length; i++) {
        var k = store.key(i);
        if (k && k.indexOf('sb-') === 0) toRemove.push(k);
      }
      toRemove.forEach(function (k) { store.removeItem(k); });
    });
    if (this._hashChangeHandler) {
      window.removeEventListener('hashchange', this._hashChangeHandler);
      this._hashChangeHandler = null;
    }
    this._routerReady = false;
    if (this._authSubscription) {
      this._authSubscription.unsubscribe();
      this._authSubscription = null;
    }
    this.clearAppState();
    window.location.hash = '';
    this.showLogin();
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

    // Settings accessible to all (non-admins see Account tab only)
    if (path === '/settings' && this.role !== 'admin') {
      Settings.activeTab = 'account';
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
    container.innerHTML = '<div style="padding:24px">' + Skeleton.render('card', 3) + '</div>';

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
