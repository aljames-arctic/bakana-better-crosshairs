import { BaseFoundryVTTAdapter } from "./base-foundryvtt-adapter.js";
import { systemAdapter } from "../system/index.js";
import { log } from "../../lib/logger.js";
import { localize } from "../../lib/utils.js";

/**
 * Adapter subclass encapsulating Foundry VTT v13 MeasuredTemplate placement behavior.
 */
export class FoundryVTTV13Adapter extends BaseFoundryVTTAdapter {
    /**
     * Construct a Foundry VTT V13 adapter instance.
     */
    constructor() {
        super();
        this.version = 13;
    }

    /**
     * Return canonical document terminology string ("template").
     * @returns {string} The localized or canonical document type term
     */
    get documentTerm() {
        return "template";
    }

    /**
     * Return section title header for pre-placement configuration.
     * @returns {string} Section header text
     */
    get prePlacementTitle() {
        return localize("BBC.autorecMenu.preTemplatePlacement", "Pre-Template Placement");
    }

    /**
     * Return section title header for placement configuration.
     * @returns {string} Section header text
     */
    get placementSectionTitle() {
        return localize("BBC.autorecMenu.templatePlacementConfig", "Template Placement Configuration");
    }

    /**
     * Return section title header for post-placement configuration.
     * @returns {string} Section header text
     */
    get postPlacementTitle() {
        return localize("BBC.autorecMenu.postTemplatePlacement", "Post-Template Placement");
    }

    /**
     * Return supported base canvas PlaceableObject type names for Foundry VTT v13.
     * @returns {string[]} Base placeable type names
     */
    get supportedBasePlaceables() {
        return ["MeasuredTemplate"];
    }

    /**
     * Return supported document creation type names (`preCreate`/`create` hook suffixes) for Foundry VTT v13.
     * @returns {string[]} Document type names
     */
    get supportedDocumentTypes() {
        return ["MeasuredTemplate"];
    }

    /**
     * Generate structured placement hook descriptors for Foundry VTT v13.
     * Quarantined directly inside FoundryVTTV13Adapter without relying on base class generation logic.
     * @param {Object} callbacks - Placement hook callbacks (`{ onDrawPreview, onPreCreate, onCreate }`)
     * @param {Object} [sysAdapter=systemAdapter] - Active System Adapter instance
     * @returns {Array<{event: string, handler: Function, category: string, targetName: string}>} Array of generated hook descriptor objects
     */
    generatePlacementHooks(callbacks = {}, sysAdapter = systemAdapter) {
        const targetSysAdapter = sysAdapter ?? systemAdapter;
        const onDrawPreview = callbacks?.onDrawPreview ?? ((placeable) => this.handleDrawPreview(placeable));
        const onPreCreate = callbacks?.onPreCreate ?? ((doc, _data, _options, userId) => this.handlePreCreate(doc, _data, _options, userId));
        const onCreate = callbacks?.onCreate ?? ((doc, _options, userId) => this.handleCreateDocument(doc, _options, userId));
        const onUpdate = callbacks?.onUpdate ?? ((doc, changed, _options, userId) => this.handleUpdateDocument(doc, changed, _options, userId));
        const onDelete = callbacks?.onDelete ?? ((doc, _options, userId) => this.handleDeleteDocument(doc, _options, userId));
        const basePlaceables = this.supportedBasePlaceables;
        const customPlaceables = targetSysAdapter?.getCustomPlaceableClassNames?.() ?? [];
        const dynamicPlaceables = [];

        if (typeof CONFIG !== "undefined") {
            for (const base of basePlaceables) {
                const customClass = CONFIG[base]?.objectClass?.name;
                if (customClass && typeof customClass === "string" && !basePlaceables.includes(customClass) && !customPlaceables.includes(customClass)) {
                    dynamicPlaceables.push(customClass);
                }
            }
        }

        const drawPlaceables = new Set([...basePlaceables, ...customPlaceables, ...dynamicPlaceables]);
        const drawHooks = Array.from(drawPlaceables).flatMap((placeableName) => [
            { event: `draw${placeableName}`, handler: onDrawPreview, category: "draw", targetName: placeableName },
            { event: `refresh${placeableName}`, handler: (template) => this.handleMeasuredTemplateRefresh(template), category: "refresh", targetName: placeableName }
        ]);

        const baseDocumentTypes = this.supportedDocumentTypes;
        const customDocumentTypes = targetSysAdapter?.getCustomDocumentTypes?.() ?? [];
        const dynamicDocumentTypes = [];

        if (typeof CONFIG !== "undefined") {
            for (const docType of baseDocumentTypes) {
                const customDocName = CONFIG[docType]?.documentClass?.documentName;
                if (customDocName && typeof customDocName === "string" && !baseDocumentTypes.includes(customDocName) && !customDocumentTypes.includes(customDocName)) {
                    dynamicDocumentTypes.push(customDocName);
                }
            }
        }

        const createDocumentTypes = new Set([...baseDocumentTypes, ...customDocumentTypes, ...dynamicDocumentTypes]);
        const documentHooks = Array.from(createDocumentTypes).flatMap((docType) => [
            { event: `preCreate${docType}`, handler: onPreCreate, category: "preCreate", targetName: docType },
            { event: `create${docType}`, handler: onCreate, category: "create", targetName: docType },
            { event: `update${docType}`, handler: onUpdate, category: "update", targetName: docType },
            { event: `delete${docType}`, handler: onDelete, category: "delete", targetName: docType }
        ]);

        const generatedHooks = [...drawHooks, ...documentHooks];

        if (targetSysAdapter && typeof targetSysAdapter.modifyPlacementHooks === "function") {
            const modifiedHooks = targetSysAdapter.modifyPlacementHooks(generatedHooks, callbacks, this);
            log.debug("FoundryVTTV13Adapter.generatePlacementHooks | Modified placement hooks from system adapter:", modifiedHooks);
            return modifiedHooks;
        }

        log.debug("FoundryVTTV13Adapter.generatePlacementHooks | Generated placement hooks:", generatedHooks);
        return generatedHooks;
    }

