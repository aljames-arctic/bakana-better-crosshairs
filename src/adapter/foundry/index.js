import { BaseFoundryVTTAdapter } from "./base-foundryvtt-adapter.js";
import { FoundryVTTV13Adapter } from "./foundryvtt-v13-adapter.js";
import { FoundryVTTV14Adapter } from "./foundryvtt-v14-adapter.js";
import { version } from "../../lib/utils.js";
import { MODULE_NAME } from "../../lib/constants.js";

export { BaseFoundryVTTAdapter, FoundryVTTV13Adapter, FoundryVTTV14Adapter, version };

/**
 * Active crosshair adapter instance, defaulting to base adapter before initialization.
 * @type {BaseFoundryVTTAdapter|FoundryVTTV13Adapter|FoundryVTTV14Adapter}
 */
export let crosshairAdapter = new BaseFoundryVTTAdapter();

/**
 * Initialize the active Foundry VTT version adapter (v13 or v14).
 * Evaluates supported generation boundaries using boolean version.clamp.
 * Should be called during the 'init' hook.
 * @returns {FoundryVTTV13Adapter|FoundryVTTV14Adapter} The initialized Foundry VTT adapter instance.
 */
export function initializeFoundryAdapter() {
    const ver = game.version;

    if (version.clamp(ver, "14")) {
        crosshairAdapter = new FoundryVTTV14Adapter();
    } else if (version.clamp(ver, "13", "14")) {
        crosshairAdapter = new FoundryVTTV13Adapter();
    } else {
        throw new Error(`[${MODULE_NAME}] Unsupported Foundry VTT generation (${ver}). Required: Foundry v13..v14+.`);
    }

    return crosshairAdapter;
}

/**
 * Reference to the Foundry VTT Token placeable class.
 * @type {typeof foundry.canvas.placeables.Token}
 */
export const Token = foundry?.canvas?.placeables?.Token;

/**
 * Reference to the Foundry VTT MeasuredTemplate placeable class.
 * @type {typeof foundry.canvas.placeables.MeasuredTemplate}
 */
export const MeasuredTemplate = foundry?.canvas?.placeables?.MeasuredTemplate;

/**
 * Reference to the Foundry VTT Region placeable class.
 * @type {typeof foundry.canvas.placeables.Region}
 */
export const Region = foundry?.canvas?.placeables?.Region;

/**
 * Reference to the Foundry VTT Ray geometry class.
 * @type {typeof foundry.canvas.geometry.Ray}
 */
export const Ray = foundry?.canvas?.geometry?.Ray;

/**
 * Reference to Foundry's mergeObject utility.
 */
export const mergeObject = (original, other, options) => crosshairAdapter.mergeObject(original, other, options);

/**
 * Reference to Foundry's deepClone utility.
 */
export const deepClone = (obj) => crosshairAdapter.deepClone(obj);

/**
 * Clears the specified grid highlight layer across Foundry canvas versions.
 * @param {string} id - The identifier of the highlight layer to clear.
 * @returns {void}
 */
export const clearHighlightLayer = (id) => crosshairAdapter.clearHighlightLayer(id);

/**
 * Destroys the specified grid highlight layer across Foundry canvas versions.
 * @param {string} id - The identifier of the highlight layer to destroy.
 * @returns {void}
 */
export const destroyHighlightLayer = (id) => crosshairAdapter.destroyHighlightLayer(id);

/**
 * Safely saves text or JSON string data to a file across Foundry VTT API versions.
 * @param {string|Object} data - String payload or object to save
 * @param {string} [type="application/json"] - MIME type (e.g. "text/json")
 * @param {string} [filename="export.json"] - Output filename
 * @returns {boolean} True if native Foundry save helper handled the request
 */
export const saveDataToFile = (data, type, filename) => crosshairAdapter.saveDataToFile(data, type, filename);

