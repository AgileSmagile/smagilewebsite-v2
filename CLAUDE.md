# smagile.co v2 — Project Instructions

## Brand Name Rules (CRITICAL)

- The legal trading name is **SMAGILE LTD** — use this form only in formal legal contexts.
- In all other contexts (branding, copy, UI, docs): **smagile** — always lowercase, always one word, no space.
- NEVER write "SM Agile", "Smagile", "SM agile", "SmAgile", "smagile Ltd", or any other variant.
- Product name: **Mosaic CV** (two words, both capitalised).

## Standards

- British English throughout (colour, organisation, analyse, catalogue).
- Never use em dashes. Use commas, semicolons, colons, or separate sentences.
- GDPR compliance is paramount. Cookie consent, data minimisation, SAR/right-to-be-forgotten readiness.
- Priority order: 1. Security, 2. Performance, 3. Maintainability, 4. Brevity.

## Tech Stack

- **Framework**: Astro 5 with @astrojs/node adapter (standalone mode)
- **Styling**: Tailwind CSS 4 via @tailwindcss/vite, @tailwindcss/typography for prose
- **Integrations**: @astrojs/sitemap (excludes /admin/*), @astrojs/rss
- **Content**: Astro Content Collections with Zod schema validation
- **Dark mode**: Class-based (.dark), controlled by JS toggle with localStorage persistence

## Brand Colours

- Primary: #117076 (teal)
- Secondary: #75bcbe (light teal)
- Accent: #B8953E (warm gold)
- White: #FDFCFA
- Cream: #F5F0E8

## Architecture

- **Public pages**: Statically rendered by default
- **Admin pages**: SSR with `export const prerender = false`, protected by Cloudflare Access
- **Admin auth**: Cloudflare Access + Google OAuth; user email from `Cf-Access-Authenticated-User-Email` header
- **Layouts**: BaseLayout > PublicLayout (public), BaseLayout > AdminLayout (admin)

## Hosting & Deployment

- **Host**: Raspberry Pi 3B+ (SMAGILE-WEBSERVER) behind Cloudflare tunnel
- **Domain**: smagile.co
- **CI/CD**: GitHub Actions — push to main deploys to production (port 4321), push to develop deploys to staging (port 4322)
- **Process**: systemd services (smagile-web, smagile-web-staging)
- **Rollback**: Automatic on health check failure (dist.bak restore)

## Analytics

- Cloudflare Web Analytics (cookie-free, always on if token set)
- Google Analytics (opt-in via cookie consent, IP anonymised)
