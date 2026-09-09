// Query name: Product.
let
    Columns = Table.SelectColumns(ProductRegion, {"Product", "ProductSort"}),
    Distinct = Table.Distinct(Columns),
    Ordered = Table.Sort(Distinct, {{"ProductSort", Order.Ascending}})
in
    Ordered