    /**
     * Detect shape type and geometric dimensions from a MeasuredTemplate document.
     * @param {Document} doc - MeasuredTemplate document
     * @returns {{type: string, distance: number, radius: number, width: number, angle: number, x: number, y: number}} Detected shape properties and dimensions
     */
    detectProperties(doc) {
        const targetDoc = doc?.document ?? doc;
        const shapeMap = {
            circle: "circle",
            cone: "cone",
            ray: "ray",
            rect: "square"
        };
        let distance = targetDoc.distance ?? 0;
        const width = targetDoc.width ?? 0;
        if (targetDoc.t === "rect" && width > 0 && distance > width) {
            const isSquareDiagonal = distance <= width * 1.6;
            distance = isSquareDiagonal ? width : Math.round(Math.sqrt(Math.max(0, distance * distance - width * width)));
        }
        let rawDir = targetDoc.direction ?? 0;
        if (targetDoc.t === "rect") {
            const w = width > 0 ? width : distance;
            const h = distance > 0 ? distance : w;
            const diagAngle = Math.atan2(h, w) * (180 / Math.PI);
            rawDir = (rawDir - diagAngle + 360) % 360;
        }
        return {
            type: shapeMap[targetDoc.t] ?? "circle",
            t: targetDoc.t ?? "circle",
            distance,
            radius: distance,
            width,
            angle: targetDoc.angle ?? 0,
            direction: rawDir,
            x: targetDoc.x ?? 0,
            y: targetDoc.y ?? 0
        };
    }

