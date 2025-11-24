// Load CSV, initialize DataTable, and set up the toggle buttons
$(document).ready(function () {
  Papa.parse("./output/cp520/cp520_all_evolutions.csv", {
    download: true,
    header: true,
    complete: function (results) {
      let data = results.data.filter((row) => row.Pokemon); // remove header/footer blanks

      let table = $("#evo-table").DataTable({
        data: data,
        deferRender: true,
        columns: [
          { data: "Pokemon" },
          { data: "CP" },
          { data: "Level" },
          { data: "IV_Attack" },
          { data: "IV_Defense" },
          { data: "IV_HP" },
          { data: "Evolution(CP)" },
          { data: "Collected" },
        ],
        order: [[0, "asc"]],
        pageLength: 25,
        lengthMenu: [10, 25, 50, 100, 200],
        dom: '<"top-controls"lf>rtip',
        fixedHeader: false,
        autoWidth: false,
      });

      // Live per-column search on input change or keyup
      $("#evo-table thead tr:eq(1) th").each(function (i) {
        $("input", this).on("keyup change", function () {
          if (table.column(i).search() !== this.value) {
            table.column(i).search(this.value).draw();
          }
        });
      });

      // Toggle showing collected vs non-collected
      $("#noncollected-toggle").on("change", function () {
        if (this.checked) {
          // Switch ON (green): show NON-COLLECTED only
          table.column(7).search("").draw();
        } else {
          // Switch OFF: show ALL collected (marked "No")
          table.column(7).search("No").draw();
        }
      });

      // Build autocomplete for each column filter
      table.columns().every(function (colIndex) {
        if (colIndex === 6) return; // skip Evolution(CP)

        let uniqueValues = [
          ...new Set(
            table
              .column(colIndex)
              .data()
              .toArray()
              .filter((v) => v !== null && v !== "")
          ),
        ];

        $(
          "#evo-table thead tr:eq(1) th:eq(" + colIndex + ") input"
        ).autocomplete({
          source: function (request, response) {
            const term = request.term.toLowerCase();
            response(
              uniqueValues.filter((v) => v.toLowerCase().includes(term))
            );
          },
          minLength: 1,
          delay: 0,
          select: function (event, ui) {
            table.column(colIndex).search(ui.item.value).draw();
          },
        });
      });

      // Clear filter button
      $("#clear-filters").on("click", function () {
        // Clear inputs
        $("#evo-table thead tr:eq(1) th input").each(function () {
          $(this).val("");
        });
        // Clear DataTable filters
        table.columns().search("").draw();
      });
    },
  });
});
