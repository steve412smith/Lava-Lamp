# Lava Drift

A portable procedural sensory lava lamp / flow-field PWA designed for Android Chrome and desktop browsers.

## Install on Android

1. Publish this folder with GitHub Pages.
2. Open the GitHub Pages URL in Chrome on Android.
3. Tap the Chrome menu and choose **Install app** or **Add to Home screen**.

## GitHub Pages setup

Repository **Settings → Pages**:

- Source: Deploy from a branch
- Branch: main
- Folder: / root

## Updating

Upload/replace these files in the repository root:

- index.html
- style.css
- app.js
- manifest.json
- service-worker.js
- icon.svg
- README.md

If the old version sticks on Android, open the app once while online, close it, then reopen. The service worker cache version is `lava-drift-v2.0.0`.

## Version 2 highlights

- Mobile-first PWA
- Offline support
- Presets: Ocean, Forest, Aurora, Ember, Night, Focus
- Sliders for energy, density, glow, and coherence
- Touch interaction
- Soft bloom and particle/metaball-style rendering
