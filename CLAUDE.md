# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands
- Build: `ng build`
- Serve: `ng serve`
- Test all: `ng test`
- Test single: `ng test --include=src/app/path/to/component.spec.ts`
- Lint: Not configured (consider adding ESLint)

## WSL Development Notes
- Project path: `/mnt/c/mechanical-portfolio`
- File paths use forward slashes (/) even when referencing Windows paths
- Use npm/Node from WSL, not Windows
- Watch for file permission issues between WSL and Windows

## Code Style Guidelines
- TypeScript: Use strict mode, single quotes, explicit return types
- Formatting: 2-space indentation, trim trailing whitespace
- Components: Use standalone components, implement lifecycle interfaces
- Imports: Group Angular imports first, then third-party, then application
- Error Handling: Use try/catch with console.error in services
- Naming: Use kebab-case for files, PascalCase for classes, camelCase for methods
- CSS: Use Tailwind utility classes, follow blueprint-like styling
- 3D: Three.js library for 3D model rendering and animations