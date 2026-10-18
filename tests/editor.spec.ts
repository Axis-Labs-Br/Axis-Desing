import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import type { Download, Page } from '@playwright/test';
import type { DesignDocument } from '../src/model';

async function createDesign(page: Page, title: string, width = 640, height = 480) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar um design', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /Usar tamanho personalizado/ }).click();
  await dialog.getByRole('textbox', { name: 'Nome do design' }).fill(title);
  await dialog.getByRole('spinbutton', { name: 'Largura do design' }).fill(String(width));
  await dialog.getByRole('spinbutton', { name: 'Altura do design' }).fill(String(height));
  await dialog.getByRole('button', { name: 'Criar design', exact: true }).click();
  await expect(page.getByTestId('design-canvas')).toHaveAttribute(
    'viewBox',
    `0 0 ${width} ${height}`,
  );
}

async function addRectangle(page: Page) {
  await page.getByRole('button', { name: 'Elementos', exact: true }).click();
  await page
    .getByRole('complementary', { name: 'Elementos', exact: true })
    .getByRole('button', { name: 'Retângulo', exact: true })
    .click();
  await expect(page.getByTestId('design-canvas').locator('[data-kind="rect"]')).toHaveCount(1);
}

async function addAndEditTitle(page: Page, text: string) {
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await page.getByRole('button', { name: 'Adicione um título', exact: true }).click();
  const element = page.getByTestId('design-canvas').locator('[data-kind="text"]');
  await element.dblclick();
  const editor = page.getByRole('textbox', { name: 'Editar texto no design' });
  await editor.fill(text);
  await editor.press('Control+Enter');
  await expectRenderedText(page, text);
}

