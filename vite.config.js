import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Relative base so the build works on GitHub Pages regardless of the
  // repository sub-path (https://user.github.io/<repo>/).
  base: './',
  plugins: [tailwindcss()],
});
