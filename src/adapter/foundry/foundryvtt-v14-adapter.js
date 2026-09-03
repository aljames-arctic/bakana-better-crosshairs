import { BaseFoundryVTTAdapter } from "./base-foundryvtt-adapter.js";
import { systemAdapter } from "../system/index.js";
import { log } from "../../lib/logger.js";
import { localize } from "../../lib/utils.js";
import { Ray } from "../../lib/compat.js";

/**
 * Adapter subclass encapsulating Foundry VTT v14+ Region placement behavior.
 */
export class FoundryVTTV14Adapter extends BaseFoundryVTTAdapter {
    /**
     * Initialize the Foundry VTT v14+ adapter instance and set its version identifier.
     */
    constructor() {
        super();
        this.version = 14;
        this._patchDeprecations();
    }

    /**
     * Return canonical document terminology string for V14+ ("region").
     * @returns {string} Document type term
     */
    get documentTerm() {
        return "region";
    }

    /**
     * Return section title header for pre-region placement configuration.
     * @returns {string} Section header text
     */
    get prePlacementTitle() {
        return localize("BBC.autorecMenu.preRegionPlacement", "Pre-Region Placement");
    }

    /**
     * Return section title header for region placement configuration.
     * @returns {string} Section header text
     */
    get placementSectionTitle() {
        return localize("BBC.autorecMenu.regionPlacementConfig", "Region Placement Configuration");
    }

    /**
     * Return section title header for post-region placement configuration.
     * @returns {string} Section header text
     */
    get postPlacementTitle() {
        return localize("BBC.autorecMenu.postRegionPlacement", "Post-Region Placement");
    }

    /**
     * Return supported base canvas PlaceableObject type names for Foundry VTT v14+.
     * @returns {string[]} Base placeable type names
     */
    get supportedBasePlaceables() {
        return ["MeasuredTemplate", "Region"];
    }

    /**
     * Return supported document creation type names (`preCreate`/`create` hook suffixes) for Foundry VTT v14+.
     * @returns {string[]} Document type names
     */
    get supportedDocumentTypes() {
        return ["MeasuredTemplate", "Region"];
    }

    /**
     * Generate structured placement hook descriptors across all supported V14+ placeable and document types (`MeasuredTemplate`, `Region`).
     * Quarantined directly inside FoundryVTTV14Adapter without relying on base class generation logic.
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
            log.debug("FoundryVTTV14Adapter.generatePlacementHooks | Modified placement hooks from system adapter:", modifiedHooks);
            return modifiedHooks;
        }

        log.debug("FoundryVTTV14Adapter.generatePlacementHooks | Generated placement hooks:", generatedHooks);
        return generatedHooks;
    }

    /**
     * Detect shape type and geometric dimensions from a Region or MeasuredTemplate document.
     * @param {Document} doc - The Region or MeasuredTemplate document to inspect
     * @returns {{type: string, distance: number, radius: number, width: number, angle: number, x: number, y: number}} Detected geometric properties and shape type
     */
    detectProperties(doc) {
        const targetDoc = doc?.document ?? doc;
        if (!targetDoc) {
            return { type: "circle", distance: 0, radius: 0, width: 5, angle: 360, x: 0, y: 0 };
        }

        const docName = targetDoc.documentName ?? (targetDoc.t ? "MeasuredTemplate" : "Region");
        if (docName === "MeasuredTemplate") {
            const shapeMap = {
                circle: "circle",
                cone: "cone",
                ray: "ray",
                rect: "square"
            };
            let distance = targetDoc.distance ?? 0;
            const width = targetDoc.width ?? 5;
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
            const result = {
                type: shapeMap[targetDoc.t] ?? "circle",
                distance,
                radius: distance,
                width,
                angle: targetDoc.angle ?? 53.13,
                direction: rawDir,
                rotation: rawDir,
                x: targetDoc.x ?? 0,
                y: targetDoc.y ?? 0
            };
            return result;
        }

        const shapesList = this._getShapesArray(targetDoc);
        if (shapesList.length === 0) {
            const fallbackDistance = targetDoc.distance ?? 0;
            return {
                type: "circle",
                distance: fallbackDistance,
                radius: fallbackDistance,
                width: targetDoc.width ?? 5,
                angle: targetDoc.angle ?? 360,
                direction: targetDoc.direction ?? 0,
                rotation: targetDoc.direction ?? 0,
                x: targetDoc.x ?? 0,
                y: targetDoc.y ?? 0
            };
        }

        const shape = typeof shapesList[0]?.toObject === "function" ? shapesList[0].toObject() : (shapesList[0] ?? {});
        let shapeType = undefined;
        switch (shape.type) {
            case "circle":
            case "ellipse":
                shapeType = "circle";
                break;
            case "cone":
            case "sector":
                shapeType = "cone";
                break;
            case "rectangle":
            case "polygon":
            case "box":
                shapeType = "square";
                break;
            case "line":
            case "ray":
            case "segment":
                shapeType = "ray";
                break;
            default:
                shapeType = "circle";
                log.warn(`FoundryVTTV14Adapter.detectProperties | Unrecognized Region shape type "${shape.type}", defaulting to "circle".`);
                break;
        }

        const pxPerFoot = (canvas?.dimensions?.size ?? 100) / (canvas?.dimensions?.distance ?? 5);
        let distance = 0;
        let width = 5;
        if (shape.type === "rectangle" || shape.type === "box") {
            const rawLengthPx = shape.width ?? 0;
            const rawWidthPx = shape.height ?? shape.width ?? 0;
            distance = Math.round(rawLengthPx / pxPerFoot);
            width = Math.round(rawWidthPx / pxPerFoot);
        } else if (shape.type === "line" || shape.type === "ray" || shape.type === "segment") {
            const rawLengthPx = shape.distance ?? shape.length ?? shape.height ?? shape.radius ?? 0;
            const rawWidthPx = shape.width ?? shape.thickness ?? (pxPerFoot * 5);
            distance = rawLengthPx >= pxPerFoot ? Math.round(rawLengthPx / pxPerFoot) : Math.round(rawLengthPx);
            width = rawWidthPx >= pxPerFoot ? Math.round(rawWidthPx / pxPerFoot) : Math.round(rawWidthPx);
            if (!distance && shape.points && Array.isArray(shape.points) && shape.points.length >= 4) {
                const dx = shape.points[2] - shape.points[0];
                const dy = shape.points[3] - shape.points[1];
                const lengthPx = Math.sqrt(dx * dx + dy * dy);
                distance = Math.round(lengthPx / pxPerFoot);
            }
            if (!width) width = 5;
        } else {
            const rawRadius = shape.radius ?? 0;
            distance = Math.round(rawRadius / pxPerFoot);
            width = distance;
        }

        let rawDir = shape.rotation ?? targetDoc.direction ?? 0;
        if (shape.type === "rectangle" || shape.type === "box") {
            if (shape.rotation === undefined && targetDoc.direction !== undefined) {
                const w = width > 0 ? width : distance;
                const h = distance > 0 ? distance : w;
                const diagAngle = Math.atan2(h, w) * (180 / Math.PI);
                rawDir = (rawDir - diagAngle + 360) % 360;
            }
        }

        const result = {
            type: shapeType,
            distance,
            radius: distance,
            width,
            angle: shape.angle ?? 53.13,
            direction: rawDir,
            rotation: rawDir,
            x: shape.x ?? targetDoc.x ?? 0,
            y: shape.y ?? targetDoc.y ?? 0
        };
        return result;
    }

