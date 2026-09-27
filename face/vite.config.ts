import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: '.',
  base: './',
  build: { outDir: 'dist', target: 'es2022' },
  test: { include: ['test/**/*.test.ts'] },
});
