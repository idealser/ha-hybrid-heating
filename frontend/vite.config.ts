import { defineConfig } from 'vite';

// The card is one ES module, built straight into the integration, which serves it to Home Assistant.
export default defineConfig({
  build: {
    lib: { entry: 'src/hybrid-heating-card.ts', formats: ['es'], fileName: () => 'hybrid-heating-card.js' },
    outDir: '../custom_components/hybrid_heating/frontend',
    emptyOutDir: true,
    target: 'es2022',
  },
  server: { port: 5179 },
});
