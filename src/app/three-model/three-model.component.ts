import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { AfterViewInit, ApplicationRef, Component, ElementRef, Inject, NgZone, OnInit, PLATFORM_ID } from '@angular/core';
import * as THREE from 'three';
import { OBJLoader } from 'three-stdlib';
import { Tween, Group, Easing } from '@tweenjs/tween.js';

@Component({
  selector: 'app-three-model',
  standalone: true, // This marks it as a standalone component
  templateUrl: './three-model.component.html',
  styleUrls: ['./three-model.component.css']
})
export class ThreeModelComponent implements OnInit, AfterViewInit {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera | THREE.OrthographicCamera;
  private renderer!: THREE.WebGLRenderer;
  private model!: THREE.Object3D;
  private customLineMaterial!: THREE.ShaderMaterial;
  private isExploded = false;
  private tweenGroup = new Group(); // Create a new Group for tweens

  constructor(
    private appRef: ApplicationRef,
    private el: ElementRef,
    private ngZone: NgZone,
    @Inject(DOCUMENT) private document: Document,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.appRef.isStable.subscribe((isStable) => {
      console.log(`Application is stable: ${isStable}`);
    });
  }

  ngOnInit(): void {
    console.log('ngOnInit called');
  }

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.ngZone.runOutsideAngular(() => {
        this.initScene();
        this.loadModel();
        this.animate();
      });
    }
    this.onWindowResize();

    // Attach toggleExplode to the container’s click event
    const container = this.el.nativeElement.querySelector('#three-container');
    container.addEventListener('click', () => this.toggleExplode());
  }


  private initScene(): void {
    if (typeof window === 'undefined') {
      return; // Exit if window is not defined (e.g., in SSR)
    }

    this.scene = new THREE.Scene();

    // Orthographic Camera setup
    const aspect = window.innerWidth / window.innerHeight;
    const frustumSize = 10;
    this.camera = new THREE.OrthographicCamera(
      frustumSize * aspect / -2,
      frustumSize * aspect / 2,
      frustumSize / 2,
      frustumSize / -2,
      0.1,
      1000
    );

    // Position the camera for an isometric view
    this.camera.position.set(5, 5, 5); // Position for the opposite corner
    this.camera.lookAt(0, 0, 0); // Keep it pointed at the center of the scene

    // Set renderer background color to Tailwind white
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(0xffffff); // Background color set to white
    this.renderer.setSize(this.el.nativeElement.clientWidth * 0.25, this.el.nativeElement.clientHeight * 0.25);

    const container = this.el.nativeElement.querySelector('#three-container');
    container.appendChild(this.renderer.domElement);

    // Optional: Add an ambient light for better visibility
    const ambientLight = new THREE.AmbientLight(0x333333, 0.5); // Soft gray light
    this.scene.add(ambientLight);

    window.addEventListener('resize', this.onWindowResize.bind(this));

    this.customLineMaterial = new THREE.ShaderMaterial({
      uniforms: {
        lineColor: { value: new THREE.Color(0x000000) },
        scaleFactor: { value: 1.005 } // Controls the scale for boldness
      },
      vertexShader: `
        uniform float scaleFactor;
        void main() {
          vec4 pos = modelViewMatrix * vec4(position * scaleFactor, 1.0);
          pos.z -= 0.001; // Depth bias to bring edges slightly forward
          gl_Position = projectionMatrix * pos;
        }
      `,
      fragmentShader: `
        uniform vec3 lineColor;
        void main() {
          gl_FragColor = vec4(lineColor, 1.0);
        }
      `,
      depthTest: true,
      depthWrite: false,
      transparent: true
    });
  }

  private onWindowResize(): void {
    if (!this.renderer) {
      return;
    }

    const container = this.el.nativeElement.querySelector('#three-container');
    const size = Math.min(container.clientWidth, container.clientHeight);
    this.renderer.setSize(size, size);

    if (this.camera instanceof THREE.PerspectiveCamera) {
      this.camera.aspect = 1;
      this.camera.updateProjectionMatrix();
    } else if (this.camera instanceof THREE.OrthographicCamera) {
      const frustumSize = 10;
      this.camera.left = frustumSize / -2;
      this.camera.right = frustumSize / 2;
      this.camera.top = frustumSize / 2;
      this.camera.bottom = frustumSize / -2;
      this.camera.updateProjectionMatrix();
    }
  }

  private loadModel(): void {
    const loader = new OBJLoader();
    const modelPath = `${this.document.location.origin}/assets/model.obj`;

    loader.load(
      modelPath,
      (obj) => {
        console.log("Model loaded successfully!");
        this.model = obj;
        this.model.rotation.z = Math.PI / 2;

        this.model.scale.set(0.25, 0.25, 0.25);
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        this.model.position.sub(center);

        this.model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.material = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

            const edgesGeometry = new THREE.EdgesGeometry(child.geometry);
            const edgeLines = new THREE.LineSegments(edgesGeometry, this.customLineMaterial);
            child.add(edgeLines);
          }
        });

        this.scene.add(this.model);
        this.prepareExplodeAnimation();

      },
      undefined,
      (error) => {
        console.error("An error occurred loading the model:", error);
      }
    );
  }



  private animate(): void {
    requestAnimationFrame(() => this.animate());
    this.tweenGroup.update(performance.now());  // Update the group with the current time
    this.renderer.render(this.scene, this.camera);
  }



  private prepareExplodeAnimation(): void {
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Skip the large part ("Body1:1") and only set up explosion for smaller parts
        if (child.name === 'Body1:1') {
          console.log(`Skipping explosion setup for large part: ${child.name}`);
          return;
        }

        console.log(`Setting up explosion for small part: ${child.name}`);
        child.userData['originalPosition'] = child.position.clone();

        // Define explosion direction for each smaller part
        let explodedPosition;
        switch (child.name) {
          case 'Body1':
            explodedPosition = child.position.clone().add(new THREE.Vector3(0, 0, 12)); // Move along x-axis
            break;
          case 'Body1:2':
            explodedPosition = child.position.clone().add(new THREE.Vector3(12, 0, 0)); // Move along y-axis
            break;
          case 'Body1:3':
            explodedPosition = child.position.clone().add(new THREE.Vector3(0, -12, 0)); // Move along z-axis
            break;
          default:
            explodedPosition = child.position.clone(); // Fallback, no movement
        }

        // Create tweens for the explosion and implosion
        child.userData['tweenExplode'] = new Tween(child.position, this.tweenGroup)
          .to({ x: explodedPosition.x, y: explodedPosition.y, z: explodedPosition.z }, 1000)
          .easing(Easing.Cubic.Out);

        child.userData['tweenImplode'] = new Tween(child.position, this.tweenGroup)
          .to({ x: child.userData['originalPosition'].x, y: child.userData['originalPosition'].y, z: child.userData['originalPosition'].z }, 1000)
          .easing(Easing.Cubic.Out);
      }
    });
  }






  private toggleExplode(): void {
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh && child.userData['tweenExplode'] && child.userData['tweenImplode']) {
        if (!this.isExploded) {
          child.userData['tweenExplode'].start();
        } else {
          child.userData['tweenImplode'].start();
        }
      }
    });
    this.isExploded = !this.isExploded; // Toggle the explosion state
  }

}
