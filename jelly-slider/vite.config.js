import { defineConfig } from 'vite';
import typegpu from 'unplugin-typegpu/vite';

export default defineConfig({
  plugins: [
    typegpu(),
  ],
  base: './',
  build: {
    target: 'esnext',
  },
  esbuild: {
    target: 'esnext',
  },
});
