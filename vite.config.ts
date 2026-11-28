import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: 'vendor-react',
                test: /node_modules[\\/](react|react-dom|react-router-dom|scheduler)[\\/]/,
              },
              {
                name: 'vendor-supabase',
                test: /node_modules[\\/]@supabase[\\/]/,
              },
              {
                name: 'vendor-ai',
                test: /node_modules[\\/]@google[\\/]genai[\\/]/,
              },
              {
                name: 'vendor-motion',
                test: /node_modules[\\/]motion[\\/]/,
              },
              {
                name: 'vendor-maps',
                test: /node_modules[\\/]leaflet[\\/]/,
              },
              {
                name: 'vendor-icons',
                test: /node_modules[\\/]lucide-react[\\/]/,
              },
            ],
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
