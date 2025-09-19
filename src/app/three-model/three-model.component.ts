import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Inject,
  NgZone,
  OnDestroy,
  OnInit,
  Output,
  PLATFORM_ID
} from '@angular/core';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { Tween, Group, Easing } from '@tweenjs/tween.js';

export type SectionKey = 'about' | 'resume' | 'portfolio' | 'wiki';

export interface SectionEvent {
  key: SectionKey;
  label: string;
  description: string;
}

const NAV_TARGETS: Record<string, SectionEvent> = {
  'Body1:1': { key: 'about', label: 'About', description: 'Meet the storyteller and the practice.' },
  'Body1': { key: 'resume', label: 'Resume', description: 'Review experience, skills, and accolades.' },
  'Body1:2': { key: 'wiki', label: 'Wiki', description: 'Explore ongoing research, notes, and ideas.' },
  'Body1:3': { key: 'portfolio', label: 'Portfolio', description: 'Dive into selected projects and case studies.' }
};

@Component({
  selector: 'app-three-model',
  standalone: true,
  templateUrl: './three-model.component.html',
  styleUrls: ['./three-model.component.css']
})
export class ThreeModelComponent implements OnInit, AfterViewInit, OnDestroy {
  @Output() sectionFocus = new EventEmitter<SectionEvent>();
  @Output() sectionReveal = new EventEmitter<SectionEvent>();

  private scene!: THREE.Scene;
  private camera!: THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private model!: THREE.Object3D;
  private isExploded = false;
  private tweenGroup = new Group();
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private container!: HTMLElement;
  private canvasEl!: HTMLCanvasElement;
  private labelElement!: HTMLDivElement;
  private labelTitleEl!: HTMLSpanElement;
  private labelBodyEl!: HTMLParagraphElement;
  private hoveredMesh: THREE.Mesh | null = null;
  private activeMesh: THREE.Mesh | null = null;
  private navMeshes: THREE.Mesh[] = [];
  private animationFrameId = 0;
  private resizeListener?: () => void;
  private detachFns: Array<() => void> = [];
  private clock = new THREE.Clock();
  private selectionInProgress = false;
  private boundingBox = new THREE.Box3();
  private boundingSphere = new THREE.Sphere();
  private modelCenter = new THREE.Vector3();
  private cameraDirection = new THREE.Vector3(1, 1, 1).normalize();
  private sceneRadius = 1;
  private readonly framePadding = 1.5;
  private readonly targetFill = 0.48;
  private readonly distanceMultiplier = 2.85;
  private tempVector = new THREE.Vector3();
  private scaleVector = new THREE.Vector3();
  private recenterPending = false;