async function expectRenderedText(page: Page, text: string) {
  // SVG line wrapping creates adjacent tspans, which do not insert textContent whitespace.
  await expect
    .poll(async () =>
      (
        await page
          .getByTestId('design-canvas')
          .locator('[data-kind="text"] tspan')
          .allTextContents()
      )
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .toBe(text.replace(/\s+/g, ' ').trim());
}

async function uploadRaster(page: Page) {
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 48;
    const context = canvas.getContext('2d')!;
    context.fillStyle = '#e64462';
    context.fillRect(0, 0, 64, 48);
    context.fillStyle = '#20a78d';
    context.fillRect(0, 0, 32, 24);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  await page.getByRole('button', { name: 'Uploads', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Uploads', exact: true });
  await panel.locator('input[type="file"]').setInputFiles({
    name: 'cores.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  });
  await panel.getByTitle('Adicionar cores.png', { exact: true }).click();
  await expect(page.getByTestId('design-canvas').locator('[data-kind="image"]')).toHaveCount(1);
}

async function exportDownload(
  page: Page,
  format: 'png' | 'jpg' | 'svg' | 'pdf' | 'axis',
  allPages = false,
  transparent = false,
): Promise<Download> {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Formato do arquivo').selectOption(format);
  if (allPages && format !== 'axis')
    await dialog.getByRole('radio', { name: /^Todas as páginas/ }).check();
  if (transparent) await dialog.getByLabel('Fundo transparente', { exact: true }).check();
  const download = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Baixar arquivo', exact: true }).click();
  const result = await download;
  expect(await result.failure()).toBeNull();
  return result;
}

async function bytes(download: Download) {
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!);
}

async function exportedProject(page: Page): Promise<DesignDocument> {
  return JSON.parse(
    (await bytes(await exportDownload(page, 'axis'))).toString('utf8'),
  ) as DesignDocument;
}

function contents(doc: DesignDocument) {
  return {
    title: doc.title,
    width: doc.width,
    height: doc.height,
    pages: doc.pages.map(({ id: _id, ...rest }) => ({
      ...rest,
      elements: rest.elements.map(({ id: _elementId, ...item }) => item),
    })),
  };
}

test('creates and edits a design, restores history, manages pages and reopens saved work', async ({
  page,
}) => {
  const title = 'Uma ideia que permanece';
  await createDesign(page, title);
  await addRectangle(page);
  await addAndEditTitle(page, 'Criatividade em movimento');
  const canvas = page.getByTestId('design-canvas');
  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  await expectRenderedText(page, 'Adicione um título');
  await page.getByRole('button', { name: 'Refazer', exact: true }).click();
  await expectRenderedText(page, 'Criatividade em movimento');

  await page.getByRole('button', { name: 'Adicionar página', exact: true }).click();
  await expect(canvas.locator('[data-element-id]')).toHaveCount(0);
  await page
    .getByRole('button', { name: /^Duplicar página/ })
    .last()
    .click();
  await expect(page.getByRole('button', { name: 'Ir para página 3', exact: true })).toBeVisible();
  await page
    .getByRole('button', { name: /^Excluir página/ })
    .last()
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Excluir página', exact: true })
    .click();
  const beforeReload = await exportedProject(page);
  expect(beforeReload.pages).toHaveLength(2);
  expect(beforeReload.pages[0].elements.map((item) => item.kind)).toEqual(['rect', 'text']);

  await page.getByRole('button', { name: 'Voltar ao início', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: `Abrir ${title}`, exact: true }).click();
  const reopened = await exportedProject(page);
  expect(contents(reopened)).toEqual(contents(beforeReload));
});

test('uploads an editable raster and downloads a real PNG at the requested dimensions', async ({
  page,
}) => {
  await createDesign(page, 'Imagem em movimento');
  await uploadRaster(page);
  const canvas = page.getByTestId('design-canvas');
  const image = canvas.locator('[data-kind="image"]');
  const initialTransform = await image.locator('g[transform]').first().getAttribute('transform');
  await image.click();
  await page.keyboard.press('ArrowRight');
  await expect(image.locator('g[transform]').first()).not.toHaveAttribute(
    'transform',
    initialTransform!,
  );

  const download = await exportDownload(page, 'png');
  expect(download.suggestedFilename()).toMatch(/\.png$/);
  const png = await bytes(download);
  expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([640, 480]);
  const visiblePixels = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const rgba = context.getImageData(0, 0, image.width, image.height).data;
    let colored = 0;
    for (let index = 0; index < rgba.length; index += 4) {
      if (rgba[index + 3] && (rgba[index] < 245 || rgba[index + 1] < 245 || rgba[index + 2] < 245))
        colored++;
    }
    return colored;
  }, png.toString('base64'));
  expect(visiblePixels).toBeGreaterThan(1000);
});

test('removes an image background locally and can undo the transparent result', async ({ page }) => {
  await createDesign(page, 'Recorte de imagem');
  await uploadRaster(page);
  await page.route('https://huggingface.co/**', (route) => route.abort());
  await page.getByRole('button', { name: 'Remover fundo', exact: true }).click();

  const dialog = page.getByRole('dialog', { name: 'Remover fundo da imagem' });
  await expect(dialog.getByLabel('Prévia do recorte inteligente com transparência')).toBeVisible();
  await dialog.getByRole('tab', { name: 'Cor uniforme' }).click();
  await dialog.getByRole('button', { name: 'Marcar para remover' }).click();
  const preview = dialog.getByLabel('Prévia do recorte inteligente com transparência');
  const previewBounds = await preview.boundingBox();
  expect(previewBounds).not.toBeNull();
  const previewAlpha = () => preview.evaluate((canvas) => {
    const context = canvas.getContext('2d')!;
    return context.getImageData(8, 8, 1, 1).data[3];
  });
  const paintSample = async (tool: string, expectedAlpha: number) => {
    await dialog.getByRole('button', { name: tool, exact: true }).click();
    await page.mouse.move(previewBounds!.x + previewBounds!.width * 0.125, previewBounds!.y + previewBounds!.height * 0.167);
    await page.mouse.down();
    await expect.poll(previewAlpha).toBe(expectedAlpha);
    await page.mouse.up();
  };
  await paintSample('Marcar para remover', 0);
  await paintSample('Restaurar área', 255);
  await paintSample('Marcar para remover', 0);
  await expect(dialog.getByRole('button', { name: 'Aplicar recorte', exact: true })).toBeEnabled();
  await dialog.getByRole('button', { name: 'Aplicar recorte', exact: true }).click();
  await expect(page.getByText('Fundo removido. Você pode desfazer a alteração.')).toBeVisible();

  const processed = await exportedProject(page);
  const processedSrc = processed.pages[0].elements.find((item) => item.kind === 'image')?.src;
  expect(processedSrc).toMatch(/^data:image\/png;base64,/);
  const alpha = await page.evaluate(async (dataUrl) => {
    const image = new Image();
    image.src = dataUrl!;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, image.width, image.height).data;
    return {
      background: pixels[(47 * image.width + 63) * 4 + 3],
      erasedManually: pixels[(8 * image.width + 8) * 4 + 3],
      keptNearby: pixels[(20 * image.width + 30) * 4 + 3],
    };
  }, processedSrc);
  expect(alpha.background).toBe(0);
  expect(alpha.erasedManually).toBe(0);
  expect(alpha.keptNearby).toBe(255);
  await expect(page.getByTestId('design-canvas').locator('[data-kind="image"] image')).toHaveAttribute('href', processedSrc!);

  await page.getByRole('button', { name: 'Desfazer', exact: true }).click();
  const restored = await exportedProject(page);
  const restoredSrc = restored.pages[0].elements.find((item) => item.kind === 'image')?.src;
  expect(restoredSrc).not.toBe(processedSrc);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Remover fundo', exact: true }).click();
  const mobileDialog = page.getByRole('dialog', { name: 'Remover fundo da imagem' });
  const mobileBounds = await mobileDialog.boundingBox();
  expect(mobileBounds).not.toBeNull();
  expect(mobileBounds!.x).toBeGreaterThanOrEqual(0);
  expect(mobileBounds!.x + mobileBounds!.width).toBeLessThanOrEqual(390);
  await mobileDialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
});

test('shows the expanded design library and scrolls the desktop tool rail when space is short', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 540 });
  await createDesign(page, 'Biblioteca completa');
  const rail = page.getByRole('navigation', { name: 'Ferramentas do editor' });
  await expect(rail).toBeVisible();
  await expect.poll(() => rail.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  const railBounds = await rail.boundingBox();
  expect(railBounds).not.toBeNull();
  await page.mouse.move(railBounds!.x + railBounds!.width / 2, railBounds!.y + railBounds!.height / 2);
  await page.mouse.wheel(0, 220);
  await expect.poll(() => rail.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const panel = page.getByRole('complementary', { name: 'Design', exact: true });
  await expect.poll(() => panel.locator('.panel-template').count()).toBeGreaterThan(25);
});

