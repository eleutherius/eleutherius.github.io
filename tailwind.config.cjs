/** @type {import('tailwindcss').Config} */

// One theme, not thirty. The blog and home pages are styled by
// src/styles/industry.css; this DaisyUI theme exists so the pages still on
// DaisyUI classes (cv, projects, 404, store) inherit the same steel palette
// instead of looking like a different website. Delete the daisyui plugin once
// those pages are ported too.

module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			fontFamily: {
				heading: ['"Barlow Condensed"', 'system-ui', 'sans-serif'],
				sans: ['Barlow', 'system-ui', 'sans-serif'],
			},
		},
	},
	plugins: [require("@tailwindcss/typography"), require("daisyui")],
	daisyui: {
		themes: [
			{
				industry: {
					"primary": "#5980a6",
					"primary-content": "#f2f2f3",
					"secondary": "#416180",
					"secondary-content": "#f2f2f3",
					"accent": "#2c455d",
					"accent-content": "#f2f2f3",
					"neutral": "#2b2b2d",
					"neutral-content": "#f2f2f3",
					"base-100": "#f2f2f3",
					"base-200": "#e7e7ea",
					"base-300": "#d4d4d7",
					"base-content": "#1d1f20",
					"info": "#5980a6",
					"success": "#4d7c5a",
					"warning": "#a1741f",
					"error": "#9c4b45",
					"--rounded-box": "0",
					"--rounded-btn": "0",
					"--rounded-badge": "0",
					"--animation-btn": "0.15s",
					"--btn-text-case": "uppercase",
				},
			},
		],
		logs: false,
	}
}