    /**
     * Helper to safely extract a Region shapes array from either an Array or Collection property.
     * @param {Document} doc - Region document
     * @returns {Array} Array of shape objects or models
     */
    _getShapesArray(doc) {
        const targetDoc = doc?.document ?? doc;
        if (!targetDoc) return [];
        return targetDoc.shapes?.contents ?? (Array.isArray(targetDoc.shapes) ? targetDoc.shapes : []);
    }

    /**
     * Return template pixel multiplier factor for V14 (converts pixels to exact grid units).
     * @returns {{factor: number, gridUnits: boolean}} The template scaling factor and grid units flag
     */
    getTemplatePixelFactor() {
        const gridSize = canvas?.dimensions?.size ?? 100;
        return { factor: 1 / gridSize, gridUnits: true };
    }

    /**
     * Update live canvas preview shape coordinates during mouse drag.
     * @param {Document} previewDoc - The Region or MeasuredTemplate preview document being updated
     * @param {{x?: number, y?: number, rotation?: number, direction?: number, radius?: number, distance?: number, width?: number, gridUnits?: boolean}} coords - The target canvas placement coordinates
     * @returns {void}
     */
    updatePreviewShape(previewDoc, coords) {
        if (!previewDoc || !coords) return;
        const targetDoc = previewDoc.document ?? previewDoc;
        const docName = targetDoc.documentName ?? (targetDoc.shapes ? "Region" : "MeasuredTemplate");
        if (docName === "Region") {
            const shapesList = this._getShapesArray(targetDoc);
            const orig = typeof shapesList[0]?.toObject === "function" ? shapesList[0].toObject() : shapesList[0];
            const updatedShape = this._formatRegionShapeUpdate(orig, coords);
            delete updatedShape._id;
            delete updatedShape.id;
            try {
                targetDoc.updateSource({ shapes: [updatedShape] }); 
            } catch (e) {
                targetDoc.shapes = [updatedShape];
            }
        } else {
            const isRect = targetDoc.t === "rect" || coords.type === "square" || coords.type === "rect" || coords.originalType === "square" || coords.t === "rect";
            const isSticky = Boolean(coords.sticky ?? coords.token);
            const pxPerFoot = (canvas?.dimensions?.size ?? 100) / (canvas?.dimensions?.distance ?? 5);
            let distFoot = coords.distance ?? coords.radius;
            const widthFoot = coords.width ?? distFoot;
            if (isRect && widthFoot > 0 && distFoot > widthFoot) {
                const isSquareDiagonal = distFoot <= widthFoot * 1.6;
                distFoot = isSquareDiagonal ? widthFoot : Math.round(Math.sqrt(Math.max(0, distFoot * distFoot - widthFoot * widthFoot)));
            }

            let targetX = coords.x;
            let targetY = coords.y;
            if (isRect && isSticky && targetX !== undefined && targetY !== undefined) {
                const wPx = (widthFoot ?? 20) * pxPerFoot;
                const rad = ((coords.direction ?? coords.rotation ?? targetDoc.direction ?? 0) * Math.PI) / 180;
                targetX = Math.round(targetX + (wPx / 2) * Math.sin(rad));
                targetY = Math.round(targetY - (wPx / 2) * Math.cos(rad));
            }

            const updateObj = {};
            if (targetX !== undefined) updateObj.x = targetX;
            if (targetY !== undefined) updateObj.y = targetY;
            if (isRect) {
                updateObj.t = "rect";
                const w = coords.width ?? distFoot ?? 20;
                const h = distFoot ?? w;
                const diagDist = Math.round(Math.hypot(w, h) * 100) / 100;
                const diagAngle = Math.atan2(h, w) * (180 / Math.PI);
                updateObj.distance = diagDist;
                updateObj.width = w;
                updateObj.direction = diagAngle;
                targetDoc.direction = diagAngle;
                targetDoc.distance = diagDist;
                targetDoc.width = w;
            } else {
                if (coords.direction !== undefined) updateObj.direction = coords.direction;
                else if (coords.rotation !== undefined) updateObj.direction = coords.rotation;
                if (coords.distance !== undefined) updateObj.distance = coords.distance;
                else if (coords.radius !== undefined) updateObj.distance = coords.radius;
                if (coords.width !== undefined) updateObj.width = coords.width;
            }

            try {
                targetDoc.updateSource(updateObj);
            } catch (e) {
                Object.assign(targetDoc, updateObj);
            }
        }
    }

