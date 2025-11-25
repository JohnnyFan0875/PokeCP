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
          { data: "Level" },
          { data: "IV_Attack" },
          { data: "IV_Defense" },
          { data: "IV_HP" },
          { data: "Evolution(CP)" },
          { data: "Collected" },
        ],
        order: [[0, "asc"]],
        pageLength: 100,
        lengthMenu: [10, 25, 50, 100, 200],
        dom: '<"top-controls"lf>rtip',
        fixedHeader: false,
        autoWidth: false,
      });

      // Live per-column search on input change or keyup for all but Attack(3), Defense(4), HP(5)
      $("#evo-table thead tr:eq(1) th").each(function (i) {
        if (i === 2 || i === 3 || i === 4) {
          // Skip input search binding for Attack, Defense, HP
          return;
        }
        $("input", this).on("keyup change", function () {
          if (table.column(i).search() !== this.value) {
            table.column(i).search(this.value).draw();
          }
        });
      });

      // Dropdown filter change events for Attack, Defense, HP columns
      $("#attack-filter").on("change", function () {
        let val = this.value;
        if (val === "") {
          table.column(2).search("").draw();
        } else {
          table
            .column(2)
            .search("^" + val + "$", true, false)
            .draw();
        }
      });

      $("#defense-filter").on("change", function () {
        let val = this.value;
        if (val === "") {
          table.column(3).search("").draw();
        } else {
          table
            .column(3)
            .search("^" + val + "$", true, false)
            .draw();
        }
      });

      $("#hp-filter").on("change", function () {
        let val = this.value;
        if (val === "") {
          table.column(4).search("").draw();
        } else {
          table
            .column(4)
            .search("^" + val + "$", true, false)
            .draw();
        }
      });

      // Toggle showing collected vs non-collected
      $("#noncollected-toggle").on("change", function () {
        if (this.checked) {
          // Switch ON (green): show NON-COLLECTED only
          table.column(6).search("").draw();
        } else {
          // Switch OFF: show ALL collected (marked "No")
          table.column(6).search("No").draw();
        }
      });

      // Build autocomplete for inputs except Attack(2), Defense(3), HP(4), Evolution(CP)(5)
      table.columns().every(function (colIndex) {
        if (
          colIndex === 2 ||
          colIndex === 3 ||
          colIndex === 4 ||
          colIndex === 5
        )
          return;

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

      // Clear filter button clears inputs and dropdowns
      $("#clear-filters").on("click", function () {
        // Clear inputs
        $("#evo-table thead tr:eq(1) th input").each(function () {
          $(this).val("");
        });
        // Clear dropdowns
        $("#attack-filter, #defense-filter, #hp-filter").val("");
        // Clear DataTable column searches except collected column (7)
        table.columns().search("").draw();

        // Reapply collected/non-collected filter based on toggle status
        if ($("#noncollected-toggle").prop("checked")) {
          // Non-collected mode ON: show only non-collected rows (column 7 blank)
          table.column(6).search("").draw();
        } else {
          // Non-collected mode OFF: show all collected rows (search "No")
          table.column(6).search("No").draw();
        }
      });
    },
  });
});
