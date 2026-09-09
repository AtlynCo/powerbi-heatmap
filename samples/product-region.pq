// Query name: ProductRegion. Depends on the SampleFolder text parameter.
let
    Path = Text.TrimEnd(SampleFolder, {"\"}) & "\product-region.csv",
    Source = Csv.Document(
        File.Contents(Path),
        [Delimiter = ",", Columns = 5, Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Headers = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    ParseNumber = (value as nullable text) as nullable number =>
        if value = null then null
        else if Text.Trim(value) = "" then null
        else Number.FromText(Text.Trim(value), "en-US"),
    Numbers = Table.TransformColumns(Headers, {
        {"ProductSort", ParseNumber, Int64.Type},
        {"RegionSort", ParseNumber, Int64.Type},
        {"Revenue", ParseNumber, type nullable number}
    }),
    Labels = Table.TransformColumnTypes(Numbers, {
        {"Product", type text}, {"Region", type text}
    }, "en-US")
in
    Labels
