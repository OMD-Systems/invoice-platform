// ============================================================
// OMD Finance Platform — Configuration
// config.js — Centralized app configuration
//
// SECURITY NOTE: This file contains Supabase public (anon) key.
// For production, configure via environment variables.
// Copy config.example.js → config.js and fill in your values.
// ============================================================

const CONFIG = {
  // Supabase credentials — loaded from env vars or defaults
  // In Cloudflare Pages, set these as environment variables:
  //   SUPABASE_URL, SUPABASE_ANON_KEY
  SUPABASE_URL: (typeof __SUPABASE_URL__ !== 'undefined' && __SUPABASE_URL__)
    || 'https://onabywripmjnkovlhkze.supabase.co',
  SUPABASE_ANON_KEY: (typeof __SUPABASE_ANON_KEY__ !== 'undefined' && __SUPABASE_ANON_KEY__)
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
};
