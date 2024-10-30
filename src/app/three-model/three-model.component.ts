import { Component, OnInit, ElementRef, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { ApplicationRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { NgZone } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { DOCUMENT } from '@angular/common';
import * as THREE from 'three';
import { OBJLoader } from 'three-stdlib';
import TWEEN from '@tweenjs/tween.js';


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

  constructor(
    private appRef: ApplicationRef,
    private el: ElementRef,
    private sanitizer: DomSanitizer,
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
      console.log('ngAfterViewInit called in browser');
      this.ngZone.runOutsideAngular(() => {
        this.initScene();
        this.loadModel();
        this.animate();
      });
    }
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
    this.camera.position.set(5, -5, 5); // Position for the opposite corner
    this.camera.lookAt(0, 0, 0); // Keep it pointed at the center of the scene


    // Set renderer background color to Tailwind white
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(0xffffff); // Background color set to white
    this.renderer.setSize(window.innerWidth, window.innerHeight);

    const container = this.el.nativeElement.querySelector('#three-container');
    container.appendChild(this.renderer.domElement);

    // Optional: Add an ambient light for better visibility
    const ambientLight = new THREE.AmbientLight(0x333333, 0.5); // Soft gray light
    this.scene.add(ambientLight);
  }




  private loadModel(): void {
    const loader = new OBJLoader();
    const modelPath = `${this.document.location.origin}/assets/model.obj`;

    loader.load(
      modelPath,
      (obj) => {
        console.log("Model loaded successfully!");
        this.model = obj;

        // Scale the model down for consistency
        this.model.scale.set(-0.25, -0.25, -0.25);
        // Center the model based on its bounding box
        const box = new THREE.Box3().setFromObject(this.model);
        const center = box.getCenter(new THREE.Vector3());
        this.model.position.sub(center); // Center the model at (0, 0, 0)



        // Traverse each mesh and add only the edges with specific positioning/scaling
        this.model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const edgesGeometry = new THREE.EdgesGeometry(child.geometry);

            // Material with depth testing for visible edges only
            const lineMaterial = new THREE.LineBasicMaterial({
              color: 0x333333,
              transparent: true,
              opacity: 0.6,
              depthTest: true,
            });

            const edgeLines = new THREE.LineSegments(edgesGeometry, lineMaterial);

            // Explicitly set position and scale for each edge
            edgeLines.position.copy(this.model.position);
            edgeLines.scale.copy(this.model.scale);
            this.scene.add(edgeLines); // Add edges only to the scene
          }
        });

        console.log('Model center:', center);
        console.log('Model position after centering:', this.model.position);
        console.log('Model scale:', this.model.scale);

        this.prepareExplodeAnimation();
      },
      undefined,
      (error) => {
        console.error("An error occurred loading the model:", error);
      }
    );
  }




  private animate(): void {
    if (typeof window === 'undefined') {
      return; // Exit if not running in a browser environment
    }
    requestAnimationFrame(() => this.animate());
    TWEEN.update();
    this.renderer.render(this.scene, this.camera);
  }


  private prepareExplodeAnimation(): void {
    this.model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Store original position for resetting
        child.userData['originalPosition'] = child.position.clone();

        // Set up exploded positions (customize these based on your layout)
        const explodedPosition = child.position.clone().add(new THREE.Vector3(0.5, 0.5, 0)); // Adjust as needed

        // Set up tween for hover explosion effect
        child.userData['tweenExplode'] = new TWEEN.Tween(child.position)
          .to({ x: explodedPosition.x, y: explodedPosition.y, z: explodedPosition.z }, 1000)
          .easing(TWEEN.Easing.Cubic.Out);

        child.userData['tweenImplode'] = new TWEEN.Tween(child.position)
          .to({ x: child.userData['originalPosition'].x, y: child.userData['originalPosition'].y, z: child.userData['originalPosition'].z }, 1000)
          .easing(TWEEN.Easing.Cubic.Out);
      }
    });
  }

}

