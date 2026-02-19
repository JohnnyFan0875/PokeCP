/* =========================================
   PokéCP Calculator - main.js
   ========================================= */

$(document).ready(function () {

  let dtTable     = null;   // normal DataTable
  let shadowTable = null;   // shadow DataTable
  let rawData     = [];
  let rawShadowData = [];
  let currentCP   = null;
  let currentMode = 'normal'; // 'normal' | 'shadow'

  // ─── Utility ───────────────────────────────────────────────────────────────

  function ivClass(val) {
    const n = parseInt(val, 10);
    if (n === 15) return 'iv-perfect';
    if (n >= 13)  return 'iv-great';
    if (n >= 1)   return 'iv-good';
    return 'iv-0';
  }

  function escapeRegex(str) {
    return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  function renderEvoChain(chainStr, targetCP) {
    if (!chainStr) return '';
    const parts = chainStr.split('-');
    return parts.map(part => {
      const match = part.match(/^(.+)\((\d+)\)$/);
      if (!match) return `<span class="evo-part">${part}</span>`;
      const name = match[1];
      const cp   = parseInt(match[2], 10);
      const cls  = (cp === targetCP) ? 'evo-part evo-target' : 'evo-part';
      return `<span class="${cls}">${name}<span class="evo-cp">(${cp})</span></span>`;
    }).join('<span class="evo-arrow"> → </span>');
  }

  // ─── Mode Toggle ───────────────────────────────────────────────────────────

  $('.mode-btn').on('click', function () {
    const mode = $(this).data('mode');
    if (mode === currentMode) return;
    currentMode = mode;

    $('.mode-btn').removeClass('active');
    $(this).addClass('active');

    if (mode === 'normal') {
      $('#table-card-normal').show();
      $('#table-card-shadow').hide();
      $('#mode-badge').removeClass('mode-badge-shadow').addClass('mode-badge-normal').html('Normal Mode');
    } else {
      $('#table-card-normal').hide();
      $('#table-card-shadow').show();
      $('#mode-badge').removeClass('mode-badge-normal').addClass('mode-badge-shadow').html('Shadow/Purified Mode');
      // Load shadow data if not loaded yet
      if (rawShadowData.length === 0 && currentCP !== null) {
        loadShadowCSV(currentCP);
      }
    }
  });

  // ─── Populate filter dropdowns ─────────────────────────────────────────────

  function buildIVOptions(selectId) {
    const $sel = $('#' + selectId);
    $sel.empty().append('<option value="">All</option>');
    for (let i = 0; i <= 15; i++) {
      $sel.append(`<option value="${i}">${i}</option>`);
    }
  }

  function buildLevelOptions(data, selectId) {
    const levels = [...new Set(data.map(r => r.Level))]
      .filter(Boolean)
      .sort((a, b) => parseFloat(a.replace('LV', '')) - parseFloat(b.replace('LV', '')));
    const $sel = $('#' + selectId);
    $sel.empty().append('<option value="">All</option>');
    levels.forEach(lv => $sel.append(`<option value="${lv}">${lv}</option>`));
  }

  // ─── NORMAL TABLE ──────────────────────────────────────────────────────────

  function initNormalTable(data) {
    if (dtTable) {
      dtTable.destroy();
      $('#evo-table tbody').empty();
      dtTable = null;
    }

    rawData = data;
    buildLevelOptions(data, 'level-filter');
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
        {
          data: 'Evolution(CP)',
          render: function (val) { return renderEvoChain(val, currentCP); }
        },
        { data: 'Collected' },
      ],
      columnDefs: [
        { targets: '_all', orderable: false },
        {
          targets: [2, 3, 4],
          createdCell: function (td, cellData) { $(td).addClass(ivClass(cellData)); }
        },
        {
          targets: 6,
          createdCell: function (td, cellData) {
            const val = (cellData || '').trim().toUpperCase();
            $(td).addClass(val === 'YES' ? 'collected-yes' : 'collected-no');
          }
        },
      ],
      pageLength: 50,
      lengthMenu: [25, 50, 100, 200, 500],
      dom: '<"dt-top"lf>rt<"dt-bottom"ip>',
      autoWidth: false,
      language: {
        search: 'Quick Search:',
        lengthMenu: 'Show _MENU_',
        info: 'Showing _START_–_END_ of _TOTAL_ entries',
        paginate: { previous: '‹', next: '›' },
      },
    });

    bindNormalFilters();
    bindNormalAutocomplete();
  }

  function bindNormalFilters() {
    if (!dtTable) return;

    $('#evo-table thead tr#filter-row th:eq(0) input').off('keyup change').on('keyup change', function () {
      dtTable.column(0).search(this.value).draw();
    });
    $('#level-filter').off('change').on('change', function () {
      dtTable.column(1).search(this.value ? '^' + escapeRegex(this.value) + '$' : '', true, false).draw();
    });
    [['attack-filter', 2], ['defense-filter', 3], ['hp-filter', 4]].forEach(([id, col]) => {
      $('#' + id).off('change').on('change', function () {
        dtTable.column(col).search(this.value ? '^' + this.value + '$' : '', true, false).draw();
      });
    });
    $('#evo-table thead tr#filter-row th:eq(5) input').off('keyup change').on('keyup change', function () {
      dtTable.column(5).search(this.value).draw();
    });
    $('#collected-filter').off('change').on('change', function () {
      dtTable.column(6).search(this.value ? '^' + escapeRegex(this.value) + '$' : '', true, false).draw();
    });
  }

  function bindNormalAutocomplete() {
    if (!dtTable) return;
    const names = [...new Set(dtTable.column(0).data().toArray().filter(v => v))].sort();
    const $input = $('#evo-table thead tr#filter-row th:eq(0) input');
    if ($input.data('ui-autocomplete')) $input.autocomplete('destroy');
    $input.autocomplete({
      source: function (req, resp) {
        const term = req.term.toLowerCase();
        resp(names.filter(v => v.toLowerCase().includes(term)).slice(0, 20));
      },
      minLength: 1, delay: 0,
      select: function (event, ui) { dtTable.column(0).search(ui.item.value).draw(); },
    });
  }

  // ─── SHADOW TABLE ──────────────────────────────────────────────────────────

  /**
   * Shadow CSV columns:
   * Pokemon, CP, Level,
   * Shadow_ATK_IV, Shadow_DEF_IV, Shadow_HP_IV,
   * Purified_ATK_IV, Purified_DEF_IV, Purified_HP_IV,
   * Evolution_Shadow(CP), Evolution_Purified(CP),
   * Collected_Shadow, Collected_Purified
   *
   * We render each CSV row as TWO <tr> rows in the table:
   *   Row 1 (shadow)  - shadow IVs highlighted purple, shadow evo chain
   *   Row 2 (purified)- purified IVs highlighted gold, purified evo chain
   *
   * We do this via createdRow + rowCallback by appending a synthetic sub-row.
   * Simpler approach: pre-process data into display rows where we combine
   * both sub-rows into a single DataTables row and use render to show stacked cells.
   */

  function initShadowTable(data) {
    if (shadowTable) {
      shadowTable.destroy();
      $('#shadow-table tbody').empty();
      shadowTable = null;
    }

    rawShadowData = data;
    buildLevelOptions(data, 'sf-level');
    ['sf-satk','sf-sdef','sf-shp','sf-patk','sf-pdef','sf-php'].forEach(id => buildIVOptions(id));

    // Each row will render shadow + purified stacked in cells
    shadowTable = $('#shadow-table').DataTable({
      data: data,
      deferRender: true,
      columns: [
        // 0: Pokemon
        { data: 'Pokemon' },
        // 1: Level
        { data: 'Level' },
        // 2: Shadow ATK
        {
          data: null,
          render: function (row) {
            return ivStackCell(row['Shadow_ATK_IV'], row['Purified_ATK_IV'], 'atk');
          }
        },
        // 3: Shadow DEF
        {
          data: null,
          render: function (row) {
            return ivStackCell(row['Shadow_DEF_IV'], row['Purified_DEF_IV'], 'def');
          }
        },
        // 4: Shadow HP
        {
          data: null,
          render: function (row) {
            return ivStackCell(row['Shadow_HP_IV'], row['Purified_HP_IV'], 'hp');
          }
        },
        // 5: Purified ATK (hidden, used for filtering)
        { data: 'Purified_ATK_IV', visible: false },
        // 6: Purified DEF (hidden)
        { data: 'Purified_DEF_IV', visible: false },
        // 7: Purified HP (hidden)
        { data: 'Purified_HP_IV', visible: false },
        // 8: Evolution chains (stacked shadow + purified)
        {
          data: null,
          render: function (row) {
            const shadowChain   = renderEvoChain(row['Evolution_Shadow(CP)'], currentCP);
            const purifiedChain = renderEvoChain(row['Evolution_Purified(CP)'], currentCP);
            return `<div class="evo-stack">
              <div class="evo-row shadow-evo">${shadowChain}</div>
              <div class="evo-row purified-evo">${purifiedChain}</div>
            </div>`;
          }
        },
        // 9: Collected Shadow
        { data: 'Collected_Shadow' },
        // 10: Collected Purified
        { data: 'Collected_Purified' },
      ],
      columnDefs: [
        { targets: '_all', orderable: false },
        // Collected columns
        {
          targets: [9, 10],
          createdCell: function (td, cellData) {
            const val = (cellData || '').trim().toUpperCase();
            $(td).addClass(val === 'YES' ? 'collected-yes' : 'collected-no');
          }
        },
      ],
      rowCallback: function (row, rowData) {
        $(row).addClass('shadow-row');
      },
      pageLength: 50,
      lengthMenu: [25, 50, 100, 200, 500],
      dom: '<"dt-top"lf>rt<"dt-bottom"ip>',
      autoWidth: false,
      language: {
        search: 'Quick Search:',
        lengthMenu: 'Show _MENU_',
        info: 'Showing _START_–_END_ of _TOTAL_ entries',
        paginate: { previous: '‹', next: '›' },
      },
    });

    bindShadowFilters();
    bindShadowAutocomplete();
  }

  function ivStackCell(shadowVal, purifiedVal, _type) {
    const sc = ivClass(shadowVal);
    const pc = ivClass(purifiedVal);
    return `<div class="iv-stack">
      <div class="iv-row shadow-iv ${sc}">${shadowVal}</div>
      <div class="iv-row purified-iv ${pc}">${purifiedVal}</div>
    </div>`;
  }

  function bindShadowFilters() {
    if (!shadowTable) return;

    // Pokemon name
    $('#sf-pokemon').off('keyup change').on('keyup change', function () {
      shadowTable.column(0).search(this.value).draw();
    });
    // Level
    $('#sf-level').off('change').on('change', function () {
      shadowTable.column(1).search(this.value ? '^' + escapeRegex(this.value) + '$' : '', true, false).draw();
    });
    // Purified IVs use hidden columns (5,6,7) — column search works fine here
    [
      ['sf-patk', 5],
      ['sf-pdef', 6],
      ['sf-php',  7],
    ].forEach(([id, colIdx]) => {
      $('#' + id).off('change').on('change', function () {
        shadowTable.column(colIdx).search(this.value ? '^' + this.value + '$' : '', true, false).draw();
      });
    });

    // Evo chain text search (col 8)
    $('#sf-evo').off('keyup change').on('keyup change', function () {
      shadowTable.column(8).search(this.value).draw();
    });
    // Collected Shadow (col 9)
    $('#sf-cshadow').off('change').on('change', function () {
      shadowTable.column(9).search(this.value ? '^' + escapeRegex(this.value) + '$' : '', true, false).draw();
    });
    // Collected Purified (col 10)
    $('#sf-cpurified').off('change').on('change', function () {
      shadowTable.column(10).search(this.value ? '^' + escapeRegex(this.value) + '$' : '', true, false).draw();
    });
  }

  function getColIndex(colName) {
    // Map data column names to their index in shadowTable columns definition
    const map = {
      'Shadow_ATK_IV': 2,    // rendered in col 2 but also need raw search
      'Shadow_DEF_IV': 3,
      'Shadow_HP_IV':  4,
      'Purified_ATK_IV': 5,
      'Purified_DEF_IV': 6,
      'Purified_HP_IV':  7,
    };
    // For shadow IVs (cols 2-4), the rendered HTML contains the value but regex won't match cleanly.
    // We use hidden columns 5,6,7 for purified. For shadow, we need custom search.
    return map[colName] !== undefined ? map[colName] : -1;
  }

  function bindShadowAutocomplete() {
    if (!shadowTable) return;
    const names = [...new Set(shadowTable.column(0).data().toArray().filter(v => v))].sort();
    const $input = $('#sf-pokemon');
    if ($input.data('ui-autocomplete')) $input.autocomplete('destroy');
    $input.autocomplete({
      source: function (req, resp) {
        const term = req.term.toLowerCase();
        resp(names.filter(v => v.toLowerCase().includes(term)).slice(0, 20));
      },
      minLength: 1, delay: 0,
      select: function (event, ui) { shadowTable.column(0).search(ui.item.value).draw(); },
    });
  }

  // For shadow IV columns 2-4, we need custom search since they contain HTML.
  // Register custom search functions.
  let shadowIVSearchFns = [];

  function registerShadowIVSearch() {
    // Remove old ones
    shadowIVSearchFns.forEach(fn => {
      $.fn.dataTable.ext.search = $.fn.dataTable.ext.search.filter(f => f !== fn);
    });
    shadowIVSearchFns = [];

    const filters = {
      'sf-satk': 'Shadow_ATK_IV',
      'sf-sdef': 'Shadow_DEF_IV',
      'sf-shp':  'Shadow_HP_IV',
    };

    Object.entries(filters).forEach(([id, field]) => {
      const fn = function (settings, _data, _idx, rowData) {
        if (settings.nTable !== document.getElementById('shadow-table')) return true;
        const val = $('#' + id).val();
        if (!val) return true;
        return String(rowData[field]).trim() === String(val).trim();
      };
      $.fn.dataTable.ext.search.push(fn);
      shadowIVSearchFns.push(fn);
    });
  }

  // ─── Clear Filters ─────────────────────────────────────────────────────────

  $('#clear-filters').on('click', function () {
    if (currentMode === 'normal') {
      if (!dtTable) return;
      $('#evo-table thead tr#filter-row input').val('');
      $('#evo-table thead tr#filter-row select').val('');
      dtTable.columns().search('').draw();
    } else {
      if (!shadowTable) return;
      $('#shadow-filter-inputs input').val('');
      $('#shadow-filter-inputs select').val('');
      shadowTable.columns().search('').draw();
    }
  });

  // ─── CSV Loaders ───────────────────────────────────────────────────────────

  function loadCP(cp) {
    const cpNum = parseInt(cp, 10);
    if (isNaN(cpNum) || cpNum < 1 || cpNum > 9999) {
      showError('Please enter a valid CP value (1–9999).');
      return;
    }

    currentCP = cpNum;
    rawShadowData = []; // reset shadow data so it reloads

    const csvUrl = `./output/cp${cpNum}/cp${cpNum}_all_evolutions.csv`;

    $('#table-card-normal, #table-card-shadow').hide();
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

        if (currentMode === 'normal') {
          $('#table-card-normal').show();
        } else {
          $('#table-card-shadow').show();
        }

        initNormalTable(data);

        // If currently in shadow mode, also load shadow CSV
        if (currentMode === 'shadow') {
          loadShadowCSV(cpNum);
        }
      },
      error: function () {
        $('#loading-state').hide();
        showError(`Could not load: <code>${csvUrl}</code><br>Make sure you have run <code>calculate_cp.py --cp ${cpNum}</code> first.`);
      },
    });
  }

  function loadShadowCSV(cpNum) {
    const csvUrl = `./output/cp${cpNum}/cp${cpNum}_shadow_purified_evolutions.csv`;

    $('#table-card-shadow').hide();
    $('#loading-state').show();

    Papa.parse(csvUrl, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: function (results) {
        $('#loading-state').hide();
        const data = results.data.filter(row => row.Pokemon && row.Pokemon.trim());
        if (data.length === 0) {
          showError(`No shadow data found in: ${csvUrl}`);
          return;
        }

        rawShadowData = data;
        $('#table-card-shadow').show();
        initShadowTable(data);
        registerShadowIVSearch();

        // Re-bind shadow IV filter selects to also trigger redraw
        ['sf-satk', 'sf-sdef', 'sf-shp'].forEach(id => {
          $('#' + id).off('change.shadow').on('change.shadow', function () {
            if (shadowTable) shadowTable.draw();
          });
        });
      },
      error: function () {
        $('#loading-state').hide();
        showError(`Could not load shadow data: <code>${csvUrl}</code><br>Make sure you have run <code>calculate_cp.py --cp ${cpNum}</code> first.`);
      },
    });
  }

  function showError(msg) {
    $('#error-msg').html(msg);
    $('#error-state').show();
    $('#table-card-normal, #table-card-shadow').hide();
  }

  // ─── Event bindings ────────────────────────────────────────────────────────

  $('#load-cp-btn').on('click', function () { loadCP($('#cp-input').val()); });

  $('#cp-input').on('keydown', function (e) {
    if (e.key === 'Enter') loadCP(this.value);
  });

  $(document).on('keydown', 'input', function (e) {
    if (e.ctrlKey && e.key === 'a') { e.preventDefault(); this.select(); }
  });

  // ─── Initial load ───────────────────────────────────────────────────────────
  loadCP(520);

});
