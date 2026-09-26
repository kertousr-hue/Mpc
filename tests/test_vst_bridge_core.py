import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import vst_bridge_core as core


class VstBridgeCoreTests(unittest.TestCase):
    def test_resolve_tls_supports_http_mode(self):
        self.assertEqual(core.resolve_tls(None, None, {}), (None, None))

    def test_resolve_tls_requires_cert_and_key_together(self):
        with tempfile.TemporaryDirectory() as td:
            cert = Path(td) / "cert.pem"
            key = Path(td) / "key.pem"
            cert.write_text("cert")
            key.write_text("key")
            with self.assertRaises(ValueError):
                core.resolve_tls(str(cert), None, {})
            with self.assertRaises(ValueError):
                core.resolve_tls(None, str(key), {})

    def test_resolve_tls_validates_paths_and_cli_overrides_env(self):
        with tempfile.TemporaryDirectory() as td:
            cert = Path(td) / "cert.pem"
            key = Path(td) / "key.pem"
            cert.write_text("cert")
            key.write_text("key")
            env = {"MPC_VST_CERT": "/missing/env-cert", "MPC_VST_KEY": "/missing/env-key"}
            self.assertEqual(core.resolve_tls(str(cert), str(key), env), (cert.resolve(), key.resolve()))
            with self.assertRaises(ValueError):
                core.resolve_tls("/missing/cert", "/missing/key", {})

    def test_allowed_origins_are_exact_and_wildcard_is_rejected(self):
        origins = core.parse_allowed_origins(
            ["https://mpc-nu-inky.vercel.app", "https://192.168.1.20:8766"],
            "https://example.local"
        )
        self.assertEqual(origins, {
            "https://mpc-nu-inky.vercel.app",
            "https://192.168.1.20:8766",
            "https://example.local",
        })
        with self.assertRaises(ValueError):
            core.parse_allowed_origins(["*"], "")

    def test_origin_headers_only_grant_approved_origins_and_pna(self):
        allowed = {"https://mpc-nu-inky.vercel.app"}
        self.assertEqual(core.origin_headers(None, allowed, False), {})
        self.assertEqual(core.origin_headers("https://evil.example", allowed, True), {})
        self.assertEqual(core.origin_headers("https://mpc-nu-inky.vercel.app", allowed, False), {
            "Access-Control-Allow-Origin": "https://mpc-nu-inky.vercel.app",
            "Vary": "Origin",
        })
        self.assertEqual(core.origin_headers("https://mpc-nu-inky.vercel.app", allowed, True), {
            "Access-Control-Allow-Origin": "https://mpc-nu-inky.vercel.app",
            "Vary": "Origin",
            "Access-Control-Allow-Private-Network": "true",
        })

    def test_wrap_server_tls_uses_server_side_context(self):
        server = mock.Mock()
        server.socket = object()
        context = mock.Mock()
        with mock.patch("vst_bridge_core.ssl.SSLContext", return_value=context) as ctor:
            core.wrap_server_tls(server, Path("/tmp/cert"), Path("/tmp/key"))
        ctor.assert_called_once_with(core.ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain.assert_called_once_with(certfile="/tmp/cert", keyfile="/tmp/key")
        context.wrap_socket.assert_called_once_with(server.socket, server_side=True)


if __name__ == "__main__":
    unittest.main()
