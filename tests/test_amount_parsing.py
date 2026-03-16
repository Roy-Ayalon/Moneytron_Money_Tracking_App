import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER_DIR = ROOT / "server"
if str(SERVER_DIR) not in sys.path:
    sys.path.insert(0, str(SERVER_DIR))

from utils import parse_amount, numify


class AmountParsingTests(unittest.TestCase):
    def test_parse_amount_thousands_and_decimals(self):
        self.assertAlmostEqual(parse_amount("1,234.56"), 1234.56)
        self.assertAlmostEqual(parse_amount("12,345"), 12345.0)
        self.assertAlmostEqual(parse_amount("3,000.00"), 3000.0)

    def test_parse_amount_negatives(self):
        self.assertAlmostEqual(parse_amount("-1,234.56"), -1234.56)
        self.assertAlmostEqual(parse_amount("(1,234.56)"), -1234.56)
        self.assertAlmostEqual(parse_amount("3,000.00-"), -3000.0)

    def test_parse_amount_localized(self):
        self.assertAlmostEqual(parse_amount("1.234,56"), 1234.56)
        self.assertAlmostEqual(parse_amount("₪ 12,345"), 12345.0)

    def test_numify_matches_parse_rules(self):
        self.assertAlmostEqual(numify("1,234.56"), 1234.56)
        self.assertAlmostEqual(numify("12,345"), 12345.0)
        self.assertAlmostEqual(numify("1.234,56"), 1234.56)
        self.assertAlmostEqual(numify("-3,000.00"), -3000.0)


if __name__ == "__main__":
    unittest.main()
