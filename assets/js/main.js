/* =========================================
   PokéCP Calculator - main.js
   ========================================= */

$(document).ready(function () {

  let dtTable = null;
  let rawData = [];
  let currentCP = null;
  let showShadowPurified = false;

  // ─── Utility ───────────────────────────────────────────────────────────────

  /**
   * Pokémon GO CP formula
   * CP = floor( (BaseAtk + atkIV) * sqrt(BaseDef + defIV) * sqrt(BaseHP + hpIV) * CPM² / 10 )
   *
   * For Shadow→Purified: each IV gets +2 (capped at 15)
   * We don't have base stats here, but we can check if purified combo
   * (atkIV+2, defIV+2, hpIV+2) appeared anywhere in the CSV data.
   *
   * Since the CSV already contains pre-calculated rows, we identify
   * "shadow eligible" rows by checking if the same Pokémon + Level
   * exists in rawData with IVs that are each 2 lower (shadow IVs → purified = this row's IVs).
   */

  function buildShadowEligibleSet(data) {
    // A row is "shadow eligible" if there exists ANOTHER row where:
    //   same Pokemon + Level, and all IVs are exactly 2 higher (i.e. shadow source IVs +2)
    // In other words: this row's IVs could be the PURIFIED result of a shadow with IVs (atk-2, def-2, hp-2).
    // Equivalently: does a shadow Pokémon exist at (atk-2, def-2, hp-2) that, after purifying (+2 each), reaches this CP?

    // Since all rows in the CSV are valid at the target CP,
    // we want rows where atk >= 2, def >= 2, hp >= 2
    // (meaning shadow IVs 0/1/2... can reach this IV after +2 purify bonus)
    // AND the shadow itself might have been at CP that is catchable/findable.
    // 
    // Practical logic: a shadow caught at some CP, when purified, gains +2 IV each stat.
    // The shadow's IVs before purify are: (atkIV-2, defIV-2, hpIV-2).
    // If any of those would be negative, impossible → skip.
    //
    // Since we don't have the shadow's CP in this dataset,
    // we flag rows where (atkIV-2 >= 0 AND defIV-2 >= 0 AND hpIV-2 >= 0)
    // = the row COULD be reached by purifying a shadow.

    const eligible = new Set();
    data.forEach((row, idx) => {
      const a = parseInt(row.IV_Attack, 10);
      const d = parseInt(row.IV_Defense, 10);
      const h = parseInt(row.IV_HP, 10);
      if (a >= 2 && d >= 2 && h >= 2) {
        eligible.add(idx);
      }
    });
    return eligible;
  }

  // ─── Populate filter dropdowns ─────────────────────────────────────────────

  function buildIVOptions(selectId) {
    const $sel = $('#' + selectId);
    $sel.empty().append('<option value="">All</option>');
    for (let i = 0; i <= 15; i++) {
      $sel.append(`<option value="${i}">${i}</option>`);
    }
  }

  function buildLevelOptions(data) {
    const levels = [...new Set(data.map(r => r.Level))]
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseFloat(a.replace('LV', ''));
        const nb = parseFloat(b.replace('LV', ''));
        return na - nb;
      });

    const $sel = $('#level-filter');
    $sel.empty().append('<option value="">All</option>');
    levels.forEach(lv => {
      $sel.append(`<option value="${lv}">${lv}</option>`);
    });
  }

  // ─── IV cell class helper ──────────────────────────────────────────────────

  function ivClass(val) {
    const n = parseInt(val, 10);
    if (n === 15) return 'iv-perfect';
    if (n >= 13) return 'iv-great';
    if (n >= 1)  return 'iv-good';
    return 'iv-0';
  }

  // ─── Render / Init DataTable ───────────────────────────────────────────────

  function initTable(data) {
    if (dtTable) {
      dtTable.destroy();
      $('#evo-table tbody').empty();
      dtTable = null;
    }

    rawData = data;
    const shadowSet = buildShadowEligibleSet(data);

    buildLevelOptions(data);
    buildIVOptions('attack-filter');
    buildIVOptions('defense-filter');
    buildIVOptions('hp-filter');

    dtTable = $('#evo-table').DataTable({
      data: data,
      deferRender: true,
      columns: [
        { data: 'Pokemon' },
        { data: 'Level' },
        { data: 'IV_Attack' },
        { data: 'IV_Defense' },
        { data: 'IV_HP' },
        { data: 'Evolution(CP)' },
        { data: 'Collected' },
      ],
      columnDefs: [
        // IV columns: add class based on value
        {
          targets: [2, 3, 4],
          createdCell: function (td, cellData) {
            $(td).addClass(ivClass(cellData));
          }
        },
        // Collected: badge styling
        {
          targets: 6,
          createdCell: function (td, cellData) {
            const val = (cellData || '').trim().toUpperCase();
            $(td).addClass(val === 'YES' ? 'collected-yes' : 'collected-no');
          }
        },
      ],
      rowCallback: function (row, rowData, rowIndex) {
        // Mark shadow-eligible rows
        if (shadowSet.has(rowIndex)) {
          $(row).addClass('shadow-eligible-source');
        }
      },
      order: [[0, 'asc']],
      pageLength: 100,
      lengthMenu: [25, 50, 100, 200, 500],
      dom: '<"dt-top"lf>rt<"dt-bottom"ip>',
      autoWidth: false,
      language: {
        search: 'Quick Search:',
        lengthMenu: 'Show _MENU_',
        info: 'Showing _START_–_END_ of _TOTAL_ entries',
        paginate: {
          previous: '‹',
          next: '›',
        },
      },
    });

    // Apply shadow filter if toggle is on
    if (showShadowPurified) {
      applyShadowFilter();
    }

    bindColumnFilters();
    bindAutocomplete();
    reapplyCollectedToggle();
  }

  // ─── Column filter bindings ────────────────────────────────────────────────

  function bindColumnFilters() {
    if (!dtTable) return;

    // Pokemon name (col 0) - text input
    $('#evo-table thead tr#filter-row th:eq(0) input')
      .off('keyup change')
      .on('keyup change', function () {
        dtTable.column(0).search(this.value).draw();
      });

    // Level (col 1)
    $('#level-filter').off('change').on('change', function () {
      const val = this.value;
      dtTable.column(1).search(val ? '^' + escapeRegex(val) + '$' : '', true, false).draw();
    });

    // ATK / DEF / HP (cols 2,3,4) - exact match
    [['attack-filter', 2], ['defense-filter', 3], ['hp-filter', 4]].forEach(([id, col]) => {
      $('#' + id).off('change').on('change', function () {
        const val = this.value;
        dtTable.column(col).search(val ? '^' + val + '$' : '', true, false).draw();
      });
    });

    // Evolution CP (col 5) - text input
    $('#evo-table thead tr#filter-row th:eq(5) input')
      .off('keyup change')
      .on('keyup change', function () {
        dtTable.column(5).search(this.value).draw();
      });

    // Collected filter (col 6)
    $('#collected-filter').off('change').on('change', function () {
      const val = this.value;
      dtTable.column(6).search(val ? '^' + escapeRegex(val) + '$' : '', true, false).draw();
    });
  }

  function escapeRegex(str) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  // ─── Autocomplete for Pokemon name ────────────────────────────────────────

  function bindAutocomplete() {
    if (!dtTable) return;

    const pokemonNames = [...new Set(
      dtTable.column(0).data().toArray().filter(v => v)
    )].sort();

    const $input = $('#evo-table thead tr#filter-row th:eq(0) input');
    if ($input.data('ui-autocomplete')) $input.autocomplete('destroy');

    $input.autocomplete({
      source: function (req, resp) {
        const term = req.term.toLowerCase();
        resp(pokemonNames.filter(v => v.toLowerCase().includes(term)).slice(0, 20));
      },
      minLength: 1,
      delay: 0,
      select: function (event, ui) {
        dtTable.column(0).search(ui.item.value).draw();
      },
    });
  }

  // ─── Collected toggle ──────────────────────────────────────────────────────

  function reapplyCollectedToggle() {
    if (!dtTable) return;
    const showAll = $('#collected-toggle').prop('checked');
    if (!showAll) {
      // Show non-collected only
      $('#collected-filter').val('NO');
      dtTable.column(6).search('^NO$', true, false).draw();
    } else {
      $('#collected-filter').val('');
      dtTable.column(6).search('').draw();
    }
  }

  $('#collected-toggle').on('change', reapplyCollectedToggle);

  // ─── Shadow Purified filter ────────────────────────────────────────────────

  /**
   * When shadow-purified mode is ON:
   * We use a custom DataTables search function that only shows rows
   * where the IVs could come from a shadow (atk-2 >= 0, def-2 >= 0, hp-2 >= 0).
   * We also add a visual badge to those rows.
   */

  let shadowSearchFn = null;

  function applyShadowFilter() {
    if (!dtTable) return;
    // Remove old custom search if any
    if (shadowSearchFn) {
      $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(fn => fn !== shadowSearchFn);
    }

    shadowSearchFn = function (settings, data) {
      if (settings.nTable !== document.getElementById('evo-table')) return true;
      const atk = parseInt(data[2], 10);
      const def = parseInt(data[3], 10);
      const hp  = parseInt(data[4], 10);
      return atk >= 2 && def >= 2 && hp >= 2;
    };

    $.fn.dataTable.ext.search.push(shadowSearchFn);
    dtTable.draw();
  }

  function removeShadowFilter() {
    if (!dtTable) return;
    if (shadowSearchFn) {
      $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(fn => fn !== shadowSearchFn);
      shadowSearchFn = null;
    }
    dtTable.draw();
  }

  $('#shadow-purified-toggle').on('change', function () {
    showShadowPurified = this.checked;
    if (showShadowPurified) {
      applyShadowFilter();
    } else {
      removeShadowFilter();
    }
  });

  // ─── Clear Filters ─────────────────────────────────────────────────────────

  $('#clear-filters').on('click', function () {
    if (!dtTable) return;

    // Clear all filter inputs
    $('#evo-table thead tr#filter-row input').val('');
    $('#evo-table thead tr#filter-row select').val('');

    // Clear DataTable searches
    dtTable.columns().search('');

    // Reapply shadow filter if on
    if (showShadowPurified) {
      applyShadowFilter();
    }

    // Reapply collected toggle
    reapplyCollectedToggle();
  });

  // ─── CP Loader ─────────────────────────────────────────────────────────────

  function loadCP(cp) {
    const cpNum = parseInt(cp, 10);
    if (isNaN(cpNum) || cpNum < 1 || cpNum > 9999) {
      showError('Please enter a valid CP value (1–9999).');
      return;
    }

    currentCP = cpNum;
    const csvUrl = `./output/cp${cpNum}/cp${cpNum}_all_evolutions.csv`;

    $('#table-card').hide();
    $('#error-state').hide();
    $('#loading-state').show();

    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        $('#loading-state').hide();

        const data = results.data.filter(row => row.Pokemon && row.Pokemon.trim());
        if (data.length === 0) {
          showError(`No data found in: ${csvUrl}`);
          return;
        }

        document.title = `PokéCP — CP${cpNum}`;
        $('#table-card').show();
        initTable(data);
      },
      error: function () {
        $('#loading-state').hide();
        showError(`Could not load: <code>${csvUrl}</code><br>Make sure you have run <code>main.py --cp ${cpNum}</code> first.`);
      },
    });
  }

  function showError(msg) {
    $('#error-msg').html(msg);
    $('#error-state').show();
    $('#table-card').hide();
  }

  // Load button
  $('#load-cp-btn').on('click', function () {
    loadCP($('#cp-input').val());
  });

  // Enter key in CP input
  $('#cp-input').on('keydown', function (e) {
    if (e.key === 'Enter') loadCP(this.value);
  });

  // Allow Ctrl+A in filter inputs
  $(document).on('keydown', 'input', function (e) {
    if (e.ctrlKey && e.key === 'a') {
      e.preventDefault();
      this.select();
    }
  });

  // ─── Initial load ───────────────────────────────────────────────────────────
  loadCP(520);

});
