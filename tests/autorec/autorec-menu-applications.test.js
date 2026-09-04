import "../setup.js";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

import { BaseCrosshairMenuApplication, normalizeHexColor } from "../../src/autorec/BaseCrosshairMenuApplication.js";
import { AutorecMenuApplication } from "../../src/autorec/autorecMenu.js";
import { ItemCrosshairConfigApplication } from "../../src/autorec/itemConfigMenu.js";
import { autorecManager } from "../../src/autorec/autorecManager.js";
import { systemAdapter } from "../../src/adapter/system/index.js";

systemAdapter.initialize();

test("BaseCrosshairMenuApplication & normalizeHexColor utility", async (t) => {
    await t.test("normalizeHexColor validates 6-digit hex strings", () => {
        assert.equal(normalizeHexColor("#ff0000"), "#ff0000");
        assert.equal(normalizeHexColor("#123456"), "#123456");
        assert.equal(normalizeHexColor("invalid", "#000000"), "#000000");
        assert.equal(normalizeHexColor(123456, "#ffffff"), "#ffffff");
        assert.equal(normalizeHexColor(null), "#000000");
    });

    await t.test("BaseCrosshairMenuApplication._normalizeElement handles polymorphic inputs", () => {
        const app = new BaseCrosshairMenuApplication();
        const dummyEl = { tagName: "DIV", nodeType: 1 };
        Object.setPrototypeOf(dummyEl, globalThis.HTMLElement?.prototype ?? Object.prototype);

        // Null / undefined input
        assert.equal(app._normalizeElement(null), null);
        assert.equal(app._normalizeElement(undefined), null);

        // Object with .element property
        const appWrapper = { element: dummyEl };
        assert.equal(app._normalizeElement(appWrapper), dummyEl);
    });

    await t.test("BaseCrosshairMenuApplication._getAdapterTitles returns adapter titles object", () => {
        const app = new BaseCrosshairMenuApplication();
        const titles = app._getAdapterTitles();
        assert.ok(titles);
        assert.ok(typeof titles.docTerm === "string");
        assert.ok(typeof titles.prePlacementTitle === "string");
        assert.ok(typeof titles.previewPlacementSectionTitle === "string");
        assert.ok(typeof titles.placementSectionTitle === "string");
        assert.ok(typeof titles.postPlacementTitle === "string");
    });

    await t.test("BaseCrosshairMenuApplication._onRender wires 'use-player-color' button to populate text and color inputs", () => {
        const app = new BaseCrosshairMenuApplication();
        const originalUserColor = game.user.color;
        game.user.color = "#4a90e2";

        const textEvents = [];
        const mockTextInput = {
            value: "#000000",
            dispatchEvent(ev) { textEvents.push(ev.type); }
        };

        const colorEvents = [];
        const mockColorPicker = {
            value: "#000000",
            dispatchEvent(ev) { colorEvents.push(ev.type); }
        };

        const mockRow = {
            querySelector(selector) {
                if (selector === "input[type='text']") return mockTextInput;
                if (selector === "input[type='color']") return mockColorPicker;
                return null;
            }
        };

        let clickHandler;
        const mockBtn = {
            addEventListener(event, fn) {
                if (event === "click") clickHandler = fn;
            },
            closest(selector) {
                if (selector === ".bbc-edit-color-row") return mockRow;
                return null;
            }
        };

        const mockRoot = {
            nodeType: 1,
            querySelectorAll(selector) {
                if (selector === "[data-action='use-player-color']") return [mockBtn];
                return [];
            },
            querySelector() { return null; }
        };

        app.element = mockRoot;
        app._onRender({}, {});

        assert.ok(clickHandler, "Click handler should be registered");

        let defaultPrevented = false;
        let propagationStopped = false;
        clickHandler({
            currentTarget: mockBtn,
            preventDefault() { defaultPrevented = true; },
            stopPropagation() { propagationStopped = true; }
        });

        assert.equal(defaultPrevented, true);
        assert.equal(propagationStopped, true);
        assert.equal(mockTextInput.value, "#4a90e2");
        assert.equal(mockColorPicker.value, "#4a90e2");
        assert.deepEqual(textEvents, ["input", "change"]);
        assert.deepEqual(colorEvents, ["input", "change"]);

        if (originalUserColor !== undefined) {
            game.user.color = originalUserColor;
        } else {
            delete game.user.color;
        }
    });
});

