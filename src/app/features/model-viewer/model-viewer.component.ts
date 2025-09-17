import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  Input,
  NgZone,
  OnDestroy,
  Output,
  PLATFORM_ID,
  ViewChild
} from '@angular/core';
import * as THREE from 'three';
import { GLTFLoader } from 'three-stdlib';
import { PortfolioSection } from '../../core/models/portfolio-section';

@Component({
  selector: 'app-model-viewer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './model-viewer.component.html',
  styleUrls: ['./model-viewer.component.css']
})
export class ModelViewerComponent implements AfterViewInit, OnDestroy {
  /**
   * Sections that should be represented as hotspots in the viewer. Each entry
   * is automatically matched with an object inside the 3D scene.
   */
  @Input() sections: readonly PortfolioSection[] = [];

  /**
   * Optional URL to a glTF (.glb/.gltf) asset exported from Blender. When not
   * provided the component will render a procedural placeholder so the layout
   * remains interactive.
   */
  @Input() modelUrl?: string;

  /** Controls how fast the placeholder model rotates (radians per second). */
  @Input() autoRotateSpeed = 0.25;

  /** Emits whenever a hotspot is clicked. */
  @Output() readonly sectionActivated = new EventEmitter<PortfolioSection>();

  @ViewChild('canvasContainer', { static: true })
  private readonly canvasContainer?: ElementRef<HTMLDivElement>;

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private mixer?: THREE.AnimationMixer;
  private resizeObserver?: ResizeObserver;
  private animationFrameId?: number;
  private readonly clock = new THREE.Clock();
  private readonly pointer = new THREE.Vector2();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pickTargets: THREE.Object3D[] = [];
  private hoveredMesh?: THREE.Mesh;
  private readonly rootGroup = new THREE.Group();