    /**
     * Format drag destination coordinates into a V13 MeasuredTemplate placement coordinates payload.
     * @param {number} x - Destination x-coordinate
     * @param {number} y - Destination y-coordinate
     * @param {number} direction - Direction angle in degrees
     * @param {Object} [config={}] - Optional sequence placement configuration
     * @returns {{x: number, y: number, direction: number, distance: number|undefined, width: number|undefined}} Formatted placement coordinates payload
     */
    formatPlacementCoordinates(x, y, direction, config = {}) {
        const shapeTypeMap = {
            circle: "circle",
            cone: "cone",
            ray: "ray",
            rect: "rect",
            square: "rect"
        };
        const rawType = config.originalType ?? config.type ?? config.t;
        const resolvedT = shapeTypeMap[rawType] ?? config.t ?? "circle";
        const isSquareOrRect = resolvedT === "rect";
        const stickVal = config.stickToToken ?? config.sticky;
        const isSticky = Boolean(stickVal && stickVal !== "none" && stickVal !== "false" && config.token);

        let finalDirection = direction ?? 0;
        if (isSquareOrRect) {
            const rawDist = config.distance ?? config.radius;
            let distFoot = rawDist;
            const widthFoot = config.width ?? distFoot;
            if (widthFoot > 0 && distFoot > widthFoot) {
                const isSquareDiagonal = distFoot <= widthFoot * 1.6;
                distFoot = isSquareDiagonal ? widthFoot : Math.round(Math.sqrt(Math.max(0, distFoot * distFoot - widthFoot * widthFoot)));
            }
            const w = widthFoot ?? 20;
            const h = distFoot ?? w;
            finalDirection = Math.atan2(h, w) * (180 / Math.PI);
        }

        return {
            x,
            y,
            direction: finalDirection,
            distance: config.distance,
            width: config.width,
            angle: config.angle,
            sticky: isSticky,
            type: isSquareOrRect ? "square" : (config.originalType ?? config.type ?? "circle"),
            originalType: config.originalType,
            t: resolvedT
        };
    }

    /**
     * Check whether Foundry V13 supports rotating a specific shape type.
     * V13 MeasuredTemplate rects/squares cannot be rotated diagonally on canvas grid.
     * @param {string} shapeType - The shape type identifier
     * @returns {boolean} False for rect and square, true for circle, cone, ray
     */
    supportsShapeRotation(shapeType) {
        if (shapeType === "rect" || shapeType === "square") {
            return false;
        }
        return true;
    }

    /**
     * Return template pixel multiplier factor for V13 (legacy pixel sizing).
     * @returns {{factor: number, gridUnits: boolean}} Template pixel multiplier factor and gridUnits mode
     */
    getTemplatePixelFactor() {
        return { factor: 1, gridUnits: false };
    }

