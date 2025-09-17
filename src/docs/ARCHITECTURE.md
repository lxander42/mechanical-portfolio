# Mechanical Portfolio Architecture Guide

This document explains how the Angular application is organised and how to extend it with new features. It is aimed at both
human contributors and AI assistants.

## High-Level Structure

```
src/
  app/
    core/            # Layout shell, navigation data, app-wide models
    features/        # Self-contained UI features (e.g. 3D model viewer)
    three-model/     # Thin wrapper around the Three.js viewer for layout compatibility
    about/           # Feature routes rendered inside the layout shell
    resume/
    portfolio/
    wiki/
  assets/            # Static files served with the app
  docs/              # Project documentation (architecture, 3D modelling guide)
```

- **Core** hosts building blocks that are used throughout the application, such as the blueprint layout shell and shared data
  (navigation links, section metadata).
- **Features** contains reusable widgets. The 3D `ModelViewerComponent` lives here so it can be swapped or reused without
  touching layout code.
- **Route folders** (`about`, `resume`, etc.) contain standalone Angular components that populate the detail panel beneath the
  3D view.

## Layout & Navigation Flow

1. `AppComponent` renders `<app-blueprint-layout>`.
2. `BlueprintLayoutComponent` draws the ASME-inspired frame, renders the `ThreeModelComponent` wrapper (which hosts the reusable
   `ModelViewerComponent`) and the navigation block, and
   exposes a `<router-outlet>` for the active section content.
3. Sections are defined once in `core/data/portfolio-sections.ts`. The same data powers:
   - Navigation links on the right-hand side.
   - 3D hotspots in the `ModelViewerComponent`.
   - Any future features that need to list or lookup sections.

Updating `PORTFOLIO_SECTIONS` keeps the UI consistent automatically.

## Adding a New Section

1. **Create the route component**
   ```bash
   ng generate component new-section --standalone --flat --path=src/app
   ```
2. **Register the route** in `app.routes.ts`:
   ```ts
   { path: 'new-section', component: NewSectionComponent }
   ```
3. **Add metadata** to `core/data/portfolio-sections.ts`:
   ```ts
   {
     id: 'new-section',
     label: 'New Section',
     route: '/new-section',
     meshName: 'new-section',
     description: 'Short summary for the navigation panel.'
   }
   ```
4. **Name a mesh** in Blender (or the procedural placeholder) with the same `meshName` to enable click-through navigation from
   the 3D model.

That is all—navigation, layout, and model hotspots will automatically discover the new section.

## Working with the 3D Model

- The `ThreeModelComponent` passes inputs through to the underlying `ModelViewerComponent`. Set the optional `modelUrl`
  binding to load a glTF (`.glb`/`.gltf`) file from `assets/models`. Without a file, a procedural placeholder is shown so the
  UI remains functional.
- `ThreeModelComponent` also exposes `autoRotateSpeed` so you can adjust or disable the placeholder animation directly from the
  layout.
- Mesh names (from Blender) are matched against the `meshName` in `PORTFOLIO_SECTIONS`. When a user clicks a mesh the
  corresponding route is activated.
- Animations inside the glTF file are played automatically via `THREE.AnimationMixer`.

See [`THREE-MODEL-GUIDE.md`](./THREE-MODEL-GUIDE.md) for export and naming tips.

## Styling & Content

- Shared typography/layout styles live in `src/styles.css`. Section components use the `.content-section` utility classes so
  content stays visually consistent.
- The blueprint layout CSS is scoped to `BlueprintLayoutComponent`, making it easy to adjust markers or border styles without
  affecting the rest of the application.

## Recommended Workflow for New Features

1. **Plan** the change in `/src/docs` so future contributors can follow the reasoning.
2. **Define data** (interfaces, configuration objects) under `core/`.
3. **Implement UI or logic** inside a dedicated `features/` subfolder when the code might be reused.
4. **Expose** the feature through the blueprint layout or a route component.
5. **Document** the change in `README.md` and update any relevant guide.

Following this structure keeps the project approachable for newcomers and for AI-assisted updates.
