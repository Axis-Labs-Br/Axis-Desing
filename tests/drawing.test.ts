import { describe, expect, it } from 'vitest';
import { createDocument, parseDocument, cloneElements } from '../src/model';
import { createNote, drawnSignature } from '../src/drawingAssets';
import { fitNote, wrapText } from '../src/Scene';

describe('sticky notes and signature documents', () => {
  it('grows for paragraphs and unbroken words, then returns to its minimum height', () => {
    const note = createNote('#fff9a8', 'Luciano Junior', 800);
    const grown = fitNote({ ...note, text: 'a'.repeat(900) });
    expect(grown.height).toBeGreaterThan(note.height * 2);
    expect(wrapText(grown).length).toBeGreaterThan(10);
    const shortened = fitNote({ ...grown, text: 'Uma ideia.' });
    expect(shortened.height).toBe(note.height);
    expect(shortened.note?.author).toBe('Luciano Junior');
  });
  it('round-trips a note and a multi-stroke signature with independent metadata', () => {
    const note = createNote('#aedbff', 'Luciano Junior', 800);
    const signature = drawnSignature([[{ x: 10, y: 20 }, { x: 24, y: 4 }, { x: 50, y: 25 }],
      [{ x: 8, y: 30 }, { x: 62, y: 30 }]], '#181b22')!;
    const doc = createDocument('Notas e assinatura', 800, 600);
    doc.pages[0].elements = [note, signature];
    const imported = parseDocument(JSON.parse(JSON.stringify(doc)));
    expect(imported.pages[0].elements[0].note).toEqual(note.note);
    expect(imported.pages[0].elements[1].vectorPaths).toHaveLength(2);
    expect(imported.pages[0].elements[1].vectorPaths).toEqual(signature.vectorPaths);
    const [copy] = cloneElements([note]);
    copy.note!.color = '#ffb6cf';
    expect(note.note?.color).toBe('#aedbff');
  });
  it.each([{ color: 'url(https://example.com/image)' }, { author: {} }, { minHeight: -1 }])(
    'rejects invalid sticky metadata %j', (invalid) => {
      const note = createNote('#fff9a8', 'Luciano Junior', 800);
      const doc = createDocument('Nota', 800, 600);
      doc.pages[0].elements = [{ ...note, note: { ...note.note!, ...invalid } } as typeof note];
      expect(() => parseDocument(doc)).toThrow('Nota adesiva inválida');
    },
  );
});
