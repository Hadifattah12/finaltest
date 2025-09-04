import { defineConfig } from 'vite';
import fs from 'node:fs';
import { resolve } from 'node:path';
import 'dotenv/config'; // Load .env variables

const certDir = resolve(__dirname, '../backend/certificate');

export default defineConfig({
  server: {
    host: '0.0.0.0', // still needed for external access
    port: 5173,
    https: fs.existsSync(resolve(certDir, 'key.pem')) && fs.existsSync(resolve(certDir, 'cert.pem')) ? {
      key: fs.readFileSync(resolve(certDir, 'key.pem')),
      cert: fs.readFileSync(resolve(certDir, 'cert.pem'))
    } : false,
    strictPort: true,
    hmr: {
      protocol: fs.existsSync(resolve(certDir, 'key.pem')) && fs.existsSync(resolve(certDir, 'cert.pem')) ? 'wss' : 'ws',
      host: 'localhost',
      port: 5173,
      clientPort: 5173
    }
  }
});
