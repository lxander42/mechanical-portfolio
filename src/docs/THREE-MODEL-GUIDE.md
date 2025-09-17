# 3D Model Workflow

The portfolio ships with a procedural placeholder model so the interface works out of the box. Replace it with your own glTF
export from Blender whenever you are ready.

## Export Checklist

1. **Organise the scene**
   - Create a collection per section (`About`, `Resume`, etc.).
   - Name the meshes using lowercase, dash-separated names (`about`, `resume`). These names should match the `meshName`
     property in `PORTFOLIO_SECTIONS`.
2. **Apply transforms**
   - Select all objects and run `Ctrl + A` → _Apply All Transforms_ so scale and rotation are baked in.
3. **Set the origin**
   - Place the model near the world origin (0, 0, 0). The camera looks at the origin, so the model will be perfectly centred.
4. **Export as glTF Binary**
   - File → Export → _glTF 2.0_.
   - Format: `glTF Binary (.glb)`.
   - Include: `+Y Up`, `Apply Modifiers`, `Animation` (if needed).
   - Destination: `assets/models/your-model.glb`.

## Wiring the Model into the App

1. Copy the exported `.glb` (and textures if any) into `assets/models/`.
2. Edit `blueprint-layout.component.html` to pass the file path:
   ```html
   <app-model-viewer
     [sections]="sections"
     modelUrl="assets/models/portfolio.glb"
     (sectionActivated)="handleSectionActivated($event)"
   ></app-model-viewer>
   ```
3. Update `PORTFOLIO_SECTIONS` if you changed the section names or added new ones.
4. Run `npm start` and verify that clicking each mesh routes to the correct page.

## Working with Animations

- Any animation clips exported with the glTF file are played automatically when the scene loads.
- To control animations manually, extend `ModelViewerComponent` by injecting your own strategy. The component exposes the
  `mixer` instance, so you can call `mixer.clipAction('AnimationName').play()` once the model is loaded.

## Troubleshooting

| Issue | Fix |
| --- | --- |
| Model appears too small/large | Adjust the scale before export or change the camera position in `ModelViewerComponent`. |
| Clicks do not trigger navigation | Ensure mesh names match `meshName` exactly (case-insensitive, dashes preferred). |
| Textures missing | Copy texture folders into `assets/models` and ensure relative paths are preserved. |
| Placeholder still visible | Double-check the `modelUrl` input. If the file fails to load, an error is logged to the browser console. |

With these steps you can iterate on the 3D experience without touching Angular or TypeScript code.
