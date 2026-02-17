# Chrome Web Store (or Extension Store) – Publish Checklist

Use this before submitting the CRT Overlay extension.

## Code & build (done)

- [x] Manifest V3, required icons (16, 48, 128), name, description, version
- [x] Production build: `npm run build` (minified, no source maps)
- [x] No unused dependencies (Bulma removed)
- [x] Permissions are minimal and justifiable: `storage`, `activeTab`, `tabs`

## Package for upload

1. Run `npm run build`.
2. Zip the **contents** of the `dist` folder (not the folder itself):
   The zip must have `manifest.json` at the root, plus `src/`, `icons/`, etc.
   ```bash
   cd crt-overlay/dist && zip -r ../crt-overlay-v0.1.0.zip . && cd ..
   ```
3. Upload `crt-overlay-v0.1.0.zip` in the Developer Dashboard.

## Store listing (you do in the dashboard)

- **Short description** (e.g. 132 chars): One clear sentence. e.g. “CRT-style overlay and optional VHS sound on any page. Scanlines, vignette, curvature. Clicks pass through.”
- **Detailed description**: Start with the single purpose (retro overlay + optional sound). Then: features, how to use, shortcut (Ctrl+Shift+C / Cmd+Shift+C). No all-caps, no “best”/“#1” unless you can back it up. Be accurate.
- **Screenshots**: 1280×800 or 640×400. Show (1) a normal site with the overlay on, (2) the popup with controls. Real usage helps review.
- **Promo tile** (optional): 440×280 for featured placement.
- **Category**: e.g. “Fun” or “Productivity”.
- **Language**: Primary language (e.g. English).
- **Single purpose**: In the form, describe the extension in one sentence (e.g. “Adds a CRT-style visual overlay and optional VHS-style audio effect to web pages for a retro look and sound.”). Chrome prefers one clear purpose.

## Support URL & Privacy policy URL (important for approval)

- **Support page:** Use `docs/support.html` in this repo. It includes:
  - What the extension does
  - How to use it
  - **Privacy policy** (no data collection; local storage only)
  - Why each permission is needed
  - FAQ and contact
- **Host it** (e.g. GitHub Pages from the `/docs` folder). See `docs/README.md` for steps.
- In the Chrome Web Store dashboard set:
  - **Support URL** → your hosted URL (e.g. `https://username.github.io/repo-name/support.html`)
  - **Privacy policy URL** → same URL (the page has a dedicated Privacy policy section)

## Privacy & permissions

- **Privacy policy**: The support page (`docs/support.html`) contains a clear “Privacy policy” section stating the extension does **not** collect or transmit any personal data; settings stay in `chrome.storage.local` on the user’s device. Use that page’s URL as the store’s “Privacy policy URL.”
- **Permission justification**: In the dashboard, for each permission:
  - **storage**: Save user preferences (overlay on/off, sliders, VHS options).
  - **activeTab**: Access current tab when user opens the popup.
  - **tabs**: Apply overlay/settings to all tabs when user changes options.

## After submission

- First review can take a few days.
- If rejected, use the feedback to fix and resubmit.
- Bump `version` in `manifest.json` (and `package.json` if you keep it in sync) for each new upload.
