import { defineConfig, fontProviders } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// Fonts are served from this site, not from Google: no third-party request
// blocking the first paint, and Astro generates metric-matched fallbacks so
// the condensed headings don't reflow when the real face arrives.
// Files: src/assets/fonts (Latin subset, OFL — see OFL.txt there).
const face = (file, weight) => ({ src: [`./src/assets/fonts/${file}`], weight, style: 'normal' });

// https://astro.build/config
export default defineConfig({
  site: 'https://eleutherius.github.io',
  // Code blocks on the site's own paper, not a dark slab: a light theme whose
  // comment colour still clears 4.5:1 (github-dark's grey comments were 3:1).
  markdown: {
    shikiConfig: { theme: 'github-light-high-contrast' },
  },
  integrations: [
    mdx(),
    // /card is a noindex page (a QR code to show people), so it has no place in the sitemap.
    sitemap({ filter: (page) => !page.endsWith('/card/') }),
  ],
  fonts: [
    {
      provider: fontProviders.local(),
      name: 'Barlow Condensed',
      cssVariable: '--font-barlow-condensed',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          face('barlow-condensed-latin-500-normal.woff2', 500),
          face('barlow-condensed-latin-600-normal.woff2', 600),
        ],
      },
    },
    {
      provider: fontProviders.local(),
      name: 'Barlow',
      cssVariable: '--font-barlow',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          face('barlow-latin-400-normal.woff2', 400),
          face('barlow-latin-500-normal.woff2', 500),
          face('barlow-latin-600-normal.woff2', 600),
        ],
      },
    },
  ],
});