test('adds editable font pairings, form templates and vector drawing strokes', async ({ page }) => {
  await createDesign(page, 'Combinações e formulários');
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await page.locator('.font-pair-card').first().click();
  await expect(page.getByTestId('design-canvas').locator('[data-kind="text"]')).toHaveCount(2);
  const paired = await exportedProject(page);
  expect(paired.pages[0].elements.filter((item) => item.kind === 'text').map((item) => item.fontFamily)).toEqual(
    expect.arrayContaining(['Anton', 'Dancing Script']),
  );

  await createDesign(page, 'Formulário editável');
  await page.getByRole('button', { name: 'Formulários', exact: true }).click();
  await page.getByRole('button', { name: /Newsletter da marca/ }).click();
  const form = await exportedProject(page);
  expect(form.pages[0].elements.filter((item) => item.kind === 'text').length).toBeGreaterThan(4);
  expect(form.pages[0].elements.some((item) => item.kind === 'rect')).toBe(true);

  await createDesign(page, 'Desenho vetorial');
  await page.getByRole('button', { name: 'Desenho', exact: true }).click();
  await page.getByRole('button', { name: 'Lápis', exact: true }).click();
  const canvas = page.getByTestId('design-canvas');
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width * 0.3, box!.y + box!.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width * 0.45, box!.y + box!.height * 0.48, { steps: 8 });
  await page.mouse.move(box!.x + box!.width * 0.6, box!.y + box!.height * 0.42, { steps: 8 });
  await page.mouse.up();
  await expect(canvas.locator('[data-kind="vector"]')).toHaveCount(1);
  const drawing = await exportedProject(page);
  expect(drawing.pages[0].elements.find((item) => item.kind === 'vector')?.vectorPaths?.[0].attrs.d).toMatch(/^M/);
});

