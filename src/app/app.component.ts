import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common'; // Import CommonModule
import { ThreeModelComponent } from './three-model/three-model.component'; // Import the component
import { RouterModule } from '@angular/router';  // Import RouterModule

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet,CommonModule,ThreeModelComponent,RouterModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'mechanical-portfolio';
  todayDate = new Date();  // Initialize the current date
}
