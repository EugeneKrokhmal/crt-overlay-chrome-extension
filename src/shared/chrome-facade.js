/**
 * Thin facade over chrome.storage.local and chrome.tabs for content/popup/background.
 * Enables tests to mock storage and messaging by replacing this module.
 */

import { isMessageableTab } from "./config.js";

export const storage = {
  get(keys, callback) {
    chrome.storage.local.get(keys, callback);
  },
  set(items, callback) {
    chrome.storage.local.set(items, callback ?? (() => {}));
  },
};

export const tabs = {
  /**
   * Send a message to all tabs that accept content scripts (excludes chrome:// etc).
   * @param {object} message
   * @param {(err?: Error) => void} [onSent] called per tab (errors are passed)
   */
  sendToMessageableTabs(message, onSent) {
    chrome.tabs.query({}, (tabList) => {
      const messageable = tabList.filter(isMessageableTab);
      messageable.forEach((tab) => {
        chrome.tabs
          .sendMessage(tab.id, message)
          .then(() => onSent?.())
          .catch((err) => onSent?.(err));
      });
    });
  },
};
