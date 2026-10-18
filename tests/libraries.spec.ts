import { readFile, mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import type { Page, Download } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import type { DesignDocument } from '../src/model';

async function create(page: Page, title: string) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Criar um design', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByRole('button', { name: /Usar tamanho personalizado/ }).click();
  await modal.getByRole('textbox', { name: 'Nome do design' }).fill(title);
  await modal.getByRole('spinbutton', { name: 'Largura do design' }).fill('640');
  await modal.getByRole('spinbutton', { name: 'Altura do design' }).fill('640');
  await modal.getByRole('button', { name: 'Criar design', exact: true }).click();
  await expect(page.getByTestId('design-canvas')).toBeVisible();
}
async function titleText(page: Page) {
  await page.getByRole('button', { name: 'Texto', exact: true }).click();
  await page.getByRole('button', { name: 'Adicione um título', exact: true }).click();
}
async function exported(page: Page, format = 'axis') {
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  const modal = page.getByRole('dialog');
  await modal.getByLabel('Formato do arquivo').selectOption(format);
  const download = page.waitForEvent('download');
  await modal.getByRole('button', { name: 'Baixar arquivo', exact: true }).click();
  const file = await download;
  expect(await file.failure()).toBeNull();
  return file;
}
async function bytes(file: Download) {
  return readFile((await file.path())!);
}
async function document(page: Page): Promise<DesignDocument> {
  return JSON.parse((await bytes(await exported(page))).toString('utf8'));
}

function paragraphPdf(lines: string[]) {
  const content = [
    'BT',
    '/F1 14 Tf',
    ...lines.flatMap((line, index) => [`1 0 0 1 50 ${750 - index * 18} Tm`, `(${line}) Tj`]),
    'ET',
  ].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'latin1');
}

test('PDF import defaults to editable text and offers an exact appearance mode', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Importar documento', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.locator('input[type="file"]').setInputFiles('tests/fixtures/pdf-editable.pdf');
  const preserveAppearance = dialog.getByRole('checkbox', {
    name: /Importar como imagem, preservando a aparência original da página/,
  });
  await expect(preserveAppearance).not.toBeChecked();
  await dialog.getByRole('button', { name: 'Preparar importação', exact: true }).click();
  await expect(dialog).toContainText(/\d+ textos editáveis/);
  await dialog.getByRole('button', { name: 'Abrir no editor', exact: true }).click();
  let canvas = page.getByTestId('design-canvas');
  await expect(canvas.locator('[data-kind="image"]')).toHaveCount(2);
  await expect(canvas.locator('[data-kind="text"]')).not.toHaveCount(0);

  const importedText = canvas.locator('text');
  await expect(importedText.first()).toContainText('Editable PDF title');
  const layout = await importedText.evaluateAll((nodes) =>
    nodes.map((node) => ({
      text: node.textContent,
      textLength: node.getAttribute('textLength'),
      lengthAdjust: node.querySelector('tspan')?.getAttribute('lengthAdjust'),
    })),
  );
  expect(layout.length).toBeGreaterThan(1);
  expect(layout.every((item) => item.textLength === null && item.lengthAdjust === null)).toBe(true);
  expect(layout.some((item) => item.text?.includes('Native paragraph with accents'))).toBe(true);

  await page.getByRole('button', { name: 'Voltar ao início', exact: true }).click();
  await page.getByRole('button', { name: 'Importar documento', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.locator('input[type="file"]').setInputFiles('tests/fixtures/pdf-editable.pdf');
  await dialog
    .getByRole('checkbox', {
      name: /Importar como imagem, preservando a aparência original da página/,
    })
    .check();
  await dialog.getByRole('button', { name: 'Preparar importação', exact: true }).click();
  await expect(dialog).toContainText('0 textos editáveis');
  await dialog.getByRole('button', { name: 'Abrir no editor', exact: true }).click();
  canvas = page.getByTestId('design-canvas');
  await expect(canvas.locator('[data-kind="image"]')).toHaveCount(1);
  await expect(canvas.locator('[data-kind="text"]')).toHaveCount(0);
});

test('PDF lines in one paragraph become a single multiline editable text box', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Importar documento', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type="file"]').setInputFiles({
    name: 'paragraph.pdf',
    mimeType: 'application/pdf',
    buffer: paragraphPdf(['A primeira linha continua', 'na segunda linha do paragrafo.']),
  });
  await dialog.getByRole('button', { name: 'Preparar importação', exact: true }).click();
  await expect(dialog).toContainText('1 textos editáveis');
  await dialog.getByRole('button', { name: 'Abrir no editor', exact: true }).click();
  const canvas = page.getByTestId('design-canvas');
  await expect(canvas.locator('[data-kind="text"]')).toHaveCount(1);
  await expect(canvas.locator('[data-kind="text"] tspan')).toHaveCount(2);
  await expect(canvas.locator('[data-kind="text"]')).toContainText('A primeira linha continua');
  await expect(canvas.locator('[data-kind="text"]')).toContainText('na segunda linha do paragrafo.');
});

