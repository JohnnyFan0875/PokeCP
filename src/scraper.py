"""
scraper.py

Scrapes Pokémon GO base stats from Bulbapedia and saves to CSV.
Skips scraping if today's file already exists (date-stamped cache).
"""
import datetime
import os
from io import StringIO

import pandas as pd
import requests

from config import BASESTAT_CSV


URL = (
    'https://bulbapedia.bulbagarden.net/wiki/'
    'List_of_Pok%C3%A9mon_by_base_stats_in_Pok%C3%A9mon_GO'
)

# Bulbapedia (behind Cloudflare) rejects the default python-requests User-Agent.
# A descriptive UA with contact info follows Wikimedia's bot policy.
HEADERS = {
    'User-Agent': 'PokeCP/1.0 (personal project; contact: your-email@example.com)',
    'Accept': 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
}


# Name cleaning: map known Unicode escape sequences from mis-encoded scrapes
# and normalise variant names
_NAME_REPLACEMENTS = {
    'Ã©': 'é',
    'â™€': '♀',
    'â™‚': '♂',
    '♀': ' Female',
    '♂': ' Male',
    ' Forme': ' Form',
    ' From': ' Form',
    'é': 'e',
}


def _clean_name(name: str) -> str:
    for src, dst in _NAME_REPLACEMENTS.items():
        name = name.replace(src, dst)
    # Remove commas (e.g. "Mr. Mime, Galarian")
    name = name.replace(',', '')
    return name.strip()


def _flatten_col(col) -> str:
    """Flatten a column label, dropping the repeated header parts Bulbapedia produces.
    ('HP', 'HP') -> 'HP'; ('Pokémon', 'Pokémon.1') -> 'Pokémon Pokémon.1'
    """
    if not isinstance(col, tuple):
        return str(col).strip()
    parts = []
    for p in map(str, col):
        if p.startswith('Unnamed') or (parts and p == parts[-1]):
            continue
        parts.append(p)
    return ' '.join(parts).strip()


def scrape_base_stats() -> pd.DataFrame:
    """
    Fetches base stats from Bulbapedia for Pokémon GO.
    Returns a DataFrame with columns: Pokemon, Attack, Defense, HP.
    Result is cached as a date-stamped CSV to avoid repeated scraping.
    """
    today = datetime.datetime.now().strftime("%Y%m%d")
    cache_path = BASESTAT_CSV.format(date=today)

    # Return cached version if available
    if os.path.exists(cache_path):
        print(f"[INFO] Using cached base stats: {cache_path}")
        return pd.read_csv(cache_path)

    print("[INFO] Scraping base stats from Bulbapedia…")

    try:
        response = requests.get(URL, headers=HEADERS, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        raise RuntimeError(f"Failed to fetch Bulbapedia: {e}") from e

    # Use explicit encoding to avoid garbled characters
    response.encoding = 'utf-8'
    tables = pd.read_html(StringIO(response.text))

    if not tables:
        raise ValueError("No tables found on Bulbapedia page.")

    df = tables[0]

    # Flatten column labels (handles MultiIndex and repeated header text)
    df.columns = [_flatten_col(c) for c in df.columns]

    # Find the columns we care about
    col_map = {}
    for col in df.columns:
        col_lower = col.lower()
        if col_lower.startswith(('pokémon', 'pokemon')) and col_lower.endswith('.1'):
            col_map.setdefault('name', col)
        elif col_lower == 'attack':
            col_map['Attack'] = col
        elif col_lower == 'defense':
            col_map['Defense'] = col
        elif col_lower == 'hp':
            col_map['HP'] = col

    missing = [k for k in ('Attack', 'Defense', 'HP') if k not in col_map]
    if missing or 'name' not in col_map:
        raise ValueError(f"Could not find required columns. Found: {df.columns.tolist()}")

    df = df[[col_map['name'], col_map['Attack'], col_map['Defense'], col_map['HP']]].copy()
    df.columns = ['Pokemon', 'Attack', 'Defense', 'HP']

    # Clean Pokémon names
    df['Pokemon'] = df['Pokemon'].astype(str).apply(_clean_name)

    # Drop rows where name looks like a header or is blank.
    # Compare against 'pokemon' (not 'pokémon') because _clean_name has already
    # converted the accented 'é' to 'e' by this point.
    df = df[df['Pokemon'].notna() & (df['Pokemon'] != '') & (df['Pokemon'] != 'nan')]
    df = df[df['Pokemon'].str.lower() != 'pokemon']

    # Ensure numeric columns
    for col in ('Attack', 'Defense', 'HP'):
        df[col] = pd.to_numeric(df[col], errors='coerce')
    df.dropna(subset=['Attack', 'Defense', 'HP'], inplace=True)
    df[['Attack', 'Defense', 'HP']] = df[['Attack', 'Defense', 'HP']].astype(int)

    df.reset_index(drop=True, inplace=True)

    os.makedirs(os.path.dirname(cache_path) or '.', exist_ok=True)
    df.to_csv(cache_path, index=False, encoding='utf-8')
    print(f"[INFO] Saved {len(df)} Pokémon to {cache_path}")

    return df


if __name__ == '__main__':
    df = scrape_base_stats()
    print(df.head(10))