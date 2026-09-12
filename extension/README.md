# Save to Personal AI — browser extension

A toolbar button + right-click menu to send the current page, a link, or
selected text to your Personal AI memory. Talks to the public API
(`POST /api/v1/captures`) with a personal token — see `docs/16-API.md`.

Manifest V3; works in Chrome, Edge, and Firefox.

## Install (unpacked, for now)

**Chrome / Edge**

1. `chrome://extensions` → turn on **Developer mode**.
2. **Load unpacked** → pick this `extension/` folder.
3. Click the extension → **Settings** → paste an API token from
   Personal AI (**Settings → API → New key**) → **Test connection**.

**Firefox**

1. `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** →
   pick `extension/manifest.json`.
2. Same token setup via the popup's **Settings** link.

## Use

- **Toolbar button** → popup: "Save this page", or type a note to save
  instead.
- **Right-click** a link → *Save link to Personal AI*.
- **Right-click** selected text → *Save selection to Personal AI* (saved as
  a note).
- **Right-click** the page → *Save this page to Personal AI*.

A desktop notification confirms each save; the capture is processed
server-side and shows up on your Timeline shortly.

## Publishing

The folder is store-ready. Firefox AMO submission is free; the Chrome Web
Store has a one-time $5 developer fee. Bump `version` in `manifest.json`
before each upload.
