import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `npm run dev:demo` uses --mode demo: the app then runs on an in-browser Postgres instead of Supabase.
// __DEMO__ is a compile-time constant, so production builds drop the demo engine entirely.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './', // relative paths + HashRouter = works on any GitHub Pages URL
  define: { __DEMO__: JSON.stringify(mode === 'demo') },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: { chunkSizeWarningLimit: 900 },
}))