  constructor(
    private el: ElementRef,
    private ngZone: NgZone,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  ngOnInit(): void {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.container = this.el.nativeElement.querySelector('#three-container');

    this.ngZone.runOutsideAngular(() => {
      this.initScene();
      this.loadModel();
      this.createLabel();
      this.attachPointerEvents();
      this.animate();
    });
  }

  ngOnDestroy(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.detachFns.forEach((remove) => remove());
    this.detachFns = [];

    if (this.resizeListener) {
      window.removeEventListener('resize', this.resizeListener);
    }

    cancelAnimationFrame(this.animationFrameId);
    this.renderer?.dispose();
  }

  resetSelection(): void {
    if (!this.model) {
      return;
    }

    this.hoveredMesh = null;
    this.updateHoverAppearance();

    const mesh = this.activeMesh;
    this.activeMesh = null;

    if (!mesh) {
      this.setExploded(true);
      this.recenterPending = true;
      return;
    }

    mesh.visible = true;
    mesh.userData['fixedScale'] = true;
    const originalPosition = (mesh.userData['originalPosition'] as THREE.Vector3).clone();
    const baseScale = (mesh.userData['baseScale'] as THREE.Vector3).clone();
    const baseRotation = mesh.userData['baseRotation'] as THREE.Euler | undefined;
    const material = mesh.material as THREE.MeshBasicMaterial;
    const edgeLines = mesh.userData['edgeLines'] as THREE.LineSegments | undefined;
    const edgeMaterial = mesh.userData['edgeMaterial'] as THREE.ShaderMaterial | undefined;

    const otherMeshes = this.navMeshes.filter((candidate) => candidate !== mesh);

    for (const other of otherMeshes) {
      other.visible = true;
      const otherMaterial = other.material as THREE.MeshBasicMaterial;
      const otherEdgeMaterial = other.userData['edgeMaterial'] as THREE.ShaderMaterial | undefined;
      const otherEdgeLines = other.userData['edgeLines'] as THREE.LineSegments | undefined;
      const otherBaseScale = other.userData['baseScale'] as THREE.Vector3 | undefined;
      other.userData['fixedScale'] = false;

      if (otherBaseScale) {
        other.scale.copy(otherBaseScale);
      }

      if (otherEdgeLines) {
        otherEdgeLines.visible = true;
      }

      otherMaterial.opacity = 0;
      if (otherEdgeMaterial) {
        otherEdgeMaterial.uniforms['lineOpacity'].value = 0;
      }

      new Tween({ opacity: otherMaterial.opacity }, this.tweenGroup)
        .to({ opacity: 1 }, 450)
        .easing(Easing.Cubic.Out)
        .onUpdate(({ opacity }) => {
          otherMaterial.opacity = opacity;
          if (otherEdgeMaterial) {
            otherEdgeMaterial.uniforms['lineOpacity'].value = opacity;
          }
        })
        .start();
    }

    new Tween(mesh.position, this.tweenGroup)
      .to({ x: originalPosition.x, y: originalPosition.y, z: originalPosition.z }, 800)
      .easing(Easing.Cubic.Out)
      .start();

    const scaleData = { value: mesh.scale.x / baseScale.x };
    new Tween(scaleData, this.tweenGroup)
      .to({ value: 1 }, 600)
      .easing(Easing.Cubic.Out)
      .onUpdate(({ value }) => {
        mesh.scale.set(baseScale.x * value, baseScale.y * value, baseScale.z * value);
      })
      .onComplete(() => {
        mesh.userData['fixedScale'] = false;
      })
      .start();

    new Tween({ opacity: material.opacity }, this.tweenGroup)
      .to({ opacity: 1 }, 400)
      .easing(Easing.Cubic.Out)
      .onUpdate(({ opacity }) => {
        material.opacity = opacity;
        if (edgeMaterial) {
          edgeMaterial.uniforms['lineOpacity'].value = opacity;
        }
      })
      .onComplete(() => {
        if (edgeLines) {
          edgeLines.visible = true;
        }
        if (baseRotation) {
          mesh.rotation.copy(baseRotation);
        }
      })
      .start();

    this.selectionInProgress = false;
    this.setExploded(true);
    this.recenterPending = true;
  }

  private initScene(): void {
    this.scene = new THREE.Scene();

    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;
    const aspect = width / height;
    const safeRadius = Math.max(this.sceneRadius, 1);

    this.camera = new THREE.OrthographicCamera(
      (-safeRadius * aspect),
      safeRadius * aspect,
      safeRadius,
      -safeRadius,
      0.1,
      1000
    );

    this.tempVector
      .copy(this.cameraDirection)
      .multiplyScalar(safeRadius * 3);
    this.camera.position.copy(this.tempVector);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0xffffff, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x333333, 0.7);
    this.scene.add(ambientLight);

    this.canvasEl = this.renderer.domElement;

    this.resizeListener = () => this.onWindowResize();
    window.addEventListener('resize', this.resizeListener);
    this.onWindowResize();
  }

  private onWindowResize(): void {
    if (!this.renderer || !this.camera || !this.container) {
      return;
    }

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) {
      return;
    }

