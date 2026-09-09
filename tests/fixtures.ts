import type powerbi from "powerbi-visuals-api";

export function matrixFixture(rows = 3, columns = 4, partial = false): powerbi.DataView {
    const row: powerbi.DataViewMetadataColumn = { displayName: "Product", queryName: "Product.Name", roles: { row: true }, type: { text: true } };
    const column: powerbi.DataViewMetadataColumn = { displayName: "Region", queryName: "Region.Name", roles: { column: true }, type: { text: true } };
    const value: powerbi.DataViewMetadataColumn = { displayName: "Revenue", queryName: "Sales.Revenue", roles: { value: true }, isMeasure: true, type: { numeric: true }, format: "$#,0.00;($#,0.00);$0.00" };
    const denominator: powerbi.DataViewMetadataColumn = { displayName: "Regional target", queryName: "Sales.Target", roles: { denominator: true }, isMeasure: true, type: { numeric: true }, format: "$#,0.00" };
    const tooltip: powerbi.DataViewMetadataColumn = { displayName: "Units", queryName: "Sales.Units", roles: { tooltips: true }, isMeasure: true, type: { numeric: true }, format: "#,0" };
    return {
        metadata: { columns: [row, column, value, denominator, tooltip], ...(partial ? { segment: {} } : {}) },
        matrix: {
            valueSources: [value, denominator, tooltip],
            rows: {
                levels: [{ sources: [row] }],
                root: {
                    children: Array.from({ length: rows }, (_, r) => ({
                        level: 0,
                        levelValues: [{ levelSourceIndex: 0, value: ["Bikes", "Helmets", "Gloves"][r] || `Product ${r + 1}` }],
                        identity: { key: `r${r}` },
                        values: Object.fromEntries(Array.from({ length: columns }, (_, c) => [
                            [c * 3, { value: (r + 1) * (c + 1) * 100.5 }],
                            [c * 3 + 1, { value: 2000, valueSourceIndex: 1 }],
                            [c * 3 + 2, { value: (r + 1) * 10, valueSourceIndex: 2 }]
                        ]).flat())
                    }))
                }
            },
            columns: {
                levels: [{ sources: [column] }, { sources: [value, denominator, tooltip] }],
                root: {
                    children: Array.from({ length: columns }, (_, c) => ({
                        level: 0,
                        levelValues: [{ levelSourceIndex: 0, value: ["West", "East", "North", "South"][c] || `Region ${c + 1}` }],
                        identity: { key: `c${c}` },
                        children: [0, 1, 2].map(valueSourceIndex => ({ level: 1, valueSourceIndex }))
                    }))
                }
            }
        }
    };
}
