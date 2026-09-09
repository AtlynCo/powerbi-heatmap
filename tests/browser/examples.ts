import { readFileSync } from "node:fs";
import { join } from "node:path";
import { matrixFixture } from "../fixtures";

export function example(kind: "product-region" | "defect-line") {
    const [header, ...lines] = readFileSync(join("samples", `${kind}.csv`), "utf8").trim().split(/\r?\n/).map(line => line.split(","));
    const rows = [...new Set(lines.map(line => line[0]))];
    const columns = [...new Set(lines.map(line => line[2]))];
    const data = matrixFixture(rows.length, columns.length);
    data.metadata.columns[0].displayName = header[0];
    data.metadata.columns[1].displayName = header[2];
    const sources = data.matrix!.valueSources;
    sources[0].displayName = header[4];
    sources[0].format = kind === "product-region" ? "$#,0" : "#,0";
    sources[1].displayName = "Inspection opportunities";
    sources[1].format = "#,0";
    sources[2].displayName = "Example source row";
    data.matrix!.columns.root.children!.forEach((node, c) => { node.levelValues![0].value = columns[c]; });
    data.matrix!.rows.root.children!.forEach((node, r) => {
        node.levelValues![0].value = rows[r];
        node.values = {};
        columns.forEach((column, c) => {
            const lineIndex = lines.findIndex(line => line[0] === rows[r] && line[2] === column);
            if (lineIndex < 0) return;
            const line = lines[lineIndex];
            node.values![c * 3] = line[4] === "" ? Object.assign({ value: 0 }, { value: null }) : { value: Number(line[4]) };
            node.values![c * 3 + 1] = { value: Number(line[5] || 1), valueSourceIndex: 1 };
            node.values![c * 3 + 2] = { value: lineIndex + 1, valueSourceIndex: 2 };
        });
    });
    return data;
}
