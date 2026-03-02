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
  }
};