    /**
     * Apply resolved placement coordinates and workflow flags onto a Region or MeasuredTemplate document.
     * @param {Document} doc - The target Region or MeasuredTemplate document to update
     * @param {Object} [coords={}] - The resolved placement coordinates
     * @param {Object} [config={}] - Optional placement styling and behavior configuration
     * @returns {void}
     */
    applyDocumentPlacement(doc, coords = {}, config = {}, data = null) {
        if (!doc) return;
        const targetDoc = doc.document ?? doc;
        const styling = this.extractPlacedStylingFlags(config);
        const docName = targetDoc.documentName ?? (targetDoc.shapes ? "Region" : "MeasuredTemplate");
        if (docName === "Region") {
            const shapesList = this._getShapesArray(targetDoc);
            const originalShape = shapesList[0] ?? (typeof targetDoc.toObject === "function" ? targetDoc.toObject().shapes?.[0] : null) ?? data?.shapes?.[0] ?? { type: "rectangle" };
            if (originalShape) {
                const updateData = {
                    flags: styling.flags
                };
                const shapeCoords = {
                    ...coords,
                    gridUnits: coords.gridUnits ?? config.gridUnits ?? true,
                    sticky: Boolean(config.token ?? coords.token ?? coords.sticky)
                };
                const newShape = this._formatRegionShapeUpdate(originalShape, shapeCoords);
                if (originalShape._id) newShape._id = originalShape._id;
                else if (originalShape.id) newShape.id = originalShape.id;
                updateData.shapes = [newShape];

                const targetColor = styling.placedFillColor ?? styling.placedBorderColor;
                if (targetColor !== undefined && targetColor !== null) updateData.color = targetColor;

                if (config.hidden || config.hideTemplate) updateData.hidden = true;

                if (typeof targetDoc?.updateSource === "function") {
                    targetDoc.updateSource(updateData);
                }
                try {
                    targetDoc.shapes = [newShape];
                } catch (e) {}
                if (data && typeof data === "object") {
                    data.shapes = foundry.utils.deepClone(updateData.shapes);
                    if (typeof foundry?.utils?.mergeObject === "function") {
                        foundry.utils.mergeObject(data, updateData, { recursive: true, overwrite: true });
                    } else {
                        Object.assign(data, updateData);
                    }
                    data.shapes = foundry.utils.deepClone(updateData.shapes);
                }
            }
        } else {
            const pxPerFoot = (canvas?.dimensions?.size ?? 100) / (canvas?.dimensions?.distance ?? 5);
            const rawDist = coords.distance ?? coords.radius;
            let distFoot = rawDist ?? config.distance ?? config.radius;
            const widthFoot = coords.width ?? config.width ?? distFoot;
            const isRect = (targetDoc.t === "rect" || coords.type === "square" || coords.type === "rect" || coords.originalType === "square" || config.originalType === "square" || coords.t === "rect" || config.t === "rect" || config.type === "square" || config.type === "rect");
            if (isRect && widthFoot > 0 && distFoot > widthFoot) {
                const isSquareDiagonal = distFoot <= widthFoot * 1.6;
                distFoot = isSquareDiagonal ? widthFoot : Math.round(Math.sqrt(Math.max(0, distFoot * distFoot - widthFoot * widthFoot)));
            }

            let targetX = coords.x;
            let targetY = coords.y;
            const rad = ((coords.direction ?? coords.rotation ?? targetDoc.direction ?? 0) * Math.PI) / 180;
            const isSticky = Boolean(config.token ?? coords.token ?? coords.sticky);
            if (isRect && isSticky && targetX !== undefined && targetY !== undefined) {
                const wPx = (widthFoot ?? 20) * pxPerFoot;
                targetX = Math.round(targetX + (wPx / 2) * Math.sin(rad));
                targetY = Math.round(targetY - (wPx / 2) * Math.cos(rad));
            }

            const updateData = {
                flags: styling.flags
            };
            if (targetX !== undefined) updateData.x = targetX;
            if (targetY !== undefined) updateData.y = targetY;
            if (isRect) {
                updateData.t = "rect";
                const w = coords.width ?? config.width ?? distFoot ?? 20;
                const h = distFoot ?? config.distance ?? config.radius ?? w;
                const diagDist = Math.round(Math.hypot(w, h) * 100) / 100;
                const diagAngle = Math.atan2(h, w) * (180 / Math.PI);
                updateData.distance = diagDist;
                updateData.width = w;
                updateData.direction = diagAngle;
            } else {
                if (coords.direction !== undefined) updateData.direction = coords.direction;
                else if (coords.rotation !== undefined) updateData.direction = coords.rotation;
                if (coords.distance !== undefined) updateData.distance = coords.distance;
                else if (coords.radius !== undefined) updateData.distance = coords.radius;
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
                if (typeof foundry?.utils?.mergeObject === "function") {
                    foundry.utils.mergeObject(data, updateData);
                } else {
                    Object.assign(data, updateData);
                }
            }
        }
    }

