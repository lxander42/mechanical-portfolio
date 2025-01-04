import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { AppComponent } from './app/app.component';
import { RouterModule } from '@angular/router';  // Import RouterModule
import { routes } from './app/app.routes';  // Import routes from app.routes.ts
import { importProvidersFrom } from '@angular/core';  // Import importProvidersFrom

// Pass RouterModule with routes to bootstrapApplication
bootstrapApplication(AppComponent, {
  providers: [
    importProvidersFrom(RouterModule.forRoot(routes))  // Use importProvidersFrom
  ]
})
  .catch((err) => console.error(err));
