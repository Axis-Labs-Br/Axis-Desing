import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { axisApi } from './server/api.mjs';
export default defineConfig({
  plugins: [react(), axisApi()],
  server: {
    port: 4332,
    strictPort: true,
    allowedHosts: ['born-fiction-artwork-meets.trycloudflare.com'],
  },
  preview: { port: 4332, strictPort: true },
});