test('downloads a multipage PDF with one page for each design page', async ({ page }) => {
  await createDesign(page, 'Duas páginas');
  await addRectangle(page);
  await page.getByRole('button', { name: 'Adicionar página', exact: true }).click();
  await addAndEditTitle(page, 'A segunda ideia');
  const download = await exportDownload(page, 'pdf', true);
  const pdf = await bytes(download);
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  expect([...pdf.toString('latin1').matchAll(/\/Type\s*\/Page\b/g)]).toHaveLength(2);
  expect(pdf.length).toBeGreaterThan(2000);
});

test('signature panel creates text, drawing and upload signatures and saves them for the current account', async ({ page }) => {
  await createDesign(page, 'Assinaturas completas', 800, 600);
  await page.getByRole('button', { name: 'Desenho', exact: true }).click();
  const tools = page.getByRole('toolbar', { name: 'Ferramentas de desenho' });
  const canvas = page.getByTestId('design-canvas');
  const place = async (x: number, y: number) => {
    const box = (await canvas.boundingBox())!;
    await page.mouse.click(box.x + x * box.width / 800, box.y + y * box.height / 600);
  };
  await tools.getByRole('button', { name: 'Criar assinatura' }).click();
  const panel = page.getByRole('complementary', { name: 'Criar assinatura' });
  await panel.getByRole('textbox', { name: 'Nome completo da assinatura' }).fill('Luciano Junior');
  await panel.getByLabel('Fonte da assinatura').selectOption('2');
  await panel.getByLabel('Cor personalizada da assinatura').fill('#275cb6');
  await panel.getByRole('button', { name: 'Usar assinatura', exact: true }).click();
  await place(360, 160);
  await expect(canvas.locator('[data-kind="text"]')).toHaveCount(1);
  await expect(canvas.locator('text')).toContainText('Luciano Junior');
  await expect(canvas.locator('text')).toHaveAttribute('font-family', 'Pacifico');
  await expect(canvas.locator('text')).toHaveAttribute('fill', '#275cb6');
  await tools.getByRole('button', { name: 'Criar assinatura' }).click();
  await expect(panel.getByRole('button', { name: 'Usar assinatura salva 1' })).toBeVisible();
  const { user } = await (await page.request.get('/api/auth/session')).json();
  expect(await page.evaluate(username => JSON.parse(localStorage.getItem(`axis-signatures:${username}`) ?? '[]').length, user.username)).toBe(1);
  await panel.getByRole('tab', { name: 'Desenho', exact: true }).click();
  const pad = panel.getByLabel('Área para desenhar assinatura');
  const box = (await pad.boundingBox())!;
  await page.mouse.move(box.x + 32, box.y + 70); await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 35, { steps: 5 });
  await page.mouse.move(box.x + 150, box.y + 80, { steps: 6 }); await page.mouse.up();
  await panel.getByRole('button', { name: 'Usar assinatura', exact: true }).click();
  await place(400, 320);
  await expect(canvas.locator('[data-kind="vector"]')).toHaveCount(1);
  await tools.getByRole('button', { name: 'Criar assinatura' }).click();
  await panel.getByRole('tab', { name: 'Fazer upload', exact: true }).click();
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 140; c.height = 40;
    const ctx = c.getContext('2d')!; ctx.strokeStyle = '#151515'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(8, 30); ctx.lineTo(45, 5); ctx.lineTo(80, 28); ctx.lineTo(132, 12); ctx.stroke();
    return c.toDataURL('image/png').split(',')[1];
  });
  await panel.getByLabel('Enviar imagem da assinatura').setInputFiles({ name: 'assinatura.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await panel.getByRole('button', { name: 'Usar assinatura', exact: true }).click();
  await place(450, 470);
  await expect(canvas.locator('[data-kind="image"]')).toHaveCount(1);
  const doc = await exportedProject(page);
  expect(doc.pages[0].elements.map(e => e.kind)).toEqual(['text', 'vector', 'image']);
  expect(doc.fonts?.some(f => f.family === 'Pacifico')).toBe(true);
  expect(doc.pages[0].elements[2].src).toMatch(/^data:image\/png;base64,/);
});

