import { existsSync } from 'node:fs';
import { defineConfig, devices } from '@playwright/test';

const installedChrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  (process.platform === 'win32' && existsSync(installedChrome) ? installedChrome : undefined);

export default defineConfig({
  globalSetup: './tests/globalSetup.ts',
  testDir: './tests',
  testMatch: ['editor.spec.ts', 'canvas.spec.ts', 'libraries.spec.ts', 'accounts.spec.ts'],
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 1000 },
    baseURL: 'http://127.0.0.1:4173',
    storageState: 'playwright/.auth/e2e-user.json',
    acceptDownloads: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath },
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