test('PDF embedded images become separate movable and replaceable objects', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Importar documento', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('input[type="file"]').setInputFiles('tests/fixtures/pdf-scanned.pdf');
  await dialog.getByRole('button', { name: 'Preparar importação', exact: true }).click();
  await expect(dialog).toContainText('2 imagens');
  await dialog.getByRole('button', { name: 'Abrir no editor', exact: true }).click();

  const canvas = page.getByTestId('design-canvas');
  const image = canvas.locator('[data-kind="image"][data-locked="false"]');
  await expect(canvas.locator('[data-kind="image"]')).toHaveCount(2);
  await expect(image).toHaveCount(1);
  const canvasBounds = (await canvas.boundingBox())!;
  const extractedBounds = (await image.locator('image').boundingBox())!;
  expect(Math.abs(extractedBounds.x - canvasBounds.x)).toBeLessThan(2);
  expect(Math.abs(extractedBounds.y - canvasBounds.y)).toBeLessThan(2);
  expect(Math.abs(extractedBounds.width - canvasBounds.width)).toBeLessThan(2);
  expect(Math.abs(extractedBounds.height - canvasBounds.height)).toBeLessThan(2);
  const imageShape = image.locator('image');
  const originalSource = await imageShape.getAttribute('href');
  await image.click();
  const originalTransform = await image.locator('g[transform]').first().getAttribute('transform');
  await page.keyboard.press('ArrowRight');
  await expect(image.locator('g[transform]').first()).not.toHaveAttribute(
    'transform',
    originalTransform!,
  );
  const clipboardImage = await page.evaluate(() => {
    const source = document.createElement('canvas');
    source.width = 24;
    source.height = 24;
    const context = source.getContext('2d')!;
    context.fillStyle = '#3b8f62';
    context.fillRect(0, 0, 24, 24);
    return source.toDataURL('image/png').split(',')[1];
  });
  await page.evaluate((base64) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], 'imagem-colada.png', { type: 'image/png' }));
    document
      .querySelector('[data-testid="design-canvas"]')!
      .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: transfer }));
  }, clipboardImage);
  await expect.poll(() => imageShape.getAttribute('href')).not.toBe(originalSource);
  await expect.poll(() => imageShape.getAttribute('href')).toContain('data:image/png;base64,');

  await page.getByRole('button', { name: 'Substituir imagem' }).click();
  const replacementDialog = page.getByRole('dialog');
  await replacementDialog.getByRole('tab', { name: 'Fotos' }).click();
  await replacementDialog.getByRole('button', { name: 'Usar foto Casa com luz natural' }).click();
  await expect(imageShape).toHaveAttribute('href', '/photos/interior.jpg');

  await page.getByRole('button', { name: 'Substituir imagem' }).click();
  await page.getByRole('dialog').getByRole('tab', { name: 'Do computador' }).click();
  const replacement = await page.evaluate(() => {
    const source = document.createElement('canvas');
    source.width = 24;
    source.height = 24;
    const context = source.getContext('2d')!;
    context.fillStyle = '#e64462';
    context.fillRect(0, 0, 24, 24);
    return source.toDataURL('image/png').split(',')[1];
  });
  await page.getByLabel('Arquivo de imagem para substituir').setInputFiles({
    name: 'nova-foto.png',
    mimeType: 'image/png',
    buffer: Buffer.from(replacement, 'base64'),
  });
  await expect(page.getByText('Imagem enviada e substituída.', { exact: true })).toBeVisible();
  await expect(imageShape).toHaveAttribute('href', /^data:image\/png;base64,/);

  await page.getByRole('button', { name: 'Substituir imagem' }).click();
  const uploadsDialog = page.getByRole('dialog');
  await uploadsDialog.getByRole('tab', { name: 'Uploads' }).click();
  await uploadsDialog.getByRole('button', { name: 'Usar upload nova-foto.png' }).click();
  await expect(uploadsDialog).toHaveCount(0);
  await page.getByRole('button', { name: 'Ajustar', exact: true }).click();
  const radius = page.getByLabel('Arredondamento dos cantos');
  await radius.focus();
  await radius.press('End');
  await expect(radius).toHaveValue('100');
  await expect(imageShape.locator('..').locator('clipPath rect')).toHaveAttribute('rx', /[1-9]/);
});

