# Site Image Blocker

This repository contains a Firefox extension that disables image loading on
selected websites and can sync the blocked-site list through Firefox Sync.

## Features

- Blocks network image requests on the sites you choose.
- Hides image elements on matching pages to avoid broken placeholders.
- Lets you toggle the current site from the toolbar popup.
- Provides an options page to add or remove blocked hosts manually.
- Saves blocked hosts to Firefox Sync when available so the list can follow
  your Firefox profile to other desktop devices.
- Injects the page-hiding script only on matching sites instead of every page.
- Lets you export, import, and bulk-refresh affected tabs from the settings page.

## Project structure

- `manifest.json`: Firefox extension manifest.
- `background.js`: Request blocking and rule management.
- `content/hide-images.js`: Hides image elements when injected on matching pages.
- `icons/`: Toolbar and add-on manager icon assets.
- `popup/`: Toolbar popup UI.
- `options/`: Full settings page.
- `scripts/build-xpi.ps1`: Packages the extension as an `.xpi` file.

## How to load it in Firefox

1. Open `about:debugging#/runtime/this-firefox`.
2. Click `Load Temporary Add-on...`.
3. Choose the `manifest.json` file from this folder.
4. Pin the extension if you want quick access to the popup.

Temporary add-ons are removed when Firefox fully exits, so this method is only
for development and quick testing.

## How to build an `.xpi` package

From this project root, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-xpi.ps1
```

The packaged file will be created in `dist/` with a name like:

```text
site-image-blocker-example.com-0.1.0.xpi
```

## How to keep it installed after restart

To keep the extension installed across browser restarts, you need a normal
installed add-on instead of a temporary one.

### Option 1: Sign it for regular Firefox

1. Create an account on Mozilla Add-on Developer Hub.
2. Upload the generated `.xpi` for signing.
3. Install the signed package in Firefox.

This is the standard route for stable Firefox builds.

### Option 2: Use a development-focused Firefox build

Firefox Developer Edition and Nightly are better for repeated extension
testing. They are commonly used during development when you do not want to rely
on temporary loading every session.

## How it works

- The popup toggles the current host on or off.
- The options page edits a list of blocked hosts stored in `browser.storage.sync`
  when Firefox Sync is available, and mirrors it locally for fast page checks.
- The settings page can export the rule list, import it again later, and reload
  all currently open tabs that match the saved rules.
- If sync writes fail later, the extension automatically falls back to local
  storage instead of breaking rule updates.
- The background script cancels requests of type `image` and
  `imageset` when the originating page matches one of your saved hosts.
- The background script injects the content script only on matching `http` and
  `https` pages so unrelated pages do not pay for the extra storage read.
- The content script hides image tags and inline background images on matching
  pages for a cleaner result.

## Notes

- Rules are host based. Saving `example.com` also covers subdomains such as
  `img.example.com`.
- Tabs usually need a reload before the request blocking takes effect.
- Existing locally saved rules are migrated into sync storage the first time the
  extension can use `browser.storage.sync`.
- If you install by temporary loading from `about:debugging`, Firefox removes
  the add-on after the browser restarts.