    /**
     * Update live canvas preview shape coordinates during mouse drag.
     * @param {Document} previewDoc - Preview MeasuredTemplate document
     * @param {{x?: number, y?: number, direction?: number, distance?: number, width?: number, type?: string, originalType?: string, t?: string}} coords - Destination preview coordinates
     * @returns {void}
     */
    updatePreviewShape(previewDoc, coords) {
        if (!previewDoc || !coords) return;
        const targetDoc = previewDoc.document ?? previewDoc;
        const isRect = targetDoc.t === "rect" || coords.type === "square" || coords.type === "rect" || coords.originalType === "square" || coords.t === "rect";
        const pxPerFoot = this.pixelsPerDistance;
        let distFoot = coords.distance ?? coords.radius;
        const widthFoot = coords.width ?? distFoot;

        if (isRect) {
            if (widthFoot > 0 && distFoot > widthFoot) {
                const isSquareDiagonal = distFoot <= widthFoot * 1.6;
                distFoot = isSquareDiagonal ? widthFoot : Math.round(Math.sqrt(Math.max(0, distFoot * distFoot - widthFoot * widthFoot)));
            }

            let targetX = coords.x;
            let targetY = coords.y;
            const rad = ((coords.direction ?? coords.rotation ?? targetDoc.direction ?? 0) * Math.PI) / 180;
            const isSticky = Boolean(coords.sticky ?? coords.token);

            if (isSticky && targetX !== undefined && targetY !== undefined) {
                const wPx = (widthFoot ?? 20) * pxPerFoot;
                targetX = Math.round(targetX + (wPx / 2) * Math.sin(rad));
                targetY = Math.round(targetY - (wPx / 2) * Math.cos(rad));
            }

            targetDoc.t = "rect";
            const w = widthFoot ?? 20;
            const h = distFoot ?? w;
            const diagDist = Math.round(Math.sqrt(w * w + h * h) * 100) / 100;
            const diagAngle = Math.atan2(h, w) * (180 / Math.PI);
            targetDoc.distance = diagDist;
            targetDoc.width = w;
            targetDoc.direction = diagAngle;

            const updateObj = {
                t: "rect",
                distance: diagDist,
                width: w,
                direction: diagAngle
            };
            if (targetX !== undefined) updateObj.x = targetX;
            if (targetY !== undefined) updateObj.y = targetY;

            if (typeof targetDoc.updateSource === "function") {
                try { targetDoc.updateSource(updateObj); } catch (e) { Object.assign(targetDoc, updateObj); }
            } else {
                Object.assign(targetDoc, updateObj);
            }
        } else {
            const updateObj = {};
            if (coords.x !== undefined) {
                targetDoc.x = coords.x;
                updateObj.x = coords.x;
            }
            if (coords.y !== undefined) {
                targetDoc.y = coords.y;
                updateObj.y = coords.y;
            }
            if (coords.direction !== undefined) {
                targetDoc.direction = coords.direction;
                updateObj.direction = coords.direction;
            }
            if (coords.t !== undefined) {
                targetDoc.t = coords.t;
                updateObj.t = coords.t;
            }
            if (coords.distance !== undefined) {
                targetDoc.distance = coords.distance;
                updateObj.distance = coords.distance;
            }
            if (coords.angle !== undefined) {
                targetDoc.angle = coords.angle;
                updateObj.angle = coords.angle;
            }
            if (coords.width !== undefined) {
                targetDoc.width = coords.width;
                updateObj.width = coords.width;
            }

            if (typeof targetDoc.updateSource === "function") {
                try { targetDoc.updateSource(updateObj); } catch (e) { Object.assign(targetDoc, updateObj); }
            } else {
                Object.assign(targetDoc, updateObj);
            }
        }
    }

    /**
     * Apply resolved placement coordinates and workflow flags onto a MeasuredTemplate document.
     * @param {Document} doc - MeasuredTemplate document
     * @param {Object} [coords={}] - Resolved placement coordinates
     * @param {Object} [config={}] - Workflow placement configuration
     * @returns {void}
     */
    applyDocumentPlacement(doc, coords = {}, config = {}, data = null) {
        if (!doc) return;
        const targetDoc = doc.document ?? doc;
        const styling = this.extractPlacedStylingFlags(config);
        const isRect = targetDoc.t === "rect" || coords.type === "square" || coords.type === "rect" || coords.originalType === "square" || config.originalType === "square" || coords.t === "rect" || config.t === "rect" || config.type === "square" || config.type === "rect";
        const updateData = {
            flags: styling.flags
        };

        const pxPerFoot = this.pixelsPerDistance;
        const rawDist = coords.distance ?? coords.radius;
        let distFoot = rawDist ?? config.distance ?? config.radius;
        const widthFoot = coords.width ?? config.width ?? distFoot;

        if (isRect) {
            if (widthFoot > 0 && distFoot > widthFoot) {
                const isSquareDiagonal = distFoot <= widthFoot * 1.6;
                distFoot = isSquareDiagonal ? widthFoot : Math.round(Math.sqrt(Math.max(0, distFoot * distFoot - widthFoot * widthFoot)));
            }

            let targetX = coords.x;
            let targetY = coords.y;
            const rad = ((coords.direction ?? coords.rotation ?? targetDoc.direction ?? 0) * Math.PI) / 180;
            const isSticky = Boolean(config.token ?? coords.token ?? coords.sticky);

            if (isSticky && targetX !== undefined && targetY !== undefined) {
                const wPx = (widthFoot ?? 20) * pxPerFoot;
                targetX = Math.round(targetX + (wPx / 2) * Math.sin(rad));
                targetY = Math.round(targetY - (wPx / 2) * Math.cos(rad));
            }

            updateData.t = "rect";
            if (targetX !== undefined) updateData.x = targetX;
            if (targetY !== undefined) updateData.y = targetY;
            const w = coords.width ?? config.width ?? distFoot ?? 20;
            const h = distFoot ?? config.distance ?? config.radius ?? w;
            const diagDist = Math.round(Math.hypot(w, h) * 100) / 100;
            const diagAngle = Math.atan2(h, w) * (180 / Math.PI);
            updateData.distance = diagDist;
            updateData.width = w;
            updateData.direction = diagAngle;
        } else {
            if (coords.x !== undefined) updateData.x = coords.x;
            if (coords.y !== undefined) updateData.y = coords.y;
            if (coords.direction !== undefined) updateData.direction = coords.direction;
            else if (coords.rotation !== undefined) updateData.direction = coords.rotation;
            if (coords.t !== undefined) updateData.t = coords.t;
            else if (config.t !== undefined) updateData.t = config.t;
            if (coords.distance !== undefined) updateData.distance = coords.distance;
            else if (coords.radius !== undefined) updateData.distance = coords.radius;
            if (coords.angle !== undefined) updateData.angle = coords.angle;
            else if (config.angle !== undefined) updateData.angle = config.angle;
            if (coords.width !== undefined) updateData.width = coords.width;
        }

        if (styling.placedFillColor !== undefined && styling.placedFillColor !== null) updateData.fillColor = styling.placedFillColor;
        if (styling.placedBorderColor !== undefined && styling.placedBorderColor !== null) updateData.borderColor = styling.placedBorderColor;
        if (styling.placedFillAlpha !== undefined) updateData.fillAlpha = styling.placedFillAlpha;
        if (styling.placedBorderAlpha !== undefined) updateData.borderAlpha = styling.placedBorderAlpha;
        if (config.hidden || config.hideTemplate) updateData.hidden = true;

        if (typeof targetDoc?.updateSource === "function") {
            targetDoc.updateSource(updateData);
        } else {
            Object.assign(targetDoc, updateData);
        }
        if (data && typeof data === "object") {
            this.mergeObject(data, updateData);
        }
    }

