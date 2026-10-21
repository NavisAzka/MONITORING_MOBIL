# Repository Guidelines

## Project Structure & Module Organization

The Next.js application lives in `src/app/` (routes and global styles), `src/components/` (client UI and map), and `src/lib/` (authentication and fleet/GPS logic). `OpenAPI.pdf` at the root is the Maxtracker API reference. `.data/` is runtime-only local assignment storage and must not be committed. No automated test suite is configured yet.

## Build, Test, and Development Commands

Run `npm install` to install dependencies, `npm run dev` for local development, `npm run build` for a production build, `npm start` to serve that build, and `npm run lint` for ESLint. See `README.md` for local demo accounts and Maxtracker configuration.

## Coding Style & Naming Conventions

Use TypeScript with 2-space indentation, React components in PascalCase, and utility modules in camelCase. Keep server-only credentials and GPS calls in `src/lib/` or API routes; never expose the Maxtracker token to client components. Preserve the source OpenAPI PDF unchanged unless a replacement reference is intentionally supplied.

## Testing Guidelines

No automated tests or coverage requirement are configured yet. Run `npm run lint` and `npm run build` before submitting application changes. Add focused tests when a test framework is introduced, especially for exclusive vehicle assignment, role access, and stale GPS handling.

## Commit & Pull Request Guidelines

Git history is not available in the current checkout, so no repository-specific commit convention can be confirmed. Use concise, imperative commit subjects that describe one change (for example, `Document API setup`). Pull requests should explain the change and its purpose, list relevant validation commands and results, link related issues when applicable, and include screenshots only for user-visible changes.

## Security & Configuration Tips

Do not commit credentials, access tokens, or machine-specific configuration. Keep secrets in environment variables or an appropriate local, ignored configuration file. Treat API definitions and examples as potentially sensitive and check them before publishing changes.


<claude-mem-context>
# Memory Context

# [MONITORING_MOBIL] recent context, 2026-10-19 10:35am GMT+7

No previous sessions found.
</claude-mem-context>