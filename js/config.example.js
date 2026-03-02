// ============================================================
// OMD Finance Platform — Configuration EXAMPLE
// Copy this file to config.js and fill in your Supabase credentials.
// ============================================================

const CONFIG = {
    // Supabase credentials — get these from your Supabase project settings
    SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
    SUPABASE_ANON_KEY: 'YOUR-ANON-KEY-HERE',

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
