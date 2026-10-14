import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const lib = (p: string) => fileURLToPath(new URL(`./libs/guided-tour/src/${p}`, import.meta.url));

// Point at the library's source so edits hot-reload without a build step.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^guided-tour\/styles\.css$/, replacement: lib('styles.css') },
      { find: /^guided-tour$/, replacement: lib('index.ts') },
    ],
  },
});
