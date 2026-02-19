"""
calculate_cp.py

Calculates evolution CP tables for Pokémon GO.
Supports --shadow flag to also compute purified (+2 IV each) results.

Usage:
    python calculate_cp.py --cp 520
    python calculate_cp.py --cp 520 --shadow
"""
import os
import sys
import csv
import math
import argparse
import itertools
import datetime
import pandas as pd

from config import (
    BASESTAT_CSV, EVOLUTION_CSV, MULTIPLIER_CSV,
    COLLECTED_CSV, OUTPUT_CP_IV_FOLDER, OUTPUT_ALL_FILE,
)


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="Pokémon GO CP Calculator")
    parser.add_argument('--cp', type=int, required=True, help='Target CP value')
    parser.add_argument('--shadow', action='store_true',
                        help='Also output Shadow→Purified (+2 IV) eligible rows')
    return parser.parse_args()


# ─── Data loading ─────────────────────────────────────────────────────────────

def load_base_stats() -> pd.DataFrame:
    today = datetime.datetime.now().strftime("%Y%m%d")
    path = BASESTAT_CSV.format(date=today)
    if not os.path.exists(path):
        sys.exit(f"[ERROR] Base stats CSV not found at '{path}'. Run scraper.py first.")
    print(f"[INFO] Loading base stats from {path}")
    return pd.read_csv(path)


