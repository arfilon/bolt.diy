import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import remix from '@remix-run/dev/vite/plugin';
import tsconfigPaths from 'vite-tsconfig-paths';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

/**
 * Vite configuration for offline browser build using WebContainers
 *
 * This config builds Bolt.diy as a browser-only application that:
 * - Runs the Remix server inside WebContainers
 * - Makes API calls to LM Studio on localhost:1234
 * - Works completely offline after load
 *
 * Build: pnpm run build:browser:offline
 * Output: dist/bolt-offline.html (single HTML file)
 */

export default defineConfig({
  plugins: [
    // Polyfills for Node.js modules used in browser
    nodePolyfills({
      include: ['buffer', 'process', 'util', 'stream', 'path', 'fs'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),

    // TypeScript path resolution
    tsconfigPaths(),

    // React plugin for JSX support
    react(),

    // Remix plugin but configured for browser-only
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
      // Build for browser environment, not SSR
      ssr: false,
    }),
  ],

  build: {
    target: 'esnext',
    minify: 'terser',
    outDir: 'dist',
    emptyOutDir: false,
    rollupOptions: {
      input: 'app/entry.client.tsx',
      output: {
        // Output as single bundle
        dir: 'dist',
        format: 'esm',
        entryFileNames: '[name]-[hash].js',
        chunkFileNames: '[name]-[hash].js',
        assetFileNames: '[name]-[hash][extname]',
      },
    },
  },

  // Environment variables
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },

  // Expose environment variables for browser
  envPrefix: [
    'VITE_',
    'LMSTUDIO_',
  ],

  ssr: {
    external: ['@webcontainer/api'],
  },

  resolve: {
    alias: {
      '~': '/app',
    },
  },
});
