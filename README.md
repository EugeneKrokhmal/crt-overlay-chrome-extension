# CRT Monitor Overlay

Chrome extension that draws a CRT-style overlay on every tab—scanlines, vignette, a bit of curvature and glow. The overlay is visual only; clicks and keyboard go to the page. Optional VHS-style audio for in-page video and audio (muffled highs, light hiss). Same-origin media only; embedded players like YouTube aren’t affected.

**Shortcut:** Ctrl+Shift+C (Windows/Linux) or Command+Shift+C (Mac) toggles the overlay.

## Build and load

```bash
npm install
npm run build
```

In Chrome open `chrome://extensions`, turn on Developer mode, choose “Load unpacked”, and pick the `dist` folder. Requires Chrome 114+ (side panel API).

## Publish to Chrome Web Store

```bash
npm run package
```

Creates `crt-overlay-chrome-extension-<version>.zip` for the Chrome Web Store. See `docs/PUBLISHING.md` and `docs/STORE_DESCRIPTION.md`.

## Development

```bash
npm run dev
```

Reload the extension when you change code.

## Using it

Click the toolbar icon to open the side panel, switch “Enable overlay” on, and tweak the sliders. Save presets for quick recall. Settings are stored locally and apply to all tabs. New tabs get the overlay if it’s already on.

## Code note

`src/shared/chrome-facade.js` wraps storage and tab messaging so you can mock it for tests. Prefer the facade over calling `chrome.*` directly in popup/background/content.
