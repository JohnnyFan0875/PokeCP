"""
main.py

Entry point: runs the scraper then the CP calculator.

Usage:
    python main.py              # default CP=520
    python main.py --cp 1500    # Great League CP cap
    python main.py --cp 1500 --shadow   # include Shadow→Purified eligibility column
"""
import argparse
import subprocess
import sys
from pathlib import Path


SCRIPTS_DIR = Path(__file__).parent


def run(script: str, extra_args: list[str] = []):
    cmd = [sys.executable, str(SCRIPTS_DIR / script)] + extra_args
    print(f"\n{'─'*50}")
    print(f"Running: {' '.join(cmd)}")
    print(f"{'─'*50}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        sys.exit(f"[ERROR] {script} failed (exit code {result.returncode})")


def parse_args():
    parser = argparse.ArgumentParser(description="Pokémon GO CP Calculator Pipeline")
    parser.add_argument('--cp', type=int, default=520,
                        help='Target CP value to calculate (default: 520)')
    parser.add_argument('--shadow', action='store_true',
                        help='Include Shadow→Purified (+2 IV) eligibility column in output')
    return parser.parse_args()


if __name__ == '__main__':
    args = parse_args()

    run('scraper.py')

    calc_args = ['--cp', str(args.cp)]
    if args.shadow:
        calc_args.append('--shadow')

    run('calculate_cp.py', calc_args)

    print(f"\nDone! Output: output/cp{args.cp}/cp{args.cp}_all_evolutions.csv")
