import { Component } from '@angular/core';
import { BlueprintLayoutComponent } from './core/layout/blueprint-layout.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BlueprintLayoutComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'mechanical-portfolio';
}
