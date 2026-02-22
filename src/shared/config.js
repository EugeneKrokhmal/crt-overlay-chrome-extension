/**
 * Shared configuration for CRT overlay extension.
 * Storage keys, defaults, and popup mappings are derived from options-schema.js.
 */
export {
  OPTION_ENTRIES,
  getContentKey,
  STORAGE_KEYS,
  DEFAULT_OPTIONS,
  STORAGE_KEYS_LIST,
  OPTION_SLIDER_KEYS,
  STORAGE_KEY_TO_OPTION,
  OPTION_TO_STORAGE_KEY,
  POPUP_IDS,
  SLIDER_RANGE,
  FILL_IDS,
  SLIDER_ID_TO_STORAGE_KEY,
} from "./options-schema.js";

export const MESSAGE = {
  TOGGLE: "toggle",
  SET_OPTIONS: "setOptions",
  GET_STATE: "getState",
};

/**
 * Standard message response shape: { ok: boolean, data?: unknown }.
 * Async handlers must return a Promise that resolves to this; the listener must return true
 * when the handler is async so sendResponse remains valid.
 */
export function messageResponse(ok, data = undefined) {
  return data === undefined ? { ok } : { ok, data };
}

/** URL prefixes for tabs we must not send messages to */
export const RESTRICTED_URL_PREFIXES = ["chrome://", "chrome-extension://", "edge://"];

/** True if we can sendMessage to this tab */
export function isMessageableTab(tab) {
  return tab.id && tab.url && !RESTRICTED_URL_PREFIXES.some((p) => tab.url.startsWith(p));
}
