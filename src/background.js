/**
 * Service worker: install defaults and keyboard command to toggle overlay.
 */
import { STORAGE_KEYS, DEFAULT_OPTIONS, MESSAGE } from "./shared/config.js";
import { storage, tabs } from "./shared/chrome-facade.js";
import { logExtensionWarning } from "./shared/logger.js";

const COMMAND_TOGGLE = "toggle-crt";

function broadcastToggle(enabled) {
  tabs.sendToMessageableTabs(
    { type: MESSAGE.TOGGLE, enabled },
    (err) => {
      if (!err) return;
      if (err.message && err.message.includes("Receiving end does not exist")) return;
      logExtensionWarning("Background: sendMessage to tab failed", err);
    }
  );
}

chrome.runtime.onInstalled.addListener(() => {
  storage.get(null, (data) => {
    const next = { ...DEFAULT_OPTIONS };
    Object.keys(next).forEach((k) => {
      if (data[k] !== undefined) next[k] = data[k];
    });
    storage.set(next);
  });
});

chrome.commands.onCommand.addListener((command) => {
  if (command !== COMMAND_TOGGLE) return;

  storage.get(STORAGE_KEYS.ENABLED, (data) => {
    const next = !data[STORAGE_KEYS.ENABLED];
    storage.set({ [STORAGE_KEYS.ENABLED]: next }, () => {
      broadcastToggle(next);
    });
  });
});
