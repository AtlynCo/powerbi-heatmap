import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { buildModel, Model, Scalar, MAX_CELLS, MAX_ROWS } from "./data";
import { analyze, Analysis, AnalyzedCell, AnalysisOptions, Domain, colorFor, textColor } from "./analysis";
import { Localizer, StringKey } from "./localization";
import { VisualFormattingSettingsModel } from "./settings";
import thirdParty from "./thirdParty.json";
import "../style/visual.less";

type SelectionId = powerbi.visuals.ISelectionId;
type UpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
type Host = powerbi.extensibility.visual.IVisualHost;

interface GridItem {
    element: HTMLTableCellElement;
    row: number;
    column: number;
    identity?: SelectionId;
    cell?: AnalyzedCell;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

export class Visual implements powerbi.extensibility.visual.IVisual {
    private readonly host: Host;
    private readonly selection: powerbi.extensibility.ISelectionManager;
    private readonly localizer: Localizer;
    private readonly formatting: FormattingSettingsService;
    private readonly root = element("div", "atlyn-heatmap");
    private readonly heading = element("div", "heading");
    private readonly viewport = element("div", "viewport");
    private readonly footer = element("div", "footer");
    private readonly live = element("div", "sr-only");
    private readonly status = element("div", "status");
    private readonly scopeLabel = element("span");
    private readonly legendRamp = element("span", "ramp");
    private settings = new VisualFormattingSettingsModel();
    private model: Model = buildModel(undefined);
    private analysis: Analysis = { cells: [], domains: [], notices: [] };
    private options: AnalysisOptions = { normalization: "raw", additive: false, scope: "global", palette: "sequential" };
    private items: GridItem[] = [];
    private active = { row: 1, column: 1 };
    private rowLabels: string[] = [];
    private columnLabels: string[] = [];
    private loadButton?: HTMLButtonElement;
    private pending = false;
    private fetchStopped = false;
    private fetchTimer?: ReturnType<typeof setTimeout>;
    private generation = 0;
    private destroyed = false;
    private highContrast = false;
    private rtl = false;

    constructor(options?: powerbi.extensibility.visual.VisualConstructorOptions) {
        if (!options) throw new Error("Power BI visual constructor options are required.");
        this.host = options.host;
        this.selection = this.host.createSelectionManager();
        this.localizer = new Localizer(this.host.createLocalizationManager());
        this.formatting = new FormattingSettingsService(this.localizer);
        this.root.append(this.heading, this.viewport, this.footer, this.live);
        this.live.setAttribute("aria-live", "polite");
        this.live.setAttribute("aria-atomic", "true");
        this.root.setAttribute("aria-label", this.t("Title"));
        options.element.appendChild(this.root);
        this.selection.registerOnSelectCallback(() => {
            if (!this.destroyed) this.paintSelections();
        });
        this.root.addEventListener("keydown", this.onKeyDown);
        this.root.addEventListener("click", this.onClick);
        this.root.addEventListener("contextmenu", this.onContextMenu);
        this.root.addEventListener("pointerover", this.onPointerOver);
        this.root.addEventListener("pointermove", this.onPointerMove);
        this.root.addEventListener("pointerout", this.onPointerOut);
        this.root.addEventListener("focusin", this.onFocus);
        this.viewport.addEventListener("scroll", this.hideTooltip, { passive: true });
    }

