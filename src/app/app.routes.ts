import { Routes } from '@angular/router';
import { AboutComponent } from './about/about.component';
import { NavigationPlaceholderComponent } from './navigation-placeholder.component';
import { PortfolioComponent } from './portfolio/portfolio.component';
import { ResumeComponent } from './resume/resume.component';
import { WikiComponent } from './wiki/wiki.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: NavigationPlaceholderComponent },
  { path: 'about', component: AboutComponent },
  { path: 'resume', component: ResumeComponent },
  { path: 'portfolio', component: PortfolioComponent },
  { path: 'wiki', component: WikiComponent },
  { path: '**', redirectTo: '' }
];

