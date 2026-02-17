/**
 * Dev-only logging. Logs only when extension is unpacked (no update_url) to avoid leaking info in production.
 */
function isDebug() {
  try {
    const manifest = chrome?.runtime?.getManifest?.();
    return !manifest?.update_url;
  } catch {
    return false;
  }
}

/**
 * Log a warning when debug mode is on (unpacked extension). No-op in production.
 * @param {string} message
 * @param {unknown} [err]
 */
export function logExtensionWarning(message, err) {
  if (!isDebug()) return;
  if (err != null) {
    console.warn(`[CRT Overlay] ${message}`, err);
  } else {
    console.warn(`[CRT Overlay] ${message}`);
  }
}