    public update(options: UpdateOptions): void {
        this.host.eventService.renderingStarted(options);
        try {
            const isData = !!(options.type & powerbi.VisualUpdateType.Data);
            const dataView = options.dataViews?.[0];
            if (dataView || isData) {
                const previousCount = this.model.cells.length;
                const wasPending = this.pending;
                if (isData) {
                    this.generation++;
                    this.pending = false;
                    if (this.fetchTimer) clearTimeout(this.fetchTimer);
                    if (options.operationKind !== powerbi.VisualDataChangeOperationKind.Append) {
                        this.fetchStopped = false;
                    }
                }
                this.model = buildModel(dataView);
                this.settings = dataView
                    ? this.formatting.populateFormattingSettingsModel(VisualFormattingSettingsModel, dataView)
                    : new VisualFormattingSettingsModel();
                if (isData && wasPending && options.operationKind === powerbi.VisualDataChangeOperationKind.Append &&
                    this.model.segment && this.model.cells.length <= previousCount) {
                    this.fetchStopped = true;
                }
            }
            this.options = this.settings.analysisOptions();
            this.analysis = analyze(this.model, this.options);
            this.render(options.viewport);
            this.host.eventService.renderingFinished(options);
        } catch (error) {
            // The host boundary must surface rendering failures rather than leave stale, plausible data.
            this.items = [];
            this.viewport.replaceChildren(element("div", "empty", this.t("RenderFailed")));
            this.report(`${this.t("RenderFailed")} ${error instanceof Error ? error.message : String(error)}`);
            this.host.eventService.renderingFailed(options, error instanceof Error ? error.message : String(error));
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        this.settings.localize(this.localizer);
        return this.formatting.buildFormattingModel(this.settings);
    }

    private t(key: StringKey): string {
        return this.localizer.text(key);
    }

    private format(value: powerbi.PrimitiveValue | undefined, source?: powerbi.DataViewMetadataColumn, percent = false, override?: string): string {
        if (value === null) return this.t("State_blank");
        if (value === undefined) return this.t("State_absent");
        if (typeof value === "number" && !Number.isFinite(value)) return this.t("State_invalid");
        const format = percent ? "0.0%;-0.0%;0.0%" : override ?? (source ? valueFormatter.getFormatStringByColumn(source) : undefined);
        const formatted = valueFormatter.format(value, format, false, this.host.locale);
        return formatted.length > 1024 ? `${formatted.slice(0, 1021)}...` : formatted;
    }

    private scalar(value: Scalar, percent = false, source = this.model.valueSource, format?: string): string {
        return value.state === "value" ? this.format(value.value, source, percent, format) : this.t(`State_${value.state}`);
    }

    private symbol(value: Scalar, format?: string): string {
        switch (value.state) {
            case "value": return this.scalar(value, this.options.normalization !== "raw", this.model.valueSource, format);
            case "blank": return "B";
            case "absent": return "-";
            case "unloaded": return "?";
            case "invalid": return "!";
            case "unavailable": return "n/a";
        }
    }

    private semantics(): string {
        const keys: Record<AnalysisOptions["normalization"], StringKey> = {
            raw: "RawSemantics", row: "RowSemantics", column: "ColumnSemantics", all: "AllSemantics", denominator: "DenominatorSemantics"
        };
        return this.t(keys[this.options.normalization]);
    }

    private render(size: powerbi.IViewport): void {
        const focused = this.viewport.contains(document.activeElement);
        const scrollTop = this.viewport.scrollTop;
        const scrollLeft = this.viewport.scrollLeft;
        const dimensions = this.settings.dimensions();
        dimensions.label = Math.min(dimensions.label, Math.max(56, Math.floor(size.width * 0.4)));
        dimensions.width = Math.min(dimensions.width, Math.max(56, size.width - dimensions.label - 24));
        dimensions.height = Math.max(Math.ceil(dimensions.font * 1.35) + 8,
            Math.min(dimensions.height, Math.max(28, Math.floor((size.height - 64) / 2))));
        this.highContrast = this.host.colorPalette.isHighContrast;
        this.rtl = /^(ar|fa|he|ur|ps|dv)(-|$)/i.test(this.host.locale) ||
            getComputedStyle(this.root.parentElement ?? this.root).direction === "rtl";
        const gridHeight = dimensions.height * 2 + 24;
        const tiny = size.width < 180 || size.height < 120 || gridHeight > size.height - 32;
        this.root.classList.toggle("tiny", tiny);
        this.root.classList.toggle("high-contrast", this.highContrast);
        this.root.dir = this.rtl ? "rtl" : "ltr";
        this.root.style.width = `${Math.max(0, size.width)}px`;
        this.root.style.height = `${Math.max(0, size.height)}px`;
        this.root.style.fontSize = `${dimensions.font}px`;
        this.root.style.setProperty("--cell-height", `${dimensions.height}px`);
        const chromeHeight = Math.max(0, size.height - gridHeight);
        this.heading.style.maxHeight = `${Math.min(size.height * 0.4, chromeHeight * 0.55)}px`;
        this.footer.style.maxHeight = `${Math.min(size.height * 0.26, chromeHeight * 0.45)}px`;
        for (const property of ["--background", "--foreground", "--border", "--focus"]) this.root.style.removeProperty(property);
        if (this.highContrast) {
            this.root.style.setProperty("--background", this.host.colorPalette.background.value);
            this.root.style.setProperty("--foreground", this.host.colorPalette.foreground.value);
            this.root.style.setProperty("--border", this.host.colorPalette.foreground.value);
            this.root.style.setProperty("--focus", this.host.colorPalette.foregroundSelected.value);
        }
        this.hideTooltip();
        this.items = [];
        this.rowLabels = this.model.rows.map(axis => this.format(axis.value, axis.source));
        this.columnLabels = this.model.columns.map(axis => this.format(axis.value, axis.source));
        this.renderHeading();
        this.renderFooter();
        if (tiny || this.model.error || !this.model.rows.length || !this.model.columns.length) {
            const message = tiny ? this.t("Tiny") : this.model.error ? this.localizer.message(this.model.error) : this.t("Empty");
            this.viewport.replaceChildren(element("div", "empty", message));
            this.viewport.tabIndex = 0;
            return;
        }
        this.viewport.removeAttribute("tabindex");
        const table = element("table");
        table.setAttribute("role", "grid");
        table.setAttribute("aria-label", this.t("Grid"));
        table.setAttribute("aria-rowcount", String(this.model.rows.length + 1));
        table.setAttribute("aria-colcount", String(this.model.columns.length + 1));
        table.setAttribute("aria-multiselectable", "true");
        table.style.width = `${dimensions.label + this.model.columns.length * (dimensions.width + 2) + 4}px`;
        const colgroup = element("colgroup");
        const labelCol = element("col");
        labelCol.style.width = `${dimensions.label}px`;
        colgroup.appendChild(labelCol);
        for (let c = 0; c < this.model.columns.length; c++) {
            const col = element("col");
            col.style.width = `${dimensions.width}px`;
            colgroup.appendChild(col);
        }
        table.appendChild(colgroup);
        const head = element("thead");
        const headerRow = element("tr");
        headerRow.setAttribute("aria-rowindex", "1");
        const corner = this.gridItem("th", 0, 0, `${this.model.rows[0].source.displayName} / ${this.model.columns[0].source.displayName}`);
        corner.element.setAttribute("aria-label", this.t("Clear"));
        headerRow.appendChild(corner.element);
        const columnIds = this.model.columns.map(axis => axis.node.identity
            ? this.host.createSelectionIdBuilder().withMatrixNode(axis.node, this.model.columnLevels).createSelectionId()
            : undefined);
        const rowIds = this.model.rows.map(axis => axis.node.identity
            ? this.host.createSelectionIdBuilder().withMatrixNode(axis.node, this.model.rowLevels).createSelectionId()
            : undefined);
        for (let c = 0; c < this.model.columns.length; c++) {
            const item = this.gridItem("th", 0, c + 1, this.columnLabels[c], columnIds[c]);
            item.element.scope = "col";
            headerRow.appendChild(item.element);
        }
        head.appendChild(headerRow);
        table.appendChild(head);
        const body = element("tbody");
        for (let r = 0; r < this.model.rows.length; r++) {
            const row = element("tr");
            row.setAttribute("aria-rowindex", String(r + 2));
            const rowItem = this.gridItem("th", r + 1, 0, this.rowLabels[r], rowIds[r]);
            rowItem.element.scope = "row";
            row.appendChild(rowItem.element);
            for (let c = 0; c < this.model.columns.length; c++) {
                const analyzed = this.analysis.cells[r * this.model.columns.length + c];
                const id = rowIds[r] && columnIds[c]
                    ? this.host.createSelectionIdBuilder()
                        .withMatrixNode(this.model.rows[r].node, this.model.rowLevels)
                        .withMatrixNode(this.model.columns[c].node, this.model.columnLevels)
                        .createSelectionId()
                    : undefined;
                const item = this.gridItem("td", r + 1, c + 1, this.symbol(analyzed.displayed, analyzed.cell.format), id, analyzed);
                const td = item.element;
                td.dataset.state = analyzed.displayed.state;
                if (analyzed.displayed.state === "value" && analyzed.domain && analyzed.displayed.value !== undefined) {
                    const background = colorFor(analyzed.displayed.value, analyzed.domain, this.options.palette);
                    td.style.backgroundColor = background;
                    td.style.color = textColor(background);
                    if (!this.settings.values.showValues.value && !this.highContrast && analyzed.displayed.value !== 0) {
                        td.textContent = "";
                    }
                }
                td.setAttribute("aria-label", this.cellDescription(analyzed));
                // Native tooltips carry the same full text; a title also works when the host disables them.
                td.title = this.cellDescription(analyzed);
                row.appendChild(td);
            }
            body.appendChild(row);
        }
        table.appendChild(body);
        this.viewport.replaceChildren(table);
        if (rowIds.some(id => !id?.hasIdentity()) || columnIds.some(id => !id?.hasIdentity())) {
            this.footer.appendChild(element("div", "notice", this.t("NoIdentity")));
        }
        this.active.row = Math.min(this.active.row, this.model.rows.length);
        this.active.column = Math.min(this.active.column, this.model.columns.length);
        this.setActive(this.active.row, this.active.column, false);
        this.viewport.scrollTop = scrollTop;
        this.viewport.scrollLeft = scrollLeft;
        this.paintSelections();
        if (focused) this.setActive(this.active.row, this.active.column, true);
    }

    private renderHeading(): void {
        const toolbar = element("div", "toolbar");
        toolbar.appendChild(element("span", "title", this.model.valueSource?.displayName || this.t("Title")));
        const clear = element("button", undefined, this.t("Clear"));
        clear.type = "button";
        clear.dataset.action = "clear";
        toolbar.appendChild(clear);
        this.loadButton = undefined;
        if (this.model.segment && !this.model.limited && this.model.rows.length < MAX_ROWS && this.model.cells.length < MAX_CELLS) {
            this.loadButton = element("button", undefined, this.t("LoadMore"));
            this.loadButton.type = "button";
            this.loadButton.dataset.action = "load";
            this.loadButton.disabled = this.pending || this.fetchStopped;
            toolbar.appendChild(this.loadButton);
        }
        const semantics = element("div", "semantics", this.semantics());
        const legend = element("div", "legend");
        this.legendRamp.replaceChildren();
        for (let i = 0; i < 9; i++) {
            const swatch = element("span", "swatch");
            swatch.style.backgroundColor = this.highContrast ? this.host.colorPalette.background.value
                : colorFor(this.options.palette === "diverging" ? i / 4 - 1 : i / 8,
                    this.options.palette === "diverging" ? { min: -1, max: 1 } : { min: 0, max: 1 }, this.options.palette);
            this.legendRamp.appendChild(swatch);
        }
        this.legendRamp.setAttribute("aria-hidden", "true");
        legend.append(this.legendRamp, this.scopeLabel);
        this.heading.replaceChildren(toolbar, semantics, legend);
        const firstDomain = this.analysis.cells.find(cell => cell.domain)?.domain;
        this.updateLegend(firstDomain);
    }

    private updateLegend(domain?: Domain, item?: GridItem): void {
        const scopeKey = this.options.scope === "global" ? "Global" : this.options.scope === "row" ? "PerRow" : "PerColumn";
        const group = item && this.options.scope !== "global"
            ? this.options.scope === "row" ? this.rowLabels[item.row - 1] : this.columnLabels[item.column - 1]
            : undefined;
        const scale = this.options.palette === "sequential" ? this.t("Sequential") : this.t("Diverging");
        const bounds = domain ? `${this.format(domain.min, this.model.valueSource, this.options.normalization !== "raw")} .. ${this.format(domain.max, this.model.valueSource, this.options.normalization !== "raw")}` : this.t("NoDomain");
        this.scopeLabel.textContent = `${this.t(scopeKey)} | ${scale} | ${group ? `${group}: ` : ""}${this.options.scope !== "global" && !group ? this.t("LocalDomain") : bounds}`;
    }

    private renderFooter(): void {
        this.status.textContent = this.model.error ? this.localizer.message(this.model.error) : (this.pending ? this.t("Loading") : this.fetchStopped ? this.t("FetchStalled")
            : this.model.partial ? this.t("Partial") : this.t("Complete"));
        this.footer.replaceChildren(this.status);
        if (this.analysis.error) this.footer.appendChild(element("div", "notice", this.localizer.message(this.analysis.error)));
        for (const notice of [...this.model.notices, ...this.analysis.notices]) {
            this.footer.appendChild(element("div", "notice", this.localizer.message(notice)));
        }
        this.footer.appendChild(element("div", "notice", this.t("Key")));
        const details = element("details");
        details.appendChild(element("summary", undefined, this.t("Details")));
        for (const text of [this.t("Help"), this.highContrast ? this.t("HighContrast") : "",
            this.model.hasHighlights ? this.t("Highlights") : ""]) {
            if (text) details.appendChild(element("div", "notice", text));
        }
        this.footer.appendChild(details);
        const legal = element("details");
        legal.append(element("summary", undefined, this.t("ThirdParty")), element("pre", "legal", thirdParty.text));
        this.footer.appendChild(legal);
    }

    private gridItem(tag: "th" | "td", row: number, column: number, text: string, identity?: SelectionId, cell?: AnalyzedCell): GridItem {
        const node = element(tag, undefined, text);
        node.tabIndex = -1;
        node.dataset.row = String(row);
        node.dataset.column = String(column);
        node.title = text;
        node.setAttribute("aria-colindex", String(column + 1));
        node.setAttribute("aria-selected", "false");
        node.setAttribute("aria-disabled", String((row !== 0 || column !== 0) && !identity?.hasIdentity()));
        const item = { element: node, row, column, identity, cell };
        this.items.push(item);
        return item;
    }

    private cellDescription(item: AnalyzedCell): string {
        const value = item.cell;
        return [
            `${this.rowLabels[value.row]} / ${this.columnLabels[value.column]}`,
            `${this.t("Raw")}: ${this.scalar(value.raw, false, this.model.valueSource, value.format)}`,
            this.options.normalization === "raw" ? "" : `${this.t("Displayed")}: ${this.scalar(item.displayed, true)}`,
            item.domain ? `${this.t("Scale")}: ${this.format(item.domain.min, this.model.valueSource, this.options.normalization !== "raw")} .. ${this.format(item.domain.max, this.model.valueSource, this.options.normalization !== "raw")}` : "",
            this.model.hasHighlights ? `${this.t("Highlight")}: ${this.scalar(value.highlight, false, this.model.valueSource, value.format)}` : ""
        ].filter(Boolean).join(". ");
    }

    private findItem(target: EventTarget | null): GridItem | undefined {
        if (!(target instanceof Element)) return undefined;
        const cell = target.closest<HTMLTableCellElement>("th[data-row], td[data-row]");
        if (!cell || !this.viewport.contains(cell)) return undefined;
        const row = Number(cell.dataset.row);
        const column = Number(cell.dataset.column);
        return this.items[row * (this.model.columns.length + 1) + column];
    }

    private readonly onClick = (event: MouseEvent): void => {
        if (!(event.target instanceof Element)) return;
        const action = event.target.closest<HTMLElement>("[data-action]")?.dataset.action;
        if (action === "clear") this.clear();
        else if (action === "load") this.loadMore();
        else {
            const item = this.findItem(event.target);
            if (item) {
                this.setActive(item.row, item.column, true);
                this.select(item, event.ctrlKey || event.metaKey);
            } else if (event.target === this.viewport) this.clear();
        }
    };

    private readonly onFocus = (event: FocusEvent): void => {
        const item = this.findItem(event.target);
        if (item) {
            this.setActive(item.row, item.column, false);
            if (item.cell) this.updateLegend(item.cell.domain, item);
        }
    };

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        if (event.key === "Escape") {
            event.preventDefault();
            this.hideTooltip();
            this.clear();
            return;
        }
        const item = this.findItem(event.target);
        if (!item) return;
        let { row, column } = item;
        const page = Math.max(1, Math.floor(this.viewport.clientHeight / (this.settings.dimensions().height + 2)) - 1);
        switch (event.key) {
            case "ArrowUp": row--; break;
            case "ArrowDown": row++; break;
            case "ArrowLeft": column += this.rtl ? 1 : -1; break;
            case "ArrowRight": column += this.rtl ? -1 : 1; break;
            case "Home": column = 0; if (event.ctrlKey || event.metaKey) row = 0; break;
            case "End": column = this.model.columns.length; if (event.ctrlKey || event.metaKey) row = this.model.rows.length; break;
            case "PageUp": row -= page; break;
            case "PageDown": row += page; break;
            case "Enter":
            case " ": this.select(item, event.ctrlKey || event.metaKey); event.preventDefault(); return;
            case "ContextMenu": this.contextMenu(item); event.preventDefault(); return;
            case "F10":
                if (event.shiftKey) { this.contextMenu(item); event.preventDefault(); }
                return;
            default: return;
        }
        event.preventDefault();
        this.setActive(Math.max(0, Math.min(this.model.rows.length, row)), Math.max(0, Math.min(this.model.columns.length, column)), true);
    };

