import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { PortfolioSection } from '../core/models/portfolio-section';
import { PORTFOLIO_SECTIONS } from '../core/data/portfolio-sections';
import { ModelViewerComponent } from '../features/model-viewer/model-viewer.component';

@Component({
  selector: 'app-three-model',
  standalone: true,
  imports: [ModelViewerComponent],
  templateUrl: './three-model.component.html',
  styleUrls: ['./three-model.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ThreeModelComponent {
  /**
   * Sections rendered as hotspots within the Three.js viewer. Defaults to the
   * shared portfolio configuration so existing screens continue to work if no
   * inputs are provided.
   */
  @Input() sections: readonly PortfolioSection[] = PORTFOLIO_SECTIONS;

  /** Optional path to a glTF asset exported from Blender. */
  @Input() modelUrl?: string;

  /** Controls how fast the procedural placeholder rotates (radians/second). */
  @Input() autoRotateSpeed = 0.25;

  /** Emits when a hotspot is activated in the 3D scene. */
  @Output() readonly sectionActivated = new EventEmitter<PortfolioSection>();

  handleSectionActivated(section: PortfolioSection): void {
    this.sectionActivated.emit(section);
  }
}