test('full font catalog searches and favorites, applies local font offline and embeds actual font bytes', async ({
  page,
}) => {
  await page.route('https://api.fontsource.org/**', (route) => route.abort());
  await page.route('https://cdn.jsdelivr.net/**', (route) => route.abort());
  await create(page, 'Fontes que acompanham a ideia');
  await titleText(page);
  await page.getByRole('button', { name: 'Fonte', exact: true }).click();
  const modal = page.getByRole('dialog');
  await expect(modal).toContainText('2.095 famílias');
  await expect(modal.getByLabel('Buscar fontes')).toBeFocused();
  await modal.getByLabel('Buscar fontes').fill('Montserrat');
  await modal.getByRole('button', { name: 'Favoritar fonte Montserrat', exact: true }).click();
  await modal.getByRole('button', { name: 'Favoritas', exact: true }).click();
  await expect(
    modal.getByRole('button', { name: 'Usar fonte Montserrat', exact: true }),
  ).toBeVisible();
  await mkdir('docs/screenshots', { recursive: true });
  await page.screenshot({ path: 'docs/screenshots/font-library.png' });
  await modal.getByRole('button', { name: 'Usar fonte Montserrat', exact: true }).click();
  await expect(modal).toBeHidden();
  await expect(page.getByTestId('design-canvas').locator('text')).toHaveAttribute(
    'font-family',
    'Montserrat',
  );
  const doc = await document(page);
  const face = doc.fonts?.find((f) => f.family === 'Montserrat' && f.weight === '700');
  expect(face?.data).toMatch(/^data:font\/woff2;base64,/);
  const binary = Buffer.from(face!.data.split(',')[1], 'base64');
  expect(binary.subarray(0, 4).toString()).toBe('wOF2');
  const svg = (await bytes(await exported(page, 'svg'))).toString('utf8');
  expect(svg).toContain('font-family="Montserrat"');
  expect(svg).toContain(face!.data);
});