    private setActive(row: number, column: number, focus: boolean): void {
        const stride = this.model.columns.length + 1;
        const previous = this.items[this.active.row * stride + this.active.column];
        if (previous) previous.element.tabIndex = -1;
        const item = this.items[row * stride + column];
        if (!item) return;
        this.active = { row, column };
        item.element.tabIndex = 0;
        if (item.cell) this.updateLegend(item.cell.domain, item);
        if (focus) {
            item.element.focus({ preventScroll: true });
            this.reveal(item);
        }
    }

    private reveal(item: GridItem): void {
        const box = item.element.getBoundingClientRect();
        const view = this.viewport.getBoundingClientRect();
        const headerHeight = this.items[0]?.element.getBoundingClientRect().height ?? 0;
        const rowLabelWidth = this.items[0]?.element.getBoundingClientRect().width ?? 0;
        if (item.row > 0) {
            if (box.top < view.top + headerHeight + 3) this.viewport.scrollTop += box.top - view.top - headerHeight - 3;
            else if (box.bottom > view.top + this.viewport.clientHeight) this.viewport.scrollTop += box.bottom - view.top - this.viewport.clientHeight;
        }
        if (item.column > 0) {
            const left = view.left + (this.rtl ? 0 : rowLabelWidth + 3);
            const right = view.left + this.viewport.clientWidth - (this.rtl ? rowLabelWidth + 3 : 0);
            if (box.left < left) this.viewport.scrollLeft += box.left - left;
            else if (box.right > right) this.viewport.scrollLeft += box.right - right;
        }
    }

