import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const isProd = mode === 'production';
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    build: {
      sourcemap: false,          
      cssCodeSplit: false,       // ❌ DISABLED: CSS code splitting breaks Tailwind v4 cascade
      assetsInlineLimit: 4096,   
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: isProd,  // Remove console.logs in prod
          drop_debugger: true,
          passes: 2,
        },
        mangle: { safari10: true },
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Core React
            if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'vendor-react';
            // Animation
            if (id.includes('motion') || id.includes('framer-motion')) return 'vendor-motion';
            // Icons
            if (id.includes('lucide-react')) return 'vendor-icons';
            // Charts
            if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'vendor-charts';
            // DnD
            if (id.includes('@dnd-kit') || id.includes('dnd')) return 'dnd';
            // Date + utils
            if (id.includes('date-fns') || id.includes('clsx') || id.includes('tailwind-merge')) return 'vendor-utils';
            // React Query
            if (id.includes('@tanstack')) return 'vendor-query';
          },
          // Hash-based filenames for long-term caching
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
        },
      },
      chunkSizeWarningLimit: 800,
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      proxy: {
        '/api': { target: 'http://localhost:5000', changeOrigin: true },
      },
    },
  };
});