test("AutorecMenuApplication lifecycle and context preparation", async (t) => {
    await t.test("_prepareContext returns normalized context data", async () => {
        const app = new AutorecMenuApplication();
        const context = await app._prepareContext({});

        assert.ok(context);
        assert.ok(Array.isArray(context.entries));
        assert.equal(typeof context.count, "number");
        assert.equal(typeof context.isEmpty, "boolean");
        assert.equal(context.isGM, true);
        assert.equal(typeof context.supportsActivities, "boolean");
        assert.ok(context.labels);
        assert.equal(typeof context.labels.usePlayerColor, "string");
        assert.ok(context.labels.usePlayerColor.length > 0);
        assert.equal(typeof context.previewPlacementSectionTitle, "string");
        assert.equal(typeof context.labels.previewFill, "string");
        assert.equal(typeof context.labels.previewBorder, "string");
        assert.equal(typeof context.labels.overridePreviewPlacement, "string");
    });

    await t.test("_prepareContext computes hasCustomStyling when preview colors diverge from defaults", async () => {
        autorecManager.register("Colored Spell", {
            itemName: "Colored Spell",
            fillColor: "#ff00ff"
        }, { local: true });

        const app = new AutorecMenuApplication();
        const context = await app._prepareContext({});
        const coloredEntry = context.entries.find(e => e.itemName === "Colored Spell");
        assert.ok(coloredEntry);
        assert.equal(coloredEntry.hasCustomStyling, true);

        autorecManager.unregister("Colored Spell", { local: true });
    });

    await t.test("AutorecMenuApplication DEFAULT_OPTIONS and PARTS static properties", () => {
        assert.equal(AutorecMenuApplication.DEFAULT_OPTIONS.id, "bbc-autorec-menu");
        assert.equal(AutorecMenuApplication.DEFAULT_OPTIONS.tag, "form");
        assert.ok(AutorecMenuApplication.PARTS.main.template.includes("autorecMenu.html"));
    });

    await t.test("autorecMenu.html and itemConfigMenu.html pass previewPlacementSectionTitle to configFieldsPartial", async () => {
        const autorecHtml = await fs.readFile(new URL("../../src/autorec/autorecMenu.html", import.meta.url), "utf8");
        const itemConfigHtml = await fs.readFile(new URL("../../src/autorec/itemConfigMenu.html", import.meta.url), "utf8");

        assert.ok(autorecHtml.includes("previewPlacementSectionTitle=../previewPlacementSectionTitle"));
        assert.ok(itemConfigHtml.includes("previewPlacementSectionTitle=../previewPlacementSectionTitle"));
    });

    await t.test("_prepareContext includes persist and hasPlacedStyling for persisted entries", async () => {
        autorecManager.register("Persisted Web", {
            itemName: "Persisted Web",
            persist: true
        }, { local: true });

        const app = new AutorecMenuApplication();
        const context = await app._prepareContext({});
        const webEntry = context.entries.find(e => e.itemName === "Persisted Web");
        assert.ok(webEntry);
        assert.equal(webEntry.persist, true);
        assert.equal(webEntry.hasPlacedStyling, true);

        autorecManager.unregister("Persisted Web", { local: true });
    });

    await t.test("_prepareContext preserves broadcast flag for entries with broadcast: false", async () => {
        autorecManager.register("Silent Spell", {
            itemName: "Silent Spell",
            broadcast: false
        }, { local: true });

        const app = new AutorecMenuApplication();
        const context = await app._prepareContext({});
        const silentEntry = context.entries.find(e => e.itemName === "Silent Spell");
        assert.ok(silentEntry);
        assert.equal(silentEntry.broadcast, false);

        autorecManager.unregister("Silent Spell", { local: true });
    });
});

