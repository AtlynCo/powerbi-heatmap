import type powerbi from "powerbi-visuals-api";

type Id = powerbi.visuals.ISelectionId;
type Host = powerbi.extensibility.visual.IVisualHost;
type Visual = powerbi.extensibility.visual.IVisual;

export interface HarnessState {
    selections: string[];
    selectionCalls: { key: string; multi: boolean }[];
    contextCalls: { key: string; x: number; y: number }[];
    tooltipCalls: powerbi.extensibility.TooltipShowOptions[];
    lifecycle: string[];
    fetchCalls: boolean[];
    fetchAccepted: boolean;
    selectionRejected: boolean;
    fetchThrows: boolean;
    contextThrows: boolean;
    selectionThrows: boolean;
}

export interface HarnessWindow extends Window {
    powerbi: { visuals: { plugins: Record<string, { create(options: powerbi.extensibility.visual.VisualConstructorOptions): Visual }> } };
    heatmap: { visual: Visual; host: Host; state: HarnessState; incoming(keys: string[]): void };
    heatmaps: Record<string, HarnessWindow["heatmap"]>;
}

// This function is serialized into Chromium. It models the host API, not Power BI itself.
export function installHost(config: { guid: string; locale: string; highContrast: boolean; interactions: boolean; rootId?: string }): void {
    const target = window as unknown as HarnessWindow;
    const state: HarnessState = {
        selections: [], selectionCalls: [], contextCalls: [], tooltipCalls: [], lifecycle: [],
        fetchCalls: [], fetchAccepted: true, selectionRejected: false,
        fetchThrows: false, contextThrows: false, selectionThrows: false
    };
    let selected: Id[] = [];
    let onSelect: (ids: Id[]) => void = () => undefined;
    function identity(key: string): Id {
        const parts = key.split("|").filter(Boolean);
        return {
            getKey: () => key,
            hasIdentity: () => !!key,
            equals: other => other.getKey() === key,
            includes: other => parts.every(part => other.getKey().split("|").includes(part)),
            getSelector: () => ({}),
            getSelectorsByColumn: () => ({})
        };
    }
    function builder(): powerbi.visuals.ISelectionIdBuilder {
        const keys: string[] = [];
        const result: powerbi.visuals.ISelectionIdBuilder = {
            withMatrixNode(node) {
                if (node.identity && "key" in node.identity && typeof node.identity.key === "string") keys.push(node.identity.key);
                return result;
            },
            withCategory() { throw new Error("Unexpected categorical identity"); },
            withSeries() { throw new Error("Unexpected series identity"); },
            withTable() { throw new Error("Unexpected table identity"); },
            withMeasure(name) { keys.push(name); return result; },
            createSelectionId: () => identity(keys.join("|"))
        };
        return result;
    }
    const manager = {
        select(ids: Id | Id[], multi?: boolean) {
            if (state.selectionThrows) throw new Error("Host threw during selection");
            if (state.selectionRejected) return Promise.reject(new Error("Host rejected selection"));
            const list = Array.isArray(ids) ? ids : [ids];
            state.selectionCalls.push({ key: list[0].getKey(), multi: !!multi });
            selected = multi ? [...selected, ...list] : list;
            state.selections = selected.map(id => id.getKey());
            onSelect(selected);
            return Promise.resolve(selected);
        },
        async clear() { selected = []; state.selections = []; onSelect([]); return {}; },
        getSelectionIds: () => selected,
        hasSelection: () => selected.length > 0,
        registerOnSelectCallback: (callback: (ids: Id[]) => void) => { onSelect = callback; },
        showContextMenu(id: Id, position: { x: number; y: number }) {
            if (state.contextThrows) throw new Error("Host threw during context menu");
            state.contextCalls.push({ key: id.getKey(), ...position }); return Promise.resolve({});
        },
        async toggleExpandCollapse() { throw new Error("No hierarchy expansion in v1"); }
    };
    const foreground = { value: "#ffff00" };
    const background = { value: "#000000" };
    const palette = {
        isHighContrast: config.highContrast, foreground, background, foregroundSelected: { value: "#00ffff" },
        getColor: () => foreground, reset() { return this; }
    };
    const host = {
        createSelectionIdBuilder: builder,
        createSelectionManager: () => manager,
        createLocalizationManager: () => ({ getDisplayName: (key: string) => key }),
        locale: config.locale,
        colorPalette: palette,
        hostCapabilities: { allowInteractions: config.interactions },
        tooltipService: {
            enabled: () => true,
            show: (options: powerbi.extensibility.TooltipShowOptions) => state.tooltipCalls.push(options),
            move: () => undefined,
            hide: () => undefined
        },
        eventService: {
            renderingStarted: () => state.lifecycle.push("started"),
            renderingFinished: () => state.lifecycle.push("finished"),
            renderingFailed: (_options: unknown, reason?: string) => state.lifecycle.push(`failed: ${reason}`)
        },
        fetchMoreData: (aggregate = true) => {
            if (state.fetchThrows) throw new Error("Host threw during fetch");
            state.fetchCalls.push(aggregate); return state.fetchAccepted;
        }
    };
    // This partial mock uses native promises in place of the host's legacy IPromise type.
    const typedHost = host as unknown as Host;
    const plugin = target.powerbi.visuals.plugins[config.guid];
    if (!plugin) throw new Error(`Packaged plugin ${config.guid} was not registered`);
    const root = document.getElementById(config.rootId || "visual");
    if (!root) throw new Error("Missing visual root");
    const visual = plugin.create({ element: root, host: typedHost });
    const instance = {
        visual, host: typedHost, state,
        incoming(keys: string[]) { selected = keys.map(identity); state.selections = keys; onSelect(selected); }
    };
    target.heatmaps ??= {};
    target.heatmaps[config.rootId || "visual"] = instance;
    if (!config.rootId || config.rootId === "visual") target.heatmap = instance;
}
