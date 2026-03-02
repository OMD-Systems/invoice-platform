/* ═══════════════════════════════════════════════════════
   App — Main SPA Controller
   Invoice Platform · OMD Systems
   ═══════════════════════════════════════════════════════ */

/* ── Global Error Handlers ── */
window.addEventListener('unhandledrejection', function(event) {
  console.error('[Unhandled Promise]', event.reason);
  if (typeof showToast === 'function') {
    showToast('An unexpected error occurred. Check console.', 'error');
  }
});

window.addEventListener('error', function(event) {
  console.error('[Global Error]', event.error);
});

const App = {
  currentPage: null,
  user: null,
  role: null, // 'admin' | 'lead' | 'viewer'

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

    try {
      const authResult = await Auth.getSession();
      const session = authResult && authResult.data ? authResult.data.session : null;
      if (session && session.user) {
        this.user = session.user;
        var roleResult = await DB.getUserRole(this.user.email);
        this.role = (roleResult && roleResult.data) || 'viewer';
        this.showApp();
        this.setupRouter();
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
      errorEl.textContent = '';
      btnSend.disabled = true;
      btnSend.textContent = 'Sending...';

      try {
        await Auth.sendOtp(email);
      } catch (err) {
        errorEl.textContent = (err.message || 'Failed to send code.') + ' — You can still enter a code if you have one.';
      } finally {
        btnSend.disabled = false;
        btnSend.textContent = 'Send Code';
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
        self.role = (roleRes && roleRes.data) || 'viewer';
        self.showApp();
        self.setupRouter();
        self.navigate(window.location.hash || '#/team');
      } catch (err) {
        errorEl.textContent = err.message || 'Invalid code. Please try again.';
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
      self.user = null;
      self.role = null;
      self.currentPage = null;
      window.location.hash = '';
      self.showLogin();
    });
  },

  /* ── Hash Router ── */
  setupRouter() {
    var self = this;
    window.addEventListener('hashchange', function () {
      self.navigate(window.location.hash);
    });
  },

  /* ── Page Navigation ── */
  async navigate(hash) {
    var path = (hash || '').replace('#', '') || '/team';

    // Handle legacy route redirects
    if (this.REDIRECTS && this.REDIRECTS[path]) {
      window.location.hash = '#' + this.REDIRECTS[path];
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
    var activeNav = document.querySelector('#sidebar-nav [data-page="' + path + '"]');
    if (activeNav) {
      activeNav.classList.add('active');
    }

    // Update page title in top bar
    document.getElementById('page-title').textContent = page.title || '';

    // Render page content
    var container = document.getElementById('main-content');
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
      await page.render(container, {
        user: this.user,
        role: this.role,
      });
    } catch (err) {
      console.error('[App] Page render error (' + path + '):', err);
      container.innerHTML =
        '<div class="loading" style="color:#EF4444;">' +
        'Error loading page: ' + (err.message || 'Unknown error') +
        '</div>';
    }

    this.currentPage = page;
  },
};

/* ── Start ── */
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});
