import { defineConfig } from 'vite';
import typegpu from 'unplugin-typegpu/vite';

export default defineConfig({
  plugins: [
    typegpu(),
  ],
  build: {
    target: 'esnext',
  },
  esbuild: {
    target: 'esnext',
  },
});
