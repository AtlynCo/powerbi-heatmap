// Query name: Defect.
let
    Columns = Table.SelectColumns(DefectLine, {"Defect", "DefectSort"}),
    Distinct = Table.Distinct(Columns),
    Ordered = Table.Sort(Distinct, {{"DefectSort", Order.Ascending}})
in
    Ordered