test('downloads an uncached catalog font and transports it into a fresh offline browser context', async ({
  page,
  browser,
}) => {
  const fixture = await readFile('tests/fixtures/abeezee.woff2');
  const metadata = JSON.parse(await readFile('tests/fixtures/abeezee.json', 'utf8'));
  let apiRequests = 0,
    cdnRequests = 0;
  await page.route('https://api.fontsource.org/v1/fonts/abeezee', (route) => {
    apiRequests++;
    return route.fulfill({
      json: { npmVersion: metadata.npmVersion },
      headers: { 'access-control-allow-origin': '*' },
    });
  });
  await page.route(
    'https://cdn.jsdelivr.net/fontsource/fonts/abeezee@*/latin-400-normal.woff2',
    (route) => {
      cdnRequests++;
      return route.fulfill({
        body: fixture,
        contentType: 'font/woff2',
        headers: { 'access-control-allow-origin': '*' },
      });
    },
  );
  await create(page, 'Uma fonte para levar');
  await titleText(page);
  await page.getByRole('button', { name: 'Fonte', exact: true }).click();
  await page.getByLabel('Buscar fontes').fill('ABeeZee');
  await page.getByRole('button', { name: 'Usar fonte ABeeZee', exact: true }).click();
  const doc = await document(page);
  const face = doc.fonts?.find((f) => f.family === 'ABeeZee');
  expect(Buffer.from(face!.data.split(',')[1], 'base64')).toEqual(fixture);
  expect(apiRequests).toBeGreaterThan(0);
  expect(cdnRequests).toBeGreaterThan(0);
  const fresh = await browser.newContext();
  const other = await fresh.newPage();
  await other.route('https://**/*', (route) => route.abort());
  try {
    await other.goto('http://127.0.0.1:4173/');
    await other.locator('input[type=file][accept=".axis,.json"]').setInputFiles({
      name: 'levada.axis',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(doc)),
    });
    await expect(other.getByTestId('design-canvas').locator('text')).toHaveAttribute(
      'font-family',
      'ABeeZee',
    );
    await expect
      .poll(() =>
        other.evaluate(() =>
          Array.from(window.document.fonts).some(
            (f) => f.family === 'ABeeZee' && f.status === 'loaded',
          ),
        ),
      )
      .toBe(true);
    const copy = await document(other);
    expect(copy.fonts?.find((f) => f.family === 'ABeeZee')?.data).toBe(face!.data);
  } finally {
    await fresh.close();
  }
});