    /**
     * Format drag destination coordinates into a V14 placement coordinates payload supporting both Region and MeasuredTemplate properties.
     * @param {number} x - Destination x-coordinate
     * @param {number} y - Destination y-coordinate
     * @param {number} direction - Rotation angle in degrees
     * @param {Object} [config={}] - Optional sequence placement configuration
     * @returns {{x: number, y: number, direction: number, rotation: number, distance: number|undefined, radius: number|undefined, width: number|undefined, gridUnits: boolean, sticky: boolean}} Formatted placement coordinates payload
     */
    formatPlacementCoordinates(x, y, direction, config = {}) {
        const isSquareOrRect = config.originalType === "square" || config.type === "square" || config.type === "rect" || config.t === "rect" || config.t === "square";
        const stickVal = config.stickToToken ?? config.sticky;
        const isSticky = Boolean(stickVal && stickVal !== "none" && stickVal !== "false" && config.token);
        const primaryDim = config.distance ?? config.radius;
        return {
            x,
            y,
            direction,
            rotation: direction,
            distance: config.distance ?? primaryDim,
            radius: config.radius ?? primaryDim,
            width: config.width,
            angle: config.angle,
            gridUnits: Boolean(config.gridUnits ?? true),
            sticky: isSticky,
            type: isSquareOrRect ? "square" : (config.originalType ?? config.type),
            originalType: config.originalType,
            t: isSquareOrRect ? "rect" : config.t
        };
    }

