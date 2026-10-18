import { describe, expect, it } from 'vitest';
import {
  blankPage,
  cloneElements,
  clonePage,
  createDocument,
  duplicateDocument,
  element,
  parseDocument,
} from '../src/model';
import type { DesignDocument, DesignElement } from '../src/model';

function fixture(): DesignDocument {
  const doc = createDocument('Projeto portátil', 640, 480);
  doc.pages[0].elements = [
    element('text', { text: 'Uma ideia', fontFamily: 'DM Sans', fontSize: 32 }),
    element('rect', { fill: '#c5e8a7', x: 40, y: 80 }),
  ];
  doc.pages.push({ ...blankPage(), name: 'Segunda página', elements: [element('ellipse')] });
  return doc;
}

function ids(doc: DesignDocument) {
  return [
    doc.id,
    ...doc.pages.flatMap((page) => [page.id, ...page.elements.map((item) => item.id)]),
  ];
}

describe('document isolation', () => {
  it('duplicates a complete document with fresh identities and independent editable state', () => {
    const original = fixture();
    original.favorite = true;
    const snapshot = structuredClone(original);
    const copy = duplicateDocument(original);
    expect(ids(copy).every((id) => !ids(original).includes(id))).toBe(true);
    expect(new Set(ids(copy)).size).toBe(ids(copy).length);
    expect(copy.favorite).toBe(false);
    copy.pages[0].elements[0].text = 'Alterado na cópia';
    copy.pages[1].elements.splice(0, 1);
    copy.pages[0].background = '#000000';
    expect(original).toEqual(snapshot);
  });

  it('clones a page without sharing its element objects or array', () => {
    const original = fixture().pages[0];
    const snapshot = structuredClone(original);
    const copy = clonePage(original);
    expect(copy.id).not.toBe(original.id);
    expect(copy.elements[0].id).not.toBe(original.elements[0].id);
    copy.elements[0].fill = '#ff0000';
    copy.elements.push(element('star'));
    expect(original).toEqual(snapshot);
  });

  it('imports a portable project while preserving content and isolating every identity', () => {
    const original = fixture();
    const imported = parseDocument(JSON.parse(JSON.stringify(original)));
    expect(imported.title).toBe(original.title);
    expect([imported.width, imported.height]).toEqual([640, 480]);
    expect(imported.pages.map((page) => page.elements.map((item) => item.kind))).toEqual([
      ['text', 'rect'],
      ['ellipse'],
    ]);
    expect(ids(imported).every((id) => !ids(original).includes(id))).toBe(true);
    imported.pages[0].elements[0].text = 'Edição importada';
    expect(original.pages[0].elements[0].text).toBe('Uma ideia');
  });

  it('normalizes an unsupported font without mutating caller-owned data', () => {
    const original = fixture();
    original.pages[0].elements[0].fontFamily = 'Fonte não instalada';
    const snapshot = structuredClone(original);
    const imported = parseDocument(original);
    expect(imported.pages[0].elements[0].fontFamily).toBe('DM Sans');
    expect(original).toEqual(snapshot);
  });

  it('clones group membership while isolating different groups and ungrouped elements', () => {
    const source = [
      element('rect', { groupId: 'group-a' }),
      element('text', { groupId: 'group-a', text: 'Juntos' }),
      element('ellipse', { groupId: 'group-b' }),
      element('star'),
    ];
    const copy = cloneElements(source);
    expect(copy[0].groupId).toBe(copy[1].groupId);
    expect(copy[0].groupId).toBeTruthy();
    expect(copy[0].groupId).not.toBe('group-a');
    expect(copy[2].groupId).not.toBe('group-b');
    expect(copy[2].groupId).not.toBe(copy[0].groupId);
    expect(copy[3].groupId).toBeUndefined();
    expect(copy.every((item) => !source.some((original) => original.id === item.id))).toBe(true);
    copy[0].groupId = undefined;
    expect(source[0].groupId).toBe('group-a');
    expect(copy[1].groupId).toBeTruthy();
  });

  it('imports grouped pages without coupling groups across pages or to the source project', () => {
    const original = fixture();
    original.pages[0].elements.forEach((item) => {
      item.groupId = 'shared-source-group';
    });
    original.pages[1].elements[0].groupId = 'shared-source-group';
    const snapshot = structuredClone(original);
    const imported = parseDocument(original);
    const group = imported.pages[0].elements[0].groupId;
    expect(group).toBeTruthy();
    expect(imported.pages[0].elements[1].groupId).toBe(group);
    expect(imported.pages[1].elements[0].groupId).not.toBe(group);
    expect(group).not.toBe('shared-source-group');
    expect(original).toEqual(snapshot);
    imported.pages[0].elements[0].text = 'Editado';
    expect(original).toEqual(snapshot);
  });
});

describe('untrusted project validation', () => {
  it.each([null, undefined, true, 'project', 42, {}, { version: 99 }])(
    'rejects malformed roots: %j',
    (value) => {
      expect(() => parseDocument(value)).toThrow();
    },
  );

  it.each([
    { width: 99 },
    { height: 8001 },
    { width: Number.NaN },
    { height: Number.POSITIVE_INFINITY },
    { pages: [] },
    { pages: null },
    { title: null },
    { version: 2 },
  ])('rejects invalid document structure: %j', (patch) => {
    expect(() => parseDocument({ ...fixture(), ...patch })).toThrow();
  });

  it.each([
    { x: Number.NaN },
    { y: Number.POSITIVE_INFINITY },
    { width: 0 },
    { height: -1 },
    { rotation: Number.NEGATIVE_INFINITY },
    { opacity: -0.1 },
    { opacity: 1.1 },
    { kind: 'script' },
    { text: 12 },
    { fontSize: Number.POSITIVE_INFINITY },
    { lineHeight: 0 },
  ])('rejects invalid element geometry or text: %j', (patch) => {
    const doc = fixture();
    Object.assign(doc.pages[0].elements[0], patch);
    expect(() => parseDocument(doc)).toThrow();
  });

  it.each([
    'https://example.com/image.png',
    'javascript:alert(1)',
    'file:///private/image.png',
    'data:image/svg+xml;base64,PHN2Zy8+',
    '/photos/../../outside.jpg',
  ])('rejects image sources outside the portable asset boundary: %s', (src) => {
    const doc = fixture();
    doc.pages[0].elements = [element('image', { src })];
    expect(() => parseDocument(doc)).toThrow();
  });

  it('accepts embedded raster assets and preserves their bytes', () => {
    const doc = fixture();
    const src =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jbe8AAAAASUVORK5CYII=';
    doc.pages[0].elements = [element('image', { src })];
    expect(parseDocument(doc).pages[0].elements[0].src).toBe(src);
  });

  it('rejects an invalid later page instead of importing only the valid prefix', () => {
    const doc = fixture();
    doc.pages[1].elements = [{ ...element('rect'), opacity: Number.NaN } as DesignElement];
    expect(() => parseDocument(doc)).toThrow();
  });
});
