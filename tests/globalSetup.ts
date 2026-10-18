import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { request } from '@playwright/test';
import type { FullConfig } from '@playwright/test';

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL as string | undefined;
  if (!baseURL) throw new Error('Playwright baseURL is required for account setup.');
  const api = await request.newContext({ baseURL });
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
  const email = `axis-e2e-${suffix}@example.test`;
  const password = 'AxisDesign-Test-Password-2026';
  const response = await api.post('/api/auth/register', {
    data: { username: `axis_e2e_${suffix}`, email, password },
  });
  if (!response.ok()) throw new Error(`Could not prepare the E2E account: ${await response.text()}`);
  const listed = await api.get('/api/designs');
  if (!listed.ok()) throw new Error(`Could not load E2E designs: ${await listed.text()}`);
  const { designs } = (await listed.json()) as { designs: Array<{ title: string }> };
  if (!designs.some((design) => design.title === 'Menos ruído. Mais essência.')) {
    const now = Date.now();
    const id = randomUUID();
    const design = {
      id,
      version: 1,
      title: 'Menos ruído. Mais essência.',
      width: 1080,
      height: 1080,
      createdAt: now,
      updatedAt: now,
      favorite: false,
      pages: [{
        id: randomUUID(),
        name: 'Página 1',
        background: '#e9e4da',
        elements: [{
          id: randomUUID(), kind: 'text', name: 'Título', x: 96, y: 260, width: 850,
          height: 110, rotation: 0, fill: '#25283a', opacity: 1, locked: false,
          hidden: false, text: 'Menos ruído.\nMais essência.', fontSize: 72,
          fontFamily: 'DM Sans', fontWeight: 600,
        }],
      }],
    };
    const saved = await api.put(`/api/designs/${id}`, { data: { document: design } });
    if (!saved.ok()) throw new Error(`Could not seed the E2E design: ${await saved.text()}`);
  }
  const statePath = path.resolve('playwright/.auth/e2e-user.json');
  await mkdir(path.dirname(statePath), { recursive: true });
  await api.storageState({ path: statePath });
  await api.dispose();
}
