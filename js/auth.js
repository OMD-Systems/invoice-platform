// ============================================================
// OMD Finance Platform — Authentication Module
// auth.js — OTP-based email auth via Supabase
// ============================================================

const Auth = {
  /**
   * Get the current session from Supabase.
   * @returns {Promise<{data: {session: object|null}, error: object|null}>}
   */
  async getSession() {
    try {
      const { data, error } = await DB.client.auth.getSession();
      return { data, error };
    } catch (err) {
      return { data: { session: null }, error: { message: err.message } };
    }
  },

  /**
   * Send a one-time password (magic link code) to the given email.
   * The user will receive a 6-digit code in their inbox.
   * @param {string} email
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async signInWithOTP(email) {
    try {
      if (!email || !email.includes('@')) {
        return { data: null, error: { message: 'Please enter a valid email address.' } };
      }

      const { data, error } = await DB.client.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false // Only existing users can sign in
        }
      });

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Verify the OTP code entered by the user.
   * @param {string} email
   * @param {string} token - The 6-digit code from the email
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async verifyOTP(email, token) {
    try {
      if (!token || token.length < 6) {
        return { data: null, error: { message: 'Please enter the 6-digit code from your email.' } };
      }

      const { data, error } = await DB.client.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'email'
      });

      return { data, error };
    } catch (err) {
      return { data: null, error: { message: err.message } };
    }
  },

  /**
   * Sign out the current user and clear the session.
   * @returns {Promise<{error: object|null}>}
   */
  async signOut() {
    try {
      const { error } = await DB.client.auth.signOut();
      return { error };
    } catch (err) {
      return { error: { message: err.message } };
    }
  },

  /**
   * Subscribe to auth state changes (sign in, sign out, token refresh).
   * @param {function} callback - (event, session) => void
   * @returns {{ data: { subscription: object } }}
   */
  onAuthStateChange(callback) {
    return DB.client.auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
  },

  // ----------------------------------------------------------
  // LOGIN FORM WIRING
  // ----------------------------------------------------------

  /** @private Store the email between step 1 and step 2 */
  _pendingEmail: null,

  /**
   * Set up the login form UI interactions.
   * Expected DOM structure:
   *
   *   <div id="login-screen">
   *     <!-- Step 1: Email -->
   *     <div id="login-step-email">
   *       <input id="login-email" type="email" placeholder="you@company.com" />
   *       <button id="btn-send-otp">Send Code</button>
   *       <div id="login-error-email" class="error-msg"></div>
   *     </div>
   *
   *     <!-- Step 2: OTP Code -->
   *     <div id="login-step-otp" style="display:none;">
   *       <p id="otp-sent-to"></p>
   *       <input id="login-otp" type="text" maxlength="6" placeholder="000000" />
   *       <button id="btn-verify-otp">Verify</button>
   *       <button id="btn-back-to-email" class="link-btn">Back</button>
   *       <div id="login-error-otp" class="error-msg"></div>
   *     </div>
   *
   *     <!-- Loading overlay -->
   *     <div id="login-loading" style="display:none;">
   *       <span>Please wait...</span>
   *     </div>
   *   </div>
   */
  setupLoginForm() {
    const emailStep = document.getElementById('login-step-email');
    const otpStep = document.getElementById('login-step-otp');
    const loadingEl = document.getElementById('login-loading');

    const emailInput = document.getElementById('login-email');
    const otpInput = document.getElementById('login-otp');
    const btnSendOtp = document.getElementById('btn-send-otp');
    const btnVerifyOtp = document.getElementById('btn-verify-otp');
    const btnBack = document.getElementById('btn-back-to-email');
    const errorEmail = document.getElementById('login-error-email');
    const errorOtp = document.getElementById('login-error-otp');
    const otpSentTo = document.getElementById('otp-sent-to');

    if (!emailStep || !otpStep || !btnSendOtp || !btnVerifyOtp) {
      console.warn('Auth: Login form elements not found in DOM. Skipping setup.');
      return;
    }

    /** Show/hide helpers */
    const showStep = (step) => {
      emailStep.style.display = step === 'email' ? '' : 'none';
      otpStep.style.display = step === 'otp' ? '' : 'none';
    };

    const showLoading = (visible) => {
      if (loadingEl) loadingEl.style.display = visible ? '' : 'none';
      btnSendOtp.disabled = visible;
      btnVerifyOtp.disabled = visible;
    };

    const showError = (el, message) => {
      if (el) {
        el.textContent = message || '';
        el.style.display = message ? '' : 'none';
      }
    };

    // ---- Step 1: Send OTP ----
    btnSendOtp.addEventListener('click', async () => {
      const email = emailInput.value.trim();
      showError(errorEmail, '');

      if (!email) {
        showError(errorEmail, 'Please enter your email address.');
        return;
      }

      showLoading(true);

      const { error } = await this.signInWithOTP(email);

      showLoading(false);

      if (error) {
        showError(errorEmail, error.message || 'Failed to send code. Please try again.');
        return;
      }

      // Success: move to step 2
      this._pendingEmail = email;
      if (otpSentTo) {
        otpSentTo.textContent = `Code sent to ${email}`;
      }
      showStep('otp');
      if (otpInput) otpInput.focus();
    });

    // Allow Enter key to submit email
    if (emailInput) {
      emailInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          btnSendOtp.click();
        }
      });
    }

    // ---- Step 2: Verify OTP ----
    btnVerifyOtp.addEventListener('click', async () => {
      const token = otpInput.value.trim();
      showError(errorOtp, '');

      if (!token || token.length < 6) {
        showError(errorOtp, 'Please enter the 6-digit code.');
        return;
      }

      showLoading(true);

      const { data, error } = await this.verifyOTP(this._pendingEmail, token);

      showLoading(false);

      if (error) {
        showError(errorOtp, error.message || 'Invalid code. Please try again.');
        return;
      }

      // Success: auth state change listener will handle the redirect
      // Clear the form
      this._pendingEmail = null;
      if (emailInput) emailInput.value = '';
      if (otpInput) otpInput.value = '';
    });

    // Allow Enter key to submit OTP
    if (otpInput) {
      otpInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          btnVerifyOtp.click();
        }
      });

      // Auto-format: only allow digits, auto-submit on 6 digits
      otpInput.addEventListener('input', () => {
        otpInput.value = otpInput.value.replace(/[^0-9]/g, '').slice(0, 6);
        if (otpInput.value.length === 6) {
          btnVerifyOtp.click();
        }
      });
    }

    // ---- Back button ----
    if (btnBack) {
      btnBack.addEventListener('click', () => {
        showError(errorOtp, '');
        if (otpInput) otpInput.value = '';
        showStep('email');
        if (emailInput) emailInput.focus();
      });
    }

    // Start on step 1
    showStep('email');
  },

  // ----------------------------------------------------------
  // SIMPLIFIED API (used by app.js — throw on error, return data directly)
  // ----------------------------------------------------------

  /**
   * Send OTP code to email. Throws on error.
   * @param {string} email
   */
  async sendOtp(email) {
    const { error } = await this.signInWithOTP(email);
    if (error) throw new Error(error.message || 'Failed to send code');
  },

  /**
   * Verify OTP code. Returns the session object. Throws on error.
   * @param {string} email
   * @param {string} code
   * @returns {Promise<Object>} session with .user
   */
  async verifyOtp(email, code) {
    const { data, error } = await this.verifyOTP(email, code);
    if (error) throw new Error(error.message || 'Invalid code');
    return data?.session || data;
  },

  // ----------------------------------------------------------
  // SESSION BOOTSTRAP
  // ----------------------------------------------------------

  /**
   * Initialize auth: check existing session, set up state change listener.
   * Call this on page load after DB.init().
   *
   * @param {object} callbacks
   * @param {function} callbacks.onAuthenticated - (session, profile) => void
   * @param {function} callbacks.onUnauthenticated - () => void
   * @returns {Promise<void>}
   */
  async init(callbacks = {}) {
    const { onAuthenticated, onUnauthenticated } = callbacks;

    // Listen for auth state changes
    this.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          const { data: profile } = await DB.getProfile(session.user.id);
          if (onAuthenticated) onAuthenticated(session, profile);
        }
      } else if (event === 'SIGNED_OUT') {
        if (onUnauthenticated) onUnauthenticated();
      }
    });

    // Check for existing session
    const { data } = await this.getSession();
    if (data?.session?.user) {
      const { data: profile } = await DB.getProfile(data.session.user.id);
      if (onAuthenticated) onAuthenticated(data.session, profile);
    } else {
      if (onUnauthenticated) onUnauthenticated();
    }

    // Set up the login form
    this.setupLoginForm();
  }
};
