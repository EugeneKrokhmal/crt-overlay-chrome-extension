# Publishing to the Chrome Web Store

## Pre-submit checklist

- [ ] `npm run package` — production build + `crt-overlay-chrome-extension-0.2.0.zip` (version from manifest)
- [ ] Zip contains manifest at root (not a `dist/` folder)
- [ ] No remote fonts or scripts (all assets bundled locally)
- [ ] GitHub Pages live at support URL (see below)
- [ ] Store listing text from `STORE_DESCRIPTION.md` pasted into dashboard
- [ ] Screenshots uploaded (1280×800 or 640×400)
- [ ] Permission justifications match `manifest.json` (storage, tabs, sidePanel)
- [ ] Privacy practices: **no data collected**

## 1. Host the support page

The store needs a Support URL and a Privacy policy URL. Use `docs/support.html`.

**GitHub Pages:** Repo → Settings → Pages → Source: "Deploy from a branch" → branch `main`, folder **/docs**. Save. The URL will be:

`https://eugenekrokhmal.github.io/crt-overlay-chrome-extension/support.html`

Use that exact URL for both Support URL and Privacy policy URL in the dashboard.

## 2. Package and upload

```bash
npm run package
```

Upload `crt-overlay-chrome-extension-0.2.0.zip` (repo root) in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole). The zip must contain the *contents* of `dist` (manifest at root), not the `dist` folder itself.

Verify before upload:

```bash
unzip -l crt-overlay-chrome-extension-0.2.0.zip | head
# Should show manifest.json at top level, icons/, src/
```

## 3. Store listing

All copy/paste text is in **`docs/STORE_DESCRIPTION.md`**.

**What changed in 0.2.0** (use as release notes / "What's new"):

```
v0.2.0 — Major feature update

Visual effects
• CRT Flicker — adjustable intensity slider (0–100)
• Interlace — analog TV field-offset artifact
• Signal Interference Bands — slow horizontal brightness drifts

VHS HUD overlay
• On-screen timestamp (VHS camcorder style: REC ●, HH:MM:SS, AM/PM, date)
• Tape Counter (incrementing C 00000)
• Channel Static — brief noise burst on SPA navigation (YouTube, Reddit, etc.)

Audio
• Wow & Flutter — pitch-wavering tape effect
• Mono downmix option

Image Filters
• Saturation / B&W, Contrast, Sharpness (unsharp mask), Hue rotation

Preset system
• 5 built-in, undeletable presets (Weak Signal, Scan, VHS, VHS 2, Clean)
• Export / Import presets as JSON
• Share settings via clipboard (one-click copy)
• Randomize no longer affects checkboxes / radio buttons

Keyboard shortcut
• Ctrl+Shift+C (⌘+Shift+C on Mac) — on-page indicator confirms state

Store
• Improved keywords and descriptions for better discoverability
```

**Permissions in manifest (justify each in the form):**

| Permission | Justification |
|------------|----------------|
| storage | Saves settings and presets locally on the device. |
| tabs | Syncs overlay settings to all open tabs when options change. |
| sidePanel | Opens the extension's bundled settings UI in Chrome's side panel when the user clicks the toolbar icon. Does not access page or browsing data. |

**Host permission** (`<all_urls>` via content scripts): see `STORE_DESCRIPTION.md` → Host permission justification.

**Category:** Fun (or Productivity). **Language:** English.

## 4. After submit

Review can take several days (sometimes longer). If rejected, read the specific policy cited, fix, bump `version` in `manifest.json` and `package.json`, run `npm run package`, and resubmit.