test('round-trips a portable .axis project with embedded images and fresh editable identities', async ({
  page,
}) => {
  await createDesign(page, 'Arquivo para levar');
  await addRectangle(page);
  await uploadRaster(page);
  await page.getByRole('button', { name: 'Fotos', exact: true }).click();
  await page
    .getByRole('complementary', { name: 'Fotos', exact: true })
    .locator('.panel-photo-grid button')
    .first()
    .click();
  await expect(page.getByTestId('design-canvas').locator('[data-kind="image"]')).toHaveCount(2);
  await expect(page.getByTestId('design-canvas').locator('image[href^="/photos/"]')).toHaveCount(1);
  await addAndEditTitle(page, 'Tudo vai junto');
  const firstDownload = await exportDownload(page, 'axis');
  expect(firstDownload.suggestedFilename()).toMatch(/\.axis$/);
  const firstBytes = await bytes(firstDownload);
  const original = JSON.parse(firstBytes.toString('utf8')) as DesignDocument;
  const imageSources = original.pages[0].elements
    .filter((item) => item.kind === 'image')
    .map((item) => item.src);
  expect(imageSources).toHaveLength(2);
  expect(imageSources[0]).toMatch(/^data:image\/png;base64,/);
  expect(imageSources[1]).toMatch(/^data:image\/jpeg;base64,/);

  await page.getByRole('button', { name: 'Voltar ao início', exact: true }).click();
  await page.locator('input[type="file"][accept=".axis,.json"]').setInputFiles({
    name: 'transportado.axis',
    mimeType: 'application/json',
    buffer: firstBytes,
  });
  await expect(page.getByTestId('design-canvas').locator('[data-element-id]')).toHaveCount(4);
  await expect(page.getByTestId('design-canvas').locator('image[href^="/photos/"]')).toHaveCount(0);
  const imported = await exportedProject(page);
  expect(contents(imported)).toEqual(contents(original));
  expect(imported.id).not.toBe(original.id);
  const originalIds = original.pages.flatMap((item) => [
    item.id,
    ...item.elements.map((element) => element.id),
  ]);
  expect(
    imported.pages
      .flatMap((item) => [item.id, ...item.elements.map((element) => element.id)])
      .every((id) => !originalIds.includes(id)),
  ).toBe(true);

  await page.getByTestId('design-canvas').locator('[data-kind="text"]').dblclick();
  const editor = page.getByRole('textbox', { name: 'Editar texto no design' });
  await editor.fill('Posso continuar editando');
  await editor.press('Control+Enter');
  await expectRenderedText(page, 'Posso continuar editando');
});