    /**
     * Resume deferred MeasuredTemplate creation in V13 when an interactive Sequencer placement resolves.
     * @param {Scene} scene - Target Canvas Scene
     * @param {Object} deferredData - Initial raw document creation data (`doc.toObject()`)
     * @param {Object} coords - Resolved placement coordinates from Sequencer (`{ x, y, direction, distance, ... }`)
     * @returns {Promise<void>} Resolves when deferred document creation completes
     */
    _getDeferredDocumentName(data, documentName) {
        return "MeasuredTemplate";
    }

    _applyDeferredCoordinates(data, coords, docName) {
        if (coords.x !== undefined) data.x = coords.x;
        if (coords.y !== undefined) data.y = coords.y;
        const isRect = data.t === "rect" || coords.type === "square" || coords.type === "rect" || coords.originalType === "square" || coords.t === "rect";
        if (isRect) {
            data.t = "rect";
            const rawDist = coords.distance ?? coords.radius;
            let distFoot = rawDist;
            const widthFoot = coords.width ?? distFoot;
            if (widthFoot > 0 && distFoot > widthFoot) {
                const isSquareDiagonal = distFoot <= widthFoot * 1.6;
                distFoot = isSquareDiagonal ? widthFoot : Math.round(Math.sqrt(Math.max(0, distFoot * distFoot - widthFoot * widthFoot)));
            }
            const w = widthFoot ?? 20;
            const h = distFoot ?? w;
            data.distance = Math.round(Math.hypot(w, h) * 100) / 100;
            data.width = w;
            data.direction = Math.atan2(h, w) * (180 / Math.PI);
        } else {
            if (coords.direction !== undefined) data.direction = coords.direction;
            else if (coords.rotation !== undefined) data.direction = coords.rotation;
            if (coords.distance !== undefined) data.distance = coords.distance;
            else if (coords.radius !== undefined) data.distance = coords.radius;
            if (coords.t !== undefined) data.t = coords.t;
            if (coords.angle !== undefined) data.angle = coords.angle;
            if (coords.width !== undefined) data.width = coords.width;
        }
    }

