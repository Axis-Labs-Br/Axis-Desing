import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

const element = (id: string, x: number, y: number, width: number, height: number, extra = {}) => ({
  id,
  kind: 'rect',
  name: id,
  x,
  y,
  width,
  height,
  rotation: 0,
  fill: '#6671df',
  opacity: 1,
  locked: false,
  hidden: false,
  ...extra,
});
const overlappingElements = (front: 'image' | 'text') => {
  const text = element('overlay-text', 140, 120, 240, 72, {
    kind: 'text', text: 'Texto', fontSize: 42, fontFamily: 'DM Sans',
  });
  const image = element('background-image', 100, 100, 400, 250, {
    kind: 'image', src: '/photos/leaves.jpg', opacity: 0.6,
  });
  return front === 'image' ? [text, image] : [image, text];
};
async function fixture(
  page: Page,
  elements = [
    element('first', 100, 100, 160, 100),
    element('second', 450, 350, 120, 80, { fill: '#d879b0' }),
    element('locked', 550, 100, 100, 100, { locked: true, fill: '#93bca2' }),
    element('title', 100, 440, 280, 80, {
      kind: 'text',
      text: 'Texto original',
      fontSize: 24,
      fontFamily: 'DM Sans',
    }),
  ],
) {
  await page.goto('/');
  const doc = {
    version: 1,
    id: 'stage-test',
    title: 'Canvas integration',
    width: 800,
    height: 600,
    createdAt: 1,
    updatedAt: 1,
    favorite: false,
    pages: [
      {
        id: 'page-test',
        name: 'Página',
        background: '#ffffff',
        elements,
      },
    ],
  };
  await page
    .locator('input[type="file"][accept=".axis,.json"]')
    .setInputFiles({
      name: 'canvas.axis',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(doc)),
    });
  await expect(page.getByTestId('design-canvas')).toBeVisible();
  await expect(page.getByTestId('design-canvas').locator('[data-element-id]')).toHaveCount(elements.length);
}
async function geometry(locator: Locator) {
  return locator.evaluate((node) => {
    const transform = node.querySelector('g[transform]')!.getAttribute('transform')!;
    const [x, y, rotation] = [...transform.matchAll(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)].map(
      (match) => Number(match[0]),
    );
    const hit = node.querySelector('.stage-hitarea');
    const shape = node.querySelector('rect');
    return {
      x,
      y,
      rotation,
      width: Number((hit ?? shape)?.getAttribute('width')),
      height: Number((hit ?? shape)?.getAttribute('height')),
    };
  });
}
async function canvasPoint(page: Page, x: number, y: number) {
  const box = (await page.getByTestId('design-canvas').boundingBox())!;
  return { x: box.x + (x * box.width) / 800, y: box.y + (y * box.height) / 600 };
}
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

