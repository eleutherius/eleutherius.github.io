import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://eleutherius.github.io',
  integrations: [
    mdx(),
    // /card is a noindex page (a QR code to show people), so it has no place in the sitemap.
    sitemap({ filter: (page) => !page.endsWith('/card/') }),
  ]
});
