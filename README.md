# Mechanical Portfolio

An Angular-powered portfolio that presents engineering work using an ASME-inspired blueprint layout. The application is designed
so future updates (human or AI-assisted) are easy to plan and implement.

## Quick Start

1. Install dependencies: `npm install`
2. Run the dev server: `npm start`
3. Open `http://localhost:4200` in your browser

> **Node.js 18+** and **Angular CLI 18.2.10** are recommended. MongoDB is optional—no database is required to run the current UI.

## Architecture Highlights

- **Blueprint layout shell** (`BlueprintLayoutComponent`) draws the borders, markers, and navigation block.
- **Single source of truth for sections** (`PORTFOLIO_SECTIONS`) keeps navigation, 3D hotspots, and route configuration in sync.
- **Reusable 3D model viewer** (`ModelViewerComponent`) supports both the procedural placeholder and custom Blender exports in
  glTF format.
- **Standalone route components** (`about`, `resume`, `portfolio`, `wiki`) populate the detail panel and reuse shared content
  styles from `src/styles.css`.

See [`src/docs/ARCHITECTURE.md`](src/docs/ARCHITECTURE.md) for a full tour of the folder structure and recommended workflow.

## Customising the Portfolio

### Update Sections & Navigation

1. Edit `src/app/core/data/portfolio-sections.ts` to add or rename sections.
2. Update `src/app/app.routes.ts` if you add new routes.
3. Create or edit the component under `src/app/<section-name>/` to change the detail content.

### Replace the 3D Model

1. Export a `.glb` file from Blender following [`THREE-MODEL-GUIDE.md`](src/docs/THREE-MODEL-GUIDE.md).
2. Copy the file into `assets/models/`.
3. Point `<app-model-viewer>` at the file via the `modelUrl` input in
   `src/app/core/layout/blueprint-layout.component.html`.
4. Ensure mesh names in Blender match the `meshName` in `PORTFOLIO_SECTIONS` so clicks route correctly.

### Add a New Feature Panel

1. Generate a standalone component (`ng generate component feature-name --standalone`).
2. Place shared models/configuration under `src/app/core` and reusable widgets under `src/app/features`.
3. Import the component into the relevant route or update the layout to expose it.
4. Document the change in `/src/docs` so future contributors understand the design.

## Available Scripts

| Command | Description |
| --- | --- |
| `npm start` | Run the dev server with live reload (`ng serve`). |
| `npm run build` | Produce an optimised production build. |
| `npm test` | Execute the Angular unit test suite. |

## Documentation

- [`src/docs/ARCHITECTURE.md`](src/docs/ARCHITECTURE.md): explains project layout and contribution flow.
- [`src/docs/THREE-MODEL-GUIDE.md`](src/docs/THREE-MODEL-GUIDE.md): how to prepare and wire 3D assets exported from Blender.
- [`assets/models/README.md`](assets/models/README.md): quick reference for storing model files.

## Need Help?

When asking for new features or bug fixes, share:

- The desired outcome and how it should behave.
- Relevant files (component, service, data config).
- Screenshots or screen recordings when visual changes are involved.

The clearer the request, the easier it is to implement future updates.