    private interactionsAllowed(): boolean {
        if (this.host.hostCapabilities.allowInteractions === false) {
            this.report(this.t("InteractionDisabled"));
            return false;
        }
        return true;
    }

    private select(item: GridItem, multi: boolean): void {
        if (!item.row && !item.column) { this.clear(); return; }
        if (!this.interactionsAllowed()) return;
        if (!item.identity?.hasIdentity()) { this.report(this.t("NoSelection")); return; }
        const generation = this.generation;
        Promise.resolve(this.selection.select(item.identity, multi)).then(() => {
            if (!this.destroyed && generation === this.generation) {
                this.paintSelections();
                this.live.textContent = this.t("Selected");
            }
        }, () => { if (!this.destroyed) this.report(this.t("SelectionFailed")); });
    }

    private clear(): void {
        if (!this.interactionsAllowed()) return;
        Promise.resolve(this.selection.clear()).then(() => {
            if (!this.destroyed) {
                this.paintSelections();
                this.live.textContent = this.t("Cleared");
            }
        }, () => { if (!this.destroyed) this.report(this.t("SelectionFailed")); });
    }

    private paintSelections(): void {
        const selected = this.selection.getSelectionIds() as SelectionId[];
        for (const item of this.items) {
            const matches = !!item.identity && selected.some(id => id.includes(item.identity!));
            item.element.setAttribute("aria-selected", String(matches));
            const highlighted = !!item.cell && item.cell.cell.highlight.state === "value";
            item.element.classList.toggle("highlighted", highlighted && this.model.hasHighlights);
            item.element.classList.toggle("dimmed", (!!item.cell && this.model.hasHighlights && !highlighted) ||
                (selected.length > 0 && !!item.cell && !matches));
        }
    }

