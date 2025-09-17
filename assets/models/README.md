# 3D Model Assets

Place exported `.glb` or `.gltf` files from Blender in this directory. Keep textures inside the same folder so Angular can
serve them without additional configuration. A typical structure is:

```
assets/
  models/
    portfolio.glb
    portfolio-textures/
      baseColor.png
      normal.png
```

Update the `modelUrl` input of `ModelViewerComponent` (used in
`src/app/core/layout/blueprint-layout.component.html`) to point at your exported file, for example:

```html
<app-model-viewer
  [sections]="sections"
  modelUrl="assets/models/portfolio.glb"
  (sectionActivated)="handleSectionActivated($event)"
></app-model-viewer>
```

The component will automatically map mesh names to the entries defined in `PORTFOLIO_SECTIONS`. Make sure the mesh names in
Blender (or the names you assign in the glTF export) match the `meshName` property for each section.
