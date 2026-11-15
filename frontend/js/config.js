// =====================================================================
// EXAMIA FRONTEND RUNTIME CONFIGURATION
// =====================================================================

function resolveApiBase() {
  if (typeof window !== "undefined") {
    if (window.EXAMIA_API_BASE) return window.EXAMIA_API_BASE;
    try {
      const stored = localStorage.getItem("EXAMIA_API_BASE");
      if (stored) return stored;
    } catch (_) {}
    const metaTag = document.querySelector('meta[name="examia-api-base"]');
    if (metaTag && metaTag.content) return metaTag.content;
    
    // In local dev when frontend runs on port 3000, reach backend on 8000
    if (window.location.port === "3000") {
      const host = window.location.hostname === "localhost" ? "127.0.0.1" : (window.location.hostname || "127.0.0.1");
      return `${window.location.protocol}//${host}:8000/api/v1`;
    }
    
    // Production default: same-origin API
    return `${window.location.origin}/api/v1`;
  }
  return "http://127.0.0.1:8000/api/v1";
}

export const CONFIG = {
  API_BASE_URL: resolveApiBase(),
  SUPABASE_URL: window.EXAMIA_SUPABASE_URL || "",
  SUPABASE_ANON_KEY: window.EXAMIA_SUPABASE_ANON_KEY || "",
  APP_NAME: "Examia",
  APP_VERSION: "2.4.2",
  TOKEN_KEY: "examia_access_token",
  USER_KEY: "examia_user_data",
  PREFS_KEY: "examia_user_preferences"
};
