/**
 * Namespace compatibility shim for Foundry VTT API updates across versions.
 */
import { log } from "./logger.js";

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
 */
export const Ray = foundry?.canvas?.geometry?.Ray;

/**
 * Reference to Foundry's mergeObject utility.
 */
export const mergeObject = foundry?.utils?.mergeObject;

/**
 * Reference to Foundry's deepClone utility.
 */
export const deepClone = foundry?.utils?.deepClone;

/**
 * Clears the specified grid highlight layer across Foundry canvas versions.
 *
 * @param {string} id - The identifier of the highlight layer to clear.
 * @returns {void}
 */
export function clearHighlightLayer(id) {
    if (typeof id !== "string" || !id.trim()) {
        log.debug("compat.clearHighlightLayer | Called with invalid or empty identifier.");
        return;
    }
    const cleanId = id.trim();
    const gridApi = canvas?.interface?.grid ?? canvas?.grid;

    if (typeof gridApi?.clearHighlightLayer === "function") {
        try { return gridApi.clearHighlightLayer(cleanId); } catch (e) {}
    }

    const legacyLayer = canvas?.grid?.highlightLayers?.[cleanId];
    if (legacyLayer && typeof legacyLayer.clear === "function") {
        try { legacyLayer.clear(); return; } catch (e) {}
    }

    log.debug(`compat.clearHighlightLayer | No highlight layer available for key "${cleanId}".`);
}

/**
 * Destroys the specified grid highlight layer across Foundry canvas versions.
 *
 * @param {string} id - The identifier of the highlight layer to destroy.
 * @returns {void}
 */
export function destroyHighlightLayer(id) {
    if (typeof id !== "string" || !id.trim()) return;
    const cleanId = id.trim();
    const gridApi = canvas?.interface?.grid ?? canvas?.grid;

    if (typeof gridApi?.destroyHighlightLayer === "function") {
        try { gridApi.destroyHighlightLayer(cleanId); } catch (e) {}
    }

    const legacyLayer = canvas?.grid?.highlightLayers?.[cleanId];
    if (legacyLayer && typeof legacyLayer.destroy === "function") {
        try { legacyLayer.destroy({ children: true }); } catch (e) {}
    }
    if (canvas?.grid?.highlightLayers && cleanId in canvas.grid.highlightLayers) {
        try { delete canvas.grid.highlightLayers[cleanId]; } catch (e) {}
    }
}

/**
 * Safely saves text or JSON string data to a file across Foundry VTT API versions.
 * Checks namespaced foundry.utils.saveDataToFile first to prevent global accessor deprecation warnings.
 * @param {string} data - String payload to save
 * @param {string} type - MIME type (e.g. "text/json")
 * @param {string} filename - Output filename
 * @returns {boolean} True if native Foundry save helper handled the request
 */
export function saveDataToFile(data, type, filename) {
    const cleanFilename = String(filename ?? "export.json").replace(/[/\\]/g, "_").trim() || "export.json";
    const cleanType = String(type ?? "application/json").trim() || "application/json";
    const cleanData = typeof data === "string" ? data : JSON.stringify(data ?? {});

    try {
        const utilsFn = foundry?.utils?.saveDataToFile;
        if (utilsFn) {
            utilsFn(cleanData, cleanType, cleanFilename);
            log.debug(`compat.saveDataToFile | File "${cleanFilename}" saved via foundry.utils.saveDataToFile.`);
            return true;
        }
    } catch (err) {
        log.warn(`compat.saveDataToFile | Error calling foundry.utils.saveDataToFile for "${cleanFilename}".`, err);
    }

    log.error(`compat.saveDataToFile | Failed to save file "${cleanFilename}": zero valid file writers available.`);
    return false;
}