test('uses home templates, keeps typing focus and restores a favorite project from the trash', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Modelos para você' }).click();
  const model = page.locator('.template-card').first();
  await expect(model).toBeVisible();
  await model.click();
  await expect(
    page.getByTestId('design-canvas').locator('[data-element-id]').first(),
  ).toBeVisible();
  const originalTitle = await page.getByRole('textbox', { name: 'Nome do design' }).inputValue();
  await page.getByRole('button', { name: 'Voltar ao início', exact: true }).click();
  await page
    .getByRole('button', { name: `Opções de ${originalTitle}`, exact: true })
    .first()
    .click();
  await page.getByRole('button', { name: 'Renomear', exact: true }).click();
  const dialog = page.getByRole('dialog');
  const name = dialog.getByRole('textbox', { name: 'Nome do design' });
  await name.fill('');
  const newTitle = 'Recomeço criativo com foco';
  await name.pressSequentially(newTitle, { delay: 15 });
  await expect(name).toHaveValue(newTitle);
  await expect(name).toBeFocused();
  await dialog.getByRole('button', { name: 'Salvar nome', exact: true }).click();

  const options = () => page.getByRole('button', { name: `Opções de ${newTitle}`, exact: true });
  await options().click();
  await page.getByRole('button', { name: 'Adicionar aos favoritos', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: /^Favoritos/ })
    .click();
  await expect(page.getByRole('button', { name: `Abrir ${newTitle}`, exact: true })).toBeVisible();
  await options().click();
  await page.getByRole('button', { name: 'Mover para a lixeira', exact: true }).click();
  await expect(page.getByRole('button', { name: `Abrir ${newTitle}`, exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Lixeira', exact: true }).click();
  await options().click();
  await page.getByRole('button', { name: 'Restaurar', exact: true }).click();
  await page
    .getByRole('navigation', { name: 'Navegação principal' })
    .getByRole('button', { name: /^Favoritos/ })
    .click();
  await page.getByRole('button', { name: `Abrir ${newTitle}`, exact: true }).click();
  await expect(
    page.getByTestId('design-canvas').locator('[data-element-id]').first(),
  ).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Nome do design' })).toHaveValue(newTitle);
});

test('refined existing templates preview their real font and keep text and photos editable', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Modelos', exact: true }).click();
  await expect.poll(() => page.evaluate(() => [...document.fonts].some(face =>
    face.family.replaceAll('"', '') === 'Playfair Display' && face.status === 'loaded'))).toBe(true);
  await page.locator('.template-card').filter({ hasText: 'Café passado com calma' }).click();
  const canvas = page.getByTestId('design-canvas');
  const heading = canvas.locator('[data-kind="text"]').filter({ hasText: 'Café passado' });
  await heading.dblclick();
  const editor = page.getByRole('textbox', { name: 'Editar texto no design' });
  await editor.fill('Sua marca\nSeu novo momento.');
  await editor.press('Control+Enter');
  await expect(canvas).toContainText('Sua marca');
  const project = await exportedProject(page);
  expect(project.pages[0].elements.some(e => e.text === 'Sua marca\nSeu novo momento.')).toBe(true);
  expect(project.pages[0].elements.filter(e => e.kind === 'image')).toHaveLength(1);
  expect(project.fonts?.some(face => face.family === 'Playfair Display')).toBe(true);
});

test('opens complete presentation decks with a photographic background on every slide', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Modelos', exact: true }).click();

  const decks = [
    { title: 'Estratégia 2026 · Deck executivo', total: 8 },
    { title: 'Proposta comercial · Deck premium', total: 6 },
  ];
  for (const deck of decks) {
    await page.getByRole('button', { name: 'Modelos', exact: true }).click();
    await page.locator('.template-card').filter({ hasText: deck.title }).click();
    const canvas = page.getByTestId('design-canvas');
    await expect(canvas).toHaveAttribute('viewBox', '0 0 1920 1080');
    for (let current = 1; current <= deck.total; current += 1) {
      await expect(page.getByText(`Página ${current} de ${deck.total}`, { exact: false })).toBeVisible();
      const photos = canvas.locator('image[href^="/photos/"]');
      await expect.poll(() => photos.count()).toBeGreaterThan(0);
      await expect(photos.first()).toHaveAttribute('width', '1920');
      await expect(photos.first()).toHaveAttribute('height', '1080');
      if (current < deck.total)
        await page.getByRole('button', { name: `Ir para página ${current + 1}` }).click();
    }
    await page.getByRole('button', { name: 'Voltar ao início', exact: true }).click();
  }
});

