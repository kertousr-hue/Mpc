#!/usr/bin/env python3
"""MPC Studio <-> VirtualDJ local bridge.

Runs on the PC that hosts VirtualDJ. It serves MPC Studio on the local network
and proxies a small, allow-listed set of VDJScript commands to the official
VirtualDJ Network Control plugin.
"""

from __future__ import annotations

import argparse
import json
import os
import secrets
import socket
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

BRIDGE_VERSION = "1.0.0"
MAX_BODY = 8192


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def number(value, default=0.0) -> float:
    try:
        return float(str(value).replace("%", "").strip())
    except (TypeError, ValueError):
        return float(default)


def parse_percent(value, default=0.0) -> float:
    return clamp(number(value, default), 0.0, 100.0)


def parse_ratio(value, default=0.0) -> float:
    raw = str(value or "").strip()
    if raw.endswith("%"):
        return clamp(number(raw) / 100.0, 0.0, 1.0)
    n = number(raw, default)
    if n > 1.0:
        n /= 100.0
    return clamp(n, 0.0, 1.0)


def parse_bool(value) -> bool:
    return str(value or "").strip().lower() in {"true", "on", "yes", "1"}


def local_ip() -> str:
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except OSError:
        try:
            return socket.gethostbyname(socket.gethostname())
        except OSError:
            return "127.0.0.1"
    finally:
        sock.close()


class VirtualDJNetworkControl:
    def __init__(self, host="127.0.0.1", port=80, password="", timeout=2.5):
        self.host = host
        self.port = int(port)
        self.password = password or ""
        self.timeout = float(timeout)

    @property
    def base_url(self) -> str:
        return f"http://{self.host}:{self.port}"

    def _request(self, endpoint: str, script: str) -> str:
        url = f"{self.base_url}/{endpoint}?script={quote(script, safe='')}"
        headers = {"Accept": "text/plain", "User-Agent": "MPC-Studio-VDJ-Bridge/1.0"}
        if self.password:
            headers["Authorization"] = f"Bearer {self.password}"
        req = Request(url, headers=headers, method="GET")
        try:
            with urlopen(req, timeout=self.timeout) as response:
                text = response.read().decode("utf-8", "replace").strip()
                if response.status != 200:
                    raise RuntimeError(f"VirtualDJ HTTP {response.status}: {text}")
                return text
        except HTTPError as exc:
            detail = exc.read().decode("utf-8", "replace").strip()
            if exc.code == 401:
                raise RuntimeError("Mot de passe Network Control incorrect") from exc
            raise RuntimeError(f"VirtualDJ HTTP {exc.code}: {detail or exc.reason}") from exc
        except URLError as exc:
            raise RuntimeError("VirtualDJ Network Control est inaccessible") from exc
        except TimeoutError as exc:
            raise RuntimeError("VirtualDJ ne répond pas") from exc

    def query(self, script: str) -> str:
        result = self._request("query", script)
        if result.lower().startswith("error:"):
            raise RuntimeError(result)
        return result

    def execute(self, script: str) -> bool:
        return self._request("execute", script).lower() == "true"

    def ping(self) -> dict:
        version = self.query("get_version")
        try:
            build = self.query("get_build")
        except RuntimeError:
            build = ""
        return {"connected": True, "version": version, "build": build}

    def _deck_state(self, deck: int) -> dict:
        # One VDJScript query per deck keeps polling light enough for Network Control.
        script = (
            f"deck {deck} get_text "
            "'`get_title`~|~`get_artist`~|~`get_bpm`~|~`get_position`~|~"
            "`get_pitch`~|~`level`~|~`play`~|~`get_key`'"
        )
        raw = self.query(script)
        parts = raw.split("~|~")
        while len(parts) < 8:
            parts.append("")
        return {
            "deck": deck,
            "title": parts[0],
            "artist": parts[1],
            "bpm": number(parts[2], 0),
            "position": parse_ratio(parts[3], 0),
            "pitch": number(parts[4], 0),
            "volume": parse_percent(parts[5], 100),
            "playing": parse_bool(parts[6]),
            "key": parts[7],
        }

    def state(self) -> dict:
        ping = self.ping()
        deck1 = self._deck_state(1)
        deck2 = self._deck_state(2)
        try:
            cross = parse_percent(self.query("crossfader"), 50)
        except RuntimeError:
            cross = 50.0
        return {
            **ping,
            "crossfader": cross,
            "decks": {"1": deck1, "2": deck2},
        }

    def command(self, payload: dict) -> tuple[bool, str]:
        action = str(payload.get("action") or "").strip().lower()
        deck = int(number(payload.get("deck"), 1))
        if deck not in (1, 2):
            raise ValueError("Deck invalide")

        deck_prefix = f"deck {deck} "
        script = ""

        if action in {"play", "pause", "play_pause", "sync", "loop_exit", "eq_reset", "keylock", "pfl"}:
            verbs = {
                "play": "play",
                "pause": "pause",
                "play_pause": "play_pause",
                "sync": "sync",
                "loop_exit": "loop_exit",
                "eq_reset": "eq_reset",
                "keylock": "key_lock",
                "pfl": "pfl",
            }
            script = deck_prefix + verbs[action]
        elif action == "cue":
            script = deck_prefix + "goto_cue"
        elif action == "set_cue":
            script = deck_prefix + "set_cue"
        elif action == "pitch":
            delta = clamp(number(payload.get("value"), 0), -50, 50)
            script = deck_prefix + f"pitch {100.0 + delta:.2f}%"
        elif action == "volume":
            value = clamp(number(payload.get("value"), 100), 0, 100)
            script = deck_prefix + f"level {value:.1f}%"
        elif action in {"eq_low", "eq_mid", "eq_high", "filter"}:
            value = clamp(number(payload.get("value"), 50), 0, 100)
            script = deck_prefix + f"{action} {value:.1f}%"
        elif action == "loop":
            beats = number(payload.get("value"), 4)
            if beats not in {0.25, 0.5, 1, 2, 4, 8, 16, 32}:
                raise ValueError("Longueur de boucle invalide")
            script = deck_prefix + f"loop {beats:g}"
        elif action in {"hot_cue", "delete_cue", "pad"}:
            slot = int(clamp(number(payload.get("slot"), 1), 1, 16))
            verb = {"hot_cue": "hot_cue", "delete_cue": "delete_cue", "pad": "pad"}[action]
            script = deck_prefix + f"{verb} {slot}"
        elif action == "sampler":
            slot = int(clamp(number(payload.get("slot"), 1), 1, 64))
            script = f"sampler_play {slot}"
        elif action == "crossfader":
            value = clamp(number(payload.get("value"), 50), 0, 100)
            script = f"crossfader {value:.1f}%"
        elif action == "echo":
            script = deck_prefix + 'padfx "echo" 60% 1bt'
        elif action == "reverb":
            script = deck_prefix + 'padfx "reverb"'
        elif action == "backspin":
            script = deck_prefix + "backspin 1000ms"
        else:
            raise ValueError("Commande non autorisée")

        ok = self.execute(script)
        return ok, script


