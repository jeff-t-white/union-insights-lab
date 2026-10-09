import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // Local development stays at /; production is served under the repo name.
  base: command === 'serve' ? '/' : '/union-insights-lab/',
}));
