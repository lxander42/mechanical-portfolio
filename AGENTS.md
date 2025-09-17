# AGENTS.md

This file provides guidance for AI assistants working in the `mechanical-portfolio` repository.

## Development workflow
- The project is an Angular 18 standalone-component app. Use the Angular CLI commands exposed in `package.json` (`npm run start`, `npm run build`, `npm run test`).
- Prefer running `npm run build` before submitting changes to make sure the project stays deployable on Vercel.
- Node modules are already installed in the workspace; do not reinstall unless dependencies actually change.

## Code style
- TypeScript: keep standalone components, follow Angular style conventions, and favour single quotes.
- Formatting: default Angular/Tailwind conventions (2-space indentation) and trim trailing whitespace.
- Keep imports ordered: Angular packages first, then third-party libraries, then local files.

## 3D viewer specifics
- The interactive cube loads `src/assets/model.obj` through the `OBJLoader` from `three-stdlib`.
- Explosion/implosion behaviour relies on `@tweenjs/tween.js`; make sure any updates continue to toggle correctly on click.

## Testing notes
- When in doubt about functionality, run `npm run test` for unit tests and `npm run build` for an end-to-end verification.
- Vercel uses the production build, so a successful `npm run build` locally is a good proxy for deployment readiness.