test('canvas drag uses design coordinates, one undo restores gesture, resize and rotation work', async ({
  page,
}) => {
  await fixture(page);
  await page.getByLabel('Zoom', { exact: true }).fill('50');
  const rect = page.getByTestId('design-canvas').locator('[data-kind="rect"]').nth(0);
  const original = await geometry(rect);
  const start = await canvasPoint(page, 150, 150);
  await drag(page, start, { x: start.x + 40, y: start.y + 30 });
  let changed = await geometry(rect);
  expect(changed.x).toBeCloseTo(original.x + 80, 3);
  expect(changed.y).toBeCloseTo(original.y + 60, 3);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  expect(await geometry(rect)).toEqual(original);
  await page.getByRole('button', { name: 'Refazer', exact: true }).click();
  expect((await geometry(rect)).x).toBeCloseTo(original.x + 80, 3);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  expect(await geometry(rect)).toEqual(original);
  await rect.click();
  const handle = (await page.getByTestId('resize-se').boundingBox())!;
  await drag(
    page,
    { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
    { x: handle.x + handle.width / 2 + 30, y: handle.y + handle.height / 2 + 20 },
  );
  changed = await geometry(rect);
  expect(changed.width).toBeCloseTo(original.width + 60, 3);
  expect(changed.height).toBeCloseTo(original.height + 40, 3);
  const rotationHandle = (await page.getByTestId('rotate-handle').boundingBox())!;
  const center = await canvasPoint(
    page,
    changed.x + changed.width / 2,
    changed.y + changed.height / 2,
  );
  await drag(
    page,
    {
      x: rotationHandle.x + rotationHandle.width / 2,
      y: rotationHandle.y + rotationHandle.height / 2,
    },
    { x: center.x + 100, y: center.y },
  );
  changed = await geometry(rect);
  expect(Number.isFinite(changed.rotation)).toBe(true);
  expect(Math.abs(changed.rotation)).toBeGreaterThan(30);
});

test('shift multiselect and marquee move only editable elements and empty click clears selection', async ({
  page,
}) => {
  await fixture(page);
  const rects = page.getByTestId('design-canvas').locator('[data-kind="rect"]');
  const before = await Promise.all([
    geometry(rects.nth(0)),
    geometry(rects.nth(1)),
    geometry(rects.nth(2)),
  ]);
  await rects.nth(0).click();
  await rects.nth(1).click({ modifiers: ['Shift'] });
  await expect(page.getByText('2 elementos selecionados', { exact: true })).toBeVisible();
  await page.keyboard.press('ArrowRight');
  expect((await geometry(rects.nth(0))).x).toBe(before[0].x + 1);
  expect((await geometry(rects.nth(1))).x).toBe(before[1].x + 1);
  expect(await geometry(rects.nth(2))).toEqual(before[2]);
  const blank = await canvasPoint(page, 30, 30);
  await page.mouse.click(blank.x, blank.y);
  await expect(page.locator('.stage-handle')).toHaveCount(0);
  await expect(page.getByText('2 elementos selecionados', { exact: true })).toHaveCount(0);
  await drag(page, await canvasPoint(page, 50, 50), await canvasPoint(page, 700, 550));
  await expect(page.getByText('3 elementos selecionados', { exact: true })).toBeVisible();
  await page.keyboard.press('Shift+ArrowDown');
  expect((await geometry(rects.nth(0))).y).toBe(before[0].y + 10);
  expect((await geometry(rects.nth(1))).y).toBe(before[1].y + 10);
  expect(await geometry(rects.nth(2))).toEqual(before[2]);
  await page.mouse.click(blank.x, blank.y);
  await rects.nth(2).click();
  await expect(page.locator('.stage-handle')).toHaveCount(0);
});

for (const [zoom, rotation] of [[35, 0], [100, 30]]) {
  test(`resize handle tolerates near misses over another element at ${zoom}% and ${rotation} degrees`, async ({ page }) => {
    await fixture(page, [
      element('behind', 80, 80, 520, 400),
      element('photo', 100, 100, 240, 160, { kind: 'image', src: '/photos/leaves.jpg', rotation }),
    ]);
    await page.getByLabel('Zoom', { exact: true }).fill(String(zoom));
    const canvas = page.getByTestId('design-canvas');
    const image = canvas.locator('[data-kind="image"]');
    const behind = canvas.locator('[data-kind="rect"]');
    const before = await geometry(image);
    const beforeBehind = await geometry(behind);
    await image.click();
    const handle = (await page.getByTestId('resize-e').boundingBox())!;
    const angle = rotation * Math.PI / 180;
    const start = {
      x: handle.x + handle.width / 2 + 8 * Math.cos(angle),
      y: handle.y + handle.height / 2 + 8 * Math.sin(angle),
    };
    await drag(page, start, { x: start.x + 32 * Math.cos(angle), y: start.y + 32 * Math.sin(angle) });
    const resized = await geometry(image);
    expect(resized.width).toBeCloseTo(before.width + 32 / (zoom / 100), 2);
    expect(resized.height).toBeCloseTo(before.height, 2);
    expect(await geometry(behind)).toEqual(beforeBehind);
    await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
    expect(await geometry(image)).toEqual(before);
    const otherPoint = await canvasPoint(page, 450, 380);
    await page.mouse.click(otherPoint.x, otherPoint.y);
    await page.keyboard.press('ArrowRight');
    expect((await geometry(behind)).x).toBe(beforeBehind.x + 1);
    expect(await geometry(image)).toEqual(before);
  });
}

test('small selections keep a draggable center between resize targets', async ({ page }) => {
  await fixture(page, [element('small', 120, 120, 50, 40)]);
  await page.getByLabel('Zoom', { exact: true }).fill('35');
  const shape = page.getByTestId('design-canvas').locator('[data-kind="rect"]');
  await shape.click();
  const before = await geometry(shape);
  const center = await canvasPoint(page, 145, 140);
  await drag(page, center, { x: center.x + 20, y: center.y + 15 });
  const moved = await geometry(shape);
  expect(moved.width).toBe(before.width);
  expect(moved.height).toBe(before.height);
  expect(moved.x).toBeCloseTo(before.x + 20 / 0.35, 2);
});

test('pasting an image from the clipboard adds it to the design', async ({ page }) => {
  await fixture(page);
  const wasHandled = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 3;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#e34b6f';
    context.fillRect(0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve) => canvas.toBlob((value) => resolve(value!), 'image/png'));
    const clipboard = new DataTransfer();
    clipboard.items.add(new File([blob], 'copiada.png', { type: 'image/png' }));
    const event = new ClipboardEvent('paste', {
      clipboardData: clipboard,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(wasHandled).toBe(true);
  await expect(page.getByTestId('design-canvas').locator('[data-kind="image"]')).toHaveCount(1);
  await expect(page.getByText('Imagem adicionada ao design.')).toBeVisible();
});

test('text selects on click, edits on double click, and deselects when clicking outside', async ({
  page,
}) => {
  await fixture(page);
  const text = page.getByTestId('design-canvas').locator('[data-kind="text"]');
  await text.click();
  await expect(page.getByRole('textbox', { name: 'Editar texto no design' })).toHaveCount(0);
  await expect(page.locator('.stage-handle')).toHaveCount(8);
  const blank = await canvasPoint(page, 30, 30);
  await page.mouse.click(blank.x, blank.y);
  await expect(page.locator('.stage-handle')).toHaveCount(0);

  await text.dblclick();
  let editor = page.getByRole('textbox', { name: 'Editar texto no design' });
  await editor.fill('Não salvar');
  await editor.press('Escape');
  await expect(text).toContainText('Texto original');
  await expect(editor).toHaveCount(0);
  await text.dblclick();
  editor = page.getByRole('textbox', { name: 'Editar texto no design' });
  await editor.fill('Texto salvo');
  await editor.press('Control+Enter');
  await expect(text).toContainText('Texto salvo');
  await text.dblclick();
  editor = page.getByRole('textbox', { name: 'Editar texto no design' });
  await editor.fill('Salvo ao sair');
  await page.mouse.click(blank.x, blank.y);
  await expect(text).toContainText('Salvo ao sair');
  await expect(editor).toHaveCount(0);
  await expect(page.locator('.stage-handle')).toHaveCount(0);

  await text.dblclick();
  editor = page.getByRole('textbox', { name: 'Editar texto no design' });
  await editor.fill('Salvo ao arrastar');
  await drag(page, await canvasPoint(page, 160, 150), await canvasPoint(page, 200, 190));
  await expect(text).toContainText('Salvo ao arrastar');
  await expect(editor).toHaveCount(0);
});

test('clicking text over an image selects the text instead of the image', async ({ page }) => {
  await fixture(page, overlappingElements('text'));

  const textPoint = await canvasPoint(page, 165, 155);
  await page.mouse.click(textPoint.x, textPoint.y);
  await expect(page.getByRole('button', { name: 'Fonte' })).toBeVisible();
  await page.mouse.dblclick(textPoint.x, textPoint.y);
  await expect(page.getByRole('textbox', { name: 'Editar texto no design' })).toBeVisible();

  const imagePoint = await canvasPoint(page, 450, 260);
  await page.mouse.click(imagePoint.x, imagePoint.y);
  await expect(page.getByRole('textbox', { name: 'Editar texto no design' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Fonte' })).toHaveCount(0);
});

test('selecting text and immediately dragging it does not open editing, while a clean double click does', async ({ page }) => {
  await fixture(page);
  await page.getByLabel('Zoom', { exact: true }).fill('50');
  const text = page.getByTestId('design-canvas').locator('[data-kind="text"]');
  const original = await geometry(text);
  const editor = page.getByRole('textbox', { name: 'Editar texto no design' });
  const start = await canvasPoint(page, 240, 480);
  await page.mouse.click(start.x, start.y);
  await page.mouse.down({ clickCount: 2 });
  await expect(editor).toHaveCount(0);
  await page.mouse.move(start.x + 35, start.y - 15, { steps: 8 });
  await expect(editor).toHaveCount(0);
  await page.mouse.up({ clickCount: 2 });
  await expect(editor).toHaveCount(0);
  expect((await geometry(text)).x).toBeGreaterThan(original.x + 50);
  await expect(text).toContainText('Texto original');
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  expect(await geometry(text)).toEqual(original);
  await text.dblclick();
  await expect(editor).toBeFocused();
});

test('an image in front receives clicks, dragging and context actions instead of the text behind', async ({ page }) => {
  await fixture(page, overlappingElements('image'));
  const canvas = page.getByTestId('design-canvas');
  const image = canvas.locator('[data-kind="image"]');
  const text = canvas.locator('[data-kind="text"]');
  const originalImage = await geometry(image);
  const originalText = await geometry(text);
  const overlap = await canvasPoint(page, 165, 155);
  await page.mouse.click(overlap.x, overlap.y);
  await expect(page.getByRole('button', { name: 'Fonte' })).toHaveCount(0);
  await page.mouse.dblclick(overlap.x, overlap.y);
  await expect(page.getByRole('textbox', { name: 'Editar texto no design' })).toHaveCount(0);
  await drag(page, overlap, await canvasPoint(page, 195, 185));
  await expect.poll(async () => (await geometry(image)).x).toBeCloseTo(originalImage.x + 30, 1);
  expect(await geometry(text)).toEqual(originalText);
  await page.mouse.click(overlap.x, overlap.y, { button: 'right' });
  await page.getByRole('menuitem', { name: /Excluir/ }).click();
  await expect(image).toHaveCount(0);
  await expect(text).toHaveCount(1);
  await page.mouse.dblclick(overlap.x, overlap.y);
  await expect(page.getByRole('textbox', { name: 'Editar texto no design' })).toBeVisible();
});

test('group shortcuts persist selection and multiple elements scale and rotate as a unit', async ({
  page,
}) => {
  await fixture(page);
  const rects = page.getByTestId('design-canvas').locator('[data-kind="rect"]');
  await rects.nth(0).click();
  await rects.nth(1).click({ modifiers: ['Shift'] });
  await page.keyboard.press('Control+g');
  await expect(page.getByRole('button', { name: 'Desagrupar', exact: true })).toBeVisible();
  const blank = await canvasPoint(page, 30, 30);
  await page.mouse.click(blank.x, blank.y);
  await rects.nth(0).click();
  await expect(page.getByText('2 elementos selecionados', { exact: true })).toBeVisible();
  await rects.nth(0).click({ modifiers: ['Shift'] });
  await expect(page.locator('.stage-handle')).toHaveCount(0);
  await rects.nth(0).click();
  const before = await Promise.all([
    geometry(rects.nth(0)),
    geometry(rects.nth(1)),
    geometry(rects.nth(2)),
  ]);
  const scale = (await page.getByTestId('design-canvas').boundingBox())!.width / 800;
  const handle = (await page.getByTestId('resize-se').boundingBox())!;
  await drag(
    page,
    { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 },
    { x: handle.x + handle.width / 2 + 47 * scale, y: handle.y + handle.height / 2 + 33 * scale },
  );
  expect((await geometry(rects.nth(0))).width).toBeCloseTo(before[0].width * 1.1, 2);
  expect((await geometry(rects.nth(1))).width).toBeCloseTo(before[1].width * 1.1, 2);
  expect((await geometry(rects.nth(1))).x).toBeCloseTo(100 + (before[1].x - 100) * 1.1, 2);
  expect(await geometry(rects.nth(2))).toEqual(before[2]);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  expect(await geometry(rects.nth(0))).toEqual(before[0]);
  expect(await geometry(rects.nth(1))).toEqual(before[1]);
  const rotationHandle = (await page.getByTestId('rotate-handle').boundingBox())!;
  const center = await canvasPoint(page, 335, 265);
  await drag(
    page,
    {
      x: rotationHandle.x + rotationHandle.width / 2,
      y: rotationHandle.y + rotationHandle.height / 2,
    },
    { x: center.x + 100, y: center.y },
  );
  expect((await geometry(rects.nth(0))).rotation).toBeCloseTo(90, 2);
  expect((await geometry(rects.nth(1))).rotation).toBeCloseTo(90, 2);
  expect(await geometry(rects.nth(2))).toEqual(before[2]);
  await page.keyboard.press('Control+Shift+g');
  await expect(page.getByRole('button', { name: 'Agrupar', exact: true })).toBeVisible();
  await page.mouse.click(blank.x, blank.y);
  await rects.nth(0).click();
  await expect(page.getByText('2 elementos selecionados', { exact: true })).toHaveCount(0);
  await expect(page.locator('.stage-handle')).toHaveCount(8);
});

test('sticky notes place at a chosen position, grow live and move as one object', async ({ page }) => {
  await fixture(page, []);
  await page.getByRole('button', { name: 'Desenho', exact: true }).click();
  const tools = page.getByRole('toolbar', { name: 'Ferramentas de desenho' });
  await tools.getByRole('button', { name: 'Nota adesiva', exact: true }).click();
  await page.getByRole('button', { name: 'Criar nota amarela', exact: true }).click();
  const chosen = await canvasPoint(page, 480, 250);
  await page.mouse.click(chosen.x, chosen.y);
  const note = page.getByTestId('design-canvas').locator('[data-note="true"]');
  const editor = page.getByRole('textbox', { name: 'Editar nota adesiva' });
  await expect(editor).toBeFocused();
  const original = await geometry(note);
  expect(original.x).toBeCloseTo(368, 1);
  await editor.fill('a'.repeat(600));
  await expect.poll(async () => (await geometry(note)).height).toBeGreaterThan(original.height * 2);
  await editor.fill('Minha ideia\ncomeça aqui.');
  await expect.poll(async () => (await geometry(note)).height).toBe(original.height);
  await editor.press('Control+Enter');
  await expect(note).toContainText('Minha ideia');
  await tools.getByRole('button', { name: 'Selecionar', exact: true }).click();
  const start = await canvasPoint(page, original.x + 70, original.y + 70);
  await drag(page, start, { x: start.x + 30, y: start.y + 15 });
  expect((await geometry(note)).x).toBeGreaterThan(original.x);
  await expect(page.getByTestId('design-canvas').locator('[data-element-id]')).toHaveCount(1);
  await page.getByLabel('Cor da nota', { exact: true }).fill('#aedbff');
  await expect(note.locator('path').first()).toHaveAttribute('fill', '#aedbff');
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(note.locator('path').first()).toHaveAttribute('fill', '#fff9a8');
});

test('drawing toolbar keeps the pencil active, erases only strokes and undoes the erase', async ({ page }) => {
  await fixture(page, [element('background', 0, 0, 800, 600, { fill: '#fff5e8' })]);
  await page.getByRole('button', { name: 'Desenho', exact: true }).click();
  const tools = page.getByRole('toolbar', { name: 'Ferramentas de desenho' });
  await tools.getByRole('button', { name: 'Lápis', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar ajustes do desenho' }).click();
  const canvas = page.getByTestId('design-canvas');
  await drag(page, await canvasPoint(page, 260, 200), await canvasPoint(page, 500, 200));
  await drag(page, await canvasPoint(page, 260, 340), await canvasPoint(page, 500, 340));
  await expect(canvas.locator('[data-kind="vector"]')).toHaveCount(2);
  await expect(tools.getByRole('button', { name: 'Lápis', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await tools.getByRole('button', { name: 'Borracha de desenho' }).click();
  await drag(page, await canvasPoint(page, 380, 160), await canvasPoint(page, 380, 240));
  await expect(canvas.locator('[data-kind="vector"]')).toHaveCount(1);
  await expect(canvas.locator('[data-kind="rect"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(canvas.locator('[data-kind="vector"]')).toHaveCount(2);
  await tools.getByRole('button', { name: 'Linha', exact: true }).click();
  await page.getByRole('button', { name: 'Fechar ajustes do desenho' }).click();
  await drag(page, await canvasPoint(page, 280, 440), await canvasPoint(page, 540, 470));
  await expect(canvas.locator('[data-kind="vector"]')).toHaveCount(3);
});

test('drawing tools adapt to a short desktop canvas and stay above the page strip', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 550 });
  await fixture(page, []);
  await page.getByRole('button', { name: 'Desenho', exact: true }).click();
  const tools = page.getByRole('toolbar', { name: 'Ferramentas de desenho' });
  const strip = (await page.locator('.pages-strip').boundingBox())!;
  const box = (await tools.boundingBox())!;
  expect(box.y + box.height).toBeLessThanOrEqual(strip.y - 8);
  await expect(tools).toHaveCSS('flex-direction', 'column');
  expect(await tools.evaluate(node => node.scrollHeight > node.clientHeight)).toBe(true);
  const zoomBeforeScroll = await page.getByLabel('Zoom', { exact: true }).inputValue();
  await tools.hover();
  await page.mouse.wheel(0, 400);
  await expect.poll(() => tools.evaluate(node => node.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByLabel('Zoom', { exact: true })).toHaveValue(zoomBeforeScroll);
  for (const button of await tools.getByRole('button').all()) {
    const control = (await button.boundingBox())!;
    expect(control.x).toBeGreaterThanOrEqual(box.x);
    expect(control.x + control.width).toBeLessThanOrEqual(box.x + box.width);
  }
  await tools.getByRole('button', { name: 'Criar assinatura' }).click();
  await expect(page.getByRole('complementary', { name: 'Criar assinatura' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar assinatura', exact: true }).click();
  await tools.getByRole('button', { name: 'Nota adesiva', exact: true }).click();
  const colors = page.getByRole('group', { name: 'Cores de notas adesivas' });
  const palette = (await colors.boundingBox())!;
  expect(palette.y + palette.height).toBeLessThanOrEqual(strip.y - 8);
  await colors.getByRole('button', { name: 'Criar nota lilás' }).click();
  await expect(page.getByRole('button', { name: 'Cancelar posicionamento' })).toBeVisible();
});

test('Ctrl plus mouse wheel zooms and the element context menu copies, duplicates, and deletes', async ({
  page,
}) => {
  await fixture(page);
  const zoom = page.getByLabel('Zoom', { exact: true });
  await zoom.fill('50');
  const workspace = page.locator('.canvas-workspace');
  const workspaceBox = (await workspace.boundingBox())!;
  await page.mouse.move(workspaceBox.x + 8, workspaceBox.y + 8);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(200);
  await expect(zoom).toHaveValue('50');
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => Number(await zoom.inputValue())).toBeGreaterThan(50);
  await zoom.fill('50');
  const canvas = page.getByTestId('design-canvas');
  const canvasBox = (await canvas.boundingBox())!;
  await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => Number(await zoom.inputValue())).toBeGreaterThan(50);

  await zoom.fill('150');
  const focusedBox = (await canvas.boundingBox())!;
  const pointer = {
    x: focusedBox.x + focusedBox.width * 0.72,
    y: focusedBox.y + focusedBox.height * 0.68,
  };
  const designPoint = {
    x: ((pointer.x - focusedBox.x) / focusedBox.width) * 800,
    y: ((pointer.y - focusedBox.y) / focusedBox.height) * 600,
  };
  await page.mouse.move(pointer.x, pointer.y);
  await page.mouse.wheel(0, -120);
  await expect.poll(async () => Number(await zoom.inputValue())).toBeGreaterThan(150);
  await expect
    .poll(async () => {
      const nextBox = (await canvas.boundingBox())!;
      return ((pointer.x - nextBox.x) / nextBox.width) * 800;
    })
    .toBeCloseTo(designPoint.x, 0);
  await expect
    .poll(async () => {
      const nextBox = (await canvas.boundingBox())!;
      return ((pointer.y - nextBox.y) / nextBox.height) * 600;
    })
    .toBeCloseTo(designPoint.y, 0);
  await page.mouse.wheel(0, 120);
  await expect.poll(async () => Number(await zoom.inputValue())).toBeCloseTo(150, 0);
  await page.keyboard.up('Control');
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);

  const rects = canvas.locator('[data-kind="rect"]');
  const first = rects.nth(0);
  const rightClick = async (target: Locator) => {
    const box = (await target.boundingBox())!;
    await page.mouse.click(box.x + 2, box.y + 2, { button: 'right' });
  };
  await rightClick(first);
  await page.getByRole('menuitem', { name: /Copiar/ }).click();
  await page.keyboard.press('Control+v');
  await expect(rects).toHaveCount(4);

  await rightClick(first);
  await page.getByRole('menuitem', { name: /Duplicar/ }).click();
  await expect(rects).toHaveCount(5);

  await rightClick(first);
  await page.getByRole('menuitem', { name: /Excluir/ }).click();
  await expect(rects).toHaveCount(4);

  await rightClick(rects.nth(1));
  await expect(page.getByRole('menuitem', { name: /Excluir/ })).toBeDisabled();

  await zoom.fill('80');
  const burstPoint = (await workspace.boundingBox())!;
  await page.mouse.move(burstPoint.x + burstPoint.width / 2, burstPoint.y + burstPoint.height / 2);
  await page.keyboard.down('Control');
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -120);
  await page.keyboard.up('Control');
  await expect.poll(async () => Number(await zoom.inputValue())).toBeGreaterThan(150);
});

test('dragging snaps text to the center of the space beside an image', async ({ page }) => {
  await fixture(page, [
    element('heading', 70, 180, 160, 60, {
      kind: 'text', text: 'Apresentação', fontSize: 24, fontFamily: 'DM Sans', textAlign: 'center',
    }),
    element('photo', 420, 0, 380, 600, { kind: 'image', src: '/photos/leaves.jpg' }),
  ]);
  await page.getByLabel('Zoom', { exact: true }).fill('50');
  const start = await canvasPoint(page, 150, 210);
  const destination = await canvasPoint(page, 212, 210);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(destination.x, destination.y, { steps: 8 });
  await expect(page.getByTestId('alignment-guide-x')).toHaveAttribute('x1', '210');
  await expect(page.getByTestId('gap-guide-x')).toBeVisible();
  await expect(page.getByTestId('gap-guide-x').getByTestId('gap-distance')).toHaveText(['130 px', '130 px']);
  const heading = page.getByTestId('design-canvas').locator('[data-kind="text"]');
  expect((await geometry(heading)).x).toBeCloseTo(130, 3);
  await page.mouse.up();
  await expect(page.getByTestId('gap-guide-x')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('alignment.png') });
  const blank = await canvasPoint(page, 30, 30);
  await page.mouse.click(blank.x, blank.y);
  await expect(page.getByTestId('gap-guide-x')).toHaveCount(0);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  expect((await geometry(heading)).x).toBe(70);
});

for (const layout of [
  { name: 'left image', image: [0, 0, 380, 600], text: [470, 180],
    start: [550, 210], end: [592, 210], axis: 'x', center: '590', position: 510, distance: '130 px' },
  { name: 'bottom image', image: [0, 380, 800, 220], text: [200, 70],
    start: [280, 100], end: [280, 192], axis: 'y', center: '190', position: 160, distance: '160 px' },
]) {
  test(`free space guides adapt to a ${layout.name}`, async ({ page }) => {
    await fixture(page, [
      element('heading', layout.text[0], layout.text[1], 160, 60, {
        kind: 'text', text: 'Apresentação', fontSize: 24, fontFamily: 'DM Sans', textAlign: 'center',
      }),
      element('photo', layout.image[0], layout.image[1], layout.image[2], layout.image[3], {
        kind: 'image', src: '/photos/leaves.jpg',
      }),
    ]);
    await page.getByLabel('Zoom', { exact: true }).fill('50');
    const start = await canvasPoint(page, layout.start[0], layout.start[1]);
    const end = await canvasPoint(page, layout.end[0], layout.end[1]);
    await drag(page, start, end);
    await expect(page.getByTestId(`alignment-guide-${layout.axis}`)).toHaveAttribute(`${layout.axis}1`, layout.center);
    await expect(page.getByTestId(`gap-guide-${layout.axis}`).getByTestId('gap-distance'))
      .toHaveText([layout.distance, layout.distance]);
    const actual = await geometry(page.getByTestId('design-canvas').locator('[data-kind="text"]'));
    expect(actual[layout.axis as 'x' | 'y']).toBeCloseTo(layout.position, 3);
  });
}

test('typography composition inserts the same editable text and fonts as its preview', async ({ page }) => {
  await fixture(page, []);
  await page.locator('.editor-rail').getByRole('button', { name: 'Texto', exact: true }).click();
  const preset = page.getByRole('button', { name: 'Inserir composição Essência editorial', exact: true });
  await expect(preset).toContainText('Menos,');
  await expect(preset).toContainText('mas melhor.');
  await preset.click();
  const canvas = page.getByTestId('design-canvas');
  await expect(canvas.locator('[data-element-id]')).toHaveCount(4);
  await expect(canvas).toContainText('Menos,mas melhor.');
  await expect(canvas.locator('text[font-family="Playfair Display"]')).toHaveCount(1);
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expect(canvas.locator('[data-element-id]')).toHaveCount(0);
});

test('new photographic template applies with its photo and editable text', async ({ page }) => {
  await fixture(page, []);
  await page.getByTitle('Aplicar modelo Arquitetura essencial · Post editorial', { exact: true }).click();
  const canvas = page.getByTestId('design-canvas');
  await expect(canvas.locator('[data-kind="image"]')).toHaveCount(1);
  await expect(canvas.locator('image')).toHaveAttribute('href', '/photos/editorial-architecture.jpg');
  await expect(canvas).toContainText('Espaços para');
  await expect(canvas.locator('[data-kind="text"]')).toHaveCount(4);
});

test.describe('mobile canvas navigation', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('a second touch on text remains draggable and only two completed taps start editing', async ({ page }) => {
    await fixture(page);
    await page.locator('.editor-rail > button.active').click();
    await page.getByLabel('Zoom', { exact: true }).fill('35');
    const text = page.getByTestId('design-canvas').locator('[data-kind="text"]');
    const original = await geometry(text);
    const editor = page.getByRole('textbox', { name: 'Editar texto no design' });
    let location = await canvasPoint(page, 240, 480);
    await page.touchscreen.tap(location.x, location.y);
    location = await canvasPoint(page, 240, 480);
    const client = await page.context().newCDPSession(page);
    const touch = (dx: number, dy: number) => [{ id: 1, x: location.x + dx, y: location.y + dy, radiusX: 2, radiusY: 2, force: 1 }];
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(0, 0) });
    await expect(editor).toHaveCount(0);
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(15, -6) });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(35, -12) });
    await expect(editor).toHaveCount(0);
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(editor).toHaveCount(0);
    const moved = await geometry(text);
    expect(moved.x).toBeGreaterThan(original.x + 80);
    await expect(text).toContainText('Texto original');
    const first = await canvasPoint(page, moved.x + moved.width / 2, moved.y + moved.height / 2);
    await page.touchscreen.tap(first.x, first.y);
    await expect(editor).toHaveCount(0);
    const second = await canvasPoint(page, moved.x + moved.width / 2, moved.y + moved.height / 2);
    await page.touchscreen.tap(second.x, second.y);
    await expect(editor).toBeFocused();
    await client.detach();
  });

  test('mobile notes place with a tap, focus typing and grow without horizontal page overflow', async ({ page }) => {
    await fixture(page, []);
    await page.getByRole('button', { name: 'Desenho', exact: true }).click();
    const tools = page.getByRole('toolbar', { name: 'Ferramentas de desenho' });
    await tools.getByRole('button', { name: 'Nota adesiva', exact: true }).click();
    await page.getByRole('button', { name: 'Criar nota rosa' }).click();
    await page.getByLabel('Zoom', { exact: true }).fill('35');
    const chosen = await canvasPoint(page, 400, 280);
    await page.touchscreen.tap(chosen.x, chosen.y);
    const editor = page.getByRole('textbox', { name: 'Editar nota adesiva' });
    await expect(editor).toBeFocused();
    const height = (await editor.boundingBox())!.height;
    await editor.fill('Uma ideia que cresce.\n'.repeat(18));
    await expect.poll(async () => (await editor.boundingBox())!.height).toBeGreaterThan(height * 2);
    const blank = await canvasPoint(page, 740, 70);
    await page.touchscreen.tap(blank.x, blank.y);
    await expect(editor).toHaveCount(0);
    await expect(page.getByTestId('design-canvas').locator('[data-note="true"]')).toContainText('Uma ideia que cresce.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });

  test('mobile signature pad accepts finger strokes, clears them and places a reusable signature', async ({ page }) => {
    await fixture(page, []);
    await page.getByRole('button', { name: 'Desenho', exact: true }).click();
    await page.getByRole('toolbar', { name: 'Ferramentas de desenho' }).getByRole('button', { name: 'Criar assinatura' }).click();
    const panel = page.getByRole('complementary', { name: 'Criar assinatura' });
    await panel.getByRole('tab', { name: 'Desenho', exact: true }).click();
    const pad = panel.getByLabel('Área para desenhar assinatura');
    const client = await page.context().newCDPSession(page);
    const draw = async () => {
      const box = (await pad.boundingBox())!;
      const touch = (x: number, y: number) => [{ id: 1, x: box.x + x, y: box.y + y, radiusX: 2, radiusY: 2, force: 1 }];
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(30, 80) });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(80, 30) });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(190, 90) });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await draw();
    const insert = panel.getByRole('button', { name: 'Usar assinatura', exact: true });
    await expect(insert).toBeEnabled();
    await panel.getByRole('button', { name: 'Limpar', exact: true }).click();
    await expect(insert).toBeDisabled();
    await draw();
    await insert.click();
    const location = await canvasPoint(page, 400, 260);
    await page.touchscreen.tap(location.x, location.y);
    await expect(page.getByTestId('design-canvas').locator('[data-kind="vector"]')).toHaveCount(1);
    await page.getByRole('toolbar', { name: 'Ferramentas de desenho' }).getByRole('button', { name: 'Criar assinatura' }).click();
    await expect(panel.getByRole('button', { name: 'Usar assinatura salva 1' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await client.detach();
  });

  test('finger resizing tolerates missing the visible dot without moving the element underneath', async ({ page }) => {
    await fixture(page, [
      element('behind', 80, 80, 520, 400),
      element('photo', 100, 100, 240, 160, { kind: 'image', src: '/photos/leaves.jpg' }),
    ]);
    await page.locator('.editor-rail > button.active').click();
    await page.getByLabel('Zoom', { exact: true }).fill('35');
    const canvas = page.getByTestId('design-canvas');
    const image = canvas.locator('[data-kind="image"]');
    const behind = canvas.locator('[data-kind="rect"]');
    const before = await geometry(image);
    const beforeBehind = await geometry(behind);
    const center = await canvasPoint(page, 220, 180);
    await page.touchscreen.tap(center.x, center.y);
    const handle = (await page.getByTestId('resize-e').boundingBox())!;
    const x = handle.x + handle.width / 2 + 14, y = handle.y + handle.height / 2;
    const client = await page.context().newCDPSession(page);
    const touch = (nextX: number) => [{ id: 1, x: nextX, y, radiusX: 2, radiusY: 2, force: 1 }];
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(x) });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(x + 12) });
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(x + 24) });
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect.poll(async () => (await geometry(image)).width).toBeCloseTo(before.width + 24 / 0.35, 1);
    expect((await geometry(image)).height).toBe(before.height);
    expect(await geometry(behind)).toEqual(beforeBehind);
    const otherPoint = await canvasPoint(page, 450, 380);
    await page.touchscreen.tap(otherPoint.x, otherPoint.y);
    await page.keyboard.press('ArrowRight');
    expect((await geometry(behind)).x).toBe(beforeBehind.x + 1);
    await client.detach();
  });

  for (const front of ['image', 'text'] as const) {
    test(`overlapping layers on mobile select and double tap the front ${front}`, async ({ page }) => {
      await fixture(page, overlappingElements(front));
      await page.locator('.editor-rail > button.active').click();
      await page.getByLabel('Zoom', { exact: true }).fill('35');
      const overlap = await canvasPoint(page, 165, 155);
      await page.touchscreen.tap(overlap.x, overlap.y);
      const editor = page.getByRole('textbox', { name: 'Editar texto no design' });
      await expect(editor).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Fonte', exact: true })).toHaveCount(front === 'text' ? 1 : 0);
      const second = await canvasPoint(page, 165, 155);
      await page.touchscreen.tap(second.x, second.y);
      if (front === 'text') await expect(editor).toBeFocused();
      else await expect(editor).toHaveCount(0);
    });
  }

  test('mobile panel follows touch dragging and can be pulled down to close', async ({ page }) => {
    await fixture(page);
    const panel = page.locator('.panel-holder');
    const handle = page.getByRole('separator', { name: 'Ajustar altura do painel' });
    const original = (await panel.boundingBox())!.height;
    const client = await page.context().newCDPSession(page);
    const moveHandle = async (dy: number) => {
      const box = (await handle.boundingBox())!;
      const x = box.x + box.width / 2, y = box.y + box.height / 2;
      const touch = (nextY: number) => [{ id: 1, x, y: nextY, radiusX: 2, radiusY: 2, force: 1 }];
      await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touch(y) });
      await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touch(y + dy) });
      await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await moveHandle(-100);
    await expect.poll(async () => (await panel.boundingBox())!.height).toBeGreaterThan(original + 80);
    await moveHandle(130);
    await expect.poll(async () => (await panel.boundingBox())!.height).toBeLessThan(original);
    await handle.press('Home');
    await expect.poll(async () => (await panel.boundingBox())!.height).toBeCloseTo(160, 0);
    await moveHandle(90);
    await expect(panel).toBeHidden();
    await expect(page.locator('.editor-footer')).toBeVisible();
    await client.detach();
  });

  test('two finger taps on text open a focused editor and outside tap saves', async ({ page }) => {
    await fixture(page);
    await page.locator('.editor-rail > button.active').click();
    await page.getByLabel('Zoom', { exact: true }).fill('35');
    const editor = page.getByRole('textbox', { name: 'Editar texto no design' });
    const location = await canvasPoint(page, 240, 480);
    await page.touchscreen.tap(location.x, location.y);
    await expect(editor).toHaveCount(0);
    const second = await canvasPoint(page, 240, 480);
    await page.touchscreen.tap(second.x, second.y);
    await expect(editor).toBeFocused();
    await editor.fill('Editado pelo celular');
    const blank = await canvasPoint(page, 30, 30);
    await page.touchscreen.tap(blank.x, blank.y);
    await expect(editor).toHaveCount(0);
    await expect(page.getByTestId('design-canvas').locator('[data-kind="text"]')).toContainText('Editado pelo celular');
    await expect(page.locator('.stage-handle')).toHaveCount(0);
  });

  test('pinch zooms around the fingers and dragging blank canvas pans it', async ({ page }) => {
    await fixture(page);
    await page.locator('.editor-rail > button.active').click();
    const zoom = page.getByLabel('Zoom', { exact: true });
    await zoom.fill('50');
    const canvas = page.getByTestId('design-canvas');
    const box = (await canvas.boundingBox())!;
    const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
    const client = await page.context().newCDPSession(page);
    const dispatch = (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: object[]) =>
      client.send('Input.dispatchTouchEvent', { type, touchPoints });
    const touch = (id: number, x: number, y: number) => ({ id, x, y, radiusX: 2, radiusY: 2, force: 1 });

    await dispatch('touchStart', [touch(1, center.x - 20, center.y), touch(2, center.x + 20, center.y)]);
    await dispatch('touchMove', [touch(1, center.x - 50, center.y), touch(2, center.x + 50, center.y)]);
    await dispatch('touchEnd', []);
    await expect.poll(async () => Number(await zoom.inputValue())).toBeGreaterThan(100);

    const workspace = page.locator('.canvas-workspace');
    const before = await workspace.evaluate((node) => node.scrollLeft);
    const afterZoom = (await canvas.boundingBox())!;
    const panPoint = { x: afterZoom.x + afterZoom.width / 2, y: afterZoom.y + afterZoom.height / 2 };
    await dispatch('touchStart', [touch(3, panPoint.x, panPoint.y)]);
    await dispatch('touchMove', [touch(3, panPoint.x - 35, panPoint.y)]);
    await dispatch('touchEnd', []);
    await expect.poll(() => workspace.evaluate((node) => node.scrollLeft)).toBeGreaterThan(before + 20);
    await client.detach();
  });
});
