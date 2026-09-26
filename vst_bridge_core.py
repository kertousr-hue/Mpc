from __future__ import annotations

import os
import ssl
from pathlib import Path
from urllib.parse import urlparse


def resolve_tls(certfile: str | None, keyfile: str | None, environ: dict[str, str] | None = None) -> tuple[Path | None, Path | None]:
    env = os.environ if environ is None else environ
    cert_value = str(certfile or env.get("MPC_VST_CERT", "")).strip()
    key_value = str(keyfile or env.get("MPC_VST_KEY", "")).strip()
    if not cert_value and not key_value:
        return None, None
    if not cert_value or not key_value:
        raise ValueError("Le certificat TLS et sa clé privée doivent être fournis ensemble")
    cert = Path(cert_value).expanduser().resolve()
    key = Path(key_value).expanduser().resolve()
    if not cert.is_file():
        raise ValueError(f"Certificat TLS introuvable: {cert}")
    if not key.is_file():
        raise ValueError(f"Clé TLS introuvable: {key}")
    return cert, key


def _normalize_origin(value: str) -> str:
    raw = str(value or "").strip()
    if raw == "*":
        raise ValueError("L'origine wildcard '*' est interdite")
    parsed = urlparse(raw)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError(f"Origine invalide: {raw}")
    if parsed.username or parsed.password or parsed.query or parsed.fragment:
        raise ValueError(f"Origine invalide: {raw}")
    return f"{parsed.scheme}://{parsed.netloc}"


def parse_allowed_origins(cli_origins: list[str] | None, env_value: str | None = None) -> set[str]:
    values = list(cli_origins or [])
    if env_value:
        values.extend(part.strip() for part in str(env_value).split(",") if part.strip())
    return {_normalize_origin(value) for value in values}


def origin_headers(origin: str | None, allowed_origins: set[str], private_network_requested: bool = False) -> dict[str, str]:
    if not origin:
        return {}
    try:
        normalized = _normalize_origin(origin)
    except ValueError:
        return {}
    if normalized not in allowed_origins:
        return {}
    headers = {
        "Access-Control-Allow-Origin": normalized,
        "Vary": "Origin",
    }
    if private_network_requested:
        headers["Access-Control-Allow-Private-Network"] = "true"
    return headers


def wrap_server_tls(server, certfile: Path, keyfile: Path) -> None:
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(certfile=str(certfile), keyfile=str(keyfile))
    server.socket = context.wrap_socket(server.socket, server_side=True)
