import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const root = __dirname;

const DEFAULT_SUPABASE_ORIGIN = 'https://sfdqxpybtmsfbjppoydh.supabase.co';

function supabaseOriginFromEnv(env: Record<string, string>) {
  const raw = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  return raw || DEFAULT_SUPABASE_ORIGIN;
}

function injectSupabaseOrigin(env: Record<string, string>) {
  const origin = supabaseOriginFromEnv(env);
  return {
    name: 'inject-supabase-origin',
    transformIndexHtml(html: string) {
      return html.replaceAll('__VITE_SUPABASE_ORIGIN__', origin);
    },
  };
}

function injectAdsenseScript(env: Record<string, string>) {
  const client = (env.VITE_GOOGLE_ADSENSE_CLIENT || '').trim();
  return {
    name: 'inject-adsense-script',
    transformIndexHtml(html: string) {
      const snippet =
        client && client.startsWith('ca-pub-')
          ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous"></script>`
          : '';
      return html.replace('<!-- __ADSENSE_SCRIPT__ -->', snippet);
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react(), injectSupabaseOrigin(env), injectAdsenseScript(env)],
      resolve: {
        alias: {
          '@': root,
          '@landing': path.resolve(root, 'landing'),
          '@app': path.resolve(root, 'app'),
          '@shared': path.resolve(root, 'shared'),
          '@backend': path.resolve(root, 'backend'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-motion': ['motion', 'framer-motion'],
              'vendor-lucide': ['lucide-react']
            }
          }
        },
        minify: 'esbuild',
      },
      esbuild: {
        drop: mode === 'production' ? ['console', 'debugger'] : [],
      }
    };
});
