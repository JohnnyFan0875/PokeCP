"""
config.py

Central path configuration for the Pokémon GO CP Calculator.
All file paths are defined here so they're easy to change in one place.
"""
import os

# ─── Data directory ────────────────────────────────────────────────────────────
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

# ─── Input files ───────────────────────────────────────────────────────────────

# Date-stamped base stats cache (regenerated daily by scraper.py)
BASESTAT_CSV = os.path.join(DATA_DIR, 'base_stat_{date}.csv')

# Evolution chains — each line is a comma-separated evolution path
# e.g. "Caterpie,Metapod,Butterfree"
EVOLUTION_CSV = os.path.join(DATA_DIR, 'evolution.csv')

# CPM (CP Multiplier) table — two columns: level, multiplier
# e.g. "1,0.094" ... "50,0.84029999"
MULTIPLIER_CSV = os.path.join(DATA_DIR, 'multiplyer.csv')

# Per-CP collected status — two columns: pokemon_name, YES|NO
# File is named by CP target value (e.g. cp520_collected.csv)
COLLECTED_CSV = os.path.join(DATA_DIR, 'cp{cp}_collected.csv')

# ─── Output files ──────────────────────────────────────────────────────────────

# Root output directory per CP value
OUTPUT_CP_DIR = os.path.join(os.path.dirname(__file__), '..', 'output', 'cp{cp}')

# Sub-folder holding per-Pokémon IV files
OUTPUT_CP_IV_FOLDER = os.path.join(OUTPUT_CP_DIR, 'pokemon_iv')

# Master evolution + IV combined CSV (loaded by index.html)
OUTPUT_ALL_FILE = os.path.join(OUTPUT_CP_DIR, 'cp{cp}_all_evolutions.csv')

# Shadow and purified information
OUTPUT_SHADOW_PURIFIED_FILE = os.path.join(OUTPUT_CP_DIR, 'cp{cp}_shadow_purified_evolutions.csv')
