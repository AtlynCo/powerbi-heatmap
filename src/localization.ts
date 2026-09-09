import type powerbi from "powerbi-visuals-api";
import strings from "./strings.json";

export type StringKey = keyof typeof strings;

export class Localizer implements powerbi.extensibility.ILocalizationManager {
    private readonly messageKeys = new Map<string, StringKey>(Object.entries(strings).map(([key, value]) => [value, key as StringKey]));
    constructor(private readonly manager: powerbi.extensibility.ILocalizationManager) {}

    public getDisplayName(key: string): string {
        const localized = this.manager.getDisplayName(key);
        if (localized && localized !== key) return localized;
        return Object.prototype.hasOwnProperty.call(strings, key) ? strings[key as StringKey] : key;
    }

    public text(key: StringKey): string {
        return this.getDisplayName(key);
    }

    public message(message: string): string {
        const key = this.messageKeys.get(message);
        return key ? this.text(key) : message;
    }
}
