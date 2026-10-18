import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { createDocument, element, parseDocument } from '../src/model';
import { validVectorPaths } from '../src/vectorTypes';
import { validEmbeddedFont, safeFontFamily } from '../src/fontTypes';
import fonts from '../src/data/fonts.json';
const icons = JSON.parse(readFileSync('public/elements/lucide.json', 'utf8'));
const graphics = JSON.parse(readFileSync('public/elements/graphics.json', 'utf8'));

describe('catalog integrity and portable asset boundaries', () => {
  it('makes the complete text-font snapshot available with unique, safe family names', () => {
    expect(fonts.length).toBeGreaterThan(2000);
    expect(new Set(fonts.map((f) => f.family)).size).toBe(fonts.length);
    expect(
      fonts.every((f) => safeFontFamily(f.family) && f.weights.length && f.styles.length),
    ).toBe(true);
  });
  it('validates every shipped vector, including filled icon details and hollow frames', () => {
    const assets = [...icons, ...graphics];
    expect(icons.length).toBeGreaterThan(1500);
    expect(graphics.length).toBeGreaterThanOrEqual(50);
    expect(new Set(assets.map((a) => a.id)).size).toBe(assets.length);
    for (const asset of assets) expect(validVectorPaths(asset.paths), asset.id).toBe(true);
  });
  it.each(['onLoad', 'href', 'style', 'dangerouslySetInnerHTML', 'filter'])(
    'rejects executable or external SVG attribute %s',
    (attribute) => {
      expect(
        validVectorPaths([
          { tag: 'path', attrs: { d: 'M0 0L24 24', [attribute]: 'javascript:alert(1)' } },
        ]),
      ).toBe(false);
    },
  );
  it('rejects unsupported SVG tags and invalid geometry', () => {
    expect(validVectorPaths([{ tag: 'script', attrs: {} }])).toBe(false);
    expect(validVectorPaths([{ tag: 'circle', attrs: { r: Infinity } }])).toBe(false);
    expect(validVectorPaths([{ tag: 'path', attrs: { d: 'url(https://example.com)' } }])).toBe(
      false,
    );
  });
  it('preserves editable vector data while regenerating imported identities', () => {
    const doc = createDocument();
    doc.pages[0].elements = [
      element('vector', {
        vectorPaths: graphics[0].paths,
        vectorViewBox: [24, 24],
        vectorStyle: 'solid',
      }),
    ];
    const imported = parseDocument(doc);
    expect(imported.pages[0].elements[0].vectorPaths).toEqual(doc.pages[0].elements[0].vectorPaths);
    expect(imported.pages[0].elements[0].id).not.toBe(doc.pages[0].elements[0].id);
  });
  it('preserves known catalog font names and embedded custom font bytes', () => {
    const doc = createDocument();
    doc.pages[0].elements = [
      element('text', { fontFamily: 'Montserrat' }),
      element('text', { fontFamily: 'Minha Fonte' }),
    ];
    doc.fonts = [
      {
        family: 'Minha Fonte',
        weight: '400',
        style: 'normal',
        data: `data:font/woff2;base64,${readFileSync('tests/fixtures/abeezee.woff2').toString('base64')}`,
      },
    ];
    const imported = parseDocument(doc);
    expect(imported.pages[0].elements.map((e) => e.fontFamily)).toEqual([
      'Montserrat',
      'Minha Fonte',
    ]);
    expect(imported.fonts).toEqual(doc.fonts);
  });
  it.each([
    { family: '</style><script>alert(1)</script>' },
    { data: 'https://example.com/font.woff2' },
    { weight: '400; color:red' },
    { style: 'url(evil)' },
  ])('rejects unsafe embedded font metadata %j', (patch) => {
    const face = {
      family: 'My Font',
      weight: '400',
      style: 'normal',
      data: 'data:font/woff2;base64,d09GMg==',
      ...patch,
    };
    expect(validEmbeddedFont(face)).toBe(false);
    const doc = createDocument();
    Object.assign(doc, { fonts: [face] });
    expect(() => parseDocument(doc)).toThrow();
  });
});