test('creates, edits and exports on a narrow mobile viewport without document overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Criar um design', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await createDesign(page, 'Ideia no celular', 600, 600);
  await page.getByRole('button', { name: 'Design', exact: true }).click();
  await expect(page.getByRole('complementary', { name: 'Design', exact: true })).toHaveCount(0);
  await page.getByTestId('design-canvas').click({ position: { x: 10, y: 10 } });
  await page.keyboard.press('t');
  await expect(page.getByTestId('design-canvas').locator('[data-kind="text"]')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'docs/screenshots/mobile-editor.png', animations: 'disabled' });
  const png = await bytes(await exportDownload(page, 'png'));
  expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([600, 600]);
});

test('downloads a JPEG with rendered text and a transparent SVG with embedded images and fonts', async ({
  page,
}) => {
  await createDesign(page, 'Forma e cor');
  await addRectangle(page);
  await uploadRaster(page);
  await addAndEditTitle(page, 'Forma e cor');

  const jpegDownload = await exportDownload(page, 'jpg');
  expect(jpegDownload.suggestedFilename()).toMatch(/\.jpg$/);
  const jpeg = await bytes(jpegDownload);
  expect(jpeg.subarray(0, 2).toString('hex')).toBe('ffd8');
  expect(jpeg.subarray(-2).toString('hex')).toBe('ffd9');
  const raster = await page.evaluate(async (base64) => {
    const image = new Image();
    image.src = `data:image/jpeg;base64,${base64}`;
    await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const rgba = context.getImageData(0, 0, image.width, image.height).data;
    let darkPixels = 0;
    for (let index = 0; index < rgba.length; index += 4) {
      if (rgba[index] < 90 && rgba[index + 1] < 90 && rgba[index + 2] < 90) darkPixels++;
    }
    return { width: image.width, height: image.height, darkPixels };
  }, jpeg.toString('base64'));
  expect([raster.width, raster.height]).toEqual([640, 480]);
  // The other fixtures are pale or saturated colors; dark pixels demonstrate rasterized text.
  expect(raster.darkPixels).toBeGreaterThan(50);

  const svgDownload = await exportDownload(page, 'svg', false, true);
  expect(svgDownload.suggestedFilename()).toMatch(/\.svg$/);
  const svg = (await bytes(svgDownload)).toString('utf8');
  const vector = await page.evaluate((source) => {
    const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
    const root = xml.documentElement;
    return {
      valid: !xml.querySelector('parsererror') && root.localName === 'svg',
      viewBox: root.getAttribute('viewBox'),
      hasPageBackground: Array.from(root.children).some((node) => node.localName === 'rect'),
      shapeCount: xml.querySelectorAll('g rect').length,
      images: Array.from(xml.querySelectorAll('image')).map((image) => image.getAttribute('href')),
      fonts: Array.from(xml.querySelectorAll('style'))
        .map((style) => style.textContent)
        .join(''),
      text: Array.from(xml.querySelectorAll('text tspan'))
        .map((span) => span.textContent)
        .join(' '),
    };
  }, svg);
  expect(vector.valid).toBe(true);
  expect(vector.viewBox).toBe('0 0 640 480');
  expect(vector.hasPageBackground).toBe(false);
  expect(vector.shapeCount).toBeGreaterThan(0);
  expect(vector.images).toHaveLength(1);
  expect(vector.images[0]).toMatch(/^data:image\/png;base64,/);
  expect(vector.fonts).toContain('@font-face');
  expect(vector.fonts).toContain('data:');
  expect(vector.text).toBe('Forma e cor');
});
