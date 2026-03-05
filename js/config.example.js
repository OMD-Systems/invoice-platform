// ============================================================
// OMD Finance Platform — Configuration EXAMPLE
//
// This file shows the structure. Actual credentials are injected
// by Cloudflare Pages Functions middleware (window.__ENV__).
//
// For local dev: copy js/config.local.js.example → js/config.local.js
// ============================================================

const CONFIG = {
  SUPABASE_URL: (window.__ENV__ && window.__ENV__.SUPABASE_URL) || '',
  SUPABASE_ANON_KEY: (window.__ENV__ && window.__ENV__.SUPABASE_ANON_KEY) || '',

  APP_NAME: 'OMD Finance',
  APP_VERSION: '1.1.0',
  DEFAULT_CURRENCY: 'USD',
  DEFAULT_LOCALE: 'en-US',

  ENABLE_SETTLEMENTS: true,
  ENABLE_EXPORT: true,

  OTP_COOLDOWN_SECONDS: 60,
  MAX_OTP_ATTEMPTS: 5,

  ALLOWED_EMAIL_DOMAINS: ['omdsystems.com'],
};
