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
}

const NAV_TARGETS: Record<string, SectionEvent> = {
  'Body1:1': { key: 'about', label: 'About' },
  'Body1': { key: 'resume', label: 'Resume' },
  'Body1:2': { key: 'wiki', label: 'Wiki' },
  'Body1:3': { key: 'portfolio', label: 'Portfolio' }
};

const CAMERA_PADDING = 1.35;

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
  private cameraDirection = new THREE.Vector3(1, 1, 1).normalize();
  private cameraTarget = new THREE.Vector3();
  private cameraBaseTarget = new THREE.Vector3();
  private baseRadius = 1;
  private sceneRadius = 1;
  private cachedCameraBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
  private tempVector = new THREE.Vector3();
  private tempVector2 = new THREE.Vector3();
  private tempVector3 = new THREE.Vector3();
  private cameraOffset = new THREE.Vector3();
  private cameraRight = new THREE.Vector3();
  private cameraUp = new THREE.Vector3();

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

    const mesh = this.activeMesh;
    this.activeMesh = null;

    if (!mesh) {
      this.setExploded(true);
      return;
    }

    mesh.visible = true;
    mesh.userData['fixedScale'] = true;
    const originalPosition = (mesh.userData['originalPosition'] as THREE.Vector3).clone();
    const baseScale = (mesh.userData['baseScale'] as THREE.Vector3).clone();
    const material = mesh.material as THREE.MeshBasicMaterial;
    const edgeLines = mesh.userData['edgeLines'] as THREE.LineSegments | undefined;
    const edgeMaterial = mesh.userData['edgeMaterial'] as THREE.ShaderMaterial | undefined;

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
      })
      .start();

    this.selectionInProgress = false;
    this.setExploded(true);
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
      .multiplyScalar(safeRadius * 3)
      .add(this.cameraTarget);
    this.camera.position.copy(this.tempVector);
    this.camera.lookAt(this.cameraTarget);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0xffffff, 1);
    this.renderer.setPixelRatio(window.devicePixelRatio);
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

    const aspect = viewWidth / viewHeight;
    if (!Number.isFinite(aspect) || aspect <= 0) {
      return;
    }

    const radius = Math.max(this.sceneRadius, this.baseRadius, 1);
    const fallbackHalf = radius * CAMERA_PADDING;

    let centerX = 0;
    let centerY = 0;
    let halfWidth = fallbackHalf * aspect;
    let halfHeight = fallbackHalf;

    if (this.cachedCameraBounds) {
      const { minX, maxX, minY, maxY } = this.cachedCameraBounds;
      centerX = Number.isFinite(minX) && Number.isFinite(maxX) ? (minX + maxX) / 2 : 0;
      centerY = Number.isFinite(minY) && Number.isFinite(maxY) ? (minY + maxY) / 2 : 0;

      halfWidth = Number.isFinite(maxX - minX)
        ? Math.max((maxX - minX) / 2, 0)
        : fallbackHalf;
      halfHeight = Number.isFinite(maxY - minY)
        ? Math.max((maxY - minY) / 2, 0)
        : fallbackHalf;
      const minHalf = Math.max(fallbackHalf * 1e-3, 1e-4);
      halfWidth = Math.max(halfWidth, minHalf);
      halfHeight = Math.max(halfHeight, minHalf);

      const currentAspect = halfWidth / halfHeight;
      if (currentAspect < aspect) {
        halfWidth = halfHeight * aspect;
      } else if (currentAspect > aspect) {
        halfHeight = halfWidth / aspect;
      }
    }

    this.camera.left = -halfWidth;
    this.camera.right = halfWidth;
    this.camera.top = halfHeight;
    this.camera.bottom = -halfHeight;
    this.camera.updateProjectionMatrix();

    const viewDir = this.tempVector2.copy(this.cameraDirection).multiplyScalar(-1).normalize();
    let upReference = this.tempVector3.set(0, 1, 0);
    if (Math.abs(viewDir.dot(upReference)) > 0.999) {
      upReference = upReference.set(1, 0, 0);
    }

    this.cameraRight.crossVectors(upReference, viewDir);
    if (this.cameraRight.lengthSq() < 1e-6) {
      this.cameraRight.crossVectors(this.tempVector3.set(1, 0, 0), viewDir);
      if (this.cameraRight.lengthSq() < 1e-6) {
        this.cameraRight.crossVectors(this.tempVector3.set(0, 0, 1), viewDir);
      }
    }
    if (this.cameraRight.lengthSq() < 1e-6) {
      this.cameraRight.set(1, 0, 0);
    } else {
      this.cameraRight.normalize();
    }

    this.cameraUp.crossVectors(viewDir, this.cameraRight);
    if (this.cameraUp.lengthSq() < 1e-6) {
      this.cameraUp.copy(upReference).normalize();
    } else {
      this.cameraUp.normalize();
    }

    this.cameraOffset.set(0, 0, 0);
    this.cameraOffset.addScaledVector(this.cameraRight, centerX);
    this.cameraOffset.addScaledVector(this.cameraUp, centerY);

    this.cameraTarget.copy(this.cameraBaseTarget).add(this.cameraOffset);

    const distance = radius * 2.6;
    this.tempVector
      .copy(this.cameraDirection)
      .setLength(distance)
      .add(this.cameraTarget);
    this.camera.position.copy(this.tempVector);
    this.camera.lookAt(this.cameraTarget);
  }

  private recenterAndFrameModel(force = false): void {
    if (!this.model || !this.camera) {
      return;
    }

    if (this.selectionInProgress && !force) {
      return;
    }

    this.model.updateMatrixWorld(true);
    this.boundingBox.setFromObject(this.model);
    if (this.boundingBox.isEmpty()) {
      return;
    }

    this.boundingBox.getBoundingSphere(this.boundingSphere);
    if (
      !Number.isFinite(this.boundingSphere.center.x) ||
      !Number.isFinite(this.boundingSphere.center.y) ||
      !Number.isFinite(this.boundingSphere.center.z)
    ) {
      return;
    }

    if (this.boundingSphere.center.lengthSq() > 1e-6) {
      this.model.position.sub(this.boundingSphere.center);
      this.model.updateMatrixWorld(true);
      this.boundingBox.setFromObject(this.model);
      this.boundingBox.getBoundingSphere(this.boundingSphere);
    }
    if (!Number.isFinite(this.boundingSphere.radius) || this.boundingSphere.radius <= 0) {
      return;
    }

    this.cameraBaseTarget.copy(this.boundingSphere.center);
    this.cameraTarget.copy(this.boundingSphere.center);

    const normalizedRadius = Math.max(this.boundingSphere.radius, 1);
    if (force) {
      this.baseRadius = normalizedRadius;
      this.sceneRadius = normalizedRadius;
    } else {
      this.sceneRadius = Math.max(this.baseRadius, normalizedRadius);
    }

    let nextBounds: { minX: number; maxX: number; minY: number; maxY: number } | null = null;
    this.camera.updateMatrixWorld(true);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    const { min, max } = this.boundingBox;
    for (let ix = 0; ix < 2; ix++) {
      const x = ix === 0 ? min.x : max.x;
      for (let iy = 0; iy < 2; iy++) {
        const y = iy === 0 ? min.y : max.y;
        for (let iz = 0; iz < 2; iz++) {
          const z = iz === 0 ? min.z : max.z;
          this.tempVector2.set(x, y, z).applyMatrix4(this.camera.matrixWorldInverse);
          minX = Math.min(minX, this.tempVector2.x);
          maxX = Math.max(maxX, this.tempVector2.x);
          minY = Math.min(minY, this.tempVector2.y);
          maxY = Math.max(maxY, this.tempVector2.y);
        }
      }
    }

    const fallbackHalf = normalizedRadius * CAMERA_PADDING;
    if (
      Number.isFinite(minX) &&
      Number.isFinite(maxX) &&
      Number.isFinite(minY) &&
      Number.isFinite(maxY)
    ) {
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      let halfWidth = ((maxX - minX) / 2) * CAMERA_PADDING;
      let halfHeight = ((maxY - minY) / 2) * CAMERA_PADDING;

      if (!Number.isFinite(halfWidth) || halfWidth <= 0) {
        halfWidth = fallbackHalf;
      }
      if (!Number.isFinite(halfHeight) || halfHeight <= 0) {
        halfHeight = fallbackHalf;
      }

      nextBounds = {
        minX: centerX - halfWidth,
        maxX: centerX + halfWidth,
        minY: centerY - halfHeight,
        maxY: centerY + halfHeight
      };
    }

    if (nextBounds) {
      this.cachedCameraBounds = nextBounds;
    }

    this.updateCameraFrustum();
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

            const edgesGeometry = new THREE.EdgesGeometry(child.geometry);
            const edgeMaterial = this.createEdgeMaterial();
            const edgeLines = new THREE.LineSegments(edgesGeometry, edgeMaterial);
            child.add(edgeLines);

            child.userData['edgeLines'] = edgeLines;
            child.userData['edgeMaterial'] = edgeMaterial;
            child.userData['originalPosition'] = child.position.clone();
            child.userData['baseScale'] = child.scale.clone();
            child.userData['fixedScale'] = false;

            if (NAV_TARGETS[child.name]) {
              this.navMeshes.push(child);
            }
          }
        });

        this.scene.add(this.model);
        this.prepareExplodeAnimation();

        this.setExploded(true, { immediate: true });
        this.recenterAndFrameModel(true);

        this.setExploded(false, { immediate: true });
        this.setExploded(true);
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

      child.userData['explodedPosition'] = explodedPosition.clone();

      child.userData['tweenExplode'] = new Tween(child.position, this.tweenGroup)
        .to({ x: explodedPosition.x, y: explodedPosition.y, z: explodedPosition.z }, 1000)
        .easing(Easing.Cubic.Out);

      child.userData['tweenImplode'] = new Tween(child.position, this.tweenGroup)
        .to({ x: child.userData['originalPosition'].x, y: child.userData['originalPosition'].y, z: child.userData['originalPosition'].z }, 1000)
        .easing(Easing.Cubic.Out);
    });
  }

  private setExploded(
    desired: boolean,
    options?: { immediate?: boolean; onComplete?: () => void }
  ): void {
    if (!this.model) {
      return;
    }

    if (!options?.immediate && this.isExploded === desired) {
      return;
    }

    let pendingTweens = 0;
    const finalize = () => {
      if (pendingTweens === 0) {
        options?.onComplete?.();
      }
    };

    this.model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const originalPosition = child.userData['originalPosition'] as THREE.Vector3 | undefined;
      const explodedPosition = child.userData['explodedPosition'] as THREE.Vector3 | undefined;
      const targetPosition = desired ? explodedPosition : originalPosition;

      if (!targetPosition) {
        return;
      }

      if (options?.immediate) {
        child.position.copy(targetPosition);
        child.updateMatrixWorld(true);
        return;
      }

      const tweenKey = desired ? 'tweenExplode' : 'tweenImplode';
      const tween: Tween<THREE.Vector3> | undefined = child.userData[tweenKey];
      if (!tween) {
        return;
      }

      pendingTweens++;
      tween.stop();
      tween.onComplete(() => {
        pendingTweens--;
        finalize();
      });
      tween.start();
    });

    this.isExploded = desired;

    if (options?.immediate) {
      this.model.updateMatrixWorld(true);
      options.onComplete?.();
      return;
    }

    if (pendingTweens === 0) {
      finalize();
    }
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
    const material = mesh.material as THREE.MeshBasicMaterial;
    const edgeMaterial = mesh.userData['edgeMaterial'] as THREE.ShaderMaterial | undefined;
    const edgeLines = mesh.userData['edgeLines'] as THREE.LineSegments | undefined;

    this.sectionFocus.emit(config);

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

    if (edgeLines) {
      edgeLines.visible = false;
    }

    new Tween({ opacity: material.opacity }, this.tweenGroup)
      .to({ opacity: 0 }, 650)
      .delay(550)
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
        this.sectionReveal.emit(config);
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

    if (!this.labelElement) {
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

    this.labelElement.textContent = config.label;
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

    this.labelElement.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
  }

  private createLabel(): void {
    this.labelElement = this.document.createElement('div');
    this.labelElement.className = 'nav-label';
    this.labelElement.style.opacity = '0';
    this.container.appendChild(this.labelElement);
  }

  private animate(): void {
    this.animationFrameId = requestAnimationFrame(() => this.animate());

    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    this.tweenGroup.update(performance.now());
    this.recenterAndFrameModel();
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

      const amplitude = mesh === this.hoveredMesh ? 0.06 : 0.03;
      const pulse = 1 + amplitude * Math.sin(elapsed * 2 + mesh.id * 0.5);
      mesh.scale.set(baseScale.x * pulse, baseScale.y * pulse, baseScale.z * pulse);
    }
  }
}
