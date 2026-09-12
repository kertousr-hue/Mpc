#!/usr/bin/env python3
"""MPC Studio <-> VirtualDJ bridge v2 with secure local audio upload and catalog search.

This extends the original bridge without exposing arbitrary VDJScript. Audio files
selected in MPC Studio are uploaded to a temporary PC folder and then loaded into
VirtualDJ. It also exposes a small allow-listed browser/search controller so the
Android UI can search and load tracks from catalogues already connected in VirtualDJ.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import secrets
import sys
import tempfile
from functools import partial
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from virtualdj_bridge import (
    BridgeHandler,
    BridgeServer,
    VirtualDJNetworkControl,
    local_ip,
    number,
)

BRIDGE_V2_VERSION = "2.1.0"
MAX_UPLOAD = 250 * 1024 * 1024
ALLOWED_EXTENSIONS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg", ".opus", ".aiff", ".aif"}


def safe_filename(value: str) -> str:
    name = Path(unquote(value or "track")).name.strip() or "track"
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", name)
    name = re.sub(r"\s+", " ", name).strip(" .")
    return name[:140] or "track"


def safe_search_text(value: object) -> str:
    text = str(value or "").strip()
    text = re.sub(r"[\x00-\x1f`\"\\]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:120]


class VirtualDJNetworkControlV2(VirtualDJNetworkControl):
    def browser_state(self) -> dict:
        try:
            raw = self.query(
                "get_text "
                "'`get_browsed_title`~|~`get_browsed_artist`~|~`get_browsed_bpm`~|~"
                "`get_browsed_key`~|~`get_browsed_filepath`~|~`file_count`'"
            )
            parts = raw.split("~|~")
            while len(parts) < 6:
                parts.append("")
            return {
                "title": parts[0],
                "artist": parts[1],
                "bpm": number(parts[2], 0),
                "key": parts[3],
                "filepath": parts[4],
                "count": int(number(parts[5], 0)),
            }
        except Exception:
            return {"title": "", "artist": "", "bpm": 0, "key": "", "filepath": "", "count": 0}

    def state(self) -> dict:
        data = super().state()
        data["browser"] = self.browser_state()
        data["bridge"] = BRIDGE_V2_VERSION
        return data

    def command(self, payload: dict) -> tuple[bool, str]:
        action = str(payload.get("action") or "").strip().lower()
        deck = int(number(payload.get("deck"), 1))
        if deck not in (1, 2):
            raise ValueError("Deck invalide")

        if action == "catalog_search":
            text = safe_search_text(payload.get("query"))
            if not text:
                raise ValueError("Recherche vide")
            search_script = f'search "{text}"'
            ok = self.execute(search_script)
            self.execute('browser_window "songs"')
            self.execute("browser_scroll 'top'")
            return ok, search_script

        if action == "browser_next":
            self.execute('browser_window "songs"')
            script = "browser_scroll +1"
            return self.execute(script), script

        if action == "browser_prev":
            self.execute('browser_window "songs"')
            script = "browser_scroll -1"
            return self.execute(script), script

        if action == "browser_top":
            self.execute('browser_window "songs"')
            script = "browser_scroll 'top'"
            return self.execute(script), script

        if action == "load_browsed":
            script = f"deck {deck} load"
            return self.execute(script), script

        if action == "preview_browsed":
            script = "prelisten"
            return self.execute(script), script

        if action == "preview_stop":
            script = "prelisten_stop"
            return self.execute(script), script

        if action == "clear_catalog_search":
            script = "clear_search"
            return self.execute(script), script

        return super().command(payload)


class UploadBridgeHandler(BridgeHandler):
    server_version = "MPCVirtualDJBridge/2.1"

    @property
    def upload_dir(self) -> Path:
        return self.server.upload_dir

    def _upload(self):
        if not self._authorized():
            self._json(401, {"ok": False, "error": "PIN incorrect"})
            return

        query = parse_qs(urlparse(self.path).query)
        try:
            deck = int(query.get("deck", ["1"])[0])
        except ValueError:
            deck = 1
        if deck not in (1, 2):
            self._json(400, {"ok": False, "error": "Deck invalide"})
            return

        filename = safe_filename(query.get("filename", ["track"])[0])
        ext = Path(filename).suffix.lower()
        if ext not in ALLOWED_EXTENSIONS:
            self._json(400, {"ok": False, "error": "Format audio non pris en charge"})
            return

        try:
            length = int(self.headers.get("Content-Length", "0") or 0)
        except ValueError:
            length = 0
        if length <= 0:
            self._json(411, {"ok": False, "error": "Fichier vide ou taille inconnue"})
            return
        if length > MAX_UPLOAD:
            self._json(413, {"ok": False, "error": "Fichier trop volumineux (250 Mo maximum)"})
            return

        self.upload_dir.mkdir(parents=True, exist_ok=True)
        target = self.upload_dir / f"{secrets.token_hex(4)}_{filename}"
        part = target.with_suffix(target.suffix + ".part")
        remaining = length
        try:
            with part.open("wb") as out:
                while remaining > 0:
                    chunk = self.rfile.read(min(1024 * 1024, remaining))
                    if not chunk:
                        raise RuntimeError("Transfert interrompu")
                    out.write(chunk)
                    remaining -= len(chunk)
            part.replace(target)
            fullpath = str(target.resolve())
            script = f'deck {deck} load "{fullpath}"'
            ok = self.bridge.execute(script)
            if not ok:
                self._json(502, {"ok": False, "error": "VirtualDJ a refusé le chargement du morceau"})
                return
            self._json(200, {"ok": True, "deck": deck, "filename": filename, "bridge": BRIDGE_V2_VERSION})
        except Exception as exc:
            try:
                if part.exists():
                    part.unlink()
            except OSError:
                pass
            self._json(503, {"ok": False, "error": str(exc)})

    def do_POST(self):
        if urlparse(self.path).path == "/api/vdj/upload":
            self._upload()
            return
        super().do_POST()


def main() -> int:
    parser = argparse.ArgumentParser(description="Passerelle locale MPC Studio -> VirtualDJ v2.1")
    parser.add_argument("--bind", default=os.getenv("MPC_VDJ_BIND", "0.0.0.0"))
    parser.add_argument("--port", type=int, default=int(os.getenv("MPC_VDJ_BRIDGE_PORT", "8765")))
    parser.add_argument("--vdj-host", default=os.getenv("MPC_VDJ_HOST", "127.0.0.1"))
    parser.add_argument("--vdj-port", type=int, default=int(os.getenv("MPC_VDJ_PORT", "80")))
    parser.add_argument("--vdj-password", default=os.getenv("MPC_VDJ_PASSWORD", ""))
    parser.add_argument("--pin", default=os.getenv("MPC_VDJ_PIN", ""))
    parser.add_argument("--root", default=str(Path(__file__).resolve().parent))
    parser.add_argument("--upload-dir", default=os.getenv("MPC_VDJ_UPLOAD_DIR", str(Path(tempfile.gettempdir()) / "MPC-Studio-VirtualDJ")))
    args = parser.parse_args()

    pin = str(args.pin).strip() or str(secrets.randbelow(900000) + 100000)
    root = Path(args.root).resolve()
    upload_dir = Path(args.upload_dir).resolve()
    if not (root / "index.html").exists():
        print(f"Erreur: index.html introuvable dans {root}", file=sys.stderr)
        return 2

    bridge = VirtualDJNetworkControlV2(host=args.vdj_host, port=args.vdj_port, password=args.vdj_password)
    handler = partial(UploadBridgeHandler, directory=str(root))
    server = BridgeServer((args.bind, args.port), handler, bridge, pin)
    server.upload_dir = upload_dir
    ip = local_ip()

    print("\n=== MPC Studio · VirtualDJ PC Bridge v2.1 ===")
    print(f"Dossier MPC : {root}")
    print(f"Dossier musiques temporaires : {upload_dir}")
    print(f"VirtualDJ Network Control : http://{args.vdj_host}:{args.vdj_port}")
    print(f"Code PIN Android : {pin}")
    print(f"Ouvre sur Android : http://{ip}:{args.port}/?mode=virtualdj")
    print("Fonctions : fichiers audio + recherche catalogue VirtualDJ + chargement Deck A/B.")
    print("Les services SoundCloud/Beatport/Beatsource/TIDAL/Deezer doivent être connectés dans VirtualDJ.")
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
