from typing import Annotated, Any, Optional
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from app.core.config import settings

security = HTTPBearer(auto_error=False)

# Supabase menandatangani access token dengan kunci asimetris (ES256/RS256) dan
# menerbitkan public key-nya lewat JWKS. Projek ini sudah memakai model kunci
# baru — `frontend/.env` berisi anon key `sb_publishable_...` dan JWT secret
# legacy sudah tidak menandatangani token — sehingga verifikasi HS256 saja
# menolak setiap token dengan
# "The specified alg value is not allowed".
# HS256 tetap dicoba sebagai jalur transisi; percobaan pertama saja yang
# menghasilkan error, bukan gabungan keduanya.
_JWKS_URL = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
_ASYMMETRIC_ALGORITHMS = ["ES256", "RS256"]

_jwks_client: Optional[jwt.PyJWKClient] = None


def _get_jwks_client() -> jwt.PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(_JWKS_URL)
    return _jwks_client


def _decode_token(token: str) -> dict[str, Any]:
    """Verifikasi token Supabase: JWKS untuk alg asimetris, HS256 untuk token legacy.

    `alg` dibaca dari header dulu (belum diverifikasi) supaya token HS256 tidak
    memicu pengambilan JWKS sama sekali, dan supaya tiap jalur hanya menerima
    keluarga algoritma yang cocok — bukan campuran yang bisa disalahgunakan.
    """
    alg = jwt.get_unverified_header(token).get("alg", "")

    if alg in _ASYMMETRIC_ALGORITHMS:
        key = _get_jwks_client().get_signing_key_from_jwt(token).key
        return jwt.decode(
            token,
            key,
            algorithms=_ASYMMETRIC_ALGORITHMS,
            audience="authenticated",
        )

    return jwt.decode(
        token,
        settings.SUPABASE_JWT_SECRET,
        algorithms=["HS256"],
        audience="authenticated",
    )


class UserPayload(BaseModel):
    id: str
    email: Optional[str] = None
    role: str = "customer"
    app_metadata: dict = {}
    user_metadata: dict = {}


async def get_current_user(
    credentials: Annotated[Optional[HTTPAuthorizationCredentials], Depends(security)]
) -> UserPayload:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Header otentikasi Bearer token tidak ditemukan.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = _decode_token(token)
        user_id: str = payload.get("sub", "")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token tidak memiliki klaim 'sub' pengguna yang valid.",
            )

        app_metadata = payload.get("app_metadata", {})
        user_metadata = payload.get("user_metadata", {})

        # User role prioritization: app_metadata.role -> user_metadata.role -> "customer"
        role = app_metadata.get("role") or user_metadata.get("role") or "customer"

        return UserPayload(
            id=user_id,
            email=payload.get("email"),
            role=role,
            app_metadata=app_metadata,
            user_metadata=user_metadata,
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesi login telah kedaluwarsa. Silakan login kembali.",
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token otentikasi tidak valid: {str(e)}",
        )


async def require_admin(
    current_user: Annotated[UserPayload, Depends(get_current_user)]
) -> UserPayload:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Fitur ini hanya dapat diakses oleh Administrator.",
        )
    return current_user


async def require_staff_or_admin(
    current_user: Annotated[UserPayload, Depends(get_current_user)]
) -> UserPayload:
    if current_user.role not in ["admin", "staff"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Akses ditolak. Fitur ini membutuhkan hak akses Staff atau Administrator.",
        )
    return current_user
