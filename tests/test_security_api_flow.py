import hashlib
import importlib.util
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER_DIR = ROOT / "server"
APP_PATH = SERVER_DIR / "app.py"

if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

spec = importlib.util.spec_from_file_location("moneytron_server_app_security", APP_PATH)
app_module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(app_module)


class SecurityApiFlowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        tmp_path = Path(self.tmp.name).resolve()
        tmp_path.mkdir(parents=True, exist_ok=True)
        app_module.USERS_DIR = tmp_path
        # storage.py owns the USERS_DIR that the helper functions actually read
        storage_mod = sys.modules.get("storage")
        if storage_mod:
            storage_mod.USERS_DIR = tmp_path
        self.client = app_module.app.test_client()

    def tearDown(self):
        self.tmp.cleanup()

    def _signup(self, user="security_user", password="p@ssword123"):
        res = self.client.post(
            "/api/signup",
            json={"user": user, "password": password, "email": f"{user}@example.com"},
        )
        self.assertEqual(res.status_code, 200)
        payload = res.get_json() or {}
        return payload.get("csrfToken", ""), user, password

    def test_login_migrates_legacy_sha256_to_bcrypt(self):
        user = "legacy_user"
        udir = app_module.USERS_DIR / user
        udir.mkdir(parents=True, exist_ok=True)
        legacy_hash = hashlib.sha256("legacy_pw".encode("utf-8")).hexdigest()
        (udir / "settings.json").write_text(
            json.dumps(
                {
                    "dateFormat": "YYYY-MM-DD",
                    "currency": "ILS",
                    "allowedCurrencies": ["ILS", "USD"],
                    "password_hash": legacy_hash,
                    "email": "legacy@example.com",
                }
            ),
            encoding="utf-8",
        )
        (udir / "categories.json").write_text("{}", encoding="utf-8")
        (udir / "current_month_transactions.json").write_text("[]", encoding="utf-8")
        (udir / "past_data.json").write_text("[]", encoding="utf-8")

        res = self.client.post("/api/login", json={"user": user, "password": "legacy_pw"})
        self.assertEqual(res.status_code, 200)

        settings = json.loads((udir / "settings.json").read_text(encoding="utf-8"))
        self.assertTrue(settings["password_hash"].startswith("$2"))
        self.assertNotEqual(settings["password_hash"], legacy_hash)

    def test_csrf_is_required_on_mutating_authenticated_endpoints(self):
        csrf, _, _ = self._signup()

        no_csrf = self.client.post("/api/current-month/reset")
        self.assertEqual(no_csrf.status_code, 403)

        ok = self.client.post("/api/current-month/reset", headers={"X-CSRF-Token": csrf})
        self.assertEqual(ok.status_code, 200)

    def test_upload_rejects_unsupported_file_type(self):
        csrf, _, _ = self._signup()
        res = self.client.post(
            "/api/upload",
            data={
                "files": (io.BytesIO(b"not,a,statement"), "bad.txt"),
                "tag": "3",
                "year": "2026",
            },
            headers={"X-CSRF-Token": csrf},
            content_type="multipart/form-data",
        )
        self.assertEqual(res.status_code, 400)
        payload = res.get_json() or {}
        self.assertFalse(payload.get("ok"))
        self.assertTrue(payload.get("files"))

    def test_login_rate_limit_blocks_excess_attempts(self):
        _, user, password = self._signup(user="ratelimit_user", password="ratelimit_pw")
        original_rule = app_module.RATE_LIMIT_RULES.get("/api/login")
        try:
            app_module.RATE_LIMIT_RULES["/api/login"] = (1, 3600)
            app_module._rate_buckets.clear()
            first = self.client.post("/api/login", json={"user": user, "password": password})
            self.assertEqual(first.status_code, 200)
            second = self.client.post("/api/login", json={"user": user, "password": password})
            self.assertEqual(second.status_code, 429)
        finally:
            if original_rule is None:
                app_module.RATE_LIMIT_RULES.pop("/api/login", None)
            else:
                app_module.RATE_LIMIT_RULES["/api/login"] = original_rule
            app_module._rate_buckets.clear()

    def test_export_and_delete_account(self):
        csrf, user, password = self._signup(user="delete_me", password="delete_pw")

        export_res = self.client.get("/api/export")
        self.assertEqual(export_res.status_code, 200)
        export_payload = json.loads(export_res.data.decode("utf-8"))
        self.assertEqual(export_payload.get("user"), user)
        self.assertIn("past_data", export_payload)

        delete_res = self.client.post(
            "/api/account/delete",
            json={"password": password},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(delete_res.status_code, 200)

        login_after_delete = self.client.post("/api/login", json={"user": user, "password": password})
        self.assertEqual(login_after_delete.status_code, 404)


if __name__ == "__main__":
    unittest.main()
