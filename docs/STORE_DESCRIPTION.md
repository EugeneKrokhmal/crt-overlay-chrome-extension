# Chrome Web Store — copy/paste for dashboard

Paste each block into the matching field in the [Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## Extension name

```
CRT Monitor Overlay — Retro VHS & Analog Filter
```

*(Keep the name consistent with whatever name was approved at first submission.
 If changing, you may need to re-submit for review.)*

---

## Short description (132 characters max)

```
Retro CRT & VHS filter for any website. Scanlines, glitch, phosphor glow, film grain, lo-fi analog aesthetic. Presets included.
```

---

## Detailed description

```
Transform any website into a glowing, flickering CRT monitor or a worn VHS tape — instantly and without touching the page.

── VISUAL EFFECTS ──────────────────────────────────
• Scanlines — classic cathode-ray tube horizontal line grid
• Vignette / barrel curvature — curved-screen dark-edge effect
• Phosphor glow — soft color bloom from an old tube monitor
• CRT flicker — subtle luminance instability, fully adjustable
• Interlace artifact — alternating field offset like analog TV
• Signal interference bands — slow horizontal brightness drifts

── VHS GLITCH EFFECTS ──────────────────────────────
• RGB chromatic aberration / color separation
• Tape tracking lines and horizontal distortion
• Head-switching bars (worn-tape damage look)
• Video noise / film grain canvas layer
• Tape dropout — random dark horizontal bars
• VHS rewind stripe pattern
• Phase drift / chroma shift
• Wobble — horizontal shake like a bad tape

── IMAGE FILTERS ───────────────────────────────────
• Saturation (color → black & white)
• Contrast boost
• Sharpness (unsharp mask via SVG filter)
• Hue rotation (RGB color shift)

── VHS AUDIO ───────────────────────────────────────
Applies a lo-fi, vintage audio chain to every <audio> and <video> element on the page:
• Tape hiss noise layer
• Warmth (analog low-pass roll-off)
• Overdrive / tape saturation
• Chorus (tape flutter modulation)
• Wow & flutter (pitch wavering)
• Mono downmix (like a mono VHS deck)

── VHS HUD OVERLAY ─────────────────────────────────
• On-screen timestamp (VHS camcorder style: REC ●, HH:MM:SS, date)
• Tape counter (incrementing C 00000)
• Channel static — brief noise burst on SPA navigation (YouTube, Reddit, etc.)

── PRESETS & CONTROLS ──────────────────────────────
• 5 built-in presets: Weak Signal, Scan, VHS, VHS 2, Clean
• Save unlimited named user presets (up to 12)
• Export / Import presets as JSON to share with others
• Share current settings via clipboard (one-click copy)
• Randomize — generates a new random look (checkboxes untouched)
• Reset to defaults

── KEYBOARD SHORTCUT ───────────────────────────────
Ctrl+Shift+C (⌘+Shift+C on Mac) — toggle the overlay on/off.
An on-page indicator confirms the state.

── PRIVACY ─────────────────────────────────────────
No data collected. No accounts. No remote servers. All processing is local.
Settings stored on your device via chrome.storage.local.

── PERFECT FOR ─────────────────────────────────────
Lo-fi aesthetic • Vaporwave • Synthwave • Retrowave • Outrun
Dark browsing • Vintage / nostalgic feel • Lofi hip-hop streams
Twitch / YouTube with a retro look • Photography inspiration
Web design & UI testing with display simulation
```

---

## Single purpose (one sentence)

```
Adds a CRT / VHS retro visual overlay and optional lo-fi audio filter to any web page for an analog, vintage aesthetic.
```

---

## Support URL & Privacy policy URL

```
https://eugenekrokhmal.github.io/crt-overlay-chrome-extension/support.html
```

Use the same URL for both fields. Deploy `docs/` via GitHub Pages before submitting.

---

## Permission justification

**storage**
```
Saves overlay settings, audio levels, and named presets locally on the device. No cloud sync, no external servers.
```

**tabs**
```
Queries open tabs to broadcast updated overlay settings when the user changes options in the side panel, keeping all tabs in sync.
```

**sidePanel** (Privacy practices tab)
```
The sidePanel permission is required to open this extension's settings UI in Chrome's side panel when the user clicks the toolbar icon. The panel contains only the extension's bundled settings page (CRT / VHS sliders, presets, image filters). It does not read, collect, or transmit any website data, browsing history, or page content. The permission is used solely to display the extension's own configuration interface.
```

---

## Host permission justification

Use for the "Read and change all your data on all websites" / broad host access field.

```
The extension injects a visual overlay (bundled CSS and JavaScript) on web pages when the user enables it. The content script draws the CRT/VHS effect and applies user settings only; it does not read, collect, or transmit page content, form data, passwords, or cookies. Broad access is required so the overlay can appear on any site the user chooses. Audio processing uses the Web Audio API on in-page media elements only; no audio data leaves the device.
```

---

## Data use (dashboard disclosures)

- **No user data collected**
- **No data sold or transferred** to third parties for unrelated purposes
- **No data used for creditworthiness or lending**
- **No remote code** — all logic is bundled in the extension package

---

## Category & language

**Category:** Fun  
**Language:** English

---

## Screenshots

1280×800 or 640×400. Suggested shots:

1. A popular site (YouTube, Wikipedia, etc.) with the CRT overlay + VHS glitches enabled
2. The side panel showing CRT Settings and VHS Audio controls
3. VHS HUD (timestamp + tape counter) visible in a corner
4. The presets dropdown with built-in presets highlighted

---

## High-value search terms naturally embedded in descriptions above

*(Internal reference — do not paste into dashboard)*

crt filter, vhs filter, retro overlay, analog effect, scanlines, phosphor, film grain,
vignette, chromatic aberration, rgb split, glitch effect, tape noise, lo-fi, lofi,
vintage filter, nostalgic, vaporwave, synthwave, retrowave, dark aesthetic,
interlace, flicker, barrel distortion, old tv effect, cathode ray tube, monitor simulation,
retro browser, retro web, retro youtube, lofi youtube, lofi twitch, crt screen, crt monitor,
retro aesthetic, 80s filter, 90s filter, vhs glitch, vhs noise, vhs tape, analog filter browser
