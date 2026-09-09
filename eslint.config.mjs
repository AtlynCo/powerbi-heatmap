import powerbiVisualsConfigs from "eslint-plugin-powerbi-visuals";

export default [
  powerbiVisualsConfigs.configs.recommended,
  {
    ignores: ["node_modules/**", "dist/**", ".vscode/**", ".tmp/**", "test-results/**", "playwright-report/**"],
  },
  {
    files: ["tests/**", "scripts/**"],
    rules: {
      "powerbi-visuals/no-http-string": "off"
    }
  }
];
