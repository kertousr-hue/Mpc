#!/usr/bin/env python3
"""Local MPC Studio VST3 processing bridge.

The browser never loads VST binaries. This process runs on the Windows PC,
scans installed VST3 plugins, accepts a 16-bit PCM WAV from MPC Studio,
processes it through one allow-listed installed plugin via Pedalboard, and
returns a WAV. It does not install or execute plugin-manager installers.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import os
import secrets
import wave
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

import numpy as np

MAX_UPLOAD = 64 * 1024 * 1024
VERSION = "1.0.0"


def plugin_id(path: Path) -> str:
    return "vst_" + hashlib.sha256(str(path).encode("utf-8", "ignore")).hexdigest()[:16]


def default_vst_dirs() -> list[Path]:
    raw = []
    for env in ("CommonProgramFiles", "ProgramFiles", "LOCALAPPDATA"):
        base = os.getenv(env)
        if base:
            raw.append(Path(base) / "VST3" if env != "ProgramFiles" else Path(base) / "Common Files" / "VST3")
    extra = os.getenv("MPC_VST_PATHS", "")
    raw.extend(Path(x.strip()) for x in extra.split(os.pathsep) if x.strip())
    out = []
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
        channels, width, rate, frames = w.getnchannels(), w.getsampwidth(), w.getframerate(), w.getnframes()
        if width != 2 or channels not in (1, 2) or rate < 8000 or rate > 192000:
            raise ValueError("WAV PCM 16-bit mono/stéréo requis")
        data = np.frombuffer(w.readframes(frames), dtype="<i2").astype(np.float32) / 32768.0
    data = data.reshape(-1, channels).T
    return data, rate


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
    pin: str


class Handler(BaseHTTPRequestHandler):
    server_version = "MPCVSTBridge/1.0"

    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-MPC-PIN")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

    def _json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self) -> bool:
        return secrets.compare_digest(str(self.headers.get("X-MPC-PIN", "")), self.server.pin)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        if urlparse(self.path).path != "/api/vst/plugins":
            self._json(404, {"error": "Route inconnue"})
            return
        if not self._authorized():
            self._json(401, {"error": "PIN incorrect"})
            return
        items = [{"id": pid, "name": p.stem, "path": str(p)} for pid, p in sorted(self.server.plugins.items(), key=lambda x: x[1].name.lower())]
        self._json(200, {"version": VERSION, "plugins": items})

    def do_POST(self):
        if urlparse(self.path).path != "/api/vst/process":
            self._json(404, {"error": "Route inconnue"})
            return
        if not self._authorized():
            self._json(401, {"error": "PIN incorrect"})
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
        self.send_response(200)
        self._cors()
        self.send_header("Content-Type", "audio/wav")
        self.send_header("Content-Length", str(len(result)))
        self.end_headers()
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
    parser.add_argument("--pin", default=os.getenv("MPC_VST_PIN", ""))
    parser.add_argument("--vst-dir", action="append", default=[])
    args = parser.parse_args()
    dirs = [Path(x).expanduser().resolve() for x in args.vst_dir] or default_vst_dirs()
    plugins = scan_plugins(dirs)
    pin = str(args.pin).strip() or str(secrets.randbelow(900000) + 100000)
    server = Server((args.bind, args.port), Handler)
    server.plugins = plugins
    server.pin = pin
    print("\n=== MPC Studio · VST3 PC Bridge ===")
    print("Aucun installeur n'est exécuté par ce pont.")
    print("Dossiers scannés:")
    for d in dirs: print(" -", d)
    print(f"Plugins VST3 détectés: {len(plugins)}")
    print(f"PIN MPC: {pin}")
    print(f"PC local: http://127.0.0.1:{args.port}")
    print(f"Depuis Android sur le même réseau: http://{local_ip()}:{args.port}")
    print("Ctrl+C pour arrêter.\n")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
