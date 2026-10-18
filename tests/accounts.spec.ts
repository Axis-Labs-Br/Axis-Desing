import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });

const credentials = (suffix: string) => ({
  username: `axis_${suffix.replaceAll('-', '').slice(0, 10)}`,
  email: `axis.${suffix}@example.test`,
  password: 'AxisDesign-Account-Test-2026',
});

test('registra contas separadas, mantém designs privados e permite compartilhar e revogar links', async ({ page }) => {
  const owner = credentials(randomUUID());
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Nome de usuário' }).fill(owner.username);
  await page.getByLabel('E-mail').fill(owner.email);
  await page.getByRole('textbox', { name: 'Senha' }).fill(owner.password);
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.getByText(`@${owner.username}`, { exact: true })).toBeVisible();

  const title = `Projeto privado ${owner.username}`;
  await page.getByRole('button', { name: 'Criar um design', exact: true }).click();
  const create = page.getByRole('dialog');
  await create.getByRole('button', { name: /Usar tamanho personalizado/ }).click();
  await create.getByRole('textbox', { name: 'Nome do design' }).fill(title);
  await create.getByRole('spinbutton', { name: 'Largura do design' }).fill('640');
  await create.getByRole('spinbutton', { name: 'Altura do design' }).fill('480');
  await create.getByRole('button', { name: 'Criar design', exact: true }).click();
  await expect(page.getByTestId('design-canvas')).toBeVisible();

  await page.getByRole('button', { name: 'Compartilhar design' }).click();
  const share = page.getByRole('dialog', { name: 'Compartilhar design' });
  await expect(share.getByRole('radio', { name: /Privado/ })).toHaveAttribute('aria-checked', 'true');
  await share.getByRole('radio', { name: /Qualquer pessoa com o link/ }).click();
  await share.getByRole('button', { name: 'Salvar acesso' }).click();
  const link = await share.getByLabel('Link de visualização').inputValue();
  expect(link).toMatch(/\/share\/[\w-]{32}$/);

  const guest = await page.context().browser()!.newContext({ storageState: { cookies: [], origins: [] } });
  const viewer = await guest.newPage();
  await viewer.goto(link);
  await expect(viewer.getByText(title, { exact: true })).toBeVisible();
  await expect(viewer.getByText('Visualização somente leitura')).toBeVisible();
  await expect(viewer.getByRole('button', { name: 'Compartilhar design' })).toHaveCount(0);
  await guest.close();

  await share.getByRole('radio', { name: /^Público/ }).click();
  await share.getByRole('button', { name: 'Salvar acesso' }).click();
  const publicUrl = await share.getByLabel('Link de visualização').inputValue();
  expect(publicUrl).toMatch(/\/public\/[0-9a-f-]{36}$/i);
  const publicContext = await page.context().browser()!.newContext({ storageState: { cookies: [], origins: [] } });
  const publicViewer = await publicContext.newPage();
  await publicViewer.goto(publicUrl);
  await expect(publicViewer.getByText(title, { exact: true })).toBeVisible();
  await publicContext.close();

  await share.getByRole('radio', { name: /Privado/ }).click();
  await share.getByRole('button', { name: 'Salvar acesso' }).click();
  await share.getByRole('button', { name: 'Fechar janela' }).click();
  await page.getByRole('button', { name: 'Voltar ao início' }).click();
  await page.getByRole('button', { name: 'Sair da conta' }).click();

  const other = credentials(randomUUID());
  await page.getByRole('textbox', { name: 'Nome de usuário' }).fill(other.username);
  await page.getByLabel('E-mail').fill(other.email);
  await page.getByRole('textbox', { name: 'Senha' }).fill(other.password);
  await page.getByRole('button', { name: 'Criar minha conta' }).click();
  await expect(page.getByText(title, { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Sair da conta' }).click();
  await page.getByRole('tab', { name: 'Entrar' }).click();
  await page.getByLabel('E-mail').fill(owner.email);
  await page.getByRole('textbox', { name: 'Senha' }).fill(owner.password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();

  const revoked = await page.context().browser()!.newContext({ storageState: { cookies: [], origins: [] } });
  const revokedViewer = await revoked.newPage();
  await revokedViewer.goto(link);
  await expect(revokedViewer.getByRole('heading', { name: 'Este link não está disponível' })).toBeVisible();
  await revoked.close();
});
