// Query name: Line.
let
    Columns = Table.SelectColumns(DefectLine, {"Line", "LineSort"}),
    Distinct = Table.Distinct(Columns),
    Ordered = Table.Sort(Distinct, {{"LineSort", Order.Ascending}})
in
    Ordered
