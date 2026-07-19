import { BaseSystemAdapter } from "./base-system-adapter.js";
import { log } from "../../lib/logger.js";

/**
 * System Adapter encapsulating Pathfinder 2e (pf2e) item context resolution and template placement behaviors.
 */
export class Pf2eSystemAdapter extends BaseSystemAdapter {
    /**
     * Initialize Pathfinder 2e system adapter properties.
     */
    constructor() {
        super();
        this.systemId = "pf2e";
        this.supportsActivities = false;
    }

    /**
     * Return list of custom PlaceableObject subclass names introduced by Pathfinder 2e.
     * @returns {string[]} Array of custom placeable class names
     */
    getCustomPlaceableClassNames() {
        return ["MeasuredTemplatePF2e", "RegionPF2e"];
    }

    /**
     * Return whether mouse wheel rotation of a crosshair requires holding the Control / Command modifier key.
     * In Pathfinder 2e, rotating a region/template requires holding Ctrl + mousewheel, so normal mousewheel zooms the canvas.
     * @returns {boolean} True (Pathfinder 2e requires Control key for crosshair wheel rotation)
     */
    requiresWheelModifier() {
        return true;
    }

    /**
     * Extract calling item context from Pathfinder 2e template document flags or base context.
     * @param {Document|null} doc - Template or Region document placed on canvas
     * @param {Object} [baseContext={}] - Initial calling context (`{ item, itemName, itemId }`)
     * @returns {{item: Item|null, itemName: string, itemId: string, activity: Object|null, activityName: string, activityId: string}} Refined calling context object
     */
    extractCallingContext(doc, baseContext = {}) {
        const targetDoc = doc?.document ?? doc;
        let itemObj = baseContext?.item ?? null;

        // In PF2e, template origins are stored inside document.flags.pf2e.origin (or flags.pf2e.item)
        const pf2eFlags = targetDoc?.flags?.pf2e ?? {};
        let originRef = pf2eFlags.origin ?? pf2eFlags.item;

        if (!originRef && targetDoc?.behaviors) {
            const behaviors = typeof targetDoc.behaviors.contents !== "undefined"
                ? targetDoc.behaviors.contents
                : (Array.isArray(targetDoc.behaviors) ? targetDoc.behaviors : []);
            for (const behavior of behaviors) {
                const bFlags = behavior?.flags?.pf2e ?? {};
                originRef = bFlags.origin ?? bFlags.item ?? behavior?.system?.origin;
                if (originRef) break;
            }
        }

        const uuidResolver = typeof fromUuidSync === "function"
            ? fromUuidSync
            : (typeof foundry?.utils?.fromUuidSync === "function" ? foundry.utils.fromUuidSync : null);

        if (!itemObj && originRef && uuidResolver) {
            try {
                if (typeof originRef === "string") {
                    itemObj = uuidResolver(originRef);
                } else if (typeof originRef === "object" && originRef !== null && typeof originRef.uuid === "string") {
                    itemObj = uuidResolver(originRef.uuid);
                }
            } catch (e) {
                log.debug("Pf2eSystemAdapter.extractCallingContext | Could not resolve item from UUID origin:", originRef, e);
            }
        }

        return {
            item: itemObj,
            itemName: itemObj?.name ?? baseContext?.itemName ?? "",
            itemId: itemObj?.id ?? baseContext?.itemId ?? "",
            activity: null,
            activityName: "",
            activityId: ""
        };
    }

    /**
     * Handle delayed single-click programmatic document creation for Pathfinder 2e.
     * Encapsulates the 50ms fallback check, coordinate normalization, PF2e diagnostic dumps, and safe preview dismissal.
     * @param {Scene} scene - Target Canvas Scene
     * @param {Document} doc - Preview Template or Region document
     * @param {PlaceableObject} placeable - Live canvas preview placeable
     * @param {Object} [coords={}] - Resolved placement coordinates (`{ x, y, direction, distance }`)
     * @param {Object} [options={}] - Execution dependencies (`{ crosshairAdapter, pendingPlacements, placementKey }`)
     * @returns {void} No return value
     */
    handleProgrammaticPlacement(scene, doc, placeable, coords = {}, options = {}) {
        if (!doc || !scene) return;
        const docName = doc.documentName ?? "MeasuredTemplate";
        const { crosshairAdapter, pendingPlacements, placementKey } = options;

        setTimeout(async () => {
            const stillPending = pendingPlacements?.get(placementKey);
            if (stillPending && stillPending.resolved && !stillPending.cancelled && stillPending.coords) {
                log.debug(`Pf2eSystemAdapter.handleProgrammaticPlacement | Native placement hook did not fire after 50ms on PF2e. Programmatically creating ${docName} from preview document.`);
                const createData = foundry.utils.deepClone(doc.toObject());
                delete createData._id;

                const shapesList = createData.shapes?.contents ?? (Array.isArray(createData.shapes) ? createData.shapes : []);
                if (shapesList.length > 0 && crosshairAdapter && typeof crosshairAdapter._formatRegionShapeUpdate === "function") {
                    const origShape = typeof shapesList[0]?.toObject === "function" ? shapesList[0].toObject() : shapesList[0];
                    const newShape = crosshairAdapter._formatRegionShapeUpdate(origShape, stillPending.coords);
                    delete newShape._id;
                    createData.shapes = [newShape];
                } else {
                    if (stillPending.coords.x !== undefined) createData.x = stillPending.coords.x;
                    if (stillPending.coords.y !== undefined) createData.y = stillPending.coords.y;
                    if (stillPending.coords.direction !== undefined) createData.direction = stillPending.coords.direction;
                    if (stillPending.coords.distance !== undefined) createData.distance = stillPending.coords.distance;
                }

                try {
                    await scene.createEmbeddedDocuments(docName, [createData]);
                } catch (err) {
                    log.error(`Pf2eSystemAdapter.handleProgrammaticPlacement | Failed to programmatically create ${docName}:`, err);
                }
            }
            if (placeable && crosshairAdapter && typeof crosshairAdapter.dismissPreview === "function") {
                crosshairAdapter.dismissPreview(placeable);
            }
        }, 50);
    }
}
