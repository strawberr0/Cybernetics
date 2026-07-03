"""Shared Google service-account auth for Workspace / Cloud adapters."""

import json
from typing import Optional
from google.oauth2 import service_account
from google.auth.transport.requests import Request
from cybernetics.config.settings import settings
from cybernetics.logging.logger import get_logger

logger = get_logger("cybernetics.adapters.google_auth")


def _load_creds(scopes: list[str]) -> Optional[service_account.Credentials]:
    key_json = settings.google_service_account_key
    if not key_json:
        logger.warning("google_service_account_key_empty")
        return None
    try:
        info = json.loads(key_json)
        return service_account.Credentials.from_service_account_info(info, scopes=scopes)
    except Exception as exc:
        logger.warning("google_creds_load_failed", error=str(exc))
        return None


def get_access_token(scopes: list[str]) -> Optional[str]:
    creds = _load_creds(scopes)
    if not creds:
        return None
    creds.refresh(Request())
    return creds.token
