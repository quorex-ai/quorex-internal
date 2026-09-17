import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const repoRoot = path.resolve(import.meta.dirname, '..');

/**
 * Port de l'API, lu directement dans le .env de la racine.
 * On ne passe pas par loadEnv de Vite : il interprete NODE_ENV du fichier et
 * produirait un bundle de developpement lors d'un build de production.
 */
function apiPort(): string {
  const fromProcess = process.env.PORT?.trim();
  if (fromProcess) return fromProcess;

  const envFile = path.join(repoRoot, '.env');
  if (fs.existsSync(envFile)) {
    const match = /^\s*PORT\s*=\s*"?(\d+)"?\s*$/m.exec(fs.readFileSync(envFile, 'utf8'));
    if (match?.[1]) return match[1];
  }

  return '4317';
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // En developpement seulement : en production, l'API et le front sortent du meme port.
    proxy: {
      '/api': { target: `http://127.0.0.1:${apiPort()}`, changeOrigin: false },
    },
  },
  build: {
    // Le build unique depose le front dans server/dist/public, servi par Express.
    outDir: path.join(repoRoot, 'server', 'dist', 'public'),
    emptyOutDir: true,
    sourcemap: true,
  },
});
