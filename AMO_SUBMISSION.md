# AMO Submission Notes

Use this file as a checklist when submitting the extension to Mozilla Add-on
Developer Hub for signing.

## Recommended submission type

- `Unlisted`

This is the best fit if you want a signed `.xpi` that can be installed in
regular Firefox without publishing a public AMO listing page.

## Upload file

Build the package first:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-xpi.ps1
```

Expected package for this version:

```text
dist/site-image-blocker-example.com-1.0.0.xpi
```

## Suggested AMO metadata

### Add-on name

`Site Image Blocker`

### Summary

`Block image loading on selected websites and sync the blocked-site list through Firefox Sync.`

### Description

`Site Image Blocker lets you disable image loading on websites you choose.`

`You can toggle the current site from the toolbar popup, manage the full site list from the settings page, import or export the list, and reload affected tabs after changing rules.`

`When Firefox Sync add-on data is available, the blocked-site list is synchronized across Firefox profiles.`

### Category suggestions

- `Privacy & Security`
- `Productivity`

## Permission rationale

You may be asked why the extension needs broad permissions. These explanations
are written to be easy to reuse in the submission form.

### `<all_urls>`

Needed so the extension can block image requests and inject its page-hiding
script on any site the user chooses to disable images on.

### `webRequest` and `webRequestBlocking`

Needed to cancel image network requests before the browser loads them.

### `webNavigation`

Needed to inject the page-hiding script only on matching sites instead of every
page.

### `tabs`

Needed for the popup to inspect the current site and for the settings page to
reload affected open tabs after rule changes.

### `storage`

Needed to save the blocked-site list locally and in Firefox Sync when
available.

## Privacy answers

### Does the extension collect user data?

`No.`

### What data is stored?

Only the blocked host list selected by the user. It is stored in browser
storage and optionally synchronized through Firefox Sync.

### Is data sent to external servers?

`No.`

The extension does not run its own backend, does not send analytics, and does
not upload browsing data anywhere.

## Review notes

- No remote code loading.
- No obfuscated code.
- No third-party network requests initiated by the extension.
- All logic is bundled in this repository.

## Visual assets

Repository preview assets that can help you prepare screenshots:

- `assets/preview-popup.svg`
- `assets/preview-options.svg`
