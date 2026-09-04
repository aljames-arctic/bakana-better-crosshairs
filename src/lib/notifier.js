/**
 * Consolidated UI notification batcher/coalescer (`src/lib/notifier.js`).
 * Delegated directly to the unified Logger class in `src/lib/logger.js`.
 */
import { log, notify, notifyInfo, notifyWarn, notifyError } from "./logger.js";

export { log, notify, notifyInfo, notifyWarn, notifyError };
export default notify;
