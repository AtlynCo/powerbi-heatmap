import { test } from "node:test";
import assert from "node:assert/strict";
import { VisualFormattingSettingsModel } from "../src/settings";
import { Localizer } from "../src/localization";

test("safe default settings never assert additivity or normalize model ratios", () => {
    const settings = new VisualFormattingSettingsModel();
    assert.deepEqual(settings.analysisOptions(), { scope: "global", palette: "sequential", normalization: "raw", additive: false });
    assert.deepEqual(settings.dimensions(), { width: 88, height: 36, label: 136, font: 12 });
});

test("untrusted layout values are bounded and unknown enum values cannot enable normalization", () => {
    const settings = new VisualFormattingSettingsModel();
    settings.layout.cellWidth.value = 10000;
    settings.layout.cellHeight.value = -4;
    settings.layout.labelWidth.value = Number.NaN;
    settings.layout.fontSize.value = Infinity;
    settings.scale.scope.value.value = "bad";
    settings.values.normalization.value.value = "bad";
    assert.deepEqual(settings.dimensions(), { width: 180, height: 28, label: 136, font: 12 });
    assert.equal(settings.analysisOptions().normalization, "raw");
    assert.equal(settings.analysisOptions().scope, "global");
});

test("localization uses the host manager with complete English fallbacks", () => {
    const localizer = new Localizer({ getDisplayName: key => key === "Clear" ? "Translated clear" : key });
    assert.equal(localizer.text("Clear"), "Translated clear");
    assert.equal(localizer.text("Title"), "Atlyn Heatmap");
    assert.equal(localizer.getDisplayName("Unknown_resource"), "Unknown_resource");
});
