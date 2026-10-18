import { describe, expect, it } from 'vitest';
import { createBackgroundMask, detectCornerBackground } from '../src/backgroundRemoval';

function rgba(width: number, height: number, color: [number, number, number]) {
  const pixels = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels.set([...color, 255], offset);
  }
  return pixels;
}

describe('remoção local de fundo', () => {
  it('detecta a cor repetida nos cantos e só remove a região conectada', () => {
    const width = 5;
    const height = 5;
    const pixels = rgba(width, height, [240, 240, 240]);
    for (let y = 1; y < 4; y++) {
      for (let x = 1; x < 4; x++) pixels.set([220, 35, 50, 255], (y * width + x) * 4);
    }
    // A mesma cor do fundo, isolada dentro do objeto, deve ser preservada.
    pixels.set([240, 240, 240, 255], (2 * width + 2) * 4);

    const background = detectCornerBackground(pixels, width, height);
    const mask = createBackgroundMask(pixels, width, height, background, 8, 0);

    expect(background).toMatchObject({ r: 240, g: 240, b: 240 });
    expect(mask[0]).toBe(0);
    expect(mask[2 * width + 2]).toBe(255);
    expect(mask[width + 1]).toBe(255);
  });

  it('suaviza pixels de borda próximos à cor escolhida', () => {
    const pixels = rgba(3, 1, [100, 100, 100]);
    pixels.set([120, 120, 120, 255], 4);
    pixels.set([230, 20, 20, 255], 8);

    const mask = createBackgroundMask(
      pixels,
      3,
      1,
      { r: 100, g: 100, b: 100, sampleX: 0, sampleY: 0 },
      10,
      40,
    );

    expect(mask[0]).toBe(0);
    expect(mask[1]).toBe(64);
    expect(mask[2]).toBe(255);
  });
});