    /**
     * Refresh the rendering and grid highlights of a preview MeasuredTemplate.
     * Prevents the native template borders/shapes from flashing visible on rendering cycles.
     * @param {PlaceableObject} tmpl - The preview MeasuredTemplate
     * @param {number} direction - The current direction in degrees
     * @returns {void}
     */
    refreshTemplateHighlights(tmpl, direction) {
        if (!tmpl) return;

        const doc = tmpl.document;
        const isRect = doc?.t === "rect" || tmpl.t === "rect";
        let effectiveDirection = direction;

        if (isRect) {
            const w = doc?.width ?? 20;
            let distFoot = doc?.distance ?? w;
            if (w > 0 && distFoot > w) {
                const isSquareDiagonal = distFoot <= w * 1.6;
                distFoot = isSquareDiagonal ? w : Math.round(Math.sqrt(Math.max(0, distFoot * distFoot - w * w)));
            }
            const h = distFoot ?? w;
            effectiveDirection = Math.atan2(h, w) * (180 / Math.PI);
            if (doc) {
                doc.distance = Math.round(Math.hypot(w, h) * 100) / 100;
                doc.width = w;
            }
        }

        const rad = effectiveDirection * (Math.PI / 180);
        tmpl.direction = effectiveDirection;

        const targetX = doc?.x ?? tmpl.x;
        const targetY = doc?.y ?? tmpl.y;

        if (doc) {
            doc.direction = effectiveDirection;
            const updateData = { direction: effectiveDirection };
            if (isRect) {
                updateData.distance = doc.distance;
                updateData.width = doc.width;
            }
            if (targetX !== undefined) updateData.x = targetX;
            if (targetY !== undefined) updateData.y = targetY;
            if (typeof doc?.updateSource === "function") {
                doc.updateSource(updateData);
            } else {
                Object.assign(doc, updateData);
            }
            if (doc.shape?.clear) doc.shape.clear();
        }
        if (targetX !== undefined) {
            try { tmpl.x = targetX; } catch (e) {}
        }
        if (targetY !== undefined) {
            try { tmpl.y = targetY; } catch (e) {}
        }
        if (tmpl.shape?.clear) tmpl.shape.clear();

        if (tmpl.ray) {
            const ox = targetX ?? tmpl.ray.origin?.x ?? tmpl.x ?? 0;
            const oy = targetY ?? tmpl.ray.origin?.y ?? tmpl.y ?? 0;
            const pxPerFoot = this.pixelsPerDistance;
            const dist = isRect && doc?.distance ? doc.distance * pxPerFoot : (tmpl.ray.distance ?? 1000);
            const newRay = this.createRayFromAngle(ox, oy, rad, dist);
            if (newRay) tmpl.ray = newRay;
        }

        if (typeof tmpl._refreshPosition === "function") {
            try { tmpl._refreshPosition(); } catch (e) {}
        }
        if (typeof tmpl._refreshShape === "function") {
            try { tmpl._refreshShape(); } catch (e) {}
        }
        if (typeof tmpl._refreshTemplate === "function") {
            try { tmpl._refreshTemplate(); } catch (e) {}
        }
        if (tmpl.ruler && typeof tmpl._refreshRulerText === "function") {
            try { tmpl._refreshRulerText(); } catch (e) {}
        }

        this._safeSetRenderFlags(tmpl, {
            refreshTemplate: true,
            refreshShape: true,
            refreshGrid: true,
            refreshState: true,
            refresh: true
        });
        if (typeof tmpl.applyRenderFlags === "function") tmpl.applyRenderFlags();
        if (typeof tmpl.highlightGrid === "function") tmpl.highlightGrid();
        const hId = tmpl.highlightId ?? tmpl.objectId ?? `Template.${doc?.id ?? "preview"}`;
        tmpl._bbcHighlightId = hId;
    }

    _snapPoint(x, y, numMode) {
        return this.getSnappedPoint({ x, y }, { mode: numMode });
    }

    _getGridCenterPoint(x, y) {
        return this.getCenterPoint({ x, y });
    }
}
