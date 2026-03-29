import io
import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER_DIR = ROOT / "server"
APP_PATH = SERVER_DIR / "app.py"

if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

spec = importlib.util.spec_from_file_location("moneytron_server_app", APP_PATH)
app_module = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(app_module)


class UploadAmountFlowTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        app_module.USERS_DIR = Path(self.tmp.name).resolve()
        app_module.USERS_DIR.mkdir(parents=True, exist_ok=True)
        self.client = app_module.app.test_client()

        res = self.client.post(
            "/api/signup",
            json={
                "user": "test_import_user",
                "password": "test_password",
                "email": "test@example.com",
            },
        )
        self.assertEqual(res.status_code, 200)
        signup_payload = res.get_json() or {}
        self.csrf = signup_payload.get("csrfToken", "")

    def tearDown(self):
        self.tmp.cleanup()

    def test_upload_parses_thousands_and_preserves_ui_values(self):
        csv_text = (
            "Date,Description,Amount,Debit\n"
            '2026-03-01,Store A,"1,234.56","1,234.56"\n'
            '2026-03-02,Store B,"12,345","12,345"\n'
            '2026-03-03,Store C,"3,000.00","3,000.00"\n'
            '2026-03-04,Store D,"-1,234.56","-1,234.56"\n'
            '2026-03-05,Store E,"1.234,56","1.234,56"\n'
        )

        res = self.client.post(
            "/api/upload",
            data={
                "file": (io.BytesIO(csv_text.encode("utf-8")), "sample.csv"),
                "tag": "3",
                "year": "2026",
            },
            headers={"X-CSRF-Token": self.csrf},
            content_type="multipart/form-data",
        )

        self.assertEqual(res.status_code, 200)
        payload = res.get_json()
        self.assertTrue(payload.get("ok"))

        txs = payload.get("transactions", [])
        self.assertEqual(len(txs), 5)

        by_name = {t.get("name"): t for t in txs}

        self.assertAlmostEqual(by_name["Store A"]["amount"], 1234.56)
        self.assertAlmostEqual(by_name["Store A"]["debit"], 1234.56)

        self.assertAlmostEqual(by_name["Store B"]["amount"], 12345.0)
        self.assertAlmostEqual(by_name["Store B"]["debit"], 12345.0)

        self.assertAlmostEqual(by_name["Store C"]["amount"], 3000.0)
        self.assertAlmostEqual(by_name["Store C"]["debit"], 3000.0)

        self.assertAlmostEqual(by_name["Store D"]["amount"], 1234.56)
        self.assertAlmostEqual(by_name["Store D"]["debit"], 1234.56)
        self.assertEqual(by_name["Store D"]["type"], "Income")

        self.assertAlmostEqual(by_name["Store E"]["amount"], 1234.56)
        self.assertAlmostEqual(by_name["Store E"]["debit"], 1234.56)

    def test_upload_accepts_multi_file_batch(self):
        csv_a = "Date,Description,Amount,Debit\n2026-03-01,Store A,10,10\n"
        csv_b = "Date,Description,Amount,Debit\n2026-03-02,Store B,20,20\n"
        res = self.client.post(
            "/api/upload",
            data={
                "files": [
                    (io.BytesIO(csv_a.encode("utf-8")), "a.csv"),
                    (io.BytesIO(csv_b.encode("utf-8")), "b.csv"),
                ],
                "tag": "3",
                "year": "2026",
            },
            headers={"X-CSRF-Token": self.csrf},
            content_type="multipart/form-data",
        )
        self.assertEqual(res.status_code, 200)
        payload = res.get_json() or {}
        self.assertTrue(payload.get("ok"))
        self.assertEqual(payload.get("count"), 2)
        self.assertEqual(len(payload.get("files", [])), 2)


if __name__ == "__main__":
    unittest.main()
