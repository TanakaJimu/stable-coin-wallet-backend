/**
 * Background worker: runs the deposit watcher and reconnects on disconnect.
 * Start from server or a separate process. Custodial flow: Vault deposits -> credit DB.
 */
import { startDepositWatcher } from "../blockchain/watcher.js";

const onError = (err) => {
  console.error("[depositProcessor]", err?.message || err);
};

/**
 * Start the deposit watcher. Call once at app startup (or from a worker process).
 */
export function runDepositProcessor() {
  startDepositWatcher(onError).catch((err) => {
    console.error("[depositProcessor] start failed:", err?.message || err);
    setTimeout(runDepositProcessor, 10000); // reconnect after 10s
  });
}
