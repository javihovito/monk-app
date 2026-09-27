import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: { input: { demo: 'index.html', monk: 'monk.html' } },
  },
  test: { include: ['test/**/*.test.ts'] },
});
