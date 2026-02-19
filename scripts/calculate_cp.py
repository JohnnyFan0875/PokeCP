"""
calculate_cp.py

Calculates evolution CP tables for Pokémon GO.
Always generates both normal and shadow evolution CSVs.

Usage:
    python calculate_cp.py --cp 520
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
    COLLECTED_CSV, OUTPUT_CP_IV_FOLDER,
    OUTPUT_ALL_FILE,
)


# ─── CLI ──────────────────────────────────────────────────────────────────────

def parse_args():
    parser = argparse.ArgumentParser(description="Pokemon GO CP Calculator")
    parser.add_argument('--cp', type=int, required=True, help='Target CP value')
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
    with open(MULTIPLIER_CSV, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        return {row[0]: float(row[1]) for row in reader if len(row) >= 2}


def load_evolution_chains() -> dict:
    chains = {}
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
    """
    Returns {pokemon_name: {Collected, Collected_Shadow, Collected_Purified}}
    Backwards compatible: missing columns default to 'NO'.
    """
    path = COLLECTED_CSV.format(cp=cp_val)
    if not os.path.exists(path):
        return {}
    result = {}
    with open(path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            name = row.get('Pokemon', '').strip()
            if not name:
                continue
            result[name] = {
                'Collected':          row.get('Collected', 'NO').strip().upper(),
                'Collected_Shadow':   row.get('Collected_Shadow', 'NO').strip().upper(),
                'Collected_Purified': row.get('Collected_Purified', 'NO').strip().upper(),
            }
    return result


# ─── Consistency check ────────────────────────────────────────────────────────

def check_consistency(df_stat: pd.DataFrame, cp_val: int) -> dict:
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
    else:
        print("[INFO] Data consistency OK.")

    return chains


# ─── CP formula ───────────────────────────────────────────────────────────────

def calc_cp(base_atk, base_def, base_hp, iv_atk, iv_def, iv_hp, cpm):
    cp = (base_atk + iv_atk) * math.sqrt(base_def + iv_def) * math.sqrt(base_hp + iv_hp) * cpm ** 2 / 10
    return int(cp)


def purified_ivs(iv_atk, iv_def, iv_hp):
    return min(iv_atk + 2, 15), min(iv_def + 2, 15), min(iv_hp + 2, 15)


# ─── Per-Pokemon CP/IV file ───────────────────────────────────────────────────

def create_cp_iv_file(name, base_atk, base_def, base_hp, multipliers, cp_val, output_folder):
    path = os.path.join(output_folder, f"cp{cp_val}_{name}.csv")
    if os.path.exists(path):
        return

    rows = []
    for iv_a, iv_d, iv_h, (level, cpm) in itertools.product(
        range(16), range(16), range(16), multipliers.items()
    ):
        if calc_cp(base_atk, base_def, base_hp, iv_a, iv_d, iv_h, float(cpm)) == cp_val:
            rows.append([name, f"LV{level}", iv_a, iv_d, iv_h, cp_val])

    with open(path, 'w', encoding='utf-8', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(['Name', 'Level', 'IV_Attack', 'IV_Defense', 'IV_HP', 'CP'])
        writer.writerows(rows)

    print(f"[INFO] Created: {path} ({len(rows)} rows)")


def create_all_cp_iv_files(df_stat, multipliers, cp_val):
    folder = OUTPUT_CP_IV_FOLDER.format(cp=cp_val)
    os.makedirs(folder, exist_ok=True)
    for _, row in df_stat.iterrows():
        create_cp_iv_file(
            row['Pokemon'], int(row['Attack']), int(row['Defense']), int(row['HP']),
            multipliers, cp_val, folder
        )


# ─── Evolution CSV ─────────────────────────────────────────────────────

def create_evolution_csv(df_stat, evo_chains, multipliers, cp_val):
    """
    cp{N}_all_evolutions.csv
    Columns: Pokemon, CP, Level, IV_Attack, IV_Defense, IV_HP, Shadow_ATK_IV, Shadow_DEF_IV, Shadow_HP_IV, Evolution(CP), Collected, Collected_Shadow, Collected_Purified
    """
    collected = load_collected(cp_val)
    stat_lookup = {row['Pokemon']: row for _, row in df_stat.iterrows()}
    iv_folder = OUTPUT_CP_IV_FOLDER.format(cp=cp_val)
    output_path = OUTPUT_ALL_FILE.format(cp=cp_val)

    print(f"[INFO] Building normal evolution CSV -> {output_path}")

    seen_rows = set()

    with open(output_path, 'w', encoding='utf-8', newline='') as f_out:
        writer = csv.writer(f_out)
        writer.writerow(['Pokemon', 'CP', 'Level', 'IV_Attack', 'IV_Defense', 'IV_HP', 'Shadow_ATK_IV', 'Shadow_DEF_IV', 'Shadow_HP_IV',
                         'Evolution(CP)', 'Collected', 'Collected_Shadow', 'Collected_Purified'])

        for poke_name in df_stat['Pokemon']:
            iv_file = os.path.join(iv_folder, f"cp{cp_val}_{poke_name}.csv")
            if not os.path.exists(iv_file):
                continue

            with open(iv_file, 'r', encoding='utf-8') as f:
                iv_rows = list(csv.DictReader(f))

            chains = evo_chains.get(poke_name, [[poke_name]])
            coll_val = collected.get(poke_name, {}).get('Collected', 'NO')
            coll_s_val = collected.get(poke_name, {}).get('Collected_Shadow', 'NO')
            coll_p_val = collected.get(poke_name, {}).get('Collected_Purified', 'NO')

            for iv_row in iv_rows:
                level  = iv_row['Level']
                iv_a   = int(iv_row['IV_Attack'])
                iv_d   = int(iv_row['IV_Defense'])
                iv_h   = int(iv_row['IV_HP'])
                if iv_a < 2 or iv_d < 2 or iv_h < 2 or float(level.replace('LV', '')) < 25:
                    s_atk = s_def = s_hp = ''
                else:
                    s_atk = iv_a - 2
                    s_def = iv_d - 2
                    s_hp  = iv_h - 2
                cp_int = int(iv_row['CP'])
                cpm    = float(multipliers[level.replace('LV', '')])

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
                    dedup_key = (poke_name, level, iv_a, iv_d, iv_h, s_atk, s_def, s_hp, evo_chain_str)
                    if dedup_key in seen_rows:
                        continue
                    seen_rows.add(dedup_key)

                    writer.writerow([poke_name, cp_int, level, iv_a, iv_d, iv_h, s_atk, s_def, s_hp,
                                     evo_chain_str, coll_val, coll_s_val, coll_p_val])

    print(f"[INFO] Normal evolution CSV complete: {output_path}")


# ─── Entry point ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    args = parse_args()

    df_stats   = load_base_stats()
    evo_chains = check_consistency(df_stats, args.cp)
    multipliers = load_multipliers()

    create_all_cp_iv_files(df_stats, multipliers, args.cp)
    create_evolution_csv(df_stats, evo_chains, multipliers, args.cp)

    print(f"\n[DONE] All files generated for CP={args.cp}.")
