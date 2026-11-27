import importlib.util
import pathlib
import tempfile
import unittest
from unittest.mock import patch

path = pathlib.Path(__file__).resolve().parents[1] / "ops" / "backup" / "alert.py"
spec = importlib.util.spec_from_file_location("backup_alert", path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class AlertTest(unittest.TestCase):
    def test_sends_only_fixed_alert_with_configured_provider(self):
        with tempfile.TemporaryDirectory() as directory:
            config = pathlib.Path(directory) / "app.env"
            config.write_text(
                "RESEND_API_KEY=test-only\nEMAIL_FROM=sender@example.test\n"
                "ADMIN_EMAIL=owner@example.test\n",
                encoding="utf-8",
            )
            module.CONFIG = config
            with patch.object(module.urllib.request, "urlopen") as send:
                send.return_value.__enter__.return_value.status = 200
                module.main()
                request = send.call_args.args[0]
                self.assertEqual(request.full_url, "https://api.resend.com/emails")
                self.assertNotIn("customer", request.data.decode())

    def test_missing_configuration_fails_without_network(self):
        with tempfile.TemporaryDirectory() as directory:
            config = pathlib.Path(directory) / "app.env"
            config.write_text("EMAIL_FROM=sender@example.test\n", encoding="utf-8")
            module.CONFIG = config
            with patch.object(module.urllib.request, "urlopen") as send:
                with self.assertRaisesRegex(ValueError, "BACKUP_ALERT_NOT_CONFIGURED"):
                    module.main()
                send.assert_not_called()


if __name__ == "__main__":
    unittest.main()