    /**
     * Format and clone a V14 Region shape payload (`doc.shapes[0]`) with updated destination coordinates and dimensions.
     * Converts grid-unit measurements (`radius`, `width`) to canvas pixels when `coords.gridUnits` is true.
     *
     * @param {Object} originalShape - The base V14 Region shape data object (`doc.shapes[0]`)
     * @param {Object} coords - The placement coordinates payload (`{ x, y, rotation, radius, width, gridUnits, sticky }`)
     * @returns {Object} A cloned and formatted Region shape payload
     * @private
     */
    _formatRegionShapeUpdate(originalShape, coords) {
        // Deep clone shape payload as a plain object to prevent mutating caller or carrying stale _source references
        const raw = typeof originalShape?.toObject === "function" ? originalShape.toObject() : (originalShape ?? {});
        const { _source, id, _id, ...cleanRaw } = raw;
        const shape = foundry.utils.deepClone(cleanRaw);

        const pxPerFoot = (canvas?.dimensions?.size ?? 100) / (canvas?.dimensions?.distance ?? 5);
        const isGridUnits = Boolean(coords.gridUnits ?? true);

        const rawType = coords.originalType ?? coords.type ?? coords.t ?? shape.type;
        const shapeType = (rawType === "cone" || rawType === "sector")
            ? "cone"
            : ((rawType === "circle" || rawType === "ellipse")
                ? "circle"
                : ((rawType === "square" || rawType === "rect" || coords.t === "rect" || rawType === "box" || rawType === "polygon")
                    ? "rectangle"
                    : ((rawType === "ray" || rawType === "line" || rawType === "segment")
                        ? (shape.type === "ray" || shape.type === "line" || shape.type === "segment" ? shape.type : "line")
                        : (shape.type ?? "rectangle"))));
        shape.type = shapeType;

        // Apply placement origin coordinates and rotation directly
        if (coords.x !== undefined) shape.x = coords.x;
        if (coords.y !== undefined) shape.y = coords.y;
        if (coords.rotation !== undefined) shape.rotation = coords.rotation;
        else if (coords.direction !== undefined) shape.rotation = coords.direction;
        if (coords.anchorX !== undefined) shape.anchorX = coords.anchorX;
        else if (shape.anchorX === undefined) shape.anchorX = originalShape?.anchorX ?? 0;
        if (coords.anchorY !== undefined) shape.anchorY = coords.anchorY;
        else if (shape.anchorY === undefined) shape.anchorY = originalShape?.anchorY ?? 0;

        if (shape.type === "rectangle") {
            const isSquare = coords.type === "square" || coords.originalType === "square" || coords.t === "rect";
            const origW = originalShape.width ?? 400;
            const origH = originalShape.height ?? origW;

            let targetW = origW;
            let targetH = origH;

            if (isSquare) {
                let sideVal = coords.width ?? (coords.distance !== undefined ? coords.distance / Math.SQRT2 : undefined);
                if (sideVal !== undefined && sideVal > 0) {
                    const sidePx = isGridUnits ? Math.round(sideVal * pxPerFoot) : sideVal;
                    targetW = sidePx;
                    targetH = sidePx;
                }
            } else {
                if (coords.width !== undefined && coords.width > 0) {
                    targetW = isGridUnits ? Math.round(coords.width * pxPerFoot) : coords.width;
                }
                if (coords.distance !== undefined && coords.distance > 0) {
                    targetH = isGridUnits ? Math.round(coords.distance * pxPerFoot) : coords.distance;
                }
            }

            shape.width = targetW;
            shape.height = targetH;

            if (coords.x !== undefined && coords.y !== undefined) {
                const wPx = shape.width ?? 200;
                const rad = ((shape.rotation ?? 0) * Math.PI) / 180;
                const isSticky = Boolean(coords.sticky ?? coords.token);
                if (isSticky) {
                    shape.x = Math.round(coords.x + (wPx / 2) * Math.sin(rad));
                    shape.y = Math.round(coords.y - (wPx / 2) * Math.cos(rad));
                } else {
                    shape.x = Math.round(coords.x);
                    shape.y = Math.round(coords.y);
                }
            }
        } else if (shape.type === "circle" || shape.type === "ellipse") {
            const radFoot = coords.radius ?? coords.distance;
            if (radFoot !== undefined) {
                shape.radius = isGridUnits ? Math.round(radFoot * pxPerFoot) : radFoot;
            }
        } else if (shape.type === "cone" || shape.type === "sector") {
            const radFoot = coords.radius ?? coords.distance;
            if (radFoot !== undefined) {
                shape.radius = isGridUnits ? Math.round(radFoot * pxPerFoot) : radFoot;
            }
            shape.angle = coords.angle ?? originalShape.angle ?? 53.13;
        } else if (shape.type === "line" || shape.type === "ray" || shape.type === "segment") {
            const distFoot = coords.distance ?? coords.radius;
            const widthFoot = coords.width ?? 5;
            if (distFoot !== undefined) {
                const distPx = isGridUnits ? Math.round(distFoot * pxPerFoot) : distFoot;
                shape.distance = distPx;
                shape.length = distPx;
            }
            if (widthFoot !== undefined) {
                const widthPx = isGridUnits ? Math.round(widthFoot * pxPerFoot) : widthFoot;
                shape.width = widthPx;
                shape.thickness = widthPx;
            }
        } else {
            if (coords.radius !== undefined) {
                shape.radius = isGridUnits ? Math.round(coords.radius * pxPerFoot) : coords.radius;
            }
            if (coords.width !== undefined) {
                shape.width = isGridUnits ? Math.round(coords.width * pxPerFoot) : coords.width;
            }
            if (coords.angle !== undefined) {
                shape.angle = coords.angle;
            }
        }
        return shape;
    }

    /**
     * Protected helper to resolve document type name for deferred creation.
     * @param {Object} data - Initial document data
     * @param {string} [documentName] - Explicit document type name
     * @returns {string} Document name ("Region" or "MeasuredTemplate")
     * @protected
     */
    _getDeferredDocumentName(data, documentName) {
        return documentName ?? (data.shapes ? "Region" : "MeasuredTemplate");
    }