  constructor(
    private readonly ngZone: NgZone,
    @Inject(PLATFORM_ID) private readonly platformId: object
  ) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId) || !this.canvasContainer) {
      return;
    }

    this.initScene();

    if (this.modelUrl) {
      this.loadGltfModel(this.modelUrl);
    } else {
      this.buildProceduralModel();
    }

    this.attachEventListeners();
    this.startRenderingLoop();
  }

  ngOnDestroy(): void {
    this.detachEventListeners();
    this.disposeScene();
  }

  private initScene(): void {
    const container = this.canvasContainer!.nativeElement;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#f8fafc');

    const { clientWidth, clientHeight } = container;
    const aspectRatio = clientWidth / clientHeight || 1;

    this.camera = new THREE.PerspectiveCamera(45, aspectRatio, 0.1, 100);
    this.camera.position.set(6, 5, 6);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(clientWidth, clientHeight, false);
    container.appendChild(this.renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    const directional = new THREE.DirectionalLight(0xffffff, 0.6);
    directional.position.set(5, 10, 7.5);

    this.scene.add(ambient);
    this.scene.add(directional);

    const grid = new THREE.GridHelper(16, 16, 0x1f2937, 0x94a3b8);
    grid.position.y = -2.5;
    this.scene.add(grid);

    this.scene.add(this.rootGroup);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.onResize());
      this.resizeObserver.observe(container);
    }
  }

  private buildProceduralModel(): void {
    if (!this.scene) {
      return;
    }

    this.clearPickTargets();
    this.rootGroup.clear();

    const sections = this.sections.length > 0 ? this.sections : [{
      id: 'placeholder',
      label: 'Placeholder',
      route: '/',
      meshName: 'placeholder'
    }];

    const radius = 2.8;
    const height = 1.2;
    const baseColor = new THREE.Color('#0f172a');
    const accentColor = new THREE.Color('#38bdf8');

    sections.forEach((section, index) => {
      const geometry = new THREE.BoxGeometry(1.8, height, 1.8);
      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: 0x000000,
        metalness: 0.2,
        roughness: 0.7
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.name = section.meshName ?? section.id;

      const angle = (index / sections.length) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * radius, height / 2, Math.sin(angle) * radius);
      mesh.userData['section'] = section;

      const accentEdge = new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry),
        new THREE.LineBasicMaterial({ color: accentColor })
      );
      mesh.add(accentEdge);

      this.rootGroup.add(mesh);
      this.pickTargets.push(mesh);
    });

    const platformGeometry = new THREE.CylinderGeometry(radius + 0.8, radius + 0.8, 0.2, 64);
    const platformMaterial = new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.1 });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = 0;
    this.rootGroup.add(platform);
  }

  private loadGltfModel(url: string): void {
    if (!this.scene) {
      return;
    }

    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        this.clearPickTargets();

        const root = gltf.scene;
        const boundingBox = new THREE.Box3().setFromObject(root);
        const center = boundingBox.getCenter(new THREE.Vector3());
        root.position.sub(center);

        const size = boundingBox.getSize(new THREE.Vector3());
        const maxDimension = Math.max(size.x, size.y, size.z);
        if (maxDimension > 0) {
          const scale = 6 / maxDimension;
          root.scale.multiplyScalar(scale);
        }
        root.traverse((object) => {
          if ((object as THREE.Mesh).isMesh) {
            const mesh = object as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            const section = this.findSectionForObject(mesh.name);
            if (section) {
              mesh.userData['section'] = section;
              this.pickTargets.push(mesh);
            }
          }
        });

        this.rootGroup.clear();
        this.rootGroup.add(root);

        if (gltf.animations.length > 0) {
          this.mixer = new THREE.AnimationMixer(root);
          gltf.animations.forEach((clip) => {
            const action = this.mixer!.clipAction(clip);
            action.play();
          });
        }
      },
      undefined,
      (error) => console.error('Failed to load glTF model', error)
    );
  }

  private findSectionForObject(objectName: string): PortfolioSection | undefined {
    const normalisedObjectName = this.normaliseName(objectName);
    return this.sections.find((section) => {
      const candidate = this.normaliseName(section.meshName ?? section.id);
      return candidate === normalisedObjectName;
    });
  }

  private normaliseName(value: string | undefined): string {
    return (value ?? '').trim().toLowerCase().replace(/\s+/g, '-');
  }

  private attachEventListeners(): void {
    const container = this.canvasContainer?.nativeElement;
    if (!container || !this.renderer || !this.camera) {
      return;
    }

    container.addEventListener('pointermove', this.onPointerMove);
    container.addEventListener('click', this.onPointerClick);
  }

  private detachEventListeners(): void {
    const container = this.canvasContainer?.nativeElement;
    if (!container) {
      return;
    }

    container.removeEventListener('pointermove', this.onPointerMove);
    container.removeEventListener('click', this.onPointerClick);
    this.resizeObserver?.disconnect();
  }

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.camera || !this.canvasContainer) {
      return;
    }

    this.updatePointerPosition(event);

    const intersections = this.raycaster.intersectObjects(this.pickTargets, true);
    const firstMesh = intersections.find((intersection) => (intersection.object as THREE.Mesh).isMesh)?.object as
      | THREE.Mesh
      | undefined;

    this.handleHover(firstMesh);
  };

  private readonly onPointerClick = (event: MouseEvent): void => {
    if (!this.camera || !this.canvasContainer) {
      return;
    }

    this.updatePointerPosition(event);

    const intersections = this.raycaster.intersectObjects(this.pickTargets, true);
    const target = intersections.find((intersection) => intersection.object.userData['section'])?.object.userData[
      'section'
    ] as PortfolioSection | undefined;

    if (target) {
      this.sectionActivated.emit(target);
    }
  };

  private updatePointerPosition(event: MouseEvent | PointerEvent): void {
    if (!this.camera || !this.canvasContainer) {
      return;
    }

    const bounds = this.canvasContainer.nativeElement.getBoundingClientRect();
    this.pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private handleHover(nextMesh?: THREE.Mesh): void {
    if (this.hoveredMesh && this.hoveredMesh !== nextMesh) {
      this.resetMeshAppearance(this.hoveredMesh);
    }

    if (nextMesh && this.hoveredMesh !== nextMesh) {
      this.highlightMesh(nextMesh);
    }

    this.hoveredMesh = nextMesh;
  }

  private startRenderingLoop(): void {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      const animate = () => {
        const delta = this.clock.getDelta();

        if (this.autoRotateSpeed && this.rootGroup.children.length > 0) {
          this.rootGroup.rotation.y += delta * this.autoRotateSpeed;
        }

        this.mixer?.update(delta);
        this.renderer!.render(this.scene!, this.camera!);
        this.animationFrameId = requestAnimationFrame(animate);
      };

      animate();
    });
  }

  private onResize(): void {
    if (!this.renderer || !this.camera || !this.canvasContainer) {
      return;
    }

    const container = this.canvasContainer.nativeElement;
    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height || 1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private disposeScene(): void {
    if (this.animationFrameId !== undefined) {
      cancelAnimationFrame(this.animationFrameId);
    }

    if (this.renderer && this.canvasContainer) {
      this.canvasContainer.nativeElement.removeChild(this.renderer.domElement);
      this.renderer.dispose();
    }
    this.renderer = undefined;
    this.scene = undefined;
    this.camera = undefined;
    this.hoveredMesh = undefined;
    this.clearPickTargets();
  }

  private clearPickTargets(): void {
    this.pickTargets.length = 0;
  }

  private highlightMesh(mesh: THREE.Mesh): void {
    mesh.scale.set(1.05, 1.05, 1.05);
    this.applyEmissiveColor(mesh, 0x1d4ed8);
  }

  private resetMeshAppearance(mesh: THREE.Mesh): void {
    mesh.scale.set(1, 1, 1);
    this.applyEmissiveColor(mesh, 0x000000);
  }

  private applyEmissiveColor(mesh: THREE.Mesh, color: number): void {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      const typed = material as THREE.MeshStandardMaterial | THREE.MeshPhongMaterial | THREE.MeshLambertMaterial;
      if ('emissive' in typed && typed.emissive) {
        typed.emissive.setHex(color);
      }
    }
  }
}
