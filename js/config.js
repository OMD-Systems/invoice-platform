// ============================================================
// OMD Finance Platform — Configuration
// config.js — Centralized app configuration
//
// Credentials are injected via Cloudflare Pages Functions middleware
// (window.__ENV__). For local dev, copy config.local.js.example
// to config.local.js and load it before this file.
// ============================================================

const CONFIG = {
  // Supabase credentials — from CF Pages env vars (injected as window.__ENV__)
  // Fallback chain: window.__ENV__ → window.__CONFIG__ → empty (will fail gracefully)
  SUPABASE_URL: (window.__ENV__ && window.__ENV__.SUPABASE_URL)
    || (window.__CONFIG__ && window.__CONFIG__.SUPABASE_URL)
    || 'https://onabywripmjnkovlhkze.supabase.co',
  SUPABASE_ANON_KEY: (window.__ENV__ && window.__ENV__.SUPABASE_ANON_KEY)
    || (window.__CONFIG__ && window.__CONFIG__.SUPABASE_ANON_KEY)
    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9uYWJ5d3JpcG1qbmtvdmxoa3plIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NjE1NTgsImV4cCI6MjA4ODAzNzU1OH0.s5T4zpgN8CdGbu83Hb3WcBgIWq0QjlNXCFmMfzthNDo',

  // App settings
  APP_NAME: 'OMD Finance',
  APP_VERSION: '1.1.0',
  DEFAULT_CURRENCY: 'USD',
  DEFAULT_LOCALE: 'en-US',

  // Feature flags
  ENABLE_SETTLEMENTS: true,
  ENABLE_EXPORT: true,

  // Security settings
  OTP_COOLDOWN_SECONDS: 60,
  MAX_OTP_ATTEMPTS: 5,

  // Email domain whitelist (client-side pre-check, enforced server-side via migration-012)
  ALLOWED_EMAIL_DOMAINS: ['omdsystems.com'],
};

// Validate required credentials
if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) {
  console.error(
    '[CONFIG] Missing Supabase credentials. ' +
    'Set SUPABASE_URL and SUPABASE_ANON_KEY in Cloudflare Pages environment variables, ' +
    'or create js/config.local.js for local development.'
  );
}