class BridgeHandler(SimpleHTTPRequestHandler):
    server_version = "MPCVirtualDJBridge/1.0"

    def log_message(self, fmt, *args):
        sys.stdout.write("[HTTP] " + (fmt % args) + "\n")

    def end_headers(self):
        self.send_header("Cache-Control", "no-store" if self.path.startswith("/api/") else "no-cache")
        if self.path.startswith("/api/"):
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Headers", "Content-Type, X-MPC-PIN")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        super().end_headers()

    @property
    def bridge(self):
        return self.server.bridge

    @property
    def pin(self):
        return self.server.pin

    def _json(self, status: int, payload: dict):
        data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self) -> bool:
        supplied = self.headers.get("X-MPC-PIN", "").strip()
        if not supplied:
            supplied = parse_qs(urlparse(self.path).query).get("pin", [""])[0]
        return secrets.compare_digest(supplied, self.pin)

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/api/vdj/ping":
            try:
                info = self.bridge.ping()
                self._json(200, {"ok": True, "bridge": BRIDGE_VERSION, **info})
            except Exception as exc:
                self._json(503, {"ok": False, "bridge": BRIDGE_VERSION, "error": str(exc)})
            return
        if path == "/api/vdj/state":
            if not self._authorized():
                self._json(401, {"ok": False, "error": "PIN incorrect"})
                return
            try:
                self._json(200, {"ok": True, **self.bridge.state()})
            except Exception as exc:
                self._json(503, {"ok": False, "error": str(exc)})
            return
        super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path != "/api/vdj/command":
            self._json(404, {"ok": False, "error": "Route inconnue"})
            return
        if not self._authorized():
            self._json(401, {"ok": False, "error": "PIN incorrect"})
            return
        try:
            length = min(int(self.headers.get("Content-Length", "0") or 0), MAX_BODY)
            payload = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
            ok, script = self.bridge.command(payload)
            self._json(200 if ok else 502, {"ok": ok, "script": script})
        except (ValueError, json.JSONDecodeError) as exc:
            self._json(400, {"ok": False, "error": str(exc)})
        except Exception as exc:
            self._json(503, {"ok": False, "error": str(exc)})


class BridgeServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address, handler, bridge, pin):
        super().__init__(address, handler)
        self.bridge = bridge
        self.pin = pin


def main() -> int:
    parser = argparse.ArgumentParser(description="Passerelle locale MPC Studio -> VirtualDJ")
    parser.add_argument("--bind", default=os.getenv("MPC_VDJ_BIND", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.getenv("MPC_VDJ_BRIDGE_PORT", "8765")))
    parser.add_argument("--vdj-host", default=os.getenv("MPC_VDJ_HOST", "127.0.0.1"))
    parser.add_argument("--vdj-port", type=int, default=int(os.getenv("MPC_VDJ_PORT", "80")))
    parser.add_argument("--vdj-password", default=os.getenv("MPC_VDJ_PASSWORD", ""))
    parser.add_argument("--pin", default=os.getenv("MPC_VDJ_PIN", ""))
    parser.add_argument("--root", default=str(Path(__file__).resolve().parent))
    args = parser.parse_args()

    pin = str(args.pin).strip() or str(secrets.randbelow(900000) + 100000)
    root = Path(args.root).resolve()
    if not (root / "index.html").exists():
        print(f"Erreur: index.html introuvable dans {root}", file=sys.stderr)
        return 2

    bridge = VirtualDJNetworkControl(
        host=args.vdj_host,
        port=args.vdj_port,
        password=args.vdj_password,
    )
    handler = partial(BridgeHandler, directory=str(root))
    server = BridgeServer((args.bind, args.port), handler, bridge, pin)
    ip = local_ip()

    print("\n=== MPC Studio · VirtualDJ PC Bridge ===")
    print(f"Dossier : {root}")
    print(f"VirtualDJ Network Control : http://{args.vdj_host}:{args.vdj_port}")
    print(f"Code PIN Android : {pin}")
    print(f"Ouvre sur Android : http://{ip}:{args.port}/?mode=virtualdj")
    print("PC et Android doivent être sur le même réseau Wi-Fi/LAN.")
    print("Ctrl+C pour arrêter.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt de la passerelle.")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
