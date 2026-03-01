# PokéCP — Evolution Calculator for Pokémon GO

> Find which Pokémon at a given CP have the best IVs across their full evolution chain.

🌐 **Live:** [https://johnnyfan0875.github.io/PokeCP/](https://johnnyfan0875.github.io/PokeCP/)

---

## Overview

When you catch a Pokémon at a specific CP, it can be difficult to know whether it's worth evolving. PokéCP solves this by calculating every IV combination that produces your target CP, then projecting the resulting CP at each stage of the evolution chain — so you can immediately see which catches have the most potential.

---

## Features

- **Evolution Chain Preview** — Projects CP across all evolution stages for every matching IV combination
- **IV Breakdown** — Displays Attack, Defense, and HP IVs with color-coded quality indicators
- **Collection Tracker** — Tracks Normal, Shadow, and Purified collection status per Pokémon
- **Flexible Filtering** — Filter by Pokémon name, level, individual IVs, and collection status
- **Auto Stat Scraping** — Base stats are fetched from Bulbapedia and cached daily
- **CSV-Based Storage** — All data stored in plain CSV files for easy inspection and editing

---

## Requirements

- Python 3.10+
- pip

---

## Installation

```bash
git clone https://github.com/johnnyfan0875/PokeCP.git
cd PokeCP
pip install -r requirements.txt
```

---

## Usage

### 1. Generate data for a target CP

```bash
python src/main.py --cp 520
```

This will scrape the latest base stats, calculate all matching IV combinations, and write the results to `output/cp520/`.

```bash
python src/main.py --cp 1500   # Great League
python src/main.py --cp 2500   # Ultra League
```

### 2. Serve locally

```bash
python -m http.server 8000
```

Open `http://localhost:8000`, enter your target CP, and click **Load**.

---

## Project Structure

```
PokeCP/
├── requirements.txt
├── src/
│   ├── main.py                     # Pipeline entry point
│   ├── scraper.py                  # Bulbapedia base stat scraper
│   ├── calculate_cp.py             # CP & IV calculation logic
│   └── config.py                   # Path configuration
├── data/
│   ├── base_stat_{date}.csv        # Daily base stat cache
│   ├── evolution.csv               # Evolution chains
│   ├── multiplyer.csv              # CP multiplier table by level
│   └── cp{N}_collected.csv         # Collection tracker per CP value
├── output/                         # Generated CSVs (created on run)
├── assets/
│   ├── css/style.css
│   └── js/main.js
└── index.html
```

---

## Data Files

| File                   | Description                                                          |
| ---------------------- | -------------------------------------------------------------------- |
| `base_stat_{date}.csv` | Pokémon base stats scraped from Bulbapedia, cached daily             |
| `evolution.csv`        | Comma-separated evolution chains, one per line                       |
| `multiplyer.csv`       | CP multiplier values indexed by level                                |
| `cp{N}_collected.csv`  | Tracks collection status (Normal / Shadow / Purified) for a given CP |
