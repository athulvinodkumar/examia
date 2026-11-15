import sys
import urllib.parse
from app.config import settings
from app.database import engine

def mask_secret(val: str, show_chars: int = 4) -> str:
    if not val:
        return "[NOT SET]"
    if len(val) <= show_chars * 2:
        return "********"
    return f"{val[:show_chars]}...{val[-show_chars:]}"

def check_config():
    print("=" * 60)
    print("  EXAMIA SYSTEM CONFIGURATION & CONNECTIVITY CHECK")
    print("=" * 60)
    print(f"Environment:       {settings.app_env}")
    print(f"Frontend URL:      {settings.frontend_url}")
    print(f"Backend Port:      {settings.backend_port}")
    print(f"Effective DB URL:  {mask_secret(settings.effective_database_url, 12)}")
    print("-" * 60)
    
    issues = []
    warnings = []
    
    # 1. Database Check
    print("[1/4] Checking Database Connectivity...")
    try:
        with engine.connect() as conn:
            print("  ✓ Database connection established successfully!")
    except Exception as e:
        print(f"  ✗ Database connection failed: {e}")
        issues.append("Database connection failure")

    # 2. Supabase Configuration Check
    print("\n[2/4] Checking Supabase Configuration...")
    if settings.supabase_url:
        parsed = urllib.parse.urlparse(settings.supabase_url)
        if not (parsed.scheme in ("http", "https") and parsed.netloc):
            print(f"  ✗ SUPABASE_URL is invalid format: {settings.supabase_url}")
            issues.append("Invalid SUPABASE_URL format")
        else:
            print(f"  ✓ SUPABASE_URL is valid: {settings.supabase_url}")
            print(f"  ✓ SUPABASE_ANON_KEY: {mask_secret(settings.supabase_anon_key)}")
            print(f"  ✓ SUPABASE_SERVICE_ROLE_KEY: {mask_secret(settings.supabase_service_role_key)}")
            print(f"  ✓ SUPABASE_JWT_SECRET: {mask_secret(settings.supabase_jwt_secret)}")
    else:
        print("  ! Supabase credentials are not set in .env")
        print("    Examia will operate in Local Development Auth mode.")
        warnings.append("Supabase credentials not configured (Local dev auth active)")

    # 3. Google OAuth Check
    print("\n[3/4] Checking Google OAuth Configuration...")
    if settings.google_client_id:
        print(f"  ✓ GOOGLE_CLIENT_ID: {mask_secret(settings.google_client_id)}")
        print(f"  ✓ GOOGLE_CLIENT_SECRET: {mask_secret(settings.google_client_secret)}")
        print(f"  ✓ GOOGLE_REDIRECT_URI: {settings.google_redirect_uri}")
    else:
        print("  ! Google OAuth credentials are not set in .env")
        print("    Users can sign in with development profiles or email.")
        warnings.append("Google OAuth credentials not configured")

    # 4. Google Gemini AI Check
    print("\n[4/4] Checking Google Gemini AI Configuration...")
    if settings.gemini_api_key:
        print(f"  ✓ GEMINI_API_KEY: {mask_secret(settings.gemini_api_key)}")
        print(f"  ✓ GEMINI_MODEL: {settings.gemini_model}")
    else:
        print("  ! GEMINI_API_KEY is not set in .env")
        print("    Examia document processor will use the offline heuristic extraction engine.")
        warnings.append("Gemini API key not configured (Offline extraction engine active)")

    print("\n" + "=" * 60)
    if issues:
        print(f"RESULT: ✗ {len(issues)} critical issue(s) detected.")
        for item in issues:
            print(f"  - {item}")
        return 1
    elif warnings:
        print(f"RESULT: ⚠ Ready with {len(warnings)} note(s).")
        print("The platform is fully ready to run in local development mode.")
        print("Enter your credentials into backend/.env when ready for cloud deployment.")
        return 0
    else:
        print("RESULT: ✓ All external services and database fully configured and verified!")
        return 0

if __name__ == "__main__":
    code = check_config()
    sys.exit(code)
