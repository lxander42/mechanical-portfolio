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
  private modelGroup!: THREE.Group;
  private modelCenter = new THREE.Vector3();
  private modelRadius = 1;
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
    if (!this.modelGroup) {
      return;
    }

    const mesh = this.activeMesh;
    this.activeMesh = null;
    this.hoveredMesh = null;
    this.updateHoverAppearance();

    if (!mesh) {
      this.setExploded(false);
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
    this.setExploded(false);
  }

  private initScene(): void {
    this.scene = new THREE.Scene();

    const aspect = this.el.nativeElement.clientWidth / this.el.nativeElement.clientHeight || 1;
    const frustumSize = 10;
    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );

    this.camera.position.set(5, 5, 5);
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

    this.renderer.setSize(width, height, false);

    const frustumSize = 10;
    const aspect = width / height;
    this.camera.left = (-frustumSize * aspect) / 2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
    if (this.modelGroup) {
      const cameraOffset = this.computeCameraOffset(this.modelRadius);
      this.camera.position.copy(this.modelCenter).add(cameraOffset);
    }
    this.camera.lookAt(this.modelCenter);
  }

  private loadModel(): void {
    const loader = new OBJLoader();
    const modelPath = 'assets/model.obj';

    loader.load(
      modelPath,
      (obj) => {
        this.modelGroup = new THREE.Group();
        this.modelGroup.add(obj);
        this.modelGroup.rotation.z = Math.PI / 2;
        this.modelGroup.scale.set(0.25, 0.25, 0.25);

        this.scene.add(this.modelGroup);

        this.recenterModel();

        this.navMeshes = [];

        this.modelGroup.traverse((child) => {
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

        this.prepareExplodeAnimation();
      },
      undefined,
      (error) => {
        console.error('An error occurred loading the model:', error);
      }
    );
  }

  private recenterModel(): void {
    if (!this.modelGroup) {
      return;
    }

    this.modelGroup.updateMatrixWorld(true);

    const { box: initialNavBounds, hasBounds: hasInitialNavBounds } = this.computeNavBounds();
    const boxToCenter = hasInitialNavBounds
      ? initialNavBounds
      : new THREE.Box3().setFromObject(this.modelGroup);
    const center = boxToCenter.getCenter(new THREE.Vector3());

    this.modelGroup.position.copy(center).multiplyScalar(-1);
    this.modelGroup.updateMatrixWorld(true);

    const { box: finalNavBounds, hasBounds: hasFinalNavBounds } = this.computeNavBounds();
    const framingBox = hasFinalNavBounds
      ? finalNavBounds
      : new THREE.Box3().setFromObject(this.modelGroup);
    const boundingSphere = framingBox.getBoundingSphere(new THREE.Sphere());

    this.modelCenter.copy(framingBox.getCenter(new THREE.Vector3()));
    this.modelRadius = Math.max(boundingSphere.radius, 1);

    const cameraOffset = this.computeCameraOffset(this.modelRadius);
    this.camera.position.copy(this.modelCenter).add(cameraOffset);
    this.camera.lookAt(this.modelCenter);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
  }

  private computeNavBounds(): { box: THREE.Box3; hasBounds: boolean } {
    const box = new THREE.Box3();
    let hasBounds = false;

    this.modelGroup.traverse((child) => {
      if (!(child instanceof THREE.Mesh) || !NAV_TARGETS[child.name]) {
        return;
      }

      const childBox = new THREE.Box3().setFromObject(child);
      if (!hasBounds) {
        box.copy(childBox);
        hasBounds = true;
      } else {
        box.union(childBox);
      }
    });

    return { box, hasBounds };
  }

  private computeCameraOffset(radius: number): THREE.Vector3 {
    const distance = Math.max(radius * 2.6, 10);
    const viewDirection = new THREE.Vector3(1.6, 1.25, 1.45).normalize();
    return viewDirection.multiplyScalar(distance);
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
    if (!this.modelGroup) {
      return;
    }

    this.modelGroup.traverse((child) => {
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
    if (!this.modelGroup || this.isExploded === desired) {
      return;
    }

    this.modelGroup.traverse((child) => {
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

  private attachPointerEvents(): void {
    if (!this.canvasEl) {
      return;
    }

    const moveHandler = (event: PointerEvent) => this.handlePointerMove(event);
    const leaveHandler = () => this.handlePointerLeave();
    const clickHandler = (event: MouseEvent | PointerEvent) => this.handlePointerClick(event);

    this.canvasEl.addEventListener('pointermove', moveHandler);
    this.canvasEl.addEventListener('pointerleave', leaveHandler);
    this.canvasEl.addEventListener('click', clickHandler);

    this.detachFns.push(() => this.canvasEl.removeEventListener('pointermove', moveHandler));
    this.detachFns.push(() => this.canvasEl.removeEventListener('pointerleave', leaveHandler));
    this.detachFns.push(() => this.canvasEl.removeEventListener('click', clickHandler));
  }

  private handlePointerMove(event: PointerEvent): void {
    if (!this.modelGroup || this.selectionInProgress) {
      return;
    }

    if (!this.isExploded) {
      this.setExploded(true);
      this.hoveredMesh = null;
    }

    const mesh = this.getMeshFromPointer(event.clientX, event.clientY);

    if (mesh !== this.hoveredMesh) {
      this.hoveredMesh = mesh;
      this.updateHoverAppearance();
    }
  }

  private handlePointerLeave(): void {
    if (this.hoveredMesh) {
      this.hoveredMesh = null;
      this.updateHoverAppearance();
    }

    if (!this.selectionInProgress) {
      this.setExploded(false);
    }
  }

  private handlePointerClick(event: MouseEvent | PointerEvent): void {
    if (this.selectionInProgress) {
      return;
    }

    const mesh = this.getMeshFromPointer(event.clientX, event.clientY);

    if (!this.isExploded) {
      this.setExploded(true);
      this.hoveredMesh = mesh;
      this.updateHoverAppearance();
      return;
    }

    this.hoveredMesh = mesh;
    this.updateHoverAppearance();

    if (!this.hoveredMesh) {
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
    const targetWorld = this.modelCenter.clone().add(new THREE.Vector3(0, 0, 2.5));
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

  private getMeshFromPointer(clientX: number, clientY: number): THREE.Mesh | null {
    if (!this.canvasEl) {
      return null;
    }

    const rect = this.canvasEl.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return null;
    }

    this.mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);
    const intersections = this.raycaster.intersectObjects(this.navMeshes, false);
    return intersections.length > 0 ? (intersections[0].object as THREE.Mesh) : null;
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