test('an embedded regular font can still export a bold edit when other variants are offline', async ({
  page,
}) => {
  const manifest = JSON.parse(await readFile('public/fonts/manifest.json', 'utf8'));
  const record = manifest.find(
    (f: { family: string; weight: number; style: string }) =>
      f.family === 'Montserrat' && f.weight === 400 && f.style === 'normal',
  );
  const font = await readFile(`public${record.url}`);
  const doc: DesignDocument = {
    id: randomUUID(),
    version: 1,
    title: 'Continua offline',
    width: 640,
    height: 640,
    createdAt: 0,
    updatedAt: 0,
    favorite: false,
    pages: [{ id: randomUUID(), name: 'Página', background: '#ffffff', elements: [] }],
  };
  doc.fonts = [
    {
      family: 'Montserrat',
      weight: '400',
      style: 'normal',
      data: `data:font/woff2;base64,${font.toString('base64')}`,
    },
  ];
  doc.pages[0].elements = [
    {
      id: randomUUID(),
      kind: 'text',
      name: 'Texto',
      x: 100,
      y: 100,
      rotation: 0,
      fill: '#191c2e',
      opacity: 1,
      locked: false,
      hidden: false,
      text: 'Uma ideia persistente',
      fontFamily: 'Montserrat',
      fontWeight: 400,
      fontSize: 40,
      width: 440,
      height: 100,
    },
  ];
  await page.route('https://**/*', (route) => route.abort());
  await page.route('**/fonts/*700*.woff2', (route) => route.abort());
  await page.goto('/');
  await page.locator('input[type=file][accept=".axis,.json"]').setInputFiles({
    name: 'offline.axis',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  const text = page.getByTestId('design-canvas').locator('[data-kind=text]');
  await text.click();
  await page.getByRole('button', { name: 'Negrito', exact: true }).click();
  const svg = (await bytes(await exported(page, 'svg'))).toString('utf8');
  expect(svg).toContain('font-weight="700"');
  expect(svg).toContain(doc.fonts[0].data);
});

test('custom font upload validates the binary and remains editable after project import', async ({
  page,
}) => {
  await create(page, 'Tipografia própria');
  await titleText(page);
  await page.getByRole('button', { name: 'Fonte', exact: true }).click();
  const modal = page.getByRole('dialog');
  const input = modal.locator('input[type=file]');
  await input.setInputFiles({
    name: 'Invalida.woff2',
    mimeType: 'font/woff2',
    buffer: Buffer.from('not-a-font'),
  });
  await expect(modal.getByRole('alert')).toContainText('não contém uma fonte válida');
  await input.setInputFiles({
    name: 'Minha Fonte.woff2',
    mimeType: 'font/woff2',
    buffer: await readFile('tests/fixtures/abeezee.woff2'),
  });
  await expect(modal).toBeHidden();
  const doc = await document(page);
  expect(doc.pages[0].elements[0].fontFamily).toBe('Minha Fonte');
  expect(doc.fonts?.some((f) => f.family === 'Minha Fonte')).toBe(true);
});

test('complete local element catalog searches in Portuguese, favorites, recolors and round-trips SVG vectors', async ({
  page,
}) => {
  await create(page, 'Um elemento para cada ideia');
  await page.getByRole('button', { name: 'Elementos', exact: true }).click();
  const panel = page.getByRole('complementary', { name: 'Elementos', exact: true });
  await expect(panel).toContainText('1.594 elementos vetoriais');
  await panel.getByRole('button', { name: 'Ícones', exact: true }).click();
  await panel.getByLabel('Buscar elementos').fill('coração');
  const heart = panel.getByTestId('asset-icon:lucide-heart');
  await expect(heart).toBeVisible();
  const favorite = heart.locator('..').getByRole('button', { name: /Favoritar elemento/ });
  await favorite.click();
  await panel.getByRole('button', { name: 'Favoritos', exact: true }).click();
  await expect(heart).toBeVisible();
  await heart.click();
  await expect(page.getByTestId('design-canvas').locator('[data-kind=vector]')).toHaveCount(1);
  await page.getByLabel('Cor do elemento', { exact: true }).fill('#e25570');
  const doc = await document(page);
  const vector = doc.pages[0].elements[0];
  expect(vector.kind).toBe('vector');
  expect(vector.vectorPaths?.length).toBeGreaterThan(0);
  expect(vector.fill).toBe('#e25570');
  const svg = (await bytes(await exported(page, 'svg'))).toString('utf8');
  expect(svg).toContain(vector.vectorPaths![0].attrs.d);
  expect(svg).toContain('#e25570');
  await page.getByRole('button', { name: 'Voltar ao início', exact: true }).click();
  await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
  await page.locator('input[type=file][accept=".axis,.json"]').setInputFiles({
    name: 'vetor.axis',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(doc)),
  });
  const imported = await document(page);
  expect(imported.pages[0].elements[0].vectorPaths).toEqual(vector.vectorPaths);
  await page.getByRole('button', { name: 'Elementos', exact: true }).click();
  await page.screenshot({ path: 'docs/screenshots/elements-library.png' });
});

for (const viewport of [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1366, height: 768 },
  { width: 1440, height: 1000 },
  { width: 1920, height: 1080 },
])
  test(`home layout and touch navigation at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'O que vamos criar hoje?' })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => window.document.documentElement.scrollWidth <= window.innerWidth),
      )
      .toBe(true);
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    const buttons = nav.getByRole('button');
    await expect(buttons).toHaveCount(5);
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    if (viewport.width <= 760) {
      const box = await nav.boundingBox();
      expect(box!.y).toBeGreaterThan(viewport.height - 100);
      await nav.getByRole('button', { name: 'Modelos', exact: true }).click();
      await expect(
        page.getByRole('heading', { name: 'Encontre seu próximo começo' }),
      ).toBeVisible();
      await nav.getByRole('button', { name: 'Início', exact: true }).click();
    }
    await page.getByRole('textbox', { name: 'Buscar no meu espaço', exact: true }).fill('essencia');
    await expect(
      page.getByRole('button', { name: 'Abrir Menos ruído. Mais essência.', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Limpar pesquisa do espaço' }).click();
    await mkdir('docs/screenshots', { recursive: true });
    await page.screenshot({ path: `docs/screenshots/home-${viewport.width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Criar um design', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
