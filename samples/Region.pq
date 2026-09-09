// Query name: Region.
let
    Columns = Table.SelectColumns(ProductRegion, {"Region", "RegionSort"}),
    Distinct = Table.Distinct(Columns),
    Ordered = Table.Sort(Distinct, {{"RegionSort", Order.Ascending}})
in
    Ordered
