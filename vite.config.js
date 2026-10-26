import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // pdf.js is left to automatic splitting: a manual 'pdf' chunk also captured Vite's
          // lazy-import helper, which made every page preload pdf.js.
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) return 'charts';
          if (id.includes('node_modules/framer-motion')) return 'motion';
          return undefined;
        },
      },
    },
  },
});
