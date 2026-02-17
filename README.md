# CRT Monitor Overlay

Chrome extension (Manifest V3) that applies a high-quality CRT-style overlay on all tabs and all sites. Uses `crt.png` as the extension icon. The overlay is purely visual—clicks, scroll, and keyboard pass through to the page.

## Features

- **All tabs, all sites**: Runs on every URL. Toggle once and it applies everywhere (or use the shortcut).
- **Effects**: Fine scanlines, vignette, curvature, and subtle glow. Adjust intensity in the popup.
- **Non-intrusive**: Overlay uses `pointer-events: none` so the page stays fully interactive.
- **Keyboard shortcut**: `Ctrl+Shift+C` (Windows/Linux) or `Command+Shift+C` (Mac) toggles the overlay.
- **VHS sound filter**: Optional retro film audio (muffled highs + lo-fi hiss) for `<audio>` and `<video>` on the page. Only affects same-origin media (e.g. direct video/audio; not audio inside cross-origin iframes like YouTube embeds).

## Build

```bash
cd crt-overlay
npm install
npm run build
```

Load the extension in Chrome: open `chrome://extensions`, enable "Developer mode", click "Load unpacked", and select the `dist` folder.

## Development

```bash
npm run dev
```

Keep this running and reload the extension when you change code.

## Usage

1. Click the extension icon to open the popup.
2. Turn "Enable overlay" on. Use the sliders to adjust scanlines, vignette, curvature, and glow.
3. Or use the keyboard shortcut to toggle without opening the popup.

Settings are saved and apply to all tabs. New tabs will show the overlay if it was enabled.

## Testing

Storage and messaging are not dependency-injected; verification is by E2E or manual testing (load unpacked, use popup and shortcut). The shared `chrome-facade` (`src/shared/chrome-facade.js`) wraps `chrome.storage.local` and tab messaging so that future automated tests can mock this module. When adding more features or unit tests, inject the facade into popup/background/content instead of calling `chrome.*` directly.
