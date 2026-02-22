# Chrome Web Store — copy/paste for dashboard

Paste each block into the matching field in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Short description (132 characters max)

```
CRT-style overlay and optional VHS sound on any page. Scanlines, vignette, curvature. Clicks pass through.
```

---

## Detailed description

```
Puts a CRT-style overlay on any tab: scanlines, vignette, slight curvature and glow. Optional VHS-style audio (muffled highs, light hiss) for in-page video and audio. The overlay is visual only—clicks and keyboard go to the page.

Toggle from the popup or with Ctrl+Shift+C (Command+Shift+C on Mac). Sliders control each effect. Settings are saved locally and apply to all tabs.
```

---

## Single purpose (one sentence)

```
Adds a CRT-style visual overlay and optional VHS-style audio to web pages for a retro look and sound.
```

---

## Support URL & Privacy policy URL

```
https://eugenekrokhmal.github.io/crt-overlay-chrome-extension/support.html
```

Use for both fields.

---

## Permission justification

**storage**
```
Saves preferences (on/off, sliders, VHS options) on the device.
```

**activeTab**
```
Lets the extension inject the overlay only into the tab where the user opens the popup or uses the shortcut (no access to other tabs).
```

**tabs**
```
Tracks which tabs have the overlay so we can update them when you change settings and remove the overlay when you close a tab.
```

---

## Host permission justification

Use for the “Read and change all your data on all websites” / `<all_urls>` field.

```
The extension injects a visual overlay (CSS + minimal JS) on every tab so the user can get the CRT effect on any site they choose. The content script only draws the overlay and applies the user's settings; it does not read page content, form data, or cookies. Without access to all URLs, the overlay could not be shown on arbitrary pages when the user enables it.
```

---

## Category & language

**Category:** Fun (or Productivity)  
**Language:** English

## Screenshots

1280×800 or 640×400. (1) A normal site with the overlay on. (2) The popup with controls.