    /**
     * Protected helper to apply resolved placement coordinates onto deferred creation data.
     * @param {Object} data - Target document data payload
     * @param {Object} coords - Placement coordinates
     * @param {string} docName - Document type name
     * @protected
     */
    _applyDeferredCoordinates(data, coords, docName) {
        if (docName === "Region") {
            const shapesList = data.shapes?.contents ?? (Array.isArray(data.shapes) ? data.shapes : []);
            if (shapesList.length > 0) {
                const origShape = typeof shapesList[0]?.toObject === "function" ? shapesList[0].toObject() : shapesList[0];
                const newShape = this._formatRegionShapeUpdate(origShape, coords);
                delete newShape._id;
                delete newShape.id;
                data.shapes = [newShape];
            }
        } else {
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
                if (coords.width !== undefined) data.width = coords.width;
            }
        }
    }

    /**
     * Refresh rendering & grid highlights for preview Region or MeasuredTemplate in V14.
     * @param {PlaceableObject} tmpl - Preview placeable or document
     * @param {number} direction - The current direction in degrees
     * @returns {void}
     */
    refreshTemplateHighlights(tmpl, direction) {
        if (!tmpl) return;

        const doc = tmpl.document ?? tmpl;
        if (!doc) return;

        const isRegion = doc.documentName === "Region" || Boolean(tmpl.shapes || doc.shapes);

        if (isRegion) {
            const effectiveDirection = direction ?? doc.direction ?? tmpl.direction;
            if (effectiveDirection !== undefined) {
                tmpl.direction = effectiveDirection;
                doc.direction = effectiveDirection;
            }

            const shapesList = this._getShapesArray(doc);
            let primaryShape = shapesList[0] ?? (Array.isArray(doc.shapes) ? doc.shapes[0] : (Array.isArray(tmpl.shapes) ? tmpl.shapes[0] : null));

            if (primaryShape && effectiveDirection !== undefined && primaryShape.rotation !== effectiveDirection) {
                const raw = typeof primaryShape.toObject === "function" ? primaryShape.toObject() : primaryShape;
                const updated = { ...raw, rotation: effectiveDirection };
                delete updated._id;
                delete updated.id;
                if (typeof doc.updateSource === "function") {
                    try {
                        doc.updateSource({ shapes: [updated] });
                    } catch (e) {
                        doc.shapes = [updated];
                    }
                } else {
                    doc.shapes = [updated];
                }
                primaryShape = updated;
            }

            const highlightId = tmpl.highlightId ?? tmpl._bbcHighlightId ?? (doc.id ? `Region.${doc.id}` : "Region.preview");
            tmpl._bbcHighlightId = highlightId;
            if (canvas?.interface?.grid) {
                if (typeof canvas.interface.grid.addHighlightLayer === "function") {
                    try { canvas.interface.grid.addHighlightLayer(highlightId); } catch (e) {}
                }
                if (typeof canvas.interface.grid.clearHighlightLayer === "function") {
                    try { canvas.interface.grid.clearHighlightLayer(highlightId); } catch (e) {}
                }
                const hl = canvas.interface.grid.getHighlightLayer?.(highlightId);
                if (hl) hl.visible = true;

                // Compute bounding box for grid space range query, accurately enveloping rotated geometry
                let shapeBounds = null;
                const isRotatedRect = Boolean(primaryShape && (primaryShape.type === "rectangle" || primaryShape.type === "box" || primaryShape.type === "square"));

                if (isRotatedRect) {
                    shapeBounds = this._computeRotatedRectangleBounds(primaryShape, effectiveDirection, doc, tmpl);
                } else if (primaryShape?.type === "circle" || primaryShape?.type === "ellipse") {
                    const origX = primaryShape.x ?? doc.x ?? tmpl.x ?? 0;
                    const origY = primaryShape.y ?? doc.y ?? tmpl.y ?? 0;
                    const radVal = primaryShape.radius ?? 100;
                    shapeBounds = { x: origX - radVal, y: origY - radVal, width: radVal * 2, height: radVal * 2 };
                }

                let bounds = shapeBounds ?? tmpl.bounds;
                if (doc.polygonTree?.bounds && Number.isFinite(doc.polygonTree.bounds.width) && doc.polygonTree.bounds.width > 0) {
                    const pb = doc.polygonTree.bounds;
                    if (bounds) {
                        const x0 = Math.min(bounds.x, pb.x);
                        const y0 = Math.min(bounds.y, pb.y);
                        const x1 = Math.max(bounds.x + bounds.width, pb.x + pb.width);
                        const y1 = Math.max(bounds.y + bounds.height, pb.y + pb.height);
                        bounds = { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
                    } else {
                        bounds = pb;
                    }
                } else if (tmpl.bounds && (!bounds || !Number.isFinite(bounds.width) || bounds.width <= 0)) {
                    bounds = tmpl.bounds;
                }

                if (canvas.grid && typeof canvas.grid.getOffsetRange === "function" && bounds) {
                    const paddedBounds = typeof bounds.pad === "function"
                        ? bounds.pad(1)
                        : { x: bounds.x - 1, y: bounds.y - 1, width: bounds.width + 2, height: bounds.height + 2 };

                    const [i0, j0, i1, j1] = canvas.grid.getOffsetRange(paddedBounds);
                    const colorVal = doc.color ?? "#ffaa00";
                    const colorNum = typeof foundry?.utils?.Color?.from === "function"
                        ? foundry.utils.Color.from(colorVal).valueOf()
                        : (typeof Color !== "undefined" && Color.from ? Color.from(colorVal).valueOf() : 0xffaa00);
                    const borderNum = 0xffffff;

                    const dxGrid = ((canvas.grid?.sizeX ?? canvas.grid?.size ?? 100) / 2);
                    const dyGrid = ((canvas.grid?.sizeY ?? canvas.grid?.size ?? 100) / 2);

                    for (let i = i0; i <= i1; i++) {
                        for (let j = j0; j <= j1; j++) {
                            const center = canvas.grid.getCenterPoint({ i, j });
                            if (!center) continue;

                            // Normalize token center point alignment matching core Foundry V14 Region._getCoveredGridSpaceOffsets
                            const testPt = {
                                x: Math.round(center.x - dxGrid) + dxGrid,
                                y: Math.round(center.y - dyGrid) + dyGrid
                            };

                            let isCovered = false;
                            if (typeof doc.polygonTree?.testPoint === "function") {
                                try {
                                    isCovered = Boolean(doc.polygonTree.testPoint(testPt, 0.75));
                                } catch (e) {}
                            }
                            if (!isCovered && typeof doc.testPoint === "function") {
                                try {
                                    isCovered = Boolean(doc.testPoint(testPt));
                                } catch (e) {}
                            }
                            if (!isCovered && typeof tmpl.testPoint === "function") {
                                try {
                                    isCovered = Boolean(tmpl.testPoint(testPt) || tmpl.testPoint(center));
                                } catch (e) {}
                            }
                            if (!isCovered && isRotatedRect) {
                                isCovered = this._testRotatedRectanglePoint(primaryShape, testPt, 0.75);
                            }

                            if (isCovered) {
                                const pt = canvas.grid.getTopLeftPoint({ i, j });
                                if (typeof canvas.interface.grid.highlightPosition === "function") {
                                    canvas.interface.grid.highlightPosition(highlightId, {
                                        x: pt.x,
                                        y: pt.y,
                                        color: colorNum,
                                        border: borderNum
                                    });
                                }
                            }
                        }
                    }
                }
            }

            this._safeSetRenderFlags(tmpl, {
                refreshShape: true,
                refreshGrid: true,
                refreshHighlight: true,
                refreshState: true,
                refresh: true
            });
            if (typeof tmpl.applyRenderFlags === "function") tmpl.applyRenderFlags();
            return;
        }

        // MeasuredTemplate in V14:
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

        const updateData = { direction: effectiveDirection };
        if (isRect && doc) {
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
        if (targetX !== undefined) {
            try { tmpl.x = targetX; } catch (e) {}
        }
        if (targetY !== undefined) {
            try { tmpl.y = targetY; } catch (e) {}
        }

        if (doc.shape?.clear) doc.shape.clear();
        if (tmpl.shape?.clear) tmpl.shape.clear();

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
            refreshVisibility: true,
            refresh: true
        });
        if (typeof tmpl.applyRenderFlags === "function") tmpl.applyRenderFlags();
        if (typeof tmpl.highlightGrid === "function") tmpl.highlightGrid();

        const hId = tmpl.highlightId ?? tmpl.objectId ?? `Template.${doc?.id ?? "preview"}`;
        tmpl._bbcHighlightId = hId;
        const hl = canvas?.interface?.grid?.getHighlightLayer?.(hId);
        if (hl) hl.visible = true;
    }

    /**
     * Handle document post-creation hook for V14 (createRegion / createMeasuredTemplate).
     * Logs the actual region/template shape that Foundry ended up making, and delegates to base implementation.
     * @param {Document} doc - Template or Region document that was created
     * @param {Object} _options - Document creation options
     * @param {string} userId - ID of the user creating the document
     * @returns {Promise<void>} Resolves when post-placement execution completes
     */
    async handleCreateDocument(doc, _options, userId) {
        await super.handleCreateDocument(doc, _options, userId);
    }

    /**
     * Handle placeable draw preview in V14, ensuring upstream deprecation shims are active.
     * @param {PlaceableObject} placeable - Preview placeable
     * @returns {Promise<void>}
     */
    async handleDrawPreview(placeable) {
        this._patchDeprecations();
        return super.handleDrawPreview(placeable);
    }

    /**
     * Patch V14-specific deprecated constants to prevent upstream Sequencer deprecation warnings.
     * Silences CONST.MEASURED_TEMPLATE_TYPES deprecation warnings from upstream Sequencer calls
     * without mutating read-only core properties or throwing during module initialization.
     * @protected
     * @returns {void}
     */
    _patchDeprecations() {
        try {
            if (typeof console !== "undefined") {
                if (typeof console.warn === "function" && !console.warn._bbcPatched) {
                    const origWarn = console.warn;
                    const wrappedWarn = function (...args) {
                        const first = args[0];
                        const msg = typeof first === "string" ? first : (first?.message ?? String(first ?? ""));
                        if (msg.includes("MEASURED_TEMPLATE_TYPES")) {
                            return;
                        }
                        return origWarn.apply(this, args);
                    };
                    wrappedWarn._bbcPatched = true;
                    console.warn = wrappedWarn;
                    log.debug("FoundryVTTV14Adapter._patchDeprecations | Intercepted console.warn for MEASURED_TEMPLATE_TYPES deprecation.");
                }

                if (typeof console.error === "function" && !console.error._bbcPatched) {
                    const origError = console.error;
                    const wrappedError = function (...args) {
                        const first = args[0];
                        const msg = typeof first === "string" ? first : (first?.message ?? String(first ?? ""));
                        if (msg.includes("MEASURED_TEMPLATE_TYPES")) {
                            return;
                        }
                        return origError.apply(this, args);
                    };
                    wrappedError._bbcPatched = true;
                    console.error = wrappedError;
                }
            }
        } catch (err) {
            log.debug("FoundryVTTV14Adapter._patchDeprecations | Could not wrap console logger:", err);
        }

        try {
            if (typeof foundry !== "undefined" && typeof foundry?.utils?.logCompatibilityWarning === "function") {
                if (!foundry.utils.logCompatibilityWarning._bbcPatched) {
                    const origLog = foundry.utils.logCompatibilityWarning;
                    const wrappedLog = function (message, ...args) {
                        const msgStr = typeof message === "string" ? message : (message?.message ?? "");
                        if (msgStr.includes("MEASURED_TEMPLATE_TYPES")) {
                            return;
                        }
                        return origLog.call(this, message, ...args);
                    };
                    wrappedLog._bbcPatched = true;
                    foundry.utils.logCompatibilityWarning = wrappedLog;
                }
            }
        } catch (err) {
            // Suppressed: foundry.utils is read-only in Foundry V14
        }

        try {
            if (typeof CONST !== "undefined") {
                const desc = Object.getOwnPropertyDescriptor(CONST, "MEASURED_TEMPLATE_TYPES");
                const hasWarningGetter = Boolean(desc?.get);
                const isMissing = !hasWarningGetter && !CONST?.MEASURED_TEMPLATE_TYPES;
                if (hasWarningGetter || isMissing) {
                    Object.defineProperty(CONST, "MEASURED_TEMPLATE_TYPES", {
                        value: Object.freeze({
                            CIRCLE: "circle",
                            CONE: "cone",
                            RECTANGLE: "rect",
                            RAY: "ray"
                        }),
                        writable: false,
                        configurable: true,
                        enumerable: true
                    });
                }
            }
        } catch (err) {
            // Suppressed: CONST is frozen in Foundry V14
        }
    }

    _snapPoint(x, y, numMode) {
        const snapped = canvas.grid.getSnappedPoint({ x, y }, { mode: numMode });
        return { x: snapped.x, y: snapped.y };
    }

    _getGridCenterPoint(x, y) {
        const pt = canvas.grid.getCenterPoint({ x, y });
        return { x: pt.x, y: pt.y };
    }

    /**
     * Compute the minimal axis-aligned bounding box enclosing a rotated Region rectangle shape.
     * Uses BaseGrid#getRectangle vertex transformation with anchor translation.
     * @param {Object} shape - Region rectangle shape data
     * @param {number} [fallbackRotation=0] - Fallback rotation angle in degrees
     * @param {Document} [doc=null] - Document fallback coordinates
     * @param {PlaceableObject} [tmpl=null] - Placeable fallback coordinates
     * @returns {{x: number, y: number, width: number, height: number}} Axis-aligned bounding box
     * @protected
     */
    _computeRotatedRectangleBounds(shape, fallbackRotation = 0, doc = null, tmpl = null) {
        const originX = shape?.x ?? doc?.x ?? tmpl?.x ?? 0;
        const originY = shape?.y ?? doc?.y ?? tmpl?.y ?? 0;
        const width = shape?.width ?? 100;
        const height = shape?.height ?? width;
        const rotation = shape?.rotation ?? fallbackRotation ?? 0;
        const anchorX = shape?.anchorX ?? 0;
        const anchorY = shape?.anchorY ?? 0;

        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        const bxRel = cos * width;
        const byRel = sin * width;
        const dxRel = -sin * height;
        const dyRel = cos * height;

        const axOffset = (anchorX * bxRel) + (anchorY * dxRel);
        const ayOffset = (anchorX * byRel) + (anchorY * dyRel);

        const ax = originX - axOffset;
        const ay = originY - ayOffset;
        const bx = ax + bxRel;
        const by = ay + byRel;
        const dx = ax + dxRel;
        const dy = ay + dyRel;
        const cx = dx + bxRel;
        const cy = dy + byRel;

        const minX = Math.min(ax, bx, cx, dx);
        const maxX = Math.max(ax, bx, cx, dx);
        const minY = Math.min(ay, by, cy, dy);
        const maxY = Math.max(ay, by, cy, dy);

        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Test whether a point intersects a rotated Region rectangle shape within an optional tolerance.
     * Implements inverse Euclidean rotation into local rectangle coordinate space.
     * @param {Object} shape - Region rectangle shape data ({ x, y, width, height, rotation, anchorX, anchorY })
     * @param {{x: number, y: number}} pt - The point to test in canvas pixel coordinates
     * @param {number} [tolerance=0.75] - Intersection tolerance distance in pixels
     * @returns {boolean} True if point is inside or within tolerance of the rotated rectangle
     * @protected
     */
    _testRotatedRectanglePoint(shape, pt, tolerance = 0.75) {
        if (!shape || !pt) return false;
        const originX = shape.x ?? 0;
        const originY = shape.y ?? 0;
        const width = shape.width ?? 0;
        const height = shape.height ?? width;
        if (width <= 0 || height <= 0) return false;

        const rotation = shape.rotation ?? 0;
        const anchorX = shape.anchorX ?? 0;
        const anchorY = shape.anchorY ?? 0;

        const rad = (rotation * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Vector along width: (cos * width, sin * width)
        const bxRel = cos * width;
        const byRel = sin * width;
        // Vector along height: (-sin * height, cos * height)
        const dxRel = -sin * height;
        const dyRel = cos * height;

        // Offset from origin to top-left vertex A based on normalized anchor
        const axOffset = (anchorX * bxRel) + (anchorY * dxRel);
        const ayOffset = (anchorX * byRel) + (anchorY * dyRel);

        const ax = originX - axOffset;
        const ay = originY - ayOffset;

        // Vector from top-left vertex A to test point P
        const vx = pt.x - ax;
        const vy = pt.y - ay;

        // Transform into local rectangle space by rotating backwards by -rad:
        const u = (vx * cos) + (vy * sin);
        const v = (-vx * sin) + (vy * cos);

        return (u >= -tolerance) && (u <= width + tolerance) &&
               (v >= -tolerance) && (v <= height + tolerance);
    }
}
