# CRT Overlay – Docs

## Support & Privacy page (for Chrome Web Store)

- **File:** [support.html](support.html)
- Use this as your **Support URL** and **Privacy policy URL** in the Chrome Web Store dashboard.

### Hosting (pick one)

1. **GitHub Pages (recommended)**
   - Push the repo to GitHub.
   - Settings → Pages → Source: **Deploy from a branch** → Branch: `main` (or `master`) → Folder: **/docs** → Save.
   - Your support page will be at:
     `https://<username>.github.io/<repo-name>/support.html`
   - Use that URL for both **Support URL** and **Privacy policy URL** in the store.

2. **Any static host**
   - Upload `support.html` to your site.
   - Use the full URL in the store listing.

3. **GitHub raw as fallback**
   - You can use a link to the raw file or a viewer (e.g. `https://github.com/<user>/<repo>/blob/main/docs/support.html`) for support, but a proper hosted page is better for privacy policy.
