/* =========================================
   PokéCP Calculator - main.js
   ========================================= */

$(document).ready(function () {

  let dtTable   = null;   // DataTable instance
  let rawData   = [];
  let currentCP = null;

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

  // ─── MAIN TABLE ────────────────────────────────────────────────────────────

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
        { data: 'Collected_Shadow' },
        { data: 'Collected_Purified' },
      ],
      columnDefs: [
        { targets: '_all', orderable: false },
        {
          targets: [2, 3, 4],
          createdCell: function (td, cellData) { $(td).addClass(ivClass(cellData)); }
        },
        {
          targets: [6, 7, 8],
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
    $('#collected-shadow-filter').off('change').on('change', function () {
      dtTable.column(7).search(this.value ? '^' + escapeRegex(this.value) + '$' : '', true, false).draw();
    });
    $('#collected-purified-filter').off('change').on('change', function () {
      dtTable.column(8).search(this.value ? '^' + escapeRegex(this.value) + '$' : '', true, false).draw();
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

  // ─── Clear Filters ─────────────────────────────────────────────────────────

  $('#clear-filters').on('click', function () {
    if (!dtTable) return;
    $('#evo-table thead tr#filter-row input').val('');
    $('#evo-table thead tr#filter-row select').val('');
    dtTable.columns().search('').draw();
  });

  // ─── CSV Loader ────────────────────────────────────────────────────────────

  function loadCP(cp) {
    const cpNum = parseInt(cp, 10);
    if (isNaN(cpNum) || cpNum < 1 || cpNum > 9999) {
      showError('Please enter a valid CP value (1–9999).');
      return;
    }

    currentCP = cpNum;

    const csvUrl = `./output/cp${cpNum}/cp${cpNum}_all_evolutions.csv`;

    $('#table-card-normal').hide();
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
        $('#table-card-normal').show();
        initNormalTable(data);
      },
      error: function () {
        $('#loading-state').hide();
        showError(`Could not load: <code>${csvUrl}</code><br>Make sure you have run <code>calculate_cp.py --cp ${cpNum}</code> first.`);
      },
    });
  }

  function showError(msg) {
    $('#error-msg').html(msg);
    $('#error-state').show();
    $('#table-card-normal').hide();
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