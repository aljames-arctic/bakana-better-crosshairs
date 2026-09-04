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
 * Reference to Foundry's canvas PreciseText container or PIXI.Text.
 */
export const PreciseText = foundry?.canvas?.containers?.PreciseText ?? globalThis.PreciseText ?? (typeof PIXI !== "undefined" ? PIXI?.Text : undefined);

/**
 * Reference to Foundry's mergeObject utility.
 */
export const mergeObject = (original, other, options) => crosshairAdapter.mergeObject(original, other, options);

/**
 * Reference to Foundry's deepClone utility.
 */
export const deepClone = (obj) => crosshairAdapter.deepClone(obj);

/**
 * Adds the specified grid highlight layer across Foundry canvas versions.
 * @param {string} id - The identifier of the highlight layer to add.
 * @returns {void}
 */
export const addHighlightLayer = (id) => crosshairAdapter.addHighlightLayer(id);

/**
 * Retrieves the specified grid highlight layer across Foundry canvas versions.
 * @param {string} id - The identifier of the highlight layer to get.
 * @returns {Object|null}
 */
export const getHighlightLayer = (id) => crosshairAdapter.getHighlightLayer(id);

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
 * Highlights a grid position on the canvas across Foundry versions.
 * @param {string} id - Identifier of the highlight layer
 * @param {Object} [options={}] - Highlight parameters
 * @returns {void}
 */
export const highlightPosition = (id, options) => crosshairAdapter.highlightPosition(id, options);

/**
 * Safely clears region layer highlights across versions.
 * @returns {void}
 */
export const clearRegionsHighlight = () => crosshairAdapter.clearRegionsHighlight();

/**
 * Deactivates templates and regions placeable layers if active.
 * @returns {void}
 */
export const deactivatePlaceablesLayers = () => crosshairAdapter.deactivatePlaceablesLayers();

/**
 * Get the center point of a grid space enclosing the given coordinates across Foundry versions.
 * @param {{x?: number, y?: number, i?: number, j?: number}} coords - Coordinates object
 * @returns {{x: number, y: number}}
 */
export const getCenterPoint = (coords) => crosshairAdapter.getCenterPoint(coords);

/**
 * Get the top-left point of a grid space enclosing the given coordinates across Foundry versions.
 * @param {{x?: number, y?: number, i?: number, j?: number}} coords - Coordinates object
 * @returns {{x: number, y: number}}
 */
export const getTopLeftPoint = (coords) => crosshairAdapter.getTopLeftPoint(coords);

/**
 * Get snapped point coordinates on the grid.
 * @param {{x: number, y: number}} point - Target point
 * @param {Object} [options={}] - Snapping options ({ mode })
 * @returns {{x: number, y: number}|null}
 */
export const getSnappedPoint = (point, options) => crosshairAdapter.getSnappedPoint(point, options);

/**
 * Compute integer grid space coordinate offset range [i0, j0, i1, j1] enclosing a bounding rectangle across Foundry versions.
 * @param {Object} bounds - Bounding rectangle
 * @returns {number[]|null}
 */
export const getOffsetRange = (bounds) => crosshairAdapter.getOffsetRange(bounds);

/**
 * Measures grid distance between two coordinate points across Foundry versions.
 * @param {{x: number, y: number}} origin - Origin point
 * @param {{x: number, y: number}} target - Target point
 * @returns {number}
 */
export const measureDistance = (origin, target) => crosshairAdapter.measureDistance(origin, target);

/**
 * Snap coordinate values to grid space.
 * @param {number} x - Target X coordinate
 * @param {number} y - Target Y coordinate
 * @param {string|number|boolean} [mode="all"] - Snap mode
 * @returns {{x: number, y: number}}
 */
export const snapCoordinates = (x, y, mode) => crosshairAdapter.snapCoordinates(x, y, mode);

/**
 * Synchronously retrieves a document by UUID across Foundry VTT versions.
 * @param {string} uuid - The document UUID to resolve
 * @returns {Document|null}
 */
export const fromUuidSync = (uuid) => crosshairAdapter.fromUuidSync(uuid);

/**
 * Generates a random alphanumeric identifier across Foundry VTT versions.
 * @param {number} [length=16] - Length of random string
 * @returns {string}
 */
export const randomID = (length) => crosshairAdapter.randomID(length);

/**
 * Finds intersection point between two 2D line segments across Foundry versions.
 * @param {{x: number, y: number}} a - Segment 1 start
 * @param {{x: number, y: number}} b - Segment 1 end
 * @param {{x: number, y: number}} c - Segment 2 start
 * @param {{x: number, y: number}} d - Segment 2 end
 * @returns {{x: number, y: number}|null}
 */
export const lineSegmentIntersection = (a, b, c, d) => crosshairAdapter.lineSegmentIntersection(a, b, c, d);

/**
 * Converts color string (hex or named) or number into numeric color value.
 * @param {string|number|null|undefined} col - Input color
 * @param {number} [fallback=0] - Fallback numeric color
 * @returns {number}
 */
export const parseColor = (col, fallback) => crosshairAdapter.parseColor(col, fallback);

/**
 * Safely saves text or JSON string data to a file across Foundry VTT API versions.
 * @param {string|Object} data - String payload or object to save
 * @param {string} [type="application/json"] - MIME type (e.g. "text/json")
 * @param {string} [filename="export.json"] - Output filename
 * @returns {boolean} True if native Foundry save helper handled the request
 */
export const saveDataToFile = (data, type, filename) => crosshairAdapter.saveDataToFile(data, type, filename);


