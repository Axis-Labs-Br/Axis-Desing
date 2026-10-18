# Font catalog

Snapshot fetched: 2026-10-17T23:03:35.880Z.

The catalog comes from the official read-only [Fontsource API](https://api.fontsource.org/v1/fonts) and contains **2095 text font families**. The API returned 2103 families; 8 families explicitly categorized as icons are excluded. This is the Fontsource catalog, not Canva's proprietary catalog. Some families only contain specific writing systems; their available subsets and weights are preserved.

## Data and local files

- `src/data/fonts.json`: normalized metadata (id, family, category, weights, styles, subsets, defSubset).
- `src/data/font-names.json`: the matching family names, suitable for validating saved documents.
- `public/fonts/manifest.json`: 49 local WOFF2 faces for 16 popular families, normal 400/700 and italic 400/700 where available. A family with one weight is included once per style.
- `public/fonts/provenance.json`: retrieval time, counts, pinned package versions, and license sources.
- `public/licenses/fonts/*-LICENSE.txt`: original license notices for every bundled family.

The local files contain the complete Fontsource **Latin subset**, including the Portuguese alphabet. They do not include every language subset; Cyrillic, Arabic, Japanese and other scripts should be loaded from the catalog on demand. The WOFF2 headers are checked during download. Files use exact npm versions rather than moving latest aliases. Fontsource's package notices accompany the redistributed files.

## Loading another family

1. Fetch `https://api.fontsource.org/v1/fonts/{id}`. The result adds `npmVersion`, `unicodeRange`, and `variants`.
2. Pick a supported weight/style/subset from `variants[String(weight)][style][subset].url.woff2`.
3. Replace `@latest/` with `@${detail.npmVersion}/` to pin the same package version returned by the API.
4. Load with the browser FontFace API and add the face to `document.fonts`. Request the language subsets needed for the text, using `unicodeRange[subset]` when registering subset faces. Await face loading before drawing or exporting. A missing network response must be shown as an unavailable font, not silently represented as a successfully loaded face.

Example verified URL: `https://cdn.jsdelivr.net/fontsource/fonts/inter@5.3.0/latin-400-normal.woff2`. Fontsource's `version` field (for example `v20`) is the upstream font revision; `npmVersion` is the CDN package version.

## Refresh

Run `node scripts/update-font-catalog.mjs` from the repository. Node 20+ and network access are required; no API key or dependency installation is required. The script reads only official Fontsource endpoints and their jsDelivr CDN links, writes project assets, and never installs system fonts.

References: [API introduction](https://fontsource.org/docs/api/introduction), [Font ID schema](https://fontsource.org/docs/api/font-id), [Fontsource licenses](https://fontsource.org/docs/getting-started/introduction).
