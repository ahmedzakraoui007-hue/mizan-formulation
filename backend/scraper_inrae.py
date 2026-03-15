"""
scraper_inrae.py — Selenium scraper for feedtables.com
Extracts nutritional profiles and maps them to the Mizan species-aware JSON schema.

─── Install dependencies (run once) ──────────────────────────────────────────
    pip install selenium webdriver-manager beautifulsoup4 lxml

─── Run ──────────────────────────────────────────────────────────────────────
    python scraper_inrae.py

Output: backend/inrae_scraped_data.json
"""

import json
import time
import sys
import io

# Force UTF-8 output so emoji in print() don't crash on Windows cp1252 terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import Select, WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager
from bs4 import BeautifulSoup

# ══════════════════════════════════════════════════════════════════════════════
#  MAPPING  —  feedtables.com English parameter name  →  (Mizan French key, divisor)
#  divisor = 10  →  g/kg value converted to  %   (divide by 10)
#  divisor = 1   →  value kept as-is (already in correct unit)
# ══════════════════════════════════════════════════════════════════════════════
COLUMN_MAP: dict[str, tuple[str, float]] = {
    # ── Base nutrients ────────────────────────────────────────────────────────
    "Dry matter":                                  ("MS %",                          1),
    "Crude protein":                               ("Protéine %",                    1),
    "Crude fibre":                                 ("Fibre %",                       1),
    "Calcium":                                     ("Calcium %",                     10),
    "Phosphorus":                                  ("Phosphore %",                   10),
    # ── 🐔 Volaille ───────────────────────────────────────────────────────────
    "AMEn broiler":                                ("Énergie Volaille KCal/Kg",      1),
    "Lysine, ileal standardized, poultry":         ("Lysine Dig. Volaille %",        10),
    "Methionine, ileal standardized, poultry":     ("Méthionine Dig. Volaille %",    10),
    # ── 🐷 Porc ───────────────────────────────────────────────────────────────
    "NE pigs":                                     ("Énergie Porc KCal/Kg",          1),
    "Lysine, ileal standardised, pig":             ("Lysine Dig. Porc %",            10),
    # ── 🐄 Ruminant ───────────────────────────────────────────────────────────
    "UFL INRA 2018":                               ("Énergie Ruminant UFL",          1),
    "PDIA INRA 2018":                              ("PDIA Ruminant g/kg",            1),
}

TARGET_URL = "https://www.feedtables.com/content/table-feed-profile"

# Number of dropdown options to process (set to None to process all)
MAX_INGREDIENTS = None


def build_driver() -> webdriver.Chrome:
    """Launch a headless Chrome browser."""
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument(
        "user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
    )

    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    return driver


def parse_nutrient_table(page_source: str) -> dict[str, float]:
    """
    Parse the rendered page source and extract parameter → value pairs.
    Only rows whose Parameter Name (col 0) exists in COLUMN_MAP are kept.
    Returns a dict of Mizan-schema French keys → numeric values.
    """
    soup = BeautifulSoup(page_source, "lxml")
    nutrients: dict[str, float] = {}

    # feedtables.com wraps results in a <table> somewhere in the main content
    tables = soup.find_all("table")
    if not tables:
        print("     ⚠️  No <table> found in page source — skipping.")
        return nutrients

    for table in tables:
        rows = table.find_all("tr")
        for row in rows:
            cols = row.find_all(["td", "th"])
            if len(cols) < 2:
                continue

            param_raw = cols[0].get_text(strip=True)
            value_raw = cols[1].get_text(strip=True)

            if param_raw not in COLUMN_MAP:
                continue

            # Parse numeric value — handle em-dashes, commas, and empty strings
            value_clean = value_raw.replace(",", ".").replace("–", "").replace("—", "").strip()
            if not value_clean or value_clean in ("-", "n/a", "N/A"):
                continue

            try:
                numeric = float(value_clean)
            except ValueError:
                continue

            mizan_key, divisor = COLUMN_MAP[param_raw]
            nutrients[mizan_key] = round(numeric / divisor, 4)

    return nutrients


def scrape(max_items: int | None = MAX_INGREDIENTS) -> list[dict]:
    driver = build_driver()
    results: list[dict] = []

    try:
        print(f"Opening {TARGET_URL} ...")
        driver.get(TARGET_URL)

        # Wait for the dropdown to be present — target by its known id
        wait = WebDriverWait(driver, 20)
        select_el = wait.until(EC.presence_of_element_located((By.ID, "edit-feed-pr-id")))

        dropdown = Select(select_el)

        # ── Extract (value, name) as plain strings BEFORE the loop ──────────────
        # This is critical: after the first select_by_value() the DOM refreshes
        # via AJAX and all WebElement references become stale immediately.
        option_pairs: list[tuple[str, str]] = [
            (opt.get_attribute("value"), opt.text.strip())
            for opt in dropdown.options
            if opt.get_attribute("value") not in ("All", "", "0", None)
            and opt.text.strip() not in ("- Any -", "")
        ]

        if max_items is not None:
            option_pairs = option_pairs[:max_items]

        print(f"Found {len(option_pairs)} option(s) to process.\n")

        for idx, (value, name) in enumerate(option_pairs, start=1):
            print(f"[{idx}/{len(option_pairs)}] Scraping: {name!r}")

            try:
                # Re-locate the ingredient dropdown each iteration (DOM refreshes on each select)
                select_el = WebDriverWait(driver, 10).until(
                    EC.presence_of_element_located((By.ID, "edit-feed-pr-id"))
                )
                dropdown = Select(select_el)
                dropdown.select_by_value(value)
            except Exception as e:
                print(f"           Could not select {name!r}: {e} — skipping.\n")
                continue

            # Wait for AJAX table to render
            time.sleep(3)

            nutrients = parse_nutrient_table(driver.page_source)

            if not nutrients:
                print(f"           No mapped nutrients found — skipping {name!r}.\n")
                continue

            record = {
                "name":           name,
                "cost":           1.0,    # placeholder — update in /ingredients
                "transport_cost": 0.05,   # placeholder
                "dm":             nutrients.get("MS %", 88.0),
                "inventory_limit_tons": 50.0,
                "nutrients":      nutrients,
            }
            results.append(record)

            print(f"           OK: extracted {len(nutrients)} nutrient(s): {list(nutrients.keys())}\n")

    except Exception as exc:
        print(f"\nScraper error: {exc}", file=sys.stderr)
        raise
    finally:
        driver.quit()

    return results


def main():
    print("=" * 60)
    print("  Mizan Formulation — FeedTables.com INRAE Scraper")
    print("=" * 60 + "\n")

    data = scrape(max_items=MAX_INGREDIENTS)

    output_path = "inrae_scraped_data.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)

    print("=" * 60)
    print(f"💾 Saved {len(data)} record(s) → {output_path}")
    print("=" * 60)

    if data:
        print("\nPreview (first record):")
        print(json.dumps(data[0], ensure_ascii=False, indent=4))


if __name__ == "__main__":
    main()
