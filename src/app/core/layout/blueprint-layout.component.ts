import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PORTFOLIO_SECTIONS } from '../data/portfolio-sections';
import { PortfolioSection } from '../models/portfolio-section';
import { ModelViewerComponent } from '../../features/model-viewer/model-viewer.component';

@Component({
  selector: 'app-blueprint-layout',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, ModelViewerComponent],
  templateUrl: './blueprint-layout.component.html',
  styleUrls: ['./blueprint-layout.component.css']
})
export class BlueprintLayoutComponent {
  protected readonly sections = PORTFOLIO_SECTIONS;
  protected readonly today = new Date();

  protected readonly rowLabelsDesktop = ['A', 'B', 'C', 'D', 'E', 'F'];
  protected readonly rowLabelsMobile = ['A', 'B', 'C', 'D'];
  protected readonly columnLabelsDesktop = ['1', '2', '3', '4', '5', '6', '7', '8'];
  protected readonly columnLabelsMobile = ['1', '2', '3', '4'];

  constructor(private readonly router: Router) {}

  handleSectionActivated(section: PortfolioSection): void {
    void this.router.navigateByUrl(section.route);
  }
}
