export interface BackgroundColor {
  r: number;
  g: number;
  b: number;
  sampleX: number;
  sampleY: number;
}

export function detectCornerBackground(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
): BackgroundColor {
  const points = [
    [Math.floor(width * 0.03), Math.floor(height * 0.03)],
    [Math.floor(width * 0.97), Math.floor(height * 0.03)],
    [Math.floor(width * 0.03), Math.floor(height * 0.97)],
    [Math.floor(width * 0.97), Math.floor(height * 0.97)],
  ];
  const samples = points.map(([x, y]) => {
    const offset = (Math.min(height - 1, y) * width + Math.min(width - 1, x)) * 4;
    return {
      r: pixels[offset],
      g: pixels[offset + 1],
      b: pixels[offset + 2],
      sampleX: x,
      sampleY: y,
    };
  });
  let best = samples[0];
  let bestCount = 0;
  for (const sample of samples) {
    const group = samples.filter(
      (other) =>
        Math.max(
          Math.abs(sample.r - other.r),
          Math.abs(sample.g - other.g),
          Math.abs(sample.b - other.b),
        ) <= 24,
    );
    if (group.length > bestCount) {
      bestCount = group.length;
      const seed = group[0];
      best = {
        r: Math.round(group.reduce((sum, color) => sum + color.r, 0) / group.length),
        g: Math.round(group.reduce((sum, color) => sum + color.g, 0) / group.length),
        b: Math.round(group.reduce((sum, color) => sum + color.b, 0) / group.length),
        sampleX: seed.sampleX,
        sampleY: seed.sampleY,
      };
    }
  }
  return best;
}

export function createBackgroundMask(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  color: BackgroundColor,
  sensitivity: number,
  feather: number,
): Uint8Array {
  const count = width * height;
  const mask = new Uint8Array(count).fill(255);
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  const limit = sensitivity + feather;
  const colorDistance = (pixel: number) => {
    const offset = pixel * 4;
    return Math.max(
      Math.abs(pixels[offset] - color.r),
      Math.abs(pixels[offset + 1] - color.g),
      Math.abs(pixels[offset + 2] - color.b),
    );
  };
  const matches = (pixel: number) => {
    const offset = pixel * 4;
    return pixels[offset + 3] > 0 && colorDistance(pixel) <= limit;
  };

  const seedX = Math.max(0, Math.min(width - 1, color.sampleX));
  const seedY = Math.max(0, Math.min(height - 1, color.sampleY));
  let seed = seedY * width + seedX;
  if (!matches(seed)) {
    seed = -1;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let pixel = 0; pixel < count; pixel++) {
      if (pixels[pixel * 4 + 3] === 0) continue;
      const distance = Math.abs((pixel % width) - seedX) + Math.abs(Math.floor(pixel / width) - seedY);
      if (distance < nearestDistance && matches(pixel)) {
        nearestDistance = distance;
        seed = pixel;
      }
    }
  }
  if (seed < 0) return mask;

  let head = 0;
  let tail = 0;
  queue[tail++] = seed;
  visited[seed] = 1;
  while (head < tail) {
    const pixel = queue[head++];
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x > 0) {
      const neighbor = pixel - 1;
      if (!visited[neighbor] && matches(neighbor)) {
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
    if (x + 1 < width) {
      const neighbor = pixel + 1;
      if (!visited[neighbor] && matches(neighbor)) {
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
    if (y > 0) {
      const neighbor = pixel - width;
      if (!visited[neighbor] && matches(neighbor)) {
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
    if (y + 1 < height) {
      const neighbor = pixel + width;
      if (!visited[neighbor] && matches(neighbor)) {
        visited[neighbor] = 1;
        queue[tail++] = neighbor;
      }
    }
  }

  for (let pixel = 0; pixel < count; pixel++) {
    if (!visited[pixel]) continue;
    const distance = colorDistance(pixel);
    mask[pixel] =
      feather > 0 && distance > sensitivity
        ? Math.round(((distance - sensitivity) / feather) * 255)
        : 0;
  }
  return mask;
}
