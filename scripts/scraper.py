"""
scraper.py

Scrapes Pokémon GO base stats from Bulbapedia and saves to CSV.
Skips scraping if today's file already exists (date-stamped cache).
"""
import sys
print(sys.executable)
import datetime
import os
import re
from io import StringIO

import pandas as pd
import requests

from config import BASESTAT_CSV


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
    'é': 'e'
}

def _clean_name(name: str) -> str:
    for src, dst in _NAME_REPLACEMENTS.items():
        name = name.replace(src, dst)
    # Remove commas (e.g. "Mr. Mime, Galarian")
    name = name.replace(',', '')
    return name.strip()


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

    url = 'https://bulbapedia.bulbagarden.net/wiki/List_of_Pok%C3%A9mon_by_base_stats_(GO)'
    print(f"[INFO] Scraping base stats from Bulbapedia…")

    try:
        response = requests.get(url, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        raise RuntimeError(f"Failed to fetch Bulbapedia: {e}") from e

    # Use explicit encoding to avoid garbled characters
    response.encoding = 'utf-8'
    tables = pd.read_html(StringIO(response.text))

    if not tables:
        raise ValueError("No tables found on Bulbapedia page.")

    df = tables[0]

    # Flatten MultiIndex columns if present
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [' '.join(str(c) for c in col).strip() for col in df.columns]

    # Find the columns we care about (case-insensitive, partial match)
    col_map = {}
    for col in df.columns:
        col_lower = col.lower()
        if 'pokémon.1' in col_lower or 'pokemon.1' in col_lower:
            if 'name' not in col_map:
                col_map['name'] = col
        elif col_lower.strip() == 'attack':
            col_map['Attack'] = col
        elif col_lower.strip() == 'defense':
            col_map['Defense'] = col
        elif col_lower.strip() == 'hp':
            col_map['HP'] = col

    missing = [k for k in ('Attack', 'Defense', 'HP') if k not in col_map]
    if missing or 'name' not in col_map:
        raise ValueError(f"Could not find required columns. Found: {df.columns.tolist()}")

    df = df[[col_map['name'], col_map['Attack'], col_map['Defense'], col_map['HP']]].copy()
    df.columns = ['Pokemon', 'Attack', 'Defense', 'HP']

    # Clean Pokémon names
    df['Pokemon'] = df['Pokemon'].astype(str).apply(_clean_name)

    # Drop rows where name looks like a header or is blank
    df = df[df['Pokemon'].notna() & (df['Pokemon'] != '') & (df['Pokemon'] != 'nan')]
    df = df[df['Pokemon'].str.lower() != 'pokémon']

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
