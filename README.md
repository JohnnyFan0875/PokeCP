# 🎮 PokéCP — Evolution Calculator for Pokémon GO

> Quickly find which Pokémon at a specific CP have the best IVs across their entire evolution chain — including Shadow & Purified forms!

🌐 **Live Website:** [https://johnnyfan0875.github.io/PokeCP/](https://johnnyfan0875.github.io/PokeCP/)

---

## 📖 What is this?

If you play Pokémon GO, you know the struggle: you catch a Pokémon at a certain CP, and you want to know if it's worth evolving. **PokéCP** does all the math for you!

Just enter a CP value, and this tool will:

- Find every Pokémon that can appear at that CP
- Show you its IVs (Attack, Defense, HP) and Level
- Calculate what CP it will become at **every stage of its evolution chain**
- Help you track which ones you've already collected

It also supports **Shadow and Purified** Pokémon, which have different IV modifiers — a great feature for competitive GO Battle League players!

---

## ✨ Features

- 🔍 **Evolution Chain Preview** — See the full CP chain from base form all the way to final evolution
- 📊 **IV Breakdown** — Attack, Defense, and HP IVs displayed for every match
- 👻 **Shadow & Purified Mode** — Toggle between Normal and Shadow/Purified views with adjusted IVs
- ✅ **Collection Tracker** — Mark Pokémon as collected so you know what you still need
- 🔎 **Powerful Filters** — Filter by Pokémon name, level, individual IVs, and collection status
- 🕸️ **Auto Stat Scraping** — Base stats are automatically fetched from Bulbapedia and cached daily
- 📁 **CSV-Based** — All data is stored in easy-to-edit CSV files

---

## 🛠️ Installation

### Prerequisites

Make sure you have the following installed:

- [Python 3.10+](https://www.python.org/downloads/)
- pip (comes with Python)

### 1. Clone the repository

```bash
git clone https://github.com/johnnyfan0875/PokeCP.git
cd PokeCP
```

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

---

## 🚀 Usage

### Step 1 — Generate data for a target CP

Run the main pipeline with your desired CP value:

```bash
python src/main.py --cp 520
```

This will:

1. Scrape the latest base stats from Bulbapedia (cached daily)
2. Calculate all IV combinations that result in your target CP
3. Generate evolution chain CSVs in the `output/cp520/` folder

### Other CP values

```bash
python src/main.py --cp 1500    # Great League cap
python src/main.py --cp 2500    # Ultra League cap
python src/main.py --cp 10      # Any CP you want!
```

### Step 2 — Open the website

After generating your data, start a local web server from the **project root folder**:

```bash
python -m http.server 8000
```

Then open your browser and go to:

```
http://localhost:8000
```

Enter your target CP in the **"Target CP"** box, click **Load**, and explore your results!

---

## 📁 Project Structure

```
PokeCP/
├── requirements.txt            # Python dependencies
├── src/
│   ├── main.py                 # Entry point — runs the full pipeline
│   ├── scraper.py              # Fetches base stats from Bulbapedia
│   ├── calculate_cp.py         # Core CP & IV calculation logic
│   └── config.py               # File path configuration
├── data/
│   ├── base_stat_{date}.csv    # Auto-generated daily cache of base stats (e.g. base_stat_20250223.csv)
│   ├── evolution.csv           # Evolution chains
│   ├── multiplyer.csv          # CP multiplier table by level
│   └── cp520_collected.csv     # Your collection tracker (per CP)
├── output/                     # Generated CSV files (created on run)
├── assets/
│   ├── css/style.css
│   └── js/main.js
└── index.html                  # The web UI
```

---

## 🤝 Contributing

Found a bug or want to add a feature? Feel free to open an issue or submit a pull request!

---

## 📜 License

This project is for personal and educational use. Pokémon GO is a trademark of Niantic, Inc. and The Pokémon Company.
