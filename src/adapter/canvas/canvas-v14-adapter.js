import { BaseCanvasAdapter } from "./base-canvas-adapter.js";
import { log } from "../../lib/logger.js";

/**
 * Foundry VTT V14+ Canvas Adapter.
 * Encapsulates canvas interactions and grid operations for Foundry V14+,
 * routing highlight management through canvas.interface.grid and coordinates through canvas.grid.
 */
export class CanvasV14Adapter extends BaseCanvasAdapter {
    constructor() {
        super();
        this.version = 14;
    }

    /**
     * Adds the specified grid highlight layer on Foundry V14 canvas.interface.grid.
     * @override
     * @param {string} id - Identifier of the highlight layer
     * @returns {void}
     */
    addHighlightLayer(id) {
        if (!id) {
            log.debug("CanvasV14Adapter.addHighlightLayer | Called with invalid or empty identifier.");
            return;
        }
        const cleanId = id.trim();
        if (!cleanId) return;

        const gridApi = canvas?.interface?.grid ?? canvas?.grid;
        if (gridApi?.addHighlightLayer) {
            try { return gridApi.addHighlightLayer(cleanId); } catch (e) {}
        }
        log.debug(`CanvasV14Adapter.addHighlightLayer | Could not add highlight layer for key "${cleanId}".`);
    }

    /**
     * Retrieves the specified grid highlight layer from Foundry V14 canvas.interface.grid.
     * @override
     * @param {string} id - Identifier of the highlight layer
     * @returns {Object|null}
     */
    getHighlightLayer(id) {
        if (!id) {
            log.debug("CanvasV14Adapter.getHighlightLayer | Called with invalid or empty identifier.");
            return null;
        }
        const cleanId = id.trim();
        if (!cleanId) return null;

        const gridApi = canvas?.interface?.grid ?? canvas?.grid;
        if (gridApi?.getHighlightLayer) {
            try { return gridApi.getHighlightLayer(cleanId); } catch (e) {}
        }
        return null;
    }

    /**
     * Clears the specified grid highlight layer on Foundry V14 canvas.interface.grid.
     * @override
     * @param {string} id - Identifier of the highlight layer
     * @returns {void}
     */
    clearHighlightLayer(id) {
        if (!id) {
            log.debug("CanvasV14Adapter.clearHighlightLayer | Called with invalid or empty identifier.");
            return;
        }
        const cleanId = id.trim();
        if (!cleanId) return;

        const gridApi = canvas?.interface?.grid ?? canvas?.grid;
        if (gridApi?.clearHighlightLayer) {
            try { return gridApi.clearHighlightLayer(cleanId); } catch (e) {}
        }
        log.debug(`CanvasV14Adapter.clearHighlightLayer | No highlight layer available for key "${cleanId}".`);
    }

    /**
     * Destroys the specified grid highlight layer on Foundry V14 canvas.interface.grid.
     * @override
     * @param {string} id - Identifier of the highlight layer
     * @returns {void}
     */
    destroyHighlightLayer(id) {
        if (!id) return;
        const cleanId = id.trim();
        if (!cleanId) return;

        const gridApi = canvas?.interface?.grid ?? canvas?.grid;
        if (gridApi?.destroyHighlightLayer) {
            try { gridApi.destroyHighlightLayer(cleanId); } catch (e) {}
        }
    }

    /**
     * Highlights a grid position on Foundry V14 canvas.interface.grid.
     * @override
     * @param {string} id - Identifier of the highlight layer
     * @param {Object} [options={}] - Highlight parameters
     * @returns {void}
     */
    highlightPosition(id, options = {}) {
        if (!id) return;
        const cleanId = id.trim();
        if (!cleanId) return;

        const gridApi = canvas?.interface?.grid ?? canvas?.grid;
        if (gridApi?.highlightPosition) {
            try { return gridApi.highlightPosition(cleanId, options); } catch (e) {}
        }
    }

    /**
     * Get the center point of a grid space on Foundry V14 canvas.grid.
     * @override
     * @param {{x?: number, y?: number, i?: number, j?: number}} coords - Coordinates object
     * @returns {{x: number, y: number}}
     */
    getCenterPoint(coords) {
        if (canvas?.grid?.getCenterPoint) {
            try {
                const pt = canvas.grid.getCenterPoint(coords);
                if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) return { x: pt.x, y: pt.y };
            } catch (e) {}
        }
        return super.getCenterPoint(coords);
    }

    /**
     * Get the top-left point of a grid space on Foundry V14 canvas.grid.
     * @override
     * @param {{x?: number, y?: number, i?: number, j?: number}} coords - Coordinates object
     * @returns {{x: number, y: number}}
     */
    getTopLeftPoint(coords) {
        if (canvas?.grid?.getTopLeftPoint) {
            try {
                const pt = canvas.grid.getTopLeftPoint(coords);
                if (pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) return { x: pt.x, y: pt.y };
            } catch (e) {}
        }
        return super.getTopLeftPoint(coords);
    }

    /**
     * Get snapped point coordinates on Foundry V14 canvas.grid.
     * @override
     * @param {{x: number, y: number}} point - Target point
     * @param {Object} [options={}] - Snapping options ({ mode })
     * @returns {{x: number, y: number}|null}
     */
    getSnappedPoint(point, options = {}) {
        if (canvas?.grid?.getSnappedPoint) {
            try {
                const snapped = canvas.grid.getSnappedPoint(point, options);
                if (snapped && Number.isFinite(snapped.x) && Number.isFinite(snapped.y)) {
                    return { x: snapped.x, y: snapped.y };
                }
            } catch (e) {}
        }
        return super.getSnappedPoint(point, options);
    }

    /**
     * Compute integer grid space coordinate offset range on Foundry V14 canvas.grid.
     * @override
     * @param {Object} bounds - Bounding rectangle
     * @returns {number[]|null}
     */
    getOffsetRange(bounds) {
        if (canvas?.grid?.getOffsetRange) {
            try { return canvas.grid.getOffsetRange(bounds); } catch (e) {}
        }
        return super.getOffsetRange(bounds);
    }
}