test("ItemCrosshairConfigApplication lifecycle and item normalization", async (t) => {
    await t.test("constructor normalizes target item document or wrapper", () => {
        const mockDoc = { id: "item-123", name: "Test Spell" };
        const mockPlaceable = { document: mockDoc };

        const app1 = new ItemCrosshairConfigApplication({ item: mockDoc });
        assert.equal(app1.item, mockDoc);
        assert.equal(app1.options.id, "bbc-item-crosshair-config-item-123");

        const app2 = new ItemCrosshairConfigApplication({ item: mockPlaceable });
        assert.equal(app2.item, mockDoc);
        assert.equal(app2.options.id, "bbc-item-crosshair-config-item-123");
    });

    await t.test("_prepareContext evaluates item flags and scopes", async () => {
        const flags = {};
        const mockItem = {
            id: "fireball-item",
            name: "Fireball",
            img: "icons/fireball.png",
            getFlag: (scope, key) => flags[key] ?? null,
            setFlag: async (scope, key, val) => { flags[key] = val; },
            unsetFlag: async (scope, key) => { delete flags[key]; }
        };

        const app = new ItemCrosshairConfigApplication({ item: mockItem });
        const context = await app._prepareContext({});

        assert.ok(context);
        assert.equal(context.itemName, "Fireball");
        assert.equal(context.itemImg, "icons/fireball.png");
        assert.equal(context.selectedScope, "item");
        assert.ok(Array.isArray(context.scopes));
        assert.equal(context.scopes.length, 1);
        assert.equal(context.scopes[0].id, "item");
        assert.equal(context.scopes[0].hasCustom, false);
        assert.equal(context.config.enableAnimation, false);
        assert.equal(context.config.enablePrePlacement, false);
        assert.equal(context.config.enablePreviewPlacement, false);
        assert.equal(context.config.enablePlacedStyling, false);
        assert.equal(context.config.enablePostPlacement, false);
        assert.equal(typeof context.previewPlacementSectionTitle, "string");
        assert.ok(context.config);
        assert.equal(typeof context.config.borderColorPicker, "string");
        assert.equal(typeof context.config.fillColorPicker, "string");
        assert.ok(context.labels);
        assert.equal(typeof context.labels.usePlayerColor, "string");
        assert.ok(context.labels.usePlayerColor.length > 0);
    });

    await t.test("_prepareContext identifies active activity overrides and sidebar scopes", async () => {
        const flags = {
            activityConfigs: {
                "act-save": {
                    enableAnimation: true,
                    circleFile: "custom.circle.effect"
                }
            }
        };
        const mockActivities = new Map([
            ["act-save", { id: "act-save", name: "Saving Throw", type: "save" }],
            ["act-damage", { id: "act-damage", name: "Damage Roll", type: "damage" }]
        ]);
        const mockItem = {
            id: "spell-item",
            name: "Custom Spell",
            system: { activities: mockActivities },
            getFlag: (scope, key) => flags[key] ?? null,
            setFlag: async (scope, key, val) => { flags[key] = val; },
            unsetFlag: async (scope, key) => { delete flags[key]; }
        };

        const app = new ItemCrosshairConfigApplication({ item: mockItem, selectedScope: "act-save" });
        const context = await app._prepareContext({});

        assert.equal(context.scopes.length, 3);
        assert.equal(context.scopes[0].id, "item");
        assert.equal(context.scopes[0].hasCustom, false);

        const saveScope = context.scopes.find(s => s.id === "act-save");
        assert.ok(saveScope);
        assert.equal(saveScope.hasCustom, true);
        assert.equal(saveScope.overrideCount, 1);
        assert.equal(saveScope.isSelected, true);

        const damageScope = context.scopes.find(s => s.id === "act-damage");
        assert.ok(damageScope);
        assert.equal(damageScope.hasCustom, false);

        assert.equal(context.currentScope.id, "act-save");
        assert.equal(context.config.enableAnimation, true);
        assert.equal(context.config.circleFile, "custom.circle.effect");
    });

    await t.test("_prepareContext identifies customConfig.enabled === false as custom override", async () => {
        const flags = {
            customConfig: {
                enabled: false
            }
        };
        const mockItem = {
            id: "disabled-item",
            name: "Disabled Spell",
            getFlag: (scope, key) => flags[key] ?? null,
            setFlag: async (scope, key, val) => { flags[key] = val; },
            unsetFlag: async (scope, key) => { delete flags[key]; }
        };

        const app = new ItemCrosshairConfigApplication({ item: mockItem });
        const context = await app._prepareContext({});

        assert.ok(context);
        assert.equal(context.scopes[0].hasCustom, true);
        assert.equal(context.scopes[0].overrideCount, 1);
        assert.equal(context.config.enabled, false);
    });

    await t.test("_prepareContext identifies customConfig.broadcast === false as custom override", async () => {
        const flags = {
            customConfig: {
                broadcast: false
            }
        };
        const mockItem = {
            id: "unbroadcast-item",
            name: "Secret Spell",
            getFlag: (scope, key) => flags[key] ?? null,
            setFlag: async (scope, key, val) => { flags[key] = val; },
            unsetFlag: async (scope, key) => { delete flags[key]; }
        };

        const app = new ItemCrosshairConfigApplication({ item: mockItem });
        const context = await app._prepareContext({});

        assert.ok(context);
        assert.equal(context.scopes[0].hasCustom, true);
        assert.equal(context.scopes[0].overrideCount, 1);
        assert.equal(context.config.broadcast, false);
    });

    await t.test("_prepareContext identifies customConfig.enablePreviewPlacement === true as custom override", async () => {
        const flags = {
            customConfig: {
                enablePreviewPlacement: true,
                fillColor: "#ff00ff",
                fillAlpha: 0.75,
                borderColor: "#00ffff",
                borderAlpha: 0.9
            }
        };
        const mockItem = {
            id: "preview-item",
            name: "Preview Styled Spell",
            getFlag: (scope, key) => flags[key] ?? null,
            setFlag: async (scope, key, val) => { flags[key] = val; },
            unsetFlag: async (scope, key) => { delete flags[key]; }
        };

        const app = new ItemCrosshairConfigApplication({ item: mockItem });
        const context = await app._prepareContext({});

        assert.ok(context);
        assert.equal(context.scopes[0].hasCustom, true);
        assert.equal(context.scopes[0].overrideCount, 1);
        assert.equal(context.config.enablePreviewPlacement, true);
        assert.equal(context.config.fillColor, "#ff00ff");
        assert.equal(context.config.fillAlpha, 0.75);
        assert.equal(context.config.borderColor, "#00ffff");
        assert.equal(context.config.borderAlpha, 0.9);
    });

    await t.test("_saveConfiguration persists enablePreviewPlacement and preview styling", async () => {
        const flags = {};
        const mockItem = {
            id: "save-preview-item",
            name: "Save Preview Spell",
            getFlag: (scope, key) => flags[key] ?? null,
            setFlag: async (scope, key, val) => { flags[key] = val; },
            unsetFlag: async (scope, key) => { delete flags[key]; }
        };

        const app = new ItemCrosshairConfigApplication({ item: mockItem });

        const formDataMap = new Map([
            ["enabled", "on"],
            ["broadcast", "on"],
            ["enablePreviewPlacement", "on"],
            ["fillColor", "#112233"],
            ["fillAlpha", "0.45"],
            ["borderColor", "#445566"],
            ["borderAlpha", "0.85"]
        ]);

        const mockForm = {
            tagName: "FORM",
            nodeType: 1
        };

        const originalFormData = globalThis.FormData;
        globalThis.FormData = class MockFormData {
            constructor(form) {
                this._map = formDataMap;
            }
            get(key) {
                return this._map.get(key) ?? null;
            }
        };

        try {
            await app._saveConfiguration(mockForm);
            assert.ok(flags.customConfig);
            assert.equal(flags.customConfig.enablePreviewPlacement, true);
            assert.equal(flags.customConfig.fillColor, "#112233");
            assert.equal(flags.customConfig.fillAlpha, 0.45);
            assert.equal(flags.customConfig.borderColor, "#445566");
            assert.equal(flags.customConfig.borderAlpha, 0.85);
        } finally {
            globalThis.FormData = originalFormData;
        }
    });
});
