import { CommonModule } from '@angular/common';
import { Component, OnDestroy, ViewChild } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { ThreeModelComponent, SectionEvent } from './three-model/three-model.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, CommonModule, ThreeModelComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnDestroy {
  title = 'mechanical-portfolio';
  todayDate = new Date();
  showContent = false;
  activeSection: SectionEvent['key'] | null = null;
  private suppressNavigationReveal = false;
  private navigationSubscription: Subscription;

  @ViewChild(ThreeModelComponent)
  private threeModel?: ThreeModelComponent;

  constructor(private router: Router) {
    this.navigationSubscription = this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.syncContentWithRoute(event.urlAfterRedirects);
      });

    this.syncContentWithRoute(this.router.url);
  }

  ngOnDestroy(): void {
    this.navigationSubscription?.unsubscribe();
  }

  handleSectionFocus(event: SectionEvent): void {
    this.activeSection = event.key;
    this.showContent = false;
    this.suppressNavigationReveal = true;
    void this.router.navigate(['/', event.key]);
  }

  handleSectionReveal(): void {
    this.suppressNavigationReveal = false;
    this.showContent = true;
  }

  closeContent(): void {
    this.showContent = false;
    this.activeSection = null;
    this.suppressNavigationReveal = false;
    this.threeModel?.resetSelection();
    void this.router.navigate(['/']);
  }

  private syncContentWithRoute(url: string): void {
    if (this.suppressNavigationReveal) {
      return;
    }

    const cleanedUrl = url.split('#')[0]?.split('?')[0] ?? '';
    this.showContent = cleanedUrl.length > 1;
    this.activeSection = this.extractSectionKey(cleanedUrl);
  }

  private extractSectionKey(url: string): SectionEvent['key'] | null {
    const section = url.replace(/^\//, '').split('/')[0] as SectionEvent['key'] | '';
    if (section === 'about' || section === 'resume' || section === 'portfolio' || section === 'wiki') {
      return section;
    }

    return null;
  }
}
