// ============================================================
// OMD Finance Platform — Authentication Module
// auth.js — OTP-based email auth via Supabase
// ============================================================

const Auth = {
  // ── OTP Rate Limiting State (persisted in sessionStorage) ──
  get _otpCooldownUntil() {
    return parseInt(sessionStorage.getItem('otp_cooldown_until') || '0', 10);
  },
  set _otpCooldownUntil(val) {
    sessionStorage.setItem('otp_cooldown_until', String(val));
  },
  get _otpAttempts() {
    return parseInt(sessionStorage.getItem('otp_attempts') || '0', 10);
  },
  set _otpAttempts(val) {
    sessionStorage.setItem('otp_attempts', String(val));
  },

  /**
   * Check if OTP send is currently in cooldown.
   * @returns {{ inCooldown: boolean, remainingSeconds: number }}
   */
  getOtpCooldownStatus() {
    var now = Date.now();
    if (now < this._otpCooldownUntil) {
      return {
        inCooldown: true,
        remainingSeconds: Math.ceil((this._otpCooldownUntil - now) / 1000)
      };
    }
    return { inCooldown: false, remainingSeconds: 0 };
  },

  /**
   * Start the OTP cooldown timer.
   */
  _startOtpCooldown() {
    var cooldownMs = (CONFIG.OTP_COOLDOWN_SECONDS || 60) * 1000;
    this._otpCooldownUntil = Date.now() + cooldownMs;
    this._otpAttempts = this._otpAttempts + 1;
  },

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
   * Includes client-side rate limiting.
   * @param {string} email
   * @returns {Promise<{data: object|null, error: object|null}>}
   */
  async signInWithOTP(email) {
    try {
      // Input validation
      if (!email || !Utils.isValidEmail(email)) {
        return { data: null, error: { message: 'Please enter a valid email address.' } };
      }

      // Email domain whitelist check
      var allowedDomains = CONFIG.ALLOWED_EMAIL_DOMAINS || [];
      if (allowedDomains.length > 0) {
        var emailDomain = email.trim().toLowerCase().split('@')[1];
        if (!emailDomain || allowedDomains.indexOf(emailDomain) === -1) {
          return {
            data: null,
            error: { message: 'Email domain is not allowed. Please use a company email address.' }
          };
        }
      }

      // Client-side rate limiting
      var cooldown = this.getOtpCooldownStatus();
      if (cooldown.inCooldown) {
        return {
          data: null,
          error: {
            message: 'Please wait ' + cooldown.remainingSeconds + ' seconds before requesting a new code.'
          }
        };
      }

      // Check max attempts
      var maxAttempts = CONFIG.MAX_OTP_ATTEMPTS || 5;
      if (this._otpAttempts >= maxAttempts) {
        return {
          data: null,
          error: {
            message: 'Too many OTP requests. Please try again later or contact an administrator.'
          }
        };
      }

      const { data, error } = await DB.client.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: false, // SECURITY: disabled open registration
          emailRedirectTo: window.location.origin + window.location.pathname
        }
      });

      // Start cooldown regardless of success/failure
      this._startOtpCooldown();

      // Supabase returns "Signups not allowed for otp" when email not found
      if (error) {
        var msg = (error.message || '').toLowerCase();
        if (msg.indexOf('signups not allowed') !== -1 || msg.indexOf('user not found') !== -1) {
          return {
            data: null,
            error: { message: 'This email is not registered. Contact your administrator.' }
          };
        }
        if (msg.indexOf('rate limit') !== -1 || error.status === 429) {
          return {
            data: null,
            error: { message: 'Too many requests. Please wait a few minutes.' }
          };
        }
        return { data, error };
      }

      // Success: OTP sent (Supabase may return data with no error even if email silently ignored)
      return { data: data, error: null, success: true };
    } catch (err) {
      var errMsg = (err.message || '').toLowerCase();
      if (errMsg.indexOf('fetch') !== -1 || errMsg.indexOf('network') !== -1 || errMsg.indexOf('failed') !== -1) {
        return { data: null, error: { message: 'Connection error. Please try again.' } };
      }
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

      if (error) {
        var msg = (error.message || '').toLowerCase();
        if (msg.indexOf('token') !== -1 || msg.indexOf('otp') !== -1 || msg.indexOf('expired') !== -1) {
          return { data: null, error: { message: 'Invalid or expired code. Please check and try again.' } };
        }
        return { data, error };
      }

      // Reset attempts on successful verification
      this._otpAttempts = 0;
      this._otpCooldownUntil = 0;

      return { data, error: null };
    } catch (err) {
      var errMsg = (err.message || '').toLowerCase();
      if (errMsg.indexOf('fetch') !== -1 || errMsg.indexOf('network') !== -1) {
        return { data: null, error: { message: 'Connection error. Please try again.' } };
      }
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
      // Clear OTP rate limit state
      sessionStorage.removeItem('otp_cooldown_until');
      sessionStorage.removeItem('otp_attempts');
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
  // SIMPLIFIED API (used by app.js — throw on error, return data directly)
  // ----------------------------------------------------------

  /**
   * Send OTP code to email. Throws on error.
   * @param {string} email
   */
  async sendOtp(email) {
    var result = await this.signInWithOTP(email);
    if (result.error) throw new Error(result.error.message || 'Failed to send code');
    return { success: true };
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
  }
};
