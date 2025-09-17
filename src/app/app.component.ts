import { CommonModule } from '@angular/common';
import { Component, ViewChild } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { ThreeModelComponent, SectionEvent } from './three-model/three-model.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, ThreeModelComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'mechanical-portfolio';
  todayDate = new Date();
  showContent = false;
  activeSection: SectionEvent['key'] | null = null;

  @ViewChild(ThreeModelComponent)
  private threeModel?: ThreeModelComponent;

  constructor(private router: Router) {}

  handleSectionFocus(event: SectionEvent): void {
    this.activeSection = event.key;
    this.showContent = false;
    void this.router.navigate(['/', event.key]);
  }

  handleSectionReveal(): void {
    this.showContent = true;
  }

  closeContent(): void {
    this.showContent = false;
    this.activeSection = null;
    this.threeModel?.resetSelection();
  }
}
