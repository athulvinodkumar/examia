// =====================================================================
// EXAMIA UNIFIED API CLIENT
// =====================================================================

import { CONFIG } from './config.js';

class ApiClient {
  constructor() {
    this.baseUrl = CONFIG.API_BASE_URL;
  }

  getToken() {
    return localStorage.getItem(CONFIG.TOKEN_KEY);
  }

  async request(endpoint, options = {}) {
    const url = endpoint.startsWith("http") ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = { ...options.headers };

    const token = this.getToken();
    if (token && !headers["Authorization"]) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Auto set content-type for JSON if not FormData
    if (options.body && !(options.body instanceof FormData) && !headers["Content-Type"]) {
      headers["Content-Type"] = "application/json";
    }

    try {
      let response;
      try {
        response = await fetch(url, { ...options, headers });
      } catch (fetchErr) {
        if (url.includes("localhost:8000")) {
          const fallbackUrl = url.replace("localhost:8000", "127.0.0.1:8000");
          response = await fetch(fallbackUrl, { ...options, headers });
        } else if (url.includes("127.0.0.1:8000")) {
          const fallbackUrl = url.replace("127.0.0.1:8000", "localhost:8000");
          response = await fetch(fallbackUrl, { ...options, headers });
        } else {
          throw fetchErr;
        }
      }

      if (response.status === 401) {
        // Clear invalid token if on protected page
        const isAuthCheck = endpoint.includes("/auth/me");
        if (!isAuthCheck) {
          localStorage.removeItem(CONFIG.TOKEN_KEY);
          localStorage.removeItem(CONFIG.USER_KEY);
        }
      }

      // Check if response is JSON or blob (e.g. CSV download)
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/csv") || contentType.includes("application/octet-stream")) {
        if (!response.ok) throw new Error("Download failed");
        return await response.blob();
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMsg = data.detail || data.message || `Request failed with status ${response.status}`;
        throw new Error(errorMsg);
      }

      return data;
    } catch (err) {
      console.error(`API Error [${endpoint}]:`, err);
      throw err;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "GET" });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: "PUT",
      body: body instanceof FormData ? body : JSON.stringify(body)
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: "DELETE" });
  }
}

export const api = new ApiClient();