    this.renderer.setSize(width, height, false);
    this.updateCameraFrustum(width, height);
  }

  private updateCameraFrustum(width?: number, height?: number): void {
    if (!this.camera || !this.container) {
      return;
    }

    const viewWidth = width ?? this.container.clientWidth;
    const viewHeight = height ?? this.container.clientHeight;
    if (viewWidth === 0 || viewHeight === 0) {
      return;
    }

    const radius = Math.max(this.sceneRadius, 1);
    const aspect = viewWidth / viewHeight;
    const verticalFill = this.targetFill;
    const halfSize = radius / verticalFill;

    this.camera.left = -halfSize * aspect;
    this.camera.right = halfSize * aspect;
    this.camera.top = halfSize;
    this.camera.bottom = -halfSize;
    this.camera.updateProjectionMatrix();

    const distance = radius * this.distanceMultiplier;
    this.tempVector.copy(this.cameraDirection).multiplyScalar(distance);
    this.camera.position.copy(this.tempVector);
    this.camera.lookAt(0, 0, 0);
  }

  private recenterAndFrameModel(force = false): boolean {
    if (!this.model || !this.camera) {
      return false;
    }

    if ((this.selectionInProgress || this.hoveredMesh || this.activeMesh) && !force) {
      return false;
    }

    if (!force && this.tweenGroup.getAll().length > 0) {
      return false;
    }

    this.model.updateMatrixWorld(true);
    this.boundingBox.setFromObject(this.model);
    if (this.boundingBox.isEmpty()) {
      return false;
    }

    this.boundingBox.getCenter(this.modelCenter);
    if (
      !Number.isFinite(this.modelCenter.x) ||
      !Number.isFinite(this.modelCenter.y) ||
      !Number.isFinite(this.modelCenter.z)
    ) {
      return false;
    }

    if (this.modelCenter.lengthSq() > 1e-6) {
      this.model.position.sub(this.modelCenter);
      this.model.updateMatrixWorld(true);
    }

    this.boundingBox.setFromObject(this.model);
    this.boundingBox.getBoundingSphere(this.boundingSphere);
    if (!Number.isFinite(this.boundingSphere.radius) || this.boundingSphere.radius <= 0) {
      return false;
    }

    const normalizedRadius = Math.max(this.boundingSphere.radius, 1);
    const diameter = normalizedRadius * 2;
    const padding = Math.max(diameter * 0.45, this.framePadding);
    this.sceneRadius = normalizedRadius + padding;

    this.updateCameraFrustum();
    return true;
  }

  private loadModel(): void {
    const loader = new OBJLoader();
    const modelPath = `${this.document.location.origin}/assets/model.obj`;

    loader.load(
      modelPath,
      (obj) => {
        this.model = obj;
        this.model.rotation.z = Math.PI / 2;
        this.model.scale.set(0.25, 0.25, 0.25);

        this.navMeshes = [];

        this.model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
            child.material = material;

            const isNavTarget = Boolean(NAV_TARGETS[child.name]);

            if (!child.geometry.boundingBox) {
              child.geometry.computeBoundingBox();
            }

            if (isNavTarget && child.geometry.boundingBox) {
              const center = child.geometry.boundingBox.getCenter(new THREE.Vector3());
              if (center.lengthSq() > 1e-8) {
                child.geometry.translate(-center.x, -center.y, -center.z);
                child.position.add(center);
                child.geometry.computeBoundingBox();
                child.geometry.computeBoundingSphere();
              }
            }

            const edgesGeometry = new THREE.EdgesGeometry(child.geometry);
            const edgeMaterial = this.createEdgeMaterial();
            const edgeLines = new THREE.LineSegments(edgesGeometry, edgeMaterial);
            child.add(edgeLines);

            child.userData['edgeLines'] = edgeLines;
            child.userData['edgeMaterial'] = edgeMaterial;
            child.userData['originalPosition'] = child.position.clone();
            child.userData['baseScale'] = child.scale.clone();
            child.userData['baseRotation'] = child.rotation.clone();
            child.userData['fixedScale'] = false;

            if (isNavTarget) {
              this.navMeshes.push(child);
            }
          }
        });

        this.scene.add(this.model);
        this.recenterAndFrameModel(true);
        this.prepareExplodeAnimation();
        this.setExploded(true);
        this.recenterPending = true;
      },
      undefined,
      (error) => {
        console.error('An error occurred loading the model:', error);
      }
    );
  }

  private createEdgeMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      uniforms: {
        lineColor: { value: new THREE.Color(0x000000) },
        scaleFactor: { value: 1.005 },
        lineOpacity: { value: 1 }
      },
      vertexShader: `
        uniform float scaleFactor;
        void main() {
          vec4 pos = modelViewMatrix * vec4(position * scaleFactor, 1.0);
          pos.z -= 0.001;
          gl_Position = projectionMatrix * pos;
        }
      `,
      fragmentShader: `
        uniform vec3 lineColor;
        uniform float lineOpacity;
        void main() {
          gl_FragColor = vec4(lineColor, lineOpacity);
        }
      `,
      depthTest: true,
      depthWrite: false,
      transparent: true
    });
  }

  private prepareExplodeAnimation(): void {
    if (!this.model) {
      return;
    }

    this.model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const originalPosition = child.userData['originalPosition'] as THREE.Vector3;
      if (!originalPosition) {
        child.userData['originalPosition'] = child.position.clone();
      }

      let explodedPosition = child.position.clone();
      switch (child.name) {
        case 'Body1':
          explodedPosition = child.position.clone().add(new THREE.Vector3(0, 0, 12));
          break;
        case 'Body1:2':
          explodedPosition = child.position.clone().add(new THREE.Vector3(12, 0, 0));
          break;
        case 'Body1:3':
          explodedPosition = child.position.clone().add(new THREE.Vector3(0, -12, 0));
          break;
        default:
          explodedPosition = child.position.clone();
      }

      child.userData['tweenExplode'] = new Tween(child.position, this.tweenGroup)
        .to({ x: explodedPosition.x, y: explodedPosition.y, z: explodedPosition.z }, 1000)
        .easing(Easing.Cubic.Out);

      child.userData['tweenImplode'] = new Tween(child.position, this.tweenGroup)
        .to({ x: child.userData['originalPosition'].x, y: child.userData['originalPosition'].y, z: child.userData['originalPosition'].z }, 1000)
        .easing(Easing.Cubic.Out);
    });
  }

  private setExploded(desired: boolean): void {
    if (!this.model || this.isExploded === desired) {
      return;
    }

    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const tweenKey = desired ? 'tweenExplode' : 'tweenImplode';
        const tween: Tween<THREE.Vector3> | undefined = child.userData[tweenKey];
        if (tween) {
          tween.stop();
          tween.start();
        }
      }
    });

    this.isExploded = desired;
    this.recenterPending = true;
  }

  private attachPointerEvents(): void {
    if (!this.canvasEl) {
      return;
    }

    const moveHandler = (event: PointerEvent) => this.handlePointerMove(event);
    const leaveHandler = () => this.handlePointerLeave();
    const clickHandler = () => this.handlePointerClick();

    this.canvasEl.addEventListener('pointermove', moveHandler);
    this.canvasEl.addEventListener('pointerleave', leaveHandler);
    this.canvasEl.addEventListener('click', clickHandler);

    this.detachFns.push(() => this.canvasEl.removeEventListener('pointermove', moveHandler));
    this.detachFns.push(() => this.canvasEl.removeEventListener('pointerleave', leaveHandler));
    this.detachFns.push(() => this.canvasEl.removeEventListener('click', clickHandler));
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.model || !this.isExploded || this.selectionInProgress) {
      return;
    }

    const rect = this.canvasEl.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersections = this.raycaster.intersectObjects(this.navMeshes, false);
    const mesh = intersections.length > 0 ? (intersections[0].object as THREE.Mesh) : null;

    if (mesh !== this.hoveredMesh) {
      this.hoveredMesh = mesh;
      this.updateHoverAppearance();
    }
  }

  private handlePointerLeave(): void {
    if (!this.hoveredMesh) {
      return;
    }
    this.hoveredMesh = null;
    this.updateHoverAppearance();
  }

  private handlePointerClick(): void {
    if (!this.hoveredMesh || !this.isExploded || this.selectionInProgress) {
      return;
    }

    const config = NAV_TARGETS[this.hoveredMesh.name];
    if (!config) {
      return;
    }

    this.startSelection(this.hoveredMesh, config);
  }

  private startSelection(mesh: THREE.Mesh, config: SectionEvent): void {
    this.selectionInProgress = true;
    this.activeMesh = mesh;
    this.hoveredMesh = null;
    this.updateHoverAppearance();

    mesh.userData['fixedScale'] = true;

    const parent = mesh.parent as THREE.Object3D;
    const targetWorld = new THREE.Vector3(0, 0, 2.5);
    const targetPosition = parent.worldToLocal(targetWorld.clone());
    const baseScale = mesh.userData['baseScale'] as THREE.Vector3;
    const baseRotation = mesh.userData['baseRotation'] as THREE.Euler | undefined;
    const material = mesh.material as THREE.MeshBasicMaterial;
    const edgeMaterial = mesh.userData['edgeMaterial'] as THREE.ShaderMaterial | undefined;
    const edgeLines = mesh.userData['edgeLines'] as THREE.LineSegments | undefined;

    const otherMeshes = this.navMeshes.filter((candidate) => candidate !== mesh);

    for (const other of otherMeshes) {
      const otherMaterial = other.material as THREE.MeshBasicMaterial;
      const otherEdgeMaterial = other.userData['edgeMaterial'] as THREE.ShaderMaterial | undefined;
      const otherEdgeLines = other.userData['edgeLines'] as THREE.LineSegments | undefined;
      const otherBaseScale = other.userData['baseScale'] as THREE.Vector3 | undefined;
      other.userData['fixedScale'] = true;

      if (otherBaseScale) {
        other.scale.copy(otherBaseScale);
      }

      new Tween({ opacity: otherMaterial.opacity }, this.tweenGroup)
        .to({ opacity: 0 }, 420)
        .easing(Easing.Cubic.InOut)
        .onUpdate(({ opacity }) => {
          otherMaterial.opacity = opacity;
          if (otherEdgeMaterial) {
            otherEdgeMaterial.uniforms['lineOpacity'].value = opacity;
          }
        })
        .onComplete(() => {
          other.visible = false;
          other.userData['fixedScale'] = false;
          if (otherEdgeLines) {
            otherEdgeLines.visible = false;
          }
        })
        .start();
    }

    this.ngZone.run(() => this.sectionFocus.emit(config));

    new Tween(mesh.position, this.tweenGroup)
      .to({ x: targetPosition.x, y: targetPosition.y, z: targetPosition.z }, 850)
      .easing(Easing.Cubic.Out)
      .start();

    const scaleData = { value: 1 };
    new Tween(scaleData, this.tweenGroup)
      .to({ value: 1.6 }, 700)
      .easing(Easing.Cubic.Out)
      .onUpdate(({ value }) => {
        mesh.scale.set(baseScale.x * value, baseScale.y * value, baseScale.z * value);
      })
      .start();

    if (baseRotation) {
      mesh.rotation.copy(baseRotation);
      const rotationData = { angle: 0 };
      new Tween(rotationData, this.tweenGroup)
        .to({ angle: Math.PI * 1.5 }, 900)
        .easing(Easing.Cubic.Out)
        .onUpdate(({ angle }) => {
          mesh.rotation.y = baseRotation.y + angle;
        })
        .start();
    }

    if (edgeLines) {
      edgeLines.visible = false;
    }

    new Tween({ opacity: material.opacity }, this.tweenGroup)
      .to({ opacity: 0 }, 650)
      .delay(520)
      .easing(Easing.Cubic.In)
      .onUpdate(({ opacity }) => {
        material.opacity = opacity;
        if (edgeMaterial) {
          edgeMaterial.uniforms['lineOpacity'].value = opacity;
        }
      })
      .onComplete(() => {
        mesh.visible = false;
        this.selectionInProgress = false;
        this.ngZone.run(() => this.sectionReveal.emit(config));
      })
      .start();
  }

  private updateHoverAppearance(): void {
    if (!this.canvasEl) {
      return;
    }

    if (this.hoveredMesh && this.isExploded && !this.selectionInProgress) {
      this.canvasEl.style.cursor = 'pointer';
    } else {
      this.canvasEl.style.cursor = 'default';
    }

    if (!this.labelElement || !this.labelTitleEl || !this.labelBodyEl) {
      return;
    }

    if (!this.hoveredMesh) {
      this.labelElement.style.opacity = '0';
      return;
    }

    const config = NAV_TARGETS[this.hoveredMesh.name];
    if (!config) {
      this.labelElement.style.opacity = '0';
      return;
    }

    this.labelTitleEl.textContent = config.label;
    this.labelBodyEl.textContent = config.description;
    this.labelElement.style.opacity = '1';
  }

  private updateLabelPosition(): void {
    if (!this.hoveredMesh || !this.labelElement) {
      return;
    }

    const vector = new THREE.Vector3();
    this.hoveredMesh.getWorldPosition(vector);
    vector.project(this.camera);

    const rect = this.canvasEl.getBoundingClientRect();
    const x = ((vector.x + 1) / 2) * rect.width;
    const y = ((-vector.y + 1) / 2) * rect.height;
    const offset = 36;
    const margin = 32;

    const clampedX = Math.min(Math.max(x, margin), rect.width - margin);
    const clampedY = Math.min(Math.max(y - offset, margin), rect.height - margin);

    this.labelElement.style.left = `${clampedX}px`;
    this.labelElement.style.top = `${clampedY}px`;
    this.labelElement.style.transform = 'translate(-50%, -100%)';
  }

  private createLabel(): void {
    this.labelElement = this.document.createElement('div');
    this.labelElement.className = 'nav-label';
    this.labelElement.style.opacity = '0';
    this.labelElement.setAttribute('role', 'status');
    this.labelElement.setAttribute('aria-live', 'polite');

    this.labelTitleEl = this.document.createElement('span');
    this.labelTitleEl.className = 'nav-label__title';
    this.labelBodyEl = this.document.createElement('p');
    this.labelBodyEl.className = 'nav-label__body';

    this.labelElement.appendChild(this.labelTitleEl);
    this.labelElement.appendChild(this.labelBodyEl);
    this.container.appendChild(this.labelElement);
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    this.tweenGroup.update(performance.now());
    if (this.recenterPending && !this.selectionInProgress && !this.hoveredMesh && !this.activeMesh) {
      const recentered = this.recenterAndFrameModel();
      if (recentered) {
        this.recenterPending = false;
      }
    }
    this.updatePulse();
    this.updateLabelPosition();
    this.renderer.render(this.scene, this.camera);
  }

  private updatePulse(): void {
    const elapsed = this.clock.getElapsedTime();
    for (const mesh of this.navMeshes) {
      if (mesh === this.activeMesh || mesh.userData['fixedScale']) {
        continue;
      }

      const baseScale = mesh.userData['baseScale'] as THREE.Vector3;
      if (!baseScale) {
        continue;
      }

      if (mesh === this.hoveredMesh && this.isExploded && !this.selectionInProgress) {
        const amplitude = 0.08;
        const pulse = 1 + amplitude * (0.5 * (Math.sin(elapsed * 3.2) + 1));
        this.scaleVector.set(baseScale.x * pulse, baseScale.y * pulse, baseScale.z * pulse);
        mesh.scale.lerp(this.scaleVector, 0.2);
      } else {
        this.scaleVector.set(baseScale.x, baseScale.y, baseScale.z);
        mesh.scale.lerp(this.scaleVector, 0.25);
      }
    }
  }
}
