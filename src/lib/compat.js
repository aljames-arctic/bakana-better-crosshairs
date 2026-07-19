/**
 * Namespace compatibility shim for Foundry VTT API updates across versions.
 */

/**
 * Reference to the Foundry VTT Token placeable class.
 * @type {typeof foundry.canvas.placeables.Token}
 */
export const Token = globalThis.foundry?.canvas?.placeables?.Token ?? globalThis.Token;

/**
 * Reference to the Foundry VTT Ray geometry class.
 */
export const Ray = globalThis.foundry?.canvas?.geometry?.Ray ?? globalThis.Ray;

/**
 * Clears the specified grid highlight layer.
 *
 * @param {string} id - The identifier of the highlight layer to clear.
 * @returns {void}
 */
export function clearHighlightLayer(id) {
    if (typeof id !== "string" || !id) return;
    if (canvas?.interface?.grid?.clearHighlightLayer) {
        return canvas.interface.grid.clearHighlightLayer(id);
    }
    return canvas?.grid?.clearHighlightLayer?.(id);
}

