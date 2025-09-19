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
  private modelCenter = new THREE.Vector3();
  private cameraDirection = new THREE.Vector3(1, 1, 1).normalize();
  private sceneRadius = 1;
  private tempVector = new THREE.Vector3();
  private hasCenteredModel = false;

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
      const needsRestore = this.navMeshes.some((candidate) => {
        const candidateMaterial = candidate.material as THREE.MeshBasicMaterial;
        return !candidate.visible || candidateMaterial.opacity < 0.99;
      });

      if (needsRestore) {
        this.restoreOtherMeshes();
      }

      this.setExploded(true);
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

    if (baseRotation) {
      mesh.rotation.copy(baseRotation);
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
      })
      .start();

    this.restoreOtherMeshes(mesh);

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
      .multiplyScalar(safeRadius * 3);
    this.camera.position.copy(this.tempVector);
    this.camera.lookAt(0, 0, 0);

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

    const side = Math.min(width, height);
    this.renderer.setSize(side, side, false);

    const canvas = this.renderer.domElement;
    canvas.style.width = `${side}px`;
    canvas.style.height = `${side}px`;

    this.updateCameraFrustum(side, side);
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
    const padding = 1.35;
    const halfSize = radius * padding;

    this.camera.left = -halfSize * aspect;
    this.camera.right = halfSize * aspect;
    this.camera.top = halfSize;
    this.camera.bottom = -halfSize;
    this.camera.updateProjectionMatrix();

    const distance = radius * 2.6;
    this.tempVector.copy(this.cameraDirection).multiplyScalar(distance);
    this.camera.position.copy(this.tempVector);
    this.camera.lookAt(0, 0, 0);
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

    const shouldCenter = force || !this.hasCenteredModel;
    this.boundingBox.getCenter(this.modelCenter);
    if (
      !Number.isFinite(this.modelCenter.x) ||
      !Number.isFinite(this.modelCenter.y) ||
      !Number.isFinite(this.modelCenter.z)
    ) {
      return;
    }

    if (shouldCenter && this.modelCenter.lengthSq() > 1e-6) {
      this.model.position.sub(this.modelCenter);
      this.model.updateMatrixWorld(true);
      this.hasCenteredModel = true;
    }

    this.boundingBox.setFromObject(this.model);
    this.boundingBox.getBoundingSphere(this.boundingSphere);
    if (!Number.isFinite(this.boundingSphere.radius) || this.boundingSphere.radius <= 0) {
      return;
    }

    const normalizedRadius = Math.max(this.boundingSphere.radius, 1);
    if (force) {
      this.sceneRadius = normalizedRadius;
    } else {
      this.sceneRadius = Math.max(this.sceneRadius, normalizedRadius);
    }

    this.updateCameraFrustum();
  }

  private refreshSceneRadiusFromMeshes(): void {
    if (!this.model) {
      return;
    }

    this.model.updateMatrixWorld(true);

    let maxRadius = 0;

    this.model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const baseScale = child.userData['baseScale'] as THREE.Vector3 | undefined;
      if (!baseScale) {
        return;
      }

      if (!child.geometry.boundingSphere) {
        child.geometry.computeBoundingSphere();
      }

      const geometryRadius = (child.geometry.boundingSphere?.radius ?? 0) * baseScale.x;
      const parent = child.parent as THREE.Object3D | null;

      const positions: THREE.Vector3[] = [];
      positions.push(child.getWorldPosition(new THREE.Vector3()));

      const originalPosition = child.userData['originalPosition'] as THREE.Vector3 | undefined;
      if (originalPosition) {
        const originalWorld = parent?.localToWorld(originalPosition.clone()) ?? originalPosition.clone();
        positions.push(originalWorld);
      }

      const explodedPosition = child.userData['explodedPosition'] as THREE.Vector3 | undefined;
      if (explodedPosition) {
        const explodedWorld = parent?.localToWorld(explodedPosition.clone()) ?? explodedPosition.clone();
        positions.push(explodedWorld);
      }

      for (const position of positions) {
        const distance = position.length() + geometryRadius;
        if (Number.isFinite(distance)) {
          maxRadius = Math.max(maxRadius, distance);
        }
      }
    });

    if (maxRadius > 0) {
      this.sceneRadius = Math.max(1, maxRadius * 1.08);
      this.updateCameraFrustum();
    }
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
        this.hasCenteredModel = false;

        this.navMeshes = [];

        this.model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
            child.material = material;

            child.geometry.computeBoundingBox();
            child.geometry.computeBoundingSphere();

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

            if (NAV_TARGETS[child.name]) {
              this.navMeshes.push(child);
            }
          }
        });

        this.scene.add(this.model);
        this.recenterAndFrameModel(true);
        this.prepareExplodeAnimation();
        this.refreshSceneRadiusFromMeshes();
        this.setExploded(true);
        this.refreshSceneRadiusFromMeshes();
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
  }

  private fadeOtherMeshesExcept(selected: THREE.Mesh): void {
    for (const mesh of this.navMeshes) {
      if (mesh === selected) {
        continue;
      }

      const material = mesh.material as THREE.MeshBasicMaterial;
      const baseScale = mesh.userData['baseScale'] as THREE.Vector3 | undefined;
      const edgeMaterial = mesh.userData['edgeMaterial'] as THREE.ShaderMaterial | undefined;
      const edgeLines = mesh.userData['edgeLines'] as THREE.LineSegments | undefined;

      mesh.userData['fixedScale'] = true;

      const fadeData = { opacity: material.opacity };
      new Tween(fadeData, this.tweenGroup)
        .to({ opacity: 0 }, 420)
        .easing(Easing.Cubic.In)
        .onUpdate(({ opacity }) => {
          material.opacity = opacity;
          if (edgeMaterial) {
            edgeMaterial.uniforms['lineOpacity'].value = opacity;
          }
        })
        .onComplete(() => {
          material.opacity = 0;
          if (edgeMaterial) {
            edgeMaterial.uniforms['lineOpacity'].value = 0;
          }
          if (baseScale) {
            mesh.scale.copy(baseScale);
          }
          if (edgeLines) {
            edgeLines.visible = false;
          }
          mesh.visible = false;
        })
        .start();
    }
  }

  private restoreOtherMeshes(exclude?: THREE.Mesh | null): void {
    for (const mesh of this.navMeshes) {
      if (mesh === exclude) {
        continue;
      }

      const material = mesh.material as THREE.MeshBasicMaterial;
      const baseScale = mesh.userData['baseScale'] as THREE.Vector3 | undefined;
      const baseRotation = mesh.userData['baseRotation'] as THREE.Euler | undefined;
      const edgeMaterial = mesh.userData['edgeMaterial'] as THREE.ShaderMaterial | undefined;
      const edgeLines = mesh.userData['edgeLines'] as THREE.LineSegments | undefined;

      mesh.visible = true;
      mesh.userData['fixedScale'] = false;

      if (baseScale) {
        mesh.scale.copy(baseScale);
      }

      if (baseRotation) {
        mesh.rotation.copy(baseRotation);
      }

      if (edgeLines) {
        edgeLines.visible = true;
      }

      material.opacity = 0;
      if (edgeMaterial) {
        edgeMaterial.uniforms['lineOpacity'].value = 0;
      }

      const fadeData = { opacity: 0 };
      new Tween(fadeData, this.tweenGroup)
        .to({ opacity: 1 }, 480)
        .delay(180)
        .easing(Easing.Cubic.Out)
        .onUpdate(({ opacity }) => {
          material.opacity = opacity;
          if (edgeMaterial) {
            edgeMaterial.uniforms['lineOpacity'].value = opacity;
          }
        })
        .start();
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
    const targetWorld = new THREE.Vector3(0, 0, this.sceneRadius * 0.25);
    const targetPosition = parent.worldToLocal(targetWorld.clone());
    const baseScale = mesh.userData['baseScale'] as THREE.Vector3;
    const material = mesh.material as THREE.MeshBasicMaterial;
    const edgeMaterial = mesh.userData['edgeMaterial'] as THREE.ShaderMaterial | undefined;
    const edgeLines = mesh.userData['edgeLines'] as THREE.LineSegments | undefined;

    this.fadeOtherMeshesExcept(mesh);

    this.sectionFocus.emit(config);

    new Tween(mesh.position, this.tweenGroup)
      .to({ x: targetPosition.x, y: targetPosition.y, z: targetPosition.z }, 850)
      .easing(Easing.Cubic.Out)
      .start();

    const scaleData = { value: 1 };
    new Tween(scaleData, this.tweenGroup)
      .to({ value: 1.85 }, 700)
      .easing(Easing.Cubic.Out)
      .onUpdate(({ value }) => {
        mesh.scale.set(baseScale.x * value, baseScale.y * value, baseScale.z * value);
      })
      .start();

    const rotationData = { angle: mesh.rotation.y };
    new Tween(rotationData, this.tweenGroup)
      .to({ angle: mesh.rotation.y + Math.PI * 2 }, 900)
      .easing(Easing.Cubic.Out)
      .onUpdate(({ angle }) => {
        mesh.rotation.y = angle;
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

    if (!this.hoveredMesh || this.selectionInProgress) {
      this.labelElement.style.opacity = '0';
      return;
    }

    const config = NAV_TARGETS[this.hoveredMesh.name];
    if (!config) {
      this.labelElement.style.opacity = '0';
      return;
    }

    this.labelElement.textContent = `Navigate: ${config.label}`;
    this.labelElement.style.opacity = '1';
  }

  private updateLabelPosition(): void {
    if (!this.hoveredMesh || !this.labelElement || !this.hoveredMesh.visible || this.selectionInProgress) {
      return;
    }

    const vector = new THREE.Vector3();
    this.hoveredMesh.getWorldPosition(vector);
    vector.project(this.camera);

    const rect = this.canvasEl.getBoundingClientRect();
    const x = ((vector.x + 1) / 2) * rect.width;
    const y = ((-vector.y + 1) / 2) * rect.height;

    const isVisible = parseFloat(this.labelElement.style.opacity || '0') > 0.5;
    const scale = isVisible ? ' scale(1.02)' : '';
    this.labelElement.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)${scale}`;
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
    this.updatePulse();
    this.updateLabelPosition();
    this.renderer.render(this.scene, this.camera);
  }

  private updatePulse(): void {
    const elapsed = this.clock.getElapsedTime();
    for (const mesh of this.navMeshes) {
      if (!mesh.visible || mesh.userData['fixedScale']) {
        continue;
      }

      const baseScale = mesh.userData['baseScale'] as THREE.Vector3;
      if (!baseScale) {
        continue;
      }

      if (mesh === this.hoveredMesh && this.isExploded && !this.selectionInProgress) {
        const pulse = 1 + 0.08 * Math.sin(elapsed * 3);
        mesh.scale.set(baseScale.x * pulse, baseScale.y * pulse, baseScale.z * pulse);
      } else {
        mesh.scale.copy(baseScale);
      }
    }
  }
}
