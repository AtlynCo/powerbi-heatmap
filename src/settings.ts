import { formattingSettings } from "powerbi-visuals-utils-formattingmodel";
import type { AnalysisOptions } from "./analysis";
import type { Localizer, StringKey } from "./localization";

class ScaleCard extends formattingSettings.SimpleCard {
    name = "scale";
    displayName = "Color scale";
    displayNameKey = "Format_Scale";
    scope = new formattingSettings.ItemDropdown({
        name: "scope", displayName: "Scale scope", displayNameKey: "Format_Scope",
        items: [
            { value: "global", displayName: "Global" },
            { value: "row", displayName: "Per row" },
            { value: "column", displayName: "Per column" }
        ],
        value: { value: "global", displayName: "Global" }
    });
    palette = new formattingSettings.ItemDropdown({
        name: "palette", displayName: "Palette", displayNameKey: "Format_Palette",
        items: [
            { value: "sequential", displayName: "Sequential blue" },
            { value: "diverging", displayName: "Diverging, centered at zero" }
        ],
        value: { value: "sequential", displayName: "Sequential blue" }
    });
    slices = [this.scope, this.palette];
}

class ValuesCard extends formattingSettings.SimpleCard {
    name = "values";
    displayName = "Values and denominators";
    displayNameKey = "Format_Values";
    normalization = new formattingSettings.ItemDropdown({
        name: "normalization", displayName: "Display values", displayNameKey: "Format_Normalization",
        items: [
            { value: "raw", displayName: "Raw (model value)" },
            { value: "row", displayName: "Share of row" },
            { value: "column", displayName: "Share of column" },
            { value: "all", displayName: "Share of all cells" },
            { value: "denominator", displayName: "Value / supplied denominator" }
        ],
        value: { value: "raw", displayName: "Raw (model value)" }
    });
    additive = new formattingSettings.ToggleSwitch({
        name: "additive", displayName: "Value is a nonnegative additive measure",
        displayNameKey: "Format_Additive",
        description: "Author assertion. Allows computed shares of observed cells only. Never enable for ratios, averages or distinct counts.",
        descriptionKey: "Format_AdditiveHelp", value: false
    });
    showValues = new formattingSettings.ToggleSwitch({
        name: "showValues", displayName: "Show cell values", displayNameKey: "Format_ShowValues", value: true
    });
    slices = [this.normalization, this.additive, this.showValues];
}

class LayoutCard extends formattingSettings.SimpleCard {
    name = "layout";
    displayName = "Grid layout";
    displayNameKey = "Format_Layout";
    cellWidth = new formattingSettings.NumUpDown({
        name: "cellWidth", displayName: "Cell width (56-180 px)", displayNameKey: "Format_CellWidth", value: 88
    });
    cellHeight = new formattingSettings.NumUpDown({
        name: "cellHeight", displayName: "Cell height (28-64 px)", displayNameKey: "Format_CellHeight", value: 36
    });
    labelWidth = new formattingSettings.NumUpDown({
        name: "labelWidth", displayName: "Row label width (80-240 px)", displayNameKey: "Format_LabelWidth", value: 136
    });
    fontSize = new formattingSettings.NumUpDown({
        name: "fontSize", displayName: "Text size (10-20 px)", displayNameKey: "Format_FontSize", value: 12
    });
    slices = [this.cellWidth, this.cellHeight, this.labelWidth, this.fontSize];
}

function clamp(value: number, min: number, max: number, fallback: number): number {
    return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export class VisualFormattingSettingsModel extends formattingSettings.Model {
    scale = new ScaleCard();
    values = new ValuesCard();
    layout = new LayoutCard();
    cards = [this.scale, this.values, this.layout];

    public localize(localizer: Localizer): void {
        const choices: [formattingSettings.ItemDropdown, Record<string, StringKey>][] = [
            [this.scale.scope, { global: "Global", row: "PerRow", column: "PerColumn" }],
            [this.scale.palette, { sequential: "Choice_Sequential", diverging: "Diverging" }],
            [this.values.normalization, { raw: "Choice_Raw", row: "Choice_Row", column: "Choice_Column", all: "Choice_All", denominator: "Choice_Denominator" }]
        ];
        for (const [dropdown, keys] of choices) {
            for (const item of dropdown.items) item.displayName = localizer.text(keys[String(item.value)]);
            const key = keys[String(dropdown.value.value)];
            if (key) dropdown.value.displayName = localizer.text(key);
        }
    }

    public analysisOptions(): AnalysisOptions {
        const scope = this.scale.scope.value.value;
        const palette = this.scale.palette.value.value;
        const normalization = this.values.normalization.value.value;
        return {
            scope: scope === "row" || scope === "column" ? scope : "global",
            palette: palette === "diverging" ? "diverging" : "sequential",
            normalization: normalization === "row" || normalization === "column" || normalization === "all" || normalization === "denominator"
                ? normalization : "raw",
            additive: this.values.additive.value === true
        };
    }

    public dimensions(): { width: number; height: number; label: number; font: number } {
        return {
            width: clamp(this.layout.cellWidth.value, 56, 180, 88),
            height: clamp(this.layout.cellHeight.value, 28, 64, 36),
            label: clamp(this.layout.labelWidth.value, 80, 240, 136),
            font: clamp(this.layout.fontSize.value, 10, 20, 12)
        };
    }
}
