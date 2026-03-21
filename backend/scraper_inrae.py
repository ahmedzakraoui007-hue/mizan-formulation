"""
scraper_inrae.py — Selenium scraper for feedtables.com
Dynamically extracts ALL available nutrients per ingredient with species context.
Supports auto-resume checkpointing via inrae_scraped_data_full.json.

─── Install dependencies (run once) ──────────────────────────────────────────
    pip install selenium webdriver-manager beautifulsoup4 lxml

─── Run ──────────────────────────────────────────────────────────────────────
    python scraper_inrae.py

Output: backend/inrae_scraped_data_full.json
"""

import json
import os
import time
import sys

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

TARGET_URL = "https://www.feedtables.com/content/table-feed-profile"
OUTPUT_FILE = "inrae_scraped_data_full.json"

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


def parse_float(raw: str) -> float:
    """Safely parse a raw cell string into a float. Returns 0.0 on failure."""
    cleaned = raw.replace(",", ".").replace("\u2013", "").replace("\u2014", "").strip()
    if not cleaned or cleaned.upper() in ("-", "N/A", "ND", "NA"):
        return 0.0
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def parse_nutrient_table(page_source: str) -> dict[str, float]:
    """
    Dynamically extract ALL nutrient rows from the page.
    Tracks species context (Poultry / Pig / Ruminant) from section headers
    embedded either as <h2>/<h3>/<h4> tags or as single-cell <tr> rows.
    Keys are built as: "<raw param name> <context suffix>" where suffix is
    one of ' Volaille', ' Porc', ' Ruminant', or '' (general).
    """
    soup = BeautifulSoup(page_source, "lxml")
    nutrients: dict[str, float] = {}
    current_context = ""

    def detect_context(text: str) -> str | None:
        t = text.lower()
        if "poultry" in t or "volaille" in t:
            return "Volaille"
        if "pig" in t or "swine" in t or "porc" in t:
            return "Porc"
        if "ruminant" in t or "cattle" in t or "cow" in t or "sheep" in t:
            return "Ruminant"
        if "chemical composition" in t or "mineral" in t or "composition" in t:
            return ""   # reset to general
        return None  # no change

    # Walk all headings AND tables in document order
    for el in soup.find_all(["h2", "h3", "h4", "table"]):
        if el.name in ("h2", "h3", "h4"):
            ctx = detect_context(el.get_text(strip=True))
            if ctx is not None:
                current_context = ctx
            continue

        # It's a table
        rows = el.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])

            # Single-cell row often acts as a section header inside the table
            if len(cells) == 1:
                ctx = detect_context(cells[0].get_text(strip=True))
                if ctx is not None:
                    current_context = ctx
                continue

            if len(cells) < 2:
                continue

            param_raw = cells[0].get_text(strip=True)

            # Skip empty or pure header rows
            if not param_raw or param_raw.lower() in ("parameter", "nutrient", "item", ""):
                continue

            # Find the best value: 'As fed' (1), 'Other' (4), or 'On DM' (2)
            val = 0.0
            for col_idx in [1, 4, 2]:
                if len(cells) > col_idx:
                    raw_val_str = cells[col_idx].get_text(strip=True)
                    if raw_val_str not in ("", "-"):
                        parsed = parse_float(raw_val_str)
                        if parsed != 0.0 or "0" in raw_val_str:
                            val = parsed
                            break
                            
            # Extract unit from column 3 or 5
            unit = ""
            for col_idx in [3, 5]:
                if len(cells) > col_idx:
                    raw_unit = cells[col_idx].get_text(strip=True)
                    if raw_unit not in ("", "-"):
                        unit = raw_unit
                        break

            # Build the namespaced key
            base_key = f"{param_raw} ({unit})" if unit else param_raw
            key = f"{base_key} {current_context}".strip() if current_context else base_key
            nutrients[key] = val

    return nutrients


def load_checkpoint(output_path: str) -> tuple[list[dict], set[str]]:
    """Load existing results from disk and return (results_list, scraped_names_set)."""
    if os.path.exists(output_path):
        try:
            with open(output_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            names = {item["name"] for item in data}
            print(f"[RESUME] Loaded {len(data)} existing record(s) from {output_path}.\n")
            return data, names
        except Exception as e:
            print(f"[WARN] Could not load checkpoint ({e}). Starting fresh.\n")
    return [], set()


def save_checkpoint(output_path: str, data: list[dict]) -> None:
    """Persist the current results list to disk immediately after each ingredient."""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def scrape(max_items: int | None = MAX_INGREDIENTS) -> list[dict]:
    # ── Auto-resume ─────────────────────────────────────────────────────────
    results, already_scraped = load_checkpoint(OUTPUT_FILE)

    driver = build_driver()
    try:
        print(f"Opening {TARGET_URL} ...")
        driver.get(TARGET_URL)

        wait = WebDriverWait(driver, 20)
        select_el = wait.until(EC.presence_of_element_located((By.ID, "edit-feed-pr-id")))
        dropdown = Select(select_el)

        # Extract all (value, label) pairs as plain strings BEFORE the iteration loop
        # so stale DOM references never cause crashes mid-run.
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
            # ── Auto-resume skip ─────────────────────────────────────────────
            if name in already_scraped:
                print(f"[{idx}/{len(option_pairs)}] Skipping (already done): {name!r}")
                continue

            print(f"[{idx}/{len(option_pairs)}] Scraping: {name!r}")

            try:
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
                print(f"           No nutrients found — skipping {name!r}.\n")
                continue

            # Use the scraped Dry matter value (key may vary) or default
            dm_value = (
                nutrients.get("Dry matter")
                or nutrients.get("Dry matter Volaille")
                or nutrients.get("MS %")
                or 88.0
            )

            record = {
                "name":                name,
                "cost":                1.0,
                "transport_cost":      0.05,
                "dm":                  dm_value,
                "inventory_limit_tons": 50.0,
                "nutrients":           nutrients,
            }
            results.append(record)
            already_scraped.add(name)

            # ── Immediate checkpoint save ─────────────────────────────────────
            save_checkpoint(OUTPUT_FILE, results)

            print(f"           OK: extracted {len(nutrients)} nutrient(s).\n")

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

    print("=" * 60)
    print(f"Done. {len(data)} record(s) saved to {OUTPUT_FILE}")
    print("=" * 60)

    if data:
        print("\nPreview (first record):")
        preview = data[0].copy()
        preview["nutrients"] = dict(list(preview["nutrients"].items())[:10])
        print(json.dumps(preview, ensure_ascii=False, indent=4))
        print(f"  ... and {len(data[0]['nutrients']) - 10} more nutrient keys.")


if __name__ == "__main__":
    main()
