/** @type {import('tailwindcss').Config} */

// Tailwind supplies layout utilities and the typography plugin for blog
// prose. All colour, type and component styling lives in
// src/styles/industry.css; DaisyUI is gone now that no page uses it.

module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			fontFamily: {
				heading: ['var(--font-heading)'],
				sans: ['var(--font-body)'],
			},
		},
	},
	plugins: [require("@tailwindcss/typography")],
}