def load_multipliers() -> dict:
    """Returns {level_str: float} e.g. {'1': 0.094, '1.5': 0.1351374, ...}"""
    with open(MULTIPLIER_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        return {row[0]: float(row[1]) for row in reader if len(row) >= 2}


def load_evolution_chains() -> dict:
    """
    Returns a dict: {pokemon_name: [[evo_chain_list], ...]}
    Each Pokémon maps to one or more evolution paths it belongs to.
    """
    chains: dict[str, list] = {}
    with open(EVOLUTION_CSV, 'r', encoding='utf-8') as f:
        for line in f:
            chain = [x.strip() for x in line.strip().split(',') if x.strip()]
            if not chain:
                continue
            for name in chain:
                if name not in chains:
                    chains[name] = []
                chains[name].append(chain)
    return chains


def load_collected(cp_val: int) -> dict:
    """Returns {pokemon_name: 'YES'|'NO'}"""
    path = COLLECTED_CSV.format(cp=cp_val)
    if not os.path.exists(path):
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        return {row[0].strip(): row[1].strip().upper() for row in reader if len(row) >= 2}


# ─── Data consistency check ───────────────────────────────────────────────────

def check_consistency(df_stat: pd.DataFrame, cp_val: int) -> dict:
    """Warns about mismatches between base stats, evolution, and collected CSVs."""
    print("[INFO] Checking data consistency...")
    chains = load_evolution_chains()
    collected = load_collected(cp_val)
    stat_names = set(df_stat['Pokemon'].tolist())
    evo_names = set(chains.keys())
    collected_names = set(collected.keys())

    issues = []
    for name in stat_names - evo_names:
        issues.append(f"  '{name}' in base_stats but missing from evolution.csv")
    for name in evo_names - stat_names:
        issues.append(f"  '{name}' in evolution.csv but missing from base_stats")
    for name in collected_names - stat_names:
        issues.append(f"  '{name}' in collected.csv but missing from base_stats")
    for name in stat_names - collected_names:
        issues.append(f"  '{name}' in base_stats but missing from collected.csv")

    if issues:
        print("[WARN] Data inconsistencies found:")
        for msg in issues:
            print(msg)
        # Don't exit — warn only, let user decide
    else:
        print("[INFO] Data consistency OK.")

    return chains


# ─── CP formula ───────────────────────────────────────────────────────────────

def calc_cp(base_atk: int, base_def: int, base_hp: int,
            iv_atk: int, iv_def: int, iv_hp: int,
            cpm: float) -> int:
    cp = (base_atk + iv_atk) * math.sqrt(base_def + iv_def) * math.sqrt(base_hp + iv_hp) * cpm ** 2 / 10
    return int(cp)


def purified_ivs(iv_atk: int, iv_def: int, iv_hp: int) -> tuple:
    """Shadow → Purified: each IV +2, capped at 15."""
    return min(iv_atk + 2, 15), min(iv_def + 2, 15), min(iv_hp + 2, 15)


# ─── Per-Pokémon CP/IV file ───────────────────────────────────────────────────

def create_cp_iv_file(name: str, base_atk: int, base_def: int, base_hp: int,
                      multipliers: dict, cp_val: int, output_folder: str):
    """Creates a CSV of all (level, IV combo) that produce exactly cp_val for this Pokémon."""
    path = os.path.join(output_folder, f"cp{cp_val}_{name}.csv")
    if os.path.exists(path):
        return  # Already computed

    rows = []
    iv_range = range(16)
    for iv_a, iv_d, iv_h, (level, cpm) in itertools.product(
        iv_range, iv_range, iv_range, multipliers.items()
    ):
        if calc_cp(base_atk, base_def, base_hp, iv_a, iv_d, iv_h, float(cpm)) == cp_val:
            rows.append([name, f"LV{level}", iv_a, iv_d, iv_h, cp_val])

    with open(path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Name', 'Level', 'IV_Attack', 'IV_Defense', 'IV_HP', 'CP'])
        writer.writerows(rows)

    print(f"[INFO] Created: {path} ({len(rows)} rows)")


def create_all_cp_iv_files(df_stat: pd.DataFrame, multipliers: dict, cp_val: int):
    folder = OUTPUT_CP_IV_FOLDER.format(cp=cp_val)
    os.makedirs(folder, exist_ok=True)
    for _, row in df_stat.iterrows():
        create_cp_iv_file(
            row['Pokemon'], int(row['Attack']), int(row['Defense']), int(row['HP']),
            multipliers, cp_val, folder
        )


# ─── Master evolution CSV ─────────────────────────────────────────────────────

def create_evolution_csv(df_stat: pd.DataFrame, evo_chains: dict,
                         multipliers: dict, cp_val: int, include_shadow: bool):
    """
    Builds the master CSV combining all Pokémon IV data with their evolution chains.
    If include_shadow=True, adds a Shadow_Purified_Eligible column.
    """
    collected = load_collected(cp_val)
    stat_lookup = {row['Pokemon']: row for _, row in df_stat.iterrows()}
    iv_folder = OUTPUT_CP_IV_FOLDER.format(cp=cp_val)
    output_path = OUTPUT_ALL_FILE.format(cp=cp_val)

    print(f"[INFO] Building evolution CSV → {output_path}")

    headers = ['Pokemon', 'CP', 'Level', 'IV_Attack', 'IV_Defense', 'IV_HP',
               'Evolution(CP)', 'Collected']
    if include_shadow:
        headers.append('Shadow_Purified_Eligible')

    seen_rows = set()  # Deduplicate (pokemon, level, iv_a, iv_d, iv_h, evo_chain)

    with open(output_path, 'w', encoding='utf-8', newline='') as f_out:
        writer = csv.writer(f_out)
        writer.writerow(headers)

        for poke_name in df_stat['Pokemon']:
            iv_file = os.path.join(iv_folder, f"cp{cp_val}_{poke_name}.csv")
            if not os.path.exists(iv_file):
                continue

            with open(iv_file, 'r', encoding='utf-8') as f:
                iv_rows = list(csv.DictReader(f))

            chains = evo_chains.get(poke_name, [[poke_name]])

            for iv_row in iv_rows:
                level    = iv_row['Level']
                iv_a     = int(iv_row['IV_Attack'])
                iv_d     = int(iv_row['IV_Defense'])
                iv_h     = int(iv_row['IV_HP'])
                cp_int   = int(iv_row['CP'])
                cpm      = float(multipliers[level.replace('LV', '')])
                coll_val = collected.get(poke_name, 'NO').upper()

                # Shadow eligible: shadow IVs (each -2) must be >= 0
                shadow_eligible = 'YES' if (iv_a >= 2 and iv_d >= 2 and iv_h >= 2) else 'NO'

                for chain in chains:
                    evo_parts = []
                    for evo_name in chain:
                        if evo_name not in stat_lookup:
                            continue
                        er = stat_lookup[evo_name]
                        evo_cp = calc_cp(int(er['Attack']), int(er['Defense']), int(er['HP']),
                                         iv_a, iv_d, iv_h, cpm)
                        evo_parts.append(f"{evo_name}({evo_cp})")

                    evo_chain_str = '-'.join(evo_parts)

                    dedup_key = (poke_name, level, iv_a, iv_d, iv_h, evo_chain_str)
                    if dedup_key in seen_rows:
                        continue
                    seen_rows.add(dedup_key)

                    row_data = [poke_name, cp_int, level, iv_a, iv_d, iv_h,
                                evo_chain_str, coll_val]
                    if include_shadow:
                        row_data.append(shadow_eligible)
                    writer.writerow(row_data)

    print(f"[INFO] Evolution CSV complete: {output_path}")


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    args = parse_args()

    df_stats = load_base_stats()
    evo_chains = check_consistency(df_stats, args.cp)
    multipliers = load_multipliers()

    create_all_cp_iv_files(df_stats, multipliers, args.cp)
    create_evolution_csv(df_stats, evo_chains, multipliers, args.cp, include_shadow=args.shadow)

    print(f"\n[DONE] All files generated for CP={args.cp}.")
