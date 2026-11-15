// =====================================================================
// EXAMIA AUTHENTICATION MANAGER (SUPABASE + GOOGLE OAUTH + DEMO AUTH)
// =====================================================================

import { CONFIG } from './config.js';
import { api } from './api.js';
import { showToast } from './notifications.js';

class AuthManager {
  constructor() {
    this.user = this.loadStoredUser();
    this.token = localStorage.getItem(CONFIG.TOKEN_KEY);
    this.supabaseClient = null;
    this.initSupabase();
  }

  loadStoredUser() {
    try {
      const data = localStorage.getItem(CONFIG.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  async initSupabase() {
    if (CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY && window.supabase) {
      try {
        this.supabaseClient = window.supabase.createClient(
          CONFIG.SUPABASE_URL,
          CONFIG.SUPABASE_ANON_KEY
        );
        return;
      } catch (err) {
        console.warn("Supabase client init warning:", err);
      }
    }

    // Try fetching public configuration from backend if not defined in frontend config
    try {
      const cfg = await api.get("/auth/public-config");
      if (cfg && cfg.supabase_url && cfg.supabase_anon_key && window.supabase) {
        CONFIG.SUPABASE_URL = cfg.supabase_url;
        CONFIG.SUPABASE_ANON_KEY = cfg.supabase_anon_key;
        this.supabaseClient = window.supabase.createClient(
          cfg.supabase_url,
          cfg.supabase_anon_key
        );
      }
    } catch (e) {
      // Backend may be offline or unreachable initially
    }
  }

  isAuthenticated() {
    return Boolean(this.token && this.user);
  }

  isOnboarded() {
    return Boolean(this.user && this.user.is_onboarded);
  }

  isTeacher() {
    return Boolean(this.user);
  }

  isStudent() {
    return Boolean(this.user);
  }

  isAdmin() {
    return this.user && this.user.role === "admin";
  }

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem(CONFIG.TOKEN_KEY, token);
    localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
  }

  logout() {
    if (this.supabaseClient) {
      this.supabaseClient.auth.signOut().catch(() => {});
    }
    this.token = null;
    this.user = null;
    localStorage.removeItem(CONFIG.TOKEN_KEY);
    localStorage.removeItem(CONFIG.USER_KEY);
    window.location.href = "login.html";
  }

  async signInWithGoogle() {
    if (!this.supabaseClient) {
      await this.initSupabase();
    }
    if (this.supabaseClient) {
      const { data, error } = await this.supabaseClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/login.html`
        }
      });
      if (error) {
        throw new Error(error.message);
      }
      return data;
    } else {
      // Supabase credentials not yet populated in .env: show friendly prompt
      throw new Error(
        "Google OAuth credentials are not yet configured in backend/.env. Use Demo Sign-In below for instant access during development!"
      );
    }
  }

  async register(registrationData) {
    try {
      const resp = await api.post("/auth/register", registrationData);
      this.setSession(resp.access_token, resp.user);
      return resp.user;
    } catch (err) {
      throw err;
    }
  }

  async login(loginStr, password) {
    try {
      const resp = await api.post("/auth/login", {
        login: loginStr,
        password: password
      });
      this.setSession(resp.access_token, resp.user);
      return resp.user;
    } catch (err) {
      throw err;
    }
  }

  async completeOnboarding(onboardingData) {
    try {
      const resp = await api.post("/auth/complete-onboarding", onboardingData);
      this.setSession(resp.access_token, resp.user);
      return resp.user;
    } catch (err) {
      throw err;
    }
  }

  async checkUsername(username) {
    try {
      const clean = (username || "").trim().toLowerCase();
      if (clean.length < 3) return { available: false, username: clean };
      return await api.get(`/auth/check-username?username=${encodeURIComponent(clean)}`);
    } catch (err) {
      return { available: false, username };
    }
  }

  async demoLogin(email, role = "teacher", fullName = "") {
    try {
      const resp = await api.post("/auth/demo-login", {
        email,
        role,
        full_name: fullName
      });
      this.setSession(resp.access_token, resp.user);
      return resp.user;
    } catch (err) {
      throw err;
    }
  }

  async checkCurrentSession() {
    if (!this.token) return null;
    try {
      const resp = await api.get("/auth/me");
      if (resp && resp.user) {
        this.user = resp.user;
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(this.user));
        return this.user;
      }
    } catch (e) {
      this.logout();
    }
    return null;
  }
}

export const auth = new AuthManager();
