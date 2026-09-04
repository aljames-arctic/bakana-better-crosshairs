import { BaseCanvasAdapter } from "./base-canvas-adapter.js";
import { CanvasV13Adapter } from "./canvas-v13-adapter.js";
import { CanvasV14Adapter } from "./canvas-v14-adapter.js";
import { version } from "../../lib/utils.js";
import { MODULE_NAME } from "../../lib/constants.js";
import { log } from "../../lib/logger.js";

export { BaseCanvasAdapter, CanvasV13Adapter, CanvasV14Adapter };

/**
 * Active canvas adapter instance, defaulting to base adapter before initialization.
 * @type {BaseCanvasAdapter|CanvasV13Adapter|CanvasV14Adapter}
 */
export let canvasAdapter = new BaseCanvasAdapter();

/**
 * Initialize the active Foundry VTT canvas adapter (v13 or v14).
 * Evaluates supported generation boundaries using boolean version.clamp.
 * Should be called during the "init" hook.
 * @returns {BaseCanvasAdapter|CanvasV13Adapter|CanvasV14Adapter}
 */
export function initializeCanvasAdapter() {
    const ver = game?.version ?? "14";

    if (version.clamp(ver, "14")) {
        canvasAdapter = new CanvasV14Adapter();
    } else if (version.clamp(ver, "13", "14")) {
        canvasAdapter = new CanvasV13Adapter();
    } else {
        canvasAdapter = new BaseCanvasAdapter();
    }

    log.info(`Initialized Canvas Adapter for Foundry VTT generation: v${canvasAdapter.version ?? "base"}`);
    return canvasAdapter;
}

/**
 * Convenience re-exports delegating to active canvas adapter instance.
 */
export const addHighlightLayer = (id) => canvasAdapter.addHighlightLayer(id);
export const getHighlightLayer = (id) => canvasAdapter.getHighlightLayer(id);
export const clearHighlightLayer = (id) => canvasAdapter.clearHighlightLayer(id);
export const destroyHighlightLayer = (id) => canvasAdapter.destroyHighlightLayer(id);
export const highlightPosition = (id, options) => canvasAdapter.highlightPosition(id, options);
export const clearRegionsHighlight = () => canvasAdapter.clearRegionsHighlight();
export const deactivatePlaceablesLayers = () => canvasAdapter.deactivatePlaceablesLayers();
export const getCenterPoint = (coords) => canvasAdapter.getCenterPoint(coords);
export const getTopLeftPoint = (coords) => canvasAdapter.getTopLeftPoint(coords);
export const getSnappedPoint = (point, options) => canvasAdapter.getSnappedPoint(point, options);
export const getOffsetRange = (bounds) => canvasAdapter.getOffsetRange(bounds);
export const measureDistance = (origin, target) => canvasAdapter.measureDistance(origin, target);
export const snapCoordinates = (x, y, mode) => canvasAdapter.snapCoordinates(x, y, mode);