    private readonly onContextMenu = (event: MouseEvent): void => {
        event.preventDefault();
        this.contextMenu(this.findItem(event.target), event.clientX, event.clientY);
    };

    private contextMenu(item?: GridItem, x?: number, y?: number): void {
        if (!this.interactionsAllowed()) return;
        if (item && (item.row || item.column) && !item.identity?.hasIdentity()) { this.report(this.t("NoSelection")); return; }
        const rect = (item?.element ?? this.viewport).getBoundingClientRect();
        const identity = item?.identity ?? this.host.createSelectionIdBuilder().createSelectionId();
        Promise.resolve(this.selection.showContextMenu(identity, { x: x ?? rect.left + rect.width / 2, y: y ?? rect.top + rect.height / 2 }))
            .then(undefined, () => { if (!this.destroyed) this.report(this.t("ContextFailed")); });
    }

    private tooltipItems(item: GridItem): powerbi.extensibility.VisualTooltipDataItem[] {
        const cell = item.cell?.cell;
        if (!cell || !item.cell) return [];
        const data: powerbi.extensibility.VisualTooltipDataItem[] = [
            { displayName: this.model.rows[cell.row].source.displayName, value: this.rowLabels[cell.row] },
            { displayName: this.model.columns[cell.column].source.displayName, value: this.columnLabels[cell.column] },
            { displayName: this.model.valueSource?.displayName || this.t("Raw"), value: this.scalar(cell.raw, false, this.model.valueSource, cell.format) }
        ];
        if (this.options.normalization !== "raw") data.push({ displayName: this.t("Displayed"), value: this.scalar(item.cell.displayed, true) });
        if (this.model.denominatorSource) data.push({ displayName: this.model.denominatorSource.displayName, value: this.scalar(cell.denominator, false, this.model.denominatorSource) });
        if (this.model.hasHighlights) data.push({ displayName: this.t("Highlight"), value: this.scalar(cell.highlight, false, this.model.valueSource, cell.format) });
        if (item.cell.domain) data.push({
            displayName: this.t("Scale"),
            value: `${this.format(item.cell.domain.min, this.model.valueSource, this.options.normalization !== "raw")} .. ${this.format(item.cell.domain.max, this.model.valueSource, this.options.normalization !== "raw")}`
        });
        for (const tooltip of cell.tooltips) data.push({ displayName: tooltip.source.displayName, value: this.format(tooltip.value, tooltip.source) });
        data.push({ displayName: this.t("Details"), value: this.semantics() });
        return data;
    }

