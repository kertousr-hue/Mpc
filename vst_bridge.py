#!/usr/bin/env python3
"""Local MPC Studio VST3 processing bridge.

The bridge serves MPC Studio itself over the LAN so browser requests to VST3
processing stay same-origin. It scans installed VST3 plugins, accepts a bounded
16-bit PCM WAV, processes it with one allow-listed plugin through Pedalboard,
and returns a WAV. It never installs or executes plugin-manager installers.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import secrets
import threading
import time
import wave
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import numpy as np

from vst_bridge_core import origin_headers, parse_allowed_origins, resolve_tls, wrap_server_tls

MAX_UPLOAD = 64 * 1024 * 1024
VERSION = "1.2.0"
AUTH_WINDOW_SECONDS = 60
AUTH_MAX_FAILURES = 8


def plugin_id(path: Path) -> str:
    return "vst_" + hashlib.sha256(str(path).encode("utf-8", "ignore")).hexdigest()[:16]


def default_vst_dirs() -> list[Path]:
    raw: list[Path] = []
    common = os.getenv("CommonProgramFiles")
    program = os.getenv("ProgramFiles")
    local = os.getenv("LOCALAPPDATA")
    if common:
        raw.append(Path(common) / "VST3")
    if program:
        raw.append(Path(program) / "Common Files" / "VST3")
    if local:
        raw.append(Path(local) / "Programs" / "Common" / "VST3")
        raw.append(Path(local) / "VST3")
    extra = os.getenv("MPC_VST_PATHS", "")
    raw.extend(Path(x.strip()) for x in extra.split(os.pathsep) if x.strip())
    out: list[Path] = []
    for p in raw:
        try:
            p = p.resolve()
        except OSError:
            continue
        if p not in out:
            out.append(p)
    return out


def scan_plugins(dirs: list[Path]) -> dict[str, Path]:
    found: dict[str, Path] = {}
    for base in dirs:
        if not base.exists():
            continue
        try:
            candidates = list(base.rglob("*.vst3"))
        except OSError:
            continue
        for path in candidates:
            try:
                resolved = path.resolve()
            except OSError:
                continue
            found[plugin_id(resolved)] = resolved
    return found


def read_wav(raw: bytes) -> tuple[np.ndarray, int]:
    with wave.open(io.BytesIO(raw), "rb") as w:
        channels = w.getnchannels()
        width = w.getsampwidth()
        rate = w.getframerate()
        frames = w.getnframes()
        if width != 2 or channels not in (1, 2) or rate < 8000 or rate > 192000:
            raise ValueError("WAV PCM 16-bit mono/stéréo requis")
        if frames <= 0 or frames > rate * 60 * 15:
            raise ValueError("Durée audio invalide ou supérieure à 15 minutes")
        data = np.frombuffer(w.readframes(frames), dtype="<i2").astype(np.float32) / 32768.0
    return data.reshape(-1, channels).T, rate


def write_wav(audio: np.ndarray, rate: int) -> bytes:
    x = np.asarray(audio, dtype=np.float32)
    if x.ndim == 1:
        x = x[np.newaxis, :]
    x = np.clip(x, -1.0, 1.0)
    interleaved = (x.T.reshape(-1) * 32767.0).astype("<i2").tobytes()
    out = io.BytesIO()
    with wave.open(out, "wb") as w:
        w.setnchannels(int(x.shape[0]))
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(interleaved)
    return out.getvalue()


class Server(ThreadingHTTPServer):
    plugins: dict[str, Path]
    token: str
    auth_failures: dict[str, list[float]]
    processing_lock: threading.Lock
    allowed_origins: set[str]


class Handler(SimpleHTTPRequestHandler):
    server_version = "MPCVSTBridge/1.1"

    def _security_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        requested_private = str(self.headers.get("Access-Control-Request-Private-Network", "")).lower() == "true"
        for key, value in origin_headers(self.headers.get("Origin"), self.server.allowed_origins, requested_private).items():
            self.send_header(key, value)

    def end_headers(self):
        self._security_headers()
        super().end_headers()

    def _json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        super().end_headers()
        self.wfile.write(body)

    def _auth(self) -> tuple[bool, int]:
        ip = str(self.client_address[0])
        now = time.monotonic()
        recent = [t for t in self.server.auth_failures.get(ip, []) if now - t < AUTH_WINDOW_SECONDS]
        if len(recent) >= AUTH_MAX_FAILURES:
            self.server.auth_failures[ip] = recent
            return False, 429
        supplied = str(self.headers.get("X-MPC-Token", ""))
        if not secrets.compare_digest(supplied, self.server.token):
            recent.append(now)
            self.server.auth_failures[ip] = recent
            return False, 401
        self.server.auth_failures.pop(ip, None)
        return True, 200

    def _require_auth(self) -> bool:
        ok, status = self._auth()
        if ok:
            return True
        self._json(status, {"error": "Trop de tentatives" if status == 429 else "Jeton incorrect"})
        return False

    def do_OPTIONS(self):
        self.send_response(204)
        origin = self.headers.get("Origin")
        cors = origin_headers(origin, self.server.allowed_origins, str(self.headers.get("Access-Control-Request-Private-Network", "")).lower() == "true")
        if cors:
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-MPC-Token")
        super().end_headers()

    def do_GET(self):
        if urlparse(self.path).path != "/api/vst/plugins":
            super().do_GET()
            return
        if not self._require_auth():
            return
        items = [
            {"id": pid, "name": p.stem}
            for pid, p in sorted(self.server.plugins.items(), key=lambda x: x[1].name.lower())
        ]
        self._json(200, {"version": VERSION, "plugins": items})

    def do_POST(self):
        if urlparse(self.path).path != "/api/vst/process":
            self._json(404, {"error": "Route inconnue"})
            return
        if not self._require_auth():
            return

        q = parse_qs(urlparse(self.path).query)
        pid = str(q.get("plugin", [""])[0])
        path = self.server.plugins.get(pid)
        if not path:
            self._json(400, {"error": "Plugin VST3 inconnu"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_UPLOAD:
            self._json(413, {"error": "WAV vide ou trop volumineux"})
            return

        if not self.server.processing_lock.acquire(blocking=False):
            self._json(429, {"error": "Un traitement VST3 est déjà en cours"})
            return
        try:
            from pedalboard import load_plugin

            raw = self.rfile.read(length)
            audio, rate = read_wav(raw)
            plugin = load_plugin(str(path))
            processed = plugin(audio, rate)
            result = write_wav(processed, rate)
        except Exception as exc:
            self._json(422, {"error": f"Traitement VST3 impossible: {exc}"})
            return
        finally:
            self.server.processing_lock.release()

        self.send_response(200)
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(result)))
        super().end_headers()
        self.wfile.write(result)

    def log_message(self, fmt, *args):
        print("[VST] " + (fmt % args))


def local_ip() -> str:
    import socket

    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def main() -> int:
    parser = argparse.ArgumentParser(description="MPC Studio VST3 local bridge")
    parser.add_argument("--bind", default=os.getenv("MPC_VST_BIND", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.getenv("MPC_VST_PORT", "8766")))
    parser.add_argument("--token", default=os.getenv("MPC_VST_TOKEN", ""))
    parser.add_argument("--pin", dest="legacy_pin", default=os.getenv("MPC_VST_PIN", ""))
    parser.add_argument("--vst-dir", action="append", default=[])
    parser.add_argument("--root", default=str(Path(__file__).resolve().parent))
    parser.add_argument("--certfile", default=None)
    parser.add_argument("--keyfile", default=None)
    parser.add_argument("--allow-origin", action="append", default=[])
    args = parser.parse_args()

    root = Path(args.root).resolve()
    if not (root / "index.html").exists():
        print(f"Erreur: index.html introuvable dans {root}")
        return 2

    dirs = [Path(x).expanduser().resolve() for x in args.vst_dir] or default_vst_dirs()
    plugins = scan_plugins(dirs)
    token = str(args.token or args.legacy_pin).strip() or secrets.token_urlsafe(24)
    try:
        certfile, keyfile = resolve_tls(args.certfile, args.keyfile)
        allowed_origins = parse_allowed_origins(args.allow_origin, os.getenv("MPC_VST_ALLOWED_ORIGINS", ""))
    except ValueError as exc:
        print(f"Erreur de configuration VST Bridge: {exc}")
        return 2

    handler = partial(Handler, directory=str(root))
    server = Server((args.bind, args.port), handler)
    server.plugins = plugins
    server.token = token
    server.auth_failures = {}
    server.processing_lock = threading.Lock()
    server.allowed_origins = allowed_origins
    if certfile and keyfile:
        wrap_server_tls(server, certfile, keyfile)

    ip = local_ip()
    scheme = "https" if certfile else "http"
    print("\n=== MPC Studio · VST3 PC Bridge v1.2 ===")
    print("Aucun installeur n'est exécuté par ce pont.")
    print("Dossiers VST3 scannés:")
    for d in dirs:
        print(" -", d)
    print(f"Plugins VST3 détectés: {len(plugins)}")
    print(f"Jeton MPC: {token}")
    print(f"Ouvre MPC Studio sur ce PC: {scheme}://127.0.0.1:{args.port}/")
    print(f"Ouvre MPC Studio sur Android/LAN: {scheme}://{ip}:{args.port}/")
    if certfile:
        print("HTTPS actif: le certificat doit être approuvé sur chaque appareil client.")
    else:
        print("HTTP actif: mode de secours; HTTPS est recommandé pour conserver le Secure Context.")
    if allowed_origins:
        print("Origines navigateur autorisées:")
        for origin in sorted(allowed_origins):
            print(" -", origin)
    print("Le mode recommandé sert MPC Studio et l'API VST depuis la même origine.")
    print("Ctrl+C pour arrêter.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt du VST Bridge.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
