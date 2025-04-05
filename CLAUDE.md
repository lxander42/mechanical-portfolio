# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands
- Build: `npm run build`
- Start development server: `npm run start` or `ng serve`
- Test all: `npm run test`
- Test single component: `ng test --include=src/app/path/to/component`
- Serve SSR: `npm run serve:ssr:mechanical-portfolio`

## Code Style Guidelines
- **Angular Version:** 18.x with standalone components
- **TypeScript:** Strict mode enabled, follow existing typing patterns
- **Imports:** Group by source (Angular core, third-party, local)
- **Component Structure:** `selector`, `standalone: true`, `imports`, `templateUrl`, `styleUrls`
- **CSS:** Uses Tailwind CSS, follow existing class patterns
- **Three.js:** For 3D models, follow existing pattern with separate initialization and animation
- **Error Handling:** Use try/catch for async operations, console.error for errors
- **Testing:** Use Jasmine for unit tests, TestBed for component testing