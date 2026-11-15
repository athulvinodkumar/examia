import jwt
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from app.config import settings

ALGORITHM = "HS256"

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode.update({"exp": expire, "iat": datetime.now(timezone.utc)})
    secret = settings.supabase_jwt_secret or settings.app_secret_key
    encoded_jwt = jwt.encode(to_encode, secret, algorithm=ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    # Try decoding with Supabase JWT Secret if available
    secrets_to_try = []
    if settings.supabase_jwt_secret:
        secrets_to_try.append(settings.supabase_jwt_secret)
    secrets_to_try.append(settings.app_secret_key)
    # Also fallback secret
    secrets_to_try.append("examia_default_secret_key_change_me")

    for secret in secrets_to_try:
        try:
            payload = jwt.decode(token, secret, algorithms=[ALGORITHM], options={"verify_aud": False})
            return payload
        except jwt.PyJWTError:
            continue
            
    # As a last fallback in non-production local development without secrets, decode unverified to allow smooth local testing if token looks like jwt
    if settings.app_env != "production":
        try:
            unverified = jwt.decode(token, options={"verify_signature": False, "verify_aud": False})
            return unverified
        except Exception:
            return None
    return None
