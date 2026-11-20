# eleutherius.github.io

Personal site of Oleksandr Liakhov, Senior Platform / DevOps Engineer:
<https://eleutherius.github.io>

Built with Astro and Tailwind CSS. `.github/workflows/deploy.yml` builds it and
deploys to GitHub Pages on every push to `master`.

## Develop

```bash
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # static site in dist/
```

## Where things are

- `src/pages/` — home, projects, blog, CV
- `src/content/blog/` — posts in Markdown; `draft: true` keeps a post out of the build
- `src/styles/industry.css` — the design system: tokens and components
- `src/config.ts` — site title, contact email, LinkedIn and GitHub links

## CV PDF

`public/Oleksandr-Liakhov-CV.pdf` is printed from the `/cv` page; its print
styles live in `src/pages/cv.astro`. After changing the CV, open `/cv` in
Chrome, print to PDF (A4, 12 mm margins, background graphics on) and replace
the file.

## Credits

Started from the [Astrofy](https://github.com/manuelernestog/astrofy) template
(MIT, see `LICENSE`).
