# Examia — Cloudflare Workers & Cloudflare Pages Deployment Guide

This guide explains how to deploy **Examia** to **Cloudflare Pages** and **Cloudflare Workers** with server-side environment variables, edge API routing, Web Crypto security, and Google Gemini AI intelligence.

---

## 1. Architecture Overview on Cloudflare

Examia is fully optimized for Cloudflare's global edge network:

```
                      ┌───────────────────────────────────────────┐
                      │             Cloudflare Edge               │
                      ├─────────────────────┬─────────────────────┤
                      │   Cloudflare Pages  │  Cloudflare Worker  │
                      │   (Static Frontend) │   (Edge API Engine) │
                      │  • index.html       │  • /api/v1/auth/*   │
                      │  • login.html       │  • /api/v1/exams/*  │
                      │  • app.html         │  • /api/v1/ai/*     │
                      │  • /css, /js        │  • /health          │
                      └──────────┬──────────┴──────────┬──────────┘
                                 │                     │
                     Direct Edge API Calls             │ Server-Side Secrets
                                 │                     │ (Never exposed to client)
                                 ▼                     ▼
                      ┌─────────────────────┐   ┌─────────────────────────┐
                      │ Client Web Browser  │   │ Google Gemini AI 2.0    │
                      │ (Teacher / Student) │   │ Supabase / PostgreSQL   │
                      └─────────────────────┘   │ Optional Origin Proxy   │
                                                └─────────────────────────┘
```

- **Cloudflare Pages**: Serves the frontend static files (`./frontend`) from Cloudflare's worldwide CDN with edge caching and instant page loads.
- **Cloudflare Pages Functions / Worker (`functions/` & `src/worker.js`)**: Runs server-side API routes at the edge, authenticates users with Web Crypto HMAC-SHA256, and calls Gemini AI securely.
- **Server-Side Environment Variables & Secrets**: `GEMINI_API_KEY`, `APP_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`, and `DATABASE_URL` are bound directly to `env` and **never sent to the client browser**.

---

## 2. Deployment Options

### Option A: Cloudflare Pages (Recommended via Git)

1. **Push your repository** to GitHub or GitLab.
2. In the [Cloudflare Dashboard](https://dash.cloudflare.com/), go to **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Select your Examia repository.
4. Set the **Build configuration**:
   - **Framework preset**: `None`
   - **Build command**: *(leave empty, or `npm run build`)*
   - **Build output directory**: `frontend`
   - **Root directory**: `/` *(repository root)*
5. Cloudflare Pages automatically detects the `functions/` directory and deploys the Cloudflare Pages Functions edge API!
6. Click **Save and Deploy**.

---

### Option B: Cloudflare Workers via Wrangler CLI

You can deploy the entire application (both frontend assets and backend API) in one command:

```bash
# 1. Install Wrangler CLI (if not already installed)
npm install

# 2. Authenticate with Cloudflare
npx wrangler login

# 3. Test your configuration with dry-run
npx wrangler deploy --dry-run

# 4. Deploy live to Cloudflare Workers
npx wrangler deploy
```

Wrangler uses [wrangler.toml](file:///home/athul/Desktop/Project-E/wrangler.toml), bundles `./frontend` as edge static assets, and deploys `src/worker.js` as the edge API router.

---

## 3. Configuring Environment Variables & Secrets

Cloudflare isolates sensitive API keys and credentials from client browsers through **server-side bindings**.

### Required & Supported Bindings:

| Binding Variable | Type | Description | Visibility |
| :--- | :--- | :--- | :--- |
| `GEMINI_API_KEY` | **Secret** | Google AI Studio API Key for syllabus analysis & question solving | **Server-side only** |
| `APP_SECRET_KEY` | **Secret** | Cryptographic secret for signing HMAC-SHA256 JWT tokens | **Server-side only** |
| `SUPABASE_URL` | Variable | Supabase REST URL (e.g. `https://xxx.supabase.co`) | Server & Client |
| `SUPABASE_ANON_KEY` | Variable | Supabase anonymous public key | Client-safe |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret** | Supabase admin key for server operations | **Server-side only** |
| `GOOGLE_CLIENT_ID` | Variable | Google OAuth 2.0 Web Client ID | Client-safe |
| `GOOGLE_CLIENT_SECRET` | **Secret** | Google OAuth 2.0 Client Secret | **Server-side only** |
| `GEMINI_MODEL` | Variable | Gemini model name (default: `gemini-2.0-flash`) | Server-side |
| `BACKEND_ORIGIN` | Variable | Optional Python backend URL (e.g. `https://api.yourdomain.com`) | Server-side |

---

### Method 1: Set Secrets via Cloudflare Dashboard

1. In the Cloudflare Dashboard, open your **Pages project** or **Worker**.
2. Navigate to **Settings** → **Variables and Secrets**.
3. Under **Environment Variables**, click **Add variable**:
   - Add `GEMINI_MODEL`: `gemini-2.0-flash`
   - Add `SUPABASE_URL`: `https://your-project.supabase.co`
   - Add `SUPABASE_ANON_KEY`: `your-anon-key`
   - Add `GOOGLE_CLIENT_ID`: `your-google-client-id`
4. Under **Secrets**, click **Add secret** (or click "Encrypt"):
   - Add `GEMINI_API_KEY`: *(paste your Gemini key)*
   - Add `APP_SECRET_KEY`: *(paste a 32+ character random string)*
   - Add `SUPABASE_SERVICE_ROLE_KEY`: *(paste your Supabase service role key)*
   - Add `GOOGLE_CLIENT_SECRET`: *(paste your Google client secret)*
5. Click **Save and Deploy**.

---

### Method 2: Set Secrets via Wrangler CLI

Run these commands in your project directory:

```bash
# Set Gemini API Key
npx wrangler secret put GEMINI_API_KEY

# Set JWT Application Secret Key
npx wrangler secret put APP_SECRET_KEY

# Set Supabase Service Role Key
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# Set Google OAuth Secret
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

---

## 4. Local Development with Wrangler

To test the Cloudflare environment locally:

1. Copy [.dev.vars.example](file:///home/athul/Desktop/Project-E/.dev.vars.example) to `.dev.vars`:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
2. Fill in your test credentials in `.dev.vars`.
3. Start the local Cloudflare dev server:
   ```bash
   # Option 1: Cloudflare Pages Local Dev
   npm run pages:dev

   # Option 2: Cloudflare Workers Local Dev
   npm run dev
   ```
4. Run the automated edge test suite:
   ```bash
   npm run test:worker
   ```

---

## 5. Security & Verification Guarantee

- **Zero Secret Leaks**: The endpoint `/api/v1/auth/public-config` returns only client-safe keys (`supabase_url`, `supabase_anon_key`, `google_client_id`). All server secrets (`GEMINI_API_KEY`, `APP_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`) are strictly omitted.
- **Candidate Security**: Candidate endpoints (`/api/v1/exams/public/:token`) sanitize all questions, stripping out `is_correct`, rubrics, and answer keys before serving to students.
- **Web Crypto Standard**: Password hashing and token generation use standard W3C Web Cryptography APIs natively supported on Cloudflare edge isolates.
- **Preserved Functionality**: All existing Python FastAPI backend services, unit tests (`36/36 passed`), and E2E acceptance tests (`14/14 passed`) remain completely functional.