    private readonly onPointerOver = (event: PointerEvent): void => {
        const item = this.findItem(event.target);
        if (!item?.cell) return;
        this.updateLegend(item.cell.domain, item);
        if (!this.host.tooltipService.enabled()) return;
        this.host.tooltipService.show({
            coordinates: [event.clientX, event.clientY], isTouchEvent: event.pointerType === "touch",
            identities: item.identity ? [item.identity] : [], dataItems: this.tooltipItems(item)
        });
    };

    private readonly onPointerMove = (event: PointerEvent): void => {
        const item = this.findItem(event.target);
        if (!item?.cell || !this.host.tooltipService.enabled()) return;
        this.host.tooltipService.move({
            coordinates: [event.clientX, event.clientY], isTouchEvent: event.pointerType === "touch",
            identities: item.identity ? [item.identity] : []
        });
    };

    private readonly onPointerOut = (event: PointerEvent): void => {
        if (this.findItem(event.target)?.element !== this.findItem(event.relatedTarget)?.element) this.hideTooltip();
    };

    private readonly hideTooltip = (): void => {
        this.host.tooltipService.hide({ isTouchEvent: false, immediately: true });
    };

    private loadMore(): void {
        if (this.pending || this.fetchStopped || !this.model.segment || this.model.limited ||
            this.model.rows.length >= MAX_ROWS || this.model.cells.length >= MAX_CELLS) return;
        this.pending = true;
        if (this.loadButton) this.loadButton.disabled = true;
        this.report(this.t("Loading"));
        if (!this.host.fetchMoreData(true)) {
            this.pending = false;
            this.fetchStopped = true;
            this.report(this.t("FetchRejected"));
            return;
        }
        this.fetchTimer = setTimeout(() => {
            if (!this.destroyed && this.pending) this.report(this.t("FetchPending"));
        }, 15000);
    }

    private report(message: string): void {
        this.status.textContent = message;
        this.live.textContent = message;
    }

    public destroy(): void {
        this.destroyed = true;
        if (this.fetchTimer) clearTimeout(this.fetchTimer);
        this.hideTooltip();
        this.root.removeEventListener("keydown", this.onKeyDown);
        this.root.removeEventListener("click", this.onClick);
        this.root.removeEventListener("contextmenu", this.onContextMenu);
        this.root.removeEventListener("pointerover", this.onPointerOver);
        this.root.removeEventListener("pointermove", this.onPointerMove);
        this.root.removeEventListener("pointerout", this.onPointerOut);
        this.root.removeEventListener("focusin", this.onFocus);
        this.viewport.removeEventListener("scroll", this.hideTooltip);
        this.items = [];
        this.root.remove();
    }
}
