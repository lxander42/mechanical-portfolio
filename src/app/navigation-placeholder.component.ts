import { Component } from '@angular/core';

@Component({
  selector: 'app-navigation-placeholder',
  standalone: true,
  template: `
    <p class="sr-only">
      Select a section from the navigation cube to explore the portfolio content.
    </p>
  `
})
export class NavigationPlaceholderComponent {}
