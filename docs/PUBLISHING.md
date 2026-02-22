# Publishing to the Chrome Web Store

## 1. Host the support page

The store needs a Support URL and a Privacy policy URL. Use `support.html` in this folder for both.

**GitHub Pages:** Repo → Settings → Pages → Source: “Deploy from a branch” → branch `main`, folder **/docs**. Save. The URL will be:

`https://eugenekrokhmal.github.io/crt-overlay-chrome-extension/support.html`

Use that exact URL for both Support URL and Privacy policy URL in the dashboard.

## 2. Package and upload

```bash
npm run build
cd dist && zip -r ../crt-overlay-chrome-extension-v0.1.0.zip . && cd ..
```

Upload `crt-overlay-chrome-extension-v0.1.0.zip` (repo root) in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). The zip must contain the *contents* of `dist` (manifest at root), not the `dist` folder itself.

## 3. Store listing — copy/paste

All text for the dashboard is in **`docs/STORE_DESCRIPTION.md`**. Open it and paste each block into the matching field.

**Short description (132 chars max):**
```
CRT-style overlay and optional VHS sound on any page. Scanlines, vignette, curvature. Clicks pass through.
```

**Detailed description:**
```
Puts a CRT-style overlay on any tab: scanlines, vignette, slight curvature and glow. Optional VHS-style audio (muffled highs, light hiss) for in-page video and audio. The overlay is visual only—clicks and keyboard go to the page.

Toggle from the popup or with Ctrl+Shift+C (Command+Shift+C on Mac). Sliders control each effect. Settings are saved locally and apply to all tabs.
```

**Single purpose (one sentence):**
```
Adds a CRT-style visual overlay and optional VHS-style audio to web pages for a retro look and sound.
```

**Permission justification (use in the form for each):**

| Permission | Justification |
|------------|----------------|
| storage | Saves your preferences (on/off, sliders, VHS options) on your device. |
| activeTab | Needed so the popup knows which tab is active. |
| tabs | Applies overlay and settings to all tabs and keeps new tabs in sync. |

**Host permission justification** (for “Read and change all your data on all websites” / `<all_urls>`):

The extension injects a visual overlay (CSS + minimal JS) on every tab so the user can get the CRT effect on any site they choose. The content script only draws the overlay and applies the user’s settings; it does not read page content, form data, or cookies. Without access to all URLs, the overlay could not be shown on arbitrary pages when the user enables it.

**Category:** Fun (or Productivity). **Language:** English.

**Screenshots:** 1280×800 or 640×400. One with a normal site and the overlay on; one of the popup with the controls.

## 4. After submit

Review can take a few days. If rejected, fix and resubmit; bump `version` in `manifest.json` (and `package.json` if you keep them in sync) for each new upload.
