// Place any global data in this file.
// You can import this data from anywhere in your site by using the `import` keyword.

export const SITE_TITLE = 'Oleksandr Liakhov';
export const SITE_DESCRIPTION = 'DevOps and Platform Engineer focused on reliable infrastructure, cloud platforms, automation, and developer experience.';
export const GENERATE_SLUG_FROM_TITLE = true
export const TRANSITION_API = true

// Contact details live here so every "Get in touch" button points at the same
// real address. Three of them used to say hello@example.com.
export const CONTACT_EMAIL = 'eleutherius69@gmail.com';
export const LINKEDIN_URL = 'https://www.linkedin.com/in/eleutherius/';
export const GITHUB_URL = 'https://github.com/eleutherius';
export const CV_PDF = '/Oleksandr-Liakhov-CV.pdf';
export const REPO_URL = 'https://github.com/eleutherius/eleutherius.github.io';

// The four destinations, in one place for the sidebar and the narrow-screen header.
export const NAV = [
  { id: 'home', href: '/', label: 'Home' },
  { id: 'projects', href: '/projects', label: 'Projects' },
  { id: 'blog', href: '/blog/', label: 'Blog' },
  { id: 'cv', href: '/cv', label: 'CV' },
] as const;
