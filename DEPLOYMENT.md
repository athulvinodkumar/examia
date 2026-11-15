# Examia — Production Deployment Guide

This guide details how to deploy **Examia** to production environments, including cloud hosting providers, containerized environments (Docker Compose), managed databases (Supabase), and static web hosts.

---

## Architecture Overview for Production

- **Backend**: Python 3.10+ running FastAPI on Uvicorn / Gunicorn.
- **Frontend**: Static ES Modules / HTML5 / CSS3 / Tailwind CDN, servable from any CDN, S3/Cloudflare R2 bucket, Vercel, Netlify, or Nginx reverse proxy.
- **Database**: Supabase PostgreSQL with native Row-Level Security (RLS).
- **Authentication**: Supabase Auth (Google OAuth 2.0 Provider).
- **AI Processing**: Google Gemini 2.0 Flash via Google GenAI SDK.
- **Object Storage**: Supabase Storage (`exam-papers` bucket).

---

## 1. Supabase Database & Auth Setup

### Step 1: Create Supabase Project
1. Go to [https://supabase.com](https://supabase.com) and create an organization and project.
2. Note your database password and reference ID.

### Step 2: Apply Database Schema & RLS Policies
Navigate to the **SQL Editor** in your Supabase dashboard and run the provided migration scripts:

1. **For a Fresh Setup**:
   - Run `backend/migrations/001_initial_schema.sql` (includes profiles, manual auth, onboarding, questions, options, syllabus material, and unified role schemas).
   - Run `backend/migrations/002_rls_policies.sql` (Row Level Security policies).

2. **If You Already Ran Migration 001 Previously**:
   - Run `backend/migrations/003_v2_schema_updates.sql` to incrementally add `username`, `password_hash`, `department`, `phone`, `is_onboarded`, `document_type`, and `confidence_score` without dropping existing data.

### Step 3: Create Storage Bucket
1. Navigate to **Storage** in the Supabase sidebar.
2. Click **New Bucket**.
3. Bucket name: `exam-papers`.
4. Set to **Public** (or configure authenticated download policies).

### Step 4: Configure Google OAuth
1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/).
2. Add your Supabase callback URL to **Authorized redirect URIs**:
   `https://<YOUR-PROJECT-ID>.supabase.co/auth/v1/callback`
3. Add your production domain to **Authorized JavaScript origins**:
   `https://examia.yourdomain.com`
4. In Supabase Dashboard → **Authentication** → **Providers** → **Google**:
   - Turn toggle ON.
   - Enter **Client ID** and **Client Secret**.
   - Save changes.

---

## 2. Docker & Docker Compose Deployment

Examia includes a production-ready `Dockerfile` and `docker-compose.yml`.

### Step 1: Configure Environment Variables
Copy and update `.env` in the `backend/` directory:
```bash
cp backend/.env.example backend/.env
```
Fill in:
```env
APP_ENV=production
APP_SECRET_KEY=generate_a_cryptographically_secure_random_string_here
FRONTEND_URL=https://examia.yourdomain.com
BACKEND_PORT=8000
DATABASE_URL=postgresql://postgres.xxx:YOUR_PASSWORD@aws-0-region.pooler.supabase.com:6543/postgres
SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_SECRET=YOUR_SUPABASE_JWT_SECRET
GEMINI_API_KEY=YOUR_GOOGLE_AI_STUDIO_GEMINI_KEY
GEMINI_MODEL=gemini-2.0-flash
```

### Step 2: Build and Run
```bash
docker-compose up -d --build
```
This starts:
- `backend` on port `8000`.
- `frontend` on port `3000` (or behind Nginx on port `80/443`).

---

## 3. Cloud Deployment: Railway / Render / Fly.io

### Option A: All-in-One Single Container (Recommended — Easiest & Cheapest)
Examia includes a root `Dockerfile` that packages both the FastAPI backend and the frontend together. FastAPI directly serves the frontend UI, landing page, and API on a single port (`$PORT` or `8000`).
1. **Source**: Connect your Git repository to Railway, Render, Fly.io, or Google Cloud Run.
2. **Dockerfile**: Leave default (`Dockerfile` in root directory).
3. **Port**: Exposed automatically via `$PORT` (Render / Railway / Cloud Run automatically inject this).
4. **Environment Variables**: Add variables from `backend/.env` (`APP_ENV=production`, `DATABASE_URL`, `GEMINI_API_KEY`, etc.).
5. **Health Check Endpoint**: `/health`

### Option B: Split Frontend (Vercel / Netlify) + Cloud Backend
If you prefer hosting the frontend on Vercel or Netlify:
1. **Frontend on Vercel**:
   - Connect repository and select Vercel. Examia includes pre-configured [vercel.json](file:///home/athul/Desktop/Project-E/vercel.json) with SPA rewrites and API proxies.
   - Set environment variable or configure `<meta name="examia-api-base" content="https://your-backend.up.railway.app/api/v1">` or in `localStorage.setItem("EXAMIA_API_BASE", ...)`.
2. **Frontend on Netlify**:
   - Pre-configured [netlify.toml](file:///home/athul/Desktop/Project-E/netlify.toml) is included for instant deploy.
3. **Backend on Railway / Render**:
   - Set Root Directory to `backend` or use `backend/Dockerfile`.
   - Set `FRONTEND_URL=https://your-frontend.vercel.app` to configure CORS.

---

## 4. Ubuntu / Debian VPS Deployment (Systemd + Nginx + Let's Encrypt)

For self-hosted instances on Ubuntu 22.04 / 24.04 or Debian 12:

### Step 1: Install Dependencies
```bash
sudo apt update && sudo apt install -y python3 python3-venv python3-pip nginx certbot python3-certbot-nginx
```

### Step 2: Clone and Setup
```bash
cd /var/www/
sudo git clone <YOUR_REPO_URL> examia
cd /var/www/examia
sudo ./setup.sh
```

### Step 3: Configure Systemd Service for Backend
Create `/etc/systemd/system/examia-backend.service`:
```ini
[Unit]
Description=Examia FastAPI Backend Service
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/examia/backend
EnvironmentFile=/var/www/examia/backend/.env
ExecStart=/var/www/examia/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable examia-backend
sudo systemctl start examia-backend
```

### Step 4: Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/examia`:
```nginx
server {
    server_name examia.yourdomain.com;

    # Frontend Static Files
    root /var/www/examia/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads endpoint
    location /uploads/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }

    # Backend docs & health
    location ~ ^/(docs|openapi.json|health) {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
    }

    client_max_body_size 30M;
}
```

Enable site and configure SSL:
```bash
sudo ln -s /etc/nginx/sites-available/examia /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d examia.yourdomain.com
```

---

## 5. Security Checklist Before Going Live

- [ ] `APP_SECRET_KEY` is set to a 64+ character random string.
- [ ] `APP_ENV` is set to `production`.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is kept strictly private in backend `.env` and never exposed to the frontend.
- [ ] Database migrations `001_initial_schema.sql` and `002_rls_policies.sql` have been executed on Supabase.
- [ ] Google OAuth redirect URI matches your production domain.
- [ ] Gemini API key has quota enabled in Google Cloud Console.
- [ ] HTTPS (TLS) is active across both frontend and backend.
- [ ] Rate limits and maximum upload limits (`client_max_body_size 30M`) are enforced.
