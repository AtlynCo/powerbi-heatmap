// Query name: DefectLine. Depends on the SampleFolder text parameter.
let
    Path = Text.TrimEnd(SampleFolder, {"\"}) & "\defect-line.csv",
    Source = Csv.Document(
        File.Contents(Path),
        [Delimiter = ",", Columns = 6, Encoding = 65001, QuoteStyle = QuoteStyle.Csv]
    ),
    Headers = Table.PromoteHeaders(Source, [PromoteAllScalars = true]),
    ParseNumber = (value as nullable text) as nullable number =>
        if value = null then null
        else if Text.Trim(value) = "" then null
        else Number.FromText(Text.Trim(value), "en-US"),
    Numbers = Table.TransformColumns(Headers, {
        {"DefectSort", ParseNumber, Int64.Type},
        {"LineSort", ParseNumber, Int64.Type},
        {"Defects", ParseNumber, Int64.Type},
        {"Opportunities", ParseNumber, Int64.Type}
    }),
    Labels = Table.TransformColumnTypes(Numbers, {
        {"Defect", type text}, {"Line", type text}
    }, "en-US")
in
    Labels
