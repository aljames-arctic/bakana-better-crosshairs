import { systemAdapter, initializeSystemAdapter } from "./system/index.js";
import {
    crosshairAdapter,
    initializeFoundryAdapter,
    Token,
    MeasuredTemplate,
    Region,
    Ray,
    PreciseText,
    addHighlightLayer,
    getHighlightLayer,
    clearHighlightLayer,
    destroyHighlightLayer,
    highlightPosition,
    clearRegionsHighlight,
    deactivatePlaceablesLayers,
    getCenterPoint,
    getTopLeftPoint,
    getSnappedPoint,
    getOffsetRange,
    measureDistance,
    snapCoordinates,
    fromUuidSync,
    randomID,
    lineSegmentIntersection,
    parseColor,
    saveDataToFile,
    mergeObject,
    deepClone
} from "./foundry/index.js";
import {
    canvasAdapter,
    initializeCanvasAdapter,
    BaseCanvasAdapter,
    CanvasV13Adapter,
    CanvasV14Adapter
} from "./canvas/index.js";
import { autorecManager } from "../autorec/autorecManager.js";

let hooksInitialized = false;
let onRegisterConnected = false;

/**
 * Register canvas placement and document creation hooks across the active Foundry generation and Game System.
 * Abstracts hook registration so that it depends on both the version adapter and system adapter.
 * @param {Object} [callbacks={}] - Placement hook callbacks (`{ onDrawPreview, onPreCreate, onCreate }`)
 * @param {Object} [options={}] - Execution options (`{ foundryAdapter, sysAdapter }`)
 * @returns {Array<{event: string, handler: Function, category: string, targetName: string}>} Array of registered hook descriptor objects
 */
export function registerPlacementHooks(callbacks = {}, options = {}) {
    const fAdapter = options.foundryAdapter ?? crosshairAdapter;
    const sAdapter = options.sysAdapter ?? systemAdapter;
    const hooks = fAdapter.registerPlacementHooks(callbacks, sAdapter);
    sAdapter.registerItemSheetHooks();
    return hooks;
}

/**
 * Initialize crosshair placement hooks and ready synchronization.
 * @param {Object} [options={}] - Execution options (`{ foundryAdapter, sysAdapter }`)
 * @returns {void}
 */
export function initializeHooks(options = {}) {
    if (!onRegisterConnected) {
        onRegisterConnected = true;
        autorecManager.onRegister(() => initializeHooks(options));
    }

    if (hooksInitialized) return;
    hooksInitialized = true;

    registerPlacementHooks({}, options);

    if (game?.ready) {
        autorecManager.initializeReadySync();
    } else {
        Hooks?.once?.("ready", () => autorecManager.initializeReadySync());
    }
}

export {
    systemAdapter,
    initializeSystemAdapter,
    crosshairAdapter,
    initializeFoundryAdapter,
    canvasAdapter,
    initializeCanvasAdapter,
    BaseCanvasAdapter,
    CanvasV13Adapter,
    CanvasV14Adapter,
    Token,
    MeasuredTemplate,
    Region,
    Ray,
    PreciseText,
    addHighlightLayer,
    getHighlightLayer,
    clearHighlightLayer,
    destroyHighlightLayer,
    highlightPosition,
    clearRegionsHighlight,
    deactivatePlaceablesLayers,
    getCenterPoint,
    getTopLeftPoint,
    getSnappedPoint,
    getOffsetRange,
    measureDistance,
    snapCoordinates,
    fromUuidSync,
    randomID,
    lineSegmentIntersection,
    parseColor,
    saveDataToFile,
    mergeObject,
    deepClone
};
