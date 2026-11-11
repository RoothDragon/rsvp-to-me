# Bundled web fonts

Every font used by the application is stored here as WOFF2 and loaded through
`next/font/local` in `app/fonts.ts`. The two Geist UI faces retain preloading;
the twelve event-title faces do not preload. CSS variables, picker IDs, normal
styles, weight ranges, and email fallback stacks retain their existing contracts.
Builds and visitors need no Google Fonts connection or host-installed fonts.

## Provenance and licenses

`manifest.json` is the inventory and integrity source of truth for all 14 faces.
It records each official source URL, source TTF SHA-256, WOFF2 SHA-256, license
filename/SHA-256, upstream license SHA-256, glyph count, variable axes, and exposed weight range. Upstream license CRLF line endings are normalized to LF for the repository; all text and upstream trailing spaces are retained. Every
license is kept adjacent to its asset. The production Docker image copies all OFL
notices and the provenance manifest into `/app/licenses/fonts`. Files come from the official Google Fonts
repository at pinned commit
`6183fc0d26361f6ddfd6f6b7a736e1467c6d8a43`:
https://github.com/google/fonts/tree/6183fc0d26361f6ddfd6f6b7a736e1467c6d8a43/ofl

The bundled families are Playfair Display, DM Serif Display, Lora, Bebas Neue,
Righteous, Fredoka, Pacifico, Dancing Script, Caveat, Roboto, Space Grotesk,
Outfit, Geist, and Geist Mono. The event picker still has twelve choices; the
Geist families supply interface typography. Additional catalog entries should
follow the same local-asset, provenance, licensing, and email-fallback contracts.

## Reproducing and updating assets

The thirteen newly bundled files were converted with Python 3.12, FontTools
4.66.1, and Brotli 1.2.0. These are conversion tools only, not application
runtime dependencies. Use a disposable tool environment; do not change project
package or lockfiles to update font assets.

Download the exact `sourceUrl` and adjacent OFL.txt at the manifest's pinned
commit. Verify the source SHA-256 before conversion. For each downloaded TTF:

```python
from fontTools.ttLib import TTFont

font = TTFont("source.ttf", recalcTimestamp=False)
# Materialize the same cmap/fvar tables used during coverage validation.
font.getBestCmap()
if "fvar" in font:
    axes = [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in font["fvar"].axes]
font.flavor = "woff2"
font.save("output.woff2")
```

No glyph subsetting or outline modification is performed. Conversion was checked
to preserve the source cmap, glyph count, and variable axes, including default
width axes. The manifest's weight range is the range exposed to CSS; Roboto
continues exposing 400-700 even though its source supports additional weights.
`recalcTimestamp=False` preserves source timestamps for reproducible assets.

Roboto is preserved byte-for-byte from its earlier bundling. Its existing source
SHA-256 is `d7598e12c5dbef095ff8272cfc55da0250bd07fbdecbac8a530b9b277872a134`
and WOFF2 SHA-256 is
`f2c9dbf532e554141e3940e974a90cc07f931e20ece062882ae1eb5358f19b94`.
Its existing FontTools/Brotli provenance remains unchanged; the new timestamp
conversion rule applies to the other thirteen assets. Roboto originally moved
local because extensionless Google `/l/font` URLs broke Next.js's font parser.

## Regression and release checks

`tests/regression/offline-font-assets.test.ts` verifies complete picker/UI
coverage, WOFF2 signatures, licenses, pinned provenance, and asset checksums.
`tests/regression/roboto-font-build.test.ts` builds the actual font module with
Turbopack and an empty Google-response map. It verifies every local asset is
emitted, all CSS variables survive, and only the two UI fonts are preloaded.
Reintroducing any Google loader must fail that offline fixture.

When updating assets, retain their full glyph coverage, review licenses and
weight/axis settings, update the manifest, and run both regressions, type checks,
and full isolated preflight. Do not substitute a Google-font network cache or
mocked font data for the real production assets.
