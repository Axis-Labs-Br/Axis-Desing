/** Refresh the official Fontsource catalog and the small offline starter library. */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = 'https://api.fontsource.org/v1/fonts';
const popular = [
  'inter', 'montserrat', 'poppins', 'playfair-display', 'roboto', 'lato',
  'oswald', 'nunito', 'raleway', 'merriweather', 'bebas-neue', 'dancing-script',
  'pacifico', 'anton', 'lora', 'space-grotesk',
];

async function get(url, format = 'json') {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(45_000) });
      if (!response.ok) throw new Error(`${response.status} ${url}`);
      if (format === 'json') return await response.json();
      if (format === 'text') return await response.text();
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

async function save(relative, data) {
  const destination = path.join(root, relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, data);
}

const raw = await get(api);
if (!Array.isArray(raw) || raw.length < 1000) throw new Error('Unexpected Fontsource catalog response');
const fonts = raw.filter((font) => font.category !== 'icons').map((font) => ({
  id: font.id,
  family: font.family,
  category: font.category,
  weights: font.weights,
  styles: font.styles,
  subsets: font.subsets,
  defSubset: font.defSubset,
}));
fonts.sort((left, right) => left.family.localeCompare(right.family, 'en'));
await save('src/data/fonts.json', `${JSON.stringify(fonts)}\n`);
await save('src/data/font-names.json', `${JSON.stringify(fonts.map((font) => font.family))}\n`);

const manifest = [];
const packages = [];
for (const id of popular) {
  const detail = await get(`${api}/${id}`);
  if (!detail.npmVersion) throw new Error(`No pinned package version for ${id}`);
  const licenseUrl = `https://cdn.jsdelivr.net/npm/@fontsource/${id}@${detail.npmVersion}/LICENSE`;
  const license = await get(licenseUrl, 'text');
  await save(`public/licenses/fonts/${id}-LICENSE.txt`, license);
  packages.push({ id, family: detail.family, npmVersion: detail.npmVersion, license: detail.license, licenseUrl });
  for (const style of ['normal', 'italic']) {
    if (!detail.styles.includes(style)) continue;
    const weights = detail.weights.filter((weight) => detail.variants?.[weight]?.[style]?.latin?.url?.woff2);
    if (!weights.length) throw new Error(`No Latin WOFF2 for ${id} ${style}`);
    const chosen = [...new Set([400, 700].map((target) =>
      [...weights].sort((left, right) => Math.abs(left - target) - Math.abs(right - target))[0],
    ))];
    for (const weight of chosen) {
      const source = detail.variants[weight][style].latin.url.woff2.replace('@latest/', `@${detail.npmVersion}/`);
      const bytes = await get(source, 'binary');
      if (bytes.subarray(0, 4).toString() !== 'wOF2') throw new Error(`Invalid WOFF2 at ${source}`);
      const filename = `${id}-latin-${weight}-${style}.woff2`;
      await save(`public/fonts/${filename}`, bytes);
      manifest.push({
        family: detail.family, weight, style, url: `/fonts/${filename}`, source,
        license: `/licenses/fonts/${id}-LICENSE.txt`,
      });
    }
  }
  console.log(`Downloaded ${detail.family} ${detail.npmVersion}`);
}

await save('public/fonts/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
const metadata = {
  fetchedAt: new Date().toISOString(), source: api, totalApiFamilies: raw.length,
  excludedIconFamilies: raw.length - fonts.length, textFamilies: fonts.length,
  offlineFamilies: popular.length, offlineFaces: manifest.length, packages,
};
await save('public/fonts/provenance.json', `${JSON.stringify(metadata, null, 2)}\n`);
await save('docs/FONT_CATALOG.md', `# Font catalog\n\nSnapshot fetched: ${metadata.fetchedAt}.\n\nThe catalog comes from the official read-only [Fontsource API](${api}) and contains **${fonts.length} text font families**. The API returned ${raw.length} families; ${metadata.excludedIconFamilies} families explicitly categorized as icons are excluded. This is the Fontsource catalog, not Canva's proprietary catalog. Some families only contain specific writing systems; their available subsets and weights are preserved.\n\n## Data and local files\n\n- \`src/data/fonts.json\`: normalized metadata (id, family, category, weights, styles, subsets, defSubset).\n- \`src/data/font-names.json\`: the matching family names, suitable for validating saved documents.\n- \`public/fonts/manifest.json\`: ${manifest.length} local WOFF2 faces for ${popular.length} popular families, normal 400/700 and italic 400/700 where available. A family with one weight is included once per style.\n- \`public/fonts/provenance.json\`: retrieval time, counts, pinned package versions, and license sources.\n- \`public/licenses/fonts/*-LICENSE.txt\`: original license notices for every bundled family.\n\nThe local files contain the complete Fontsource **Latin subset**, including the Portuguese alphabet. They do not include every language subset; Cyrillic, Arabic, Japanese and other scripts should be loaded from the catalog on demand. The WOFF2 headers are checked during download. Files use exact npm versions rather than moving latest aliases. Fontsource's package notices accompany the redistributed files.\n\n## Loading another family\n\n1. Fetch \`https://api.fontsource.org/v1/fonts/{id}\`. The result adds \`npmVersion\`, \`unicodeRange\`, and \`variants\`.\n2. Pick a supported weight/style/subset from \`variants[String(weight)][style][subset].url.woff2\`.\n3. Replace \`@latest/\` with \`@\${detail.npmVersion}/\` to pin the same package version returned by the API.\n4. Load with the browser FontFace API and add the face to \`document.fonts\`. Request the language subsets needed for the text, using \`unicodeRange[subset]\` when registering subset faces. Await face loading before drawing or exporting. A missing network response must be shown as an unavailable font, not silently represented as a successfully loaded face.\n\nExample verified URL: \`https://cdn.jsdelivr.net/fontsource/fonts/inter@5.3.0/latin-400-normal.woff2\`. Fontsource's \`version\` field (for example \`v20\`) is the upstream font revision; \`npmVersion\` is the CDN package version.\n\n## Refresh\n\nRun \`node scripts/update-font-catalog.mjs\` from the repository. Node 20+ and network access are required; no API key or dependency installation is required. The script reads only official Fontsource endpoints and their jsDelivr CDN links, writes project assets, and never installs system fonts.\n\nReferences: [API introduction](https://fontsource.org/docs/api/introduction), [Font ID schema](https://fontsource.org/docs/api/font-id), [Fontsource licenses](https://fontsource.org/docs/getting-started/introduction).\n`);
console.log(JSON.stringify({ textFamilies: fonts.length, offlineFamilies: popular.length, offlineFaces: manifest.length }));
