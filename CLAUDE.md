# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Package manager is **bun** (see `bun.lock`). Use `bun` / `bunx` rather than `npm` / `npx`.

- `bun dev` — run the Next.js dev server
- `bun run build` — production build
- `bun start` — serve the production build
- `bun run lint` — ESLint (flat config in `eslint.config.mjs`)
- `bun run db:generate` — generate Drizzle migrations from schema
- `bun run db:migrate` — apply migrations
- `bun run db:push` — push schema directly (no migration file)

No test runner is configured.

## Architecture

This is a Next.js **16.2.6** + React **19.2.4** App Router project. Because Next.js 16 has breaking changes from older versions, follow `AGENTS.md` and consult `node_modules/next/dist/docs/` (especially `01-app/` and `03-architecture/`) before writing routing, data-fetching, or caching code — do not rely on training-data conventions.

**Stack**

- **Storage:** `@aws-sdk/client-s3` configured for Cloudflare R2 (see `.env`: `S3_API`, `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `BUCKET_NAME`). The "object storage" in the project name refers to this; no R2 client code exists yet — wiring it up is greenfield.
- **Database:** Drizzle ORM + `pg` (Postgres). `DATABASE_URL` in `.env`. No `drizzle.config.ts` or schema directory exists yet; create them when adding DB code (drizzle-kit looks for `drizzle.config.ts` at repo root by default).
- **Styling:** Tailwind CSS v4 via `@tailwindcss/postcss` (no `tailwind.config.*` — config lives in CSS). Entry: `src/styles/globals.css`, which `@import`s `theme.css` + `typography.css` and registers plugins (`@tailwindcss/typography`, `tailwindcss-react-aria-components`, `tailwindcss-animate`). Custom variants `dark`, `label`, `focus-input-within` are declared there. Use `cx` from `src/utils/cx.ts` (an extended `tailwind-merge`) for conditional classes, and `sortCx` to keep class strings sortable inside style objects.
- **UI primitives:** Built on `react-aria-components` (React Aria). `src/providers/route-provider.tsx` wires Next's router into `RouterProvider` so Aria `<Link>`/navigation use Next routing — keep this in `app/layout.tsx` above `ThemeProvider`.
- **Theming:** `next-themes` with `attribute="class"` and custom class values `light-mode` / `dark-mode` (not the default `light`/`dark`). The `dark:` variant in `globals.css` is bound to `.dark-mode` — Tailwind's default `dark:` won't work without this mapping.
- **Component library:** `src/components/` follows the Untitled UI layout (`base/`, `application/`, `foundations/`, `shared-assets/`). New components should match this taxonomy. The `untitledui` MCP server is available for fetching/searching components and icons.

**Path alias:** `@/*` → `src/*` (configured in `tsconfig.json`).

**Secrets note:** `.env` is checked into the working tree and contains live R2 credentials. Do not commit it (`.gitignore` already excludes `.env*`); treat values in it as sensitive.
