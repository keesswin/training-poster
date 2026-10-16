import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

const hosted = (mode: string) => mode === 'hosted';
const src = (f: string) => fileURLToPath(new URL(`./src/${f}`, import.meta.url));

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(hosted(mode) ? [viteSingleFile()] : []),
    {
      name: 'hosted-fonts-link',
      transformIndexHtml: (html) =>
        hosted(mode)
          ? html.replace(
              '</head>',
              '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;900&amp;family=Space+Grotesk:wght@500;700&amp;family=Space+Mono:wght@400;700&amp;display=swap" /></head>',
            )
          : html,
    },
  ],
  resolve: { alias: { '~fonts': hosted(mode) ? src('fonts.hosted.ts') : src('fonts.local.ts') } },
  // Relative asset URLs so the same build works at a domain root (Netlify) and under /training-poster/ (GitHub Pages).
  base: './',
  build: { outDir: hosted(mode) ? 'dist-hosted' : 'dist' },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
}));
